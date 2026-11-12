import "server-only";

import { deriveGndFromNatureza } from "@/lib/catalog-fiscal";
import {
  buildCatalogExpertTaxonomy,
  buildCatalogExpertNodeKey,
  getCatalogExpertNodeDepth,
  parseCatalogExpertNodeKey,
  type CatalogExpertNode,
} from "@/lib/catalog-expert";

const CATALOG_EXPERT_SELECT_COLUMNS =
  "id,codigo_efisco,descricao,tipo,categoria,grupo,classe,tipo_objeto,codigo_grupo,nome_grupo,codigo_classe,nome_classe,codigo_material_servico,nome_material_servico,codigo_natureza_preferencial,gnd_preferencial,natureza_count,has_mixed_expense_classes,has_missing_natureza,gnds,naturezas,unidade_medida";
const CATALOG_EXPERT_TAXONOMY_COLUMNS =
  "id,tipo_objeto,codigo_grupo,nome_grupo,codigo_classe,nome_classe,gnd_preferencial,gnds,codigo_natureza_preferencial";
const CATALOG_EXPERT_CHUNK_SIZE = 1_000;
const CATALOG_EXPERT_CONCURRENCY = 8;
const CATALOG_EXPERT_CACHE_TTL_MS = 10 * 60 * 1_000;

type SupabaseLike = {
  from: (table: string) => any;
};

type CatalogExpertCache = {
  expiresAt: number;
  taxonomy: CatalogExpertNode;
};

let catalogExpertCache: CatalogExpertCache | null = null;
const lazyChildrenCache = new Map<string, { expiresAt: number; children: CatalogExpertNode[] }>();

function normalizeCode(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTipoObjeto(value: unknown): "material" | "servico" | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (["servico", "servicos"].includes(normalized)) return "servico";
  if (["material", "materiais", "produto", "produtos"].includes(normalized)) {
    return "material";
  }
  return null;
}

function compactDescription(value: string, maxLength = 122): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function getGndLabel(gnd: string) {
  if (gnd === "3") return "3 - Custeio";
  if (gnd === "4") return "4 - Capital";
  if (gnd === "5") return "5 - Transferências";
  return "Sem GND";
}

function getGndBucket(value: unknown) {
  const digit = String(value || "").match(/\d/)?.[0] || "";
  if (digit === "3" || digit === "4" || digit === "5") return digit;
  return "sem-gnd";
}

function withCodeLabel(code: unknown, label: unknown, fallback: string) {
  const normalizedCode = String(code || "").trim();
  const normalizedLabel = String(label || "").replace(/\s+/g, " ").trim() || fallback;
  return normalizedCode ? `${normalizedCode} - ${normalizedLabel}` : normalizedLabel;
}

function makeNode(key: string, label: string, count: number, hasMoreChildren = false): CatalogExpertNode {
  return { key, label, count, children: [], hasMoreChildren };
}

export function mapCatalogExpertRowToProduct(row: any, index = 0) {
  const normalizedCode =
    normalizeCode(row.codigo_efisco) ??
    normalizeCode(row.codigo_tce) ??
    normalizeCode(row.id) ??
    `CUSTOM-${index + 1}`;
  const codigoNatureza =
    row.codigo_natureza_preferencial || row.codigo_natureza_despesa || null;
  const gnd =
    row.gnd_preferencial ||
    row.gnd ||
    row.gnd_derivado ||
    deriveGndFromNatureza(codigoNatureza) ||
    "";
  const description = String(row.descricao || "Descrição não informada");

  return {
    efisco_item_id: row.efisco_item_id || row.id,
    efisco_item_natureza_id: row.efisco_item_natureza_id,
    efiscoCode: normalizedCode,
    id: String(row.id ?? normalizedCode),
    siad: normalizedCode,
    siadLabel: normalizedCode,
    name: description,
    summary: compactDescription(description),
    classe: String(
      row.nome_classe || row.classe || row.nome_grupo || row.grupo || "Sem Classe Informada",
    ),
    gnd,
    unidade_medida: String(row.unidade_medida || "UN"),
    category:
      normalizeTipoObjeto(row.tipo_objeto || row.tipo || row.categoria) === "servico"
        ? "Serviço"
        : "Material",
    tipo_objeto: row.tipo_objeto,
    codigo_grupo: row.codigo_grupo,
    nome_grupo: row.nome_grupo || row.grupo,
    codigo_classe: row.codigo_classe,
    nome_classe: row.nome_classe || row.classe,
    codigo_material_servico: row.codigo_material_servico,
    nome_material_servico: row.nome_material_servico,
    codigo_natureza_despesa: codigoNatureza,
    natureza_count: Number(row.natureza_count || 0),
    has_mixed_expense_classes: Boolean(row.has_mixed_expense_classes),
    has_missing_natureza: Boolean(row.has_missing_natureza),
    gnds: Array.isArray(row.gnds) ? row.gnds : [],
    naturezas: Array.isArray(row.naturezas) ? row.naturezas : [],
    rank: Number(row.rank || 0),
  };
}

export async function loadCatalogExpertDataset(supabaseLike: SupabaseLike) {
  const now = Date.now();
  if (catalogExpertCache && catalogExpertCache.expiresAt > now) {
    return catalogExpertCache;
  }

  const { count, error: countError } = await supabaseLike
    .from("catalogo_efisco_v2")
    .select("id", { count: "exact", head: true });

  if (countError) {
    console.error("Catalog expert count failed.", {
      code: countError.code,
      message: countError.message,
      details: countError.details,
    });
  }

  const fetchRange = async (from: number) => {
    const to = from + CATALOG_EXPERT_CHUNK_SIZE - 1;
    const { data, error } = await supabaseLike
      .from("catalogo_efisco_v2")
      .select(CATALOG_EXPERT_TAXONOMY_COLUMNS)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      console.error("Catalog expert dataset failed.", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      throw error;
    }

    const chunk = Array.isArray(data) ? data : [];
    return chunk;
  };

  const rows: any[] = [];

  if (Number.isFinite(Number(count)) && Number(count) > 0) {
    const ranges = Array.from(
      { length: Math.ceil(Number(count) / CATALOG_EXPERT_CHUNK_SIZE) },
      (_, index) => index * CATALOG_EXPERT_CHUNK_SIZE,
    );

    for (let index = 0; index < ranges.length; index += CATALOG_EXPERT_CONCURRENCY) {
      const batch = ranges.slice(index, index + CATALOG_EXPERT_CONCURRENCY);
      const chunks = await Promise.all(batch.map((from) => fetchRange(from)));
      chunks.forEach((chunk) => rows.push(...chunk));
    }
  } else {
    for (let from = 0; ; from += CATALOG_EXPERT_CHUNK_SIZE) {
      const chunk = await fetchRange(from);
      rows.push(...chunk);
      if (chunk.length < CATALOG_EXPERT_CHUNK_SIZE) break;
    }
  }

  catalogExpertCache = {
    expiresAt: now + CATALOG_EXPERT_CACHE_TTL_MS,
    taxonomy: buildCatalogExpertTaxonomy(rows),
  };

  return catalogExpertCache;
}

function sortLazyNodes(nodes: CatalogExpertNode[]) {
  return nodes.sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true }));
}

export async function listCatalogExpertTaxonomyChildren(
  supabaseLike: SupabaseLike,
  parentKey: string | null,
) {
  const safeParentKey = parentKey || "base";
  const now = Date.now();
  const cached = lazyChildrenCache.get(safeParentKey);
  if (cached && cached.expiresAt > now) return cached.children;

  const parentPath = parseCatalogExpertNodeKey(safeParentKey);
  const depth = getCatalogExpertNodeDepth(safeParentKey);
  const map = new Map<string, CatalogExpertNode>();

  if (depth === "base") {
    const { data, error } = await supabaseLike
      .from("efisco_gnd_distribution")
      .select("gnd,itens_distintos");

    if (error) {
      console.error("Catalog expert GND taxonomy failed.", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      throw error;
    }

    for (const row of Array.isArray(data) ? data : []) {
      const gnd = getGndBucket(row.gnd);
      const key = buildCatalogExpertNodeKey({ gnd });
      const count = Number(row.itens_distintos || 0);
      const existing = map.get(key);
      if (existing) {
        existing.count += count;
      } else {
        map.set(key, makeNode(key, getGndLabel(gnd), count, true));
      }
    }
  } else if (depth === "gnd") {
    const { data, error } = await supabaseLike
      .from("efisco_taxonomy_gnd_distribution")
      .select("codigo_grupo,nome_grupo,itens")
      .eq("gnd_bucket", parentPath.gnd)
      .order("itens", { ascending: false })
      .limit(5_000);

    if (error) {
      console.error("Catalog expert group taxonomy failed.", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      throw error;
    }

    for (const row of Array.isArray(data) ? data : []) {
      const codigoGrupo = String(row.codigo_grupo || "sem-grupo").trim();
      const key = buildCatalogExpertNodeKey({ ...parentPath, group: codigoGrupo });
      const count = Number(row.itens || 0);
      const existing = map.get(key);
      if (existing) {
        existing.count += count;
      } else {
        map.set(
          key,
          makeNode(
            key,
            withCodeLabel(row.codigo_grupo, row.nome_grupo, "Sem grupo"),
            count,
            true,
          ),
        );
      }
    }
  } else if (depth === "group") {
    const { data, error } = await supabaseLike
      .from("efisco_taxonomy_gnd_distribution")
      .select("codigo_classe,nome_classe,itens")
      .eq("gnd_bucket", parentPath.gnd)
      .eq("codigo_grupo", parentPath.group)
      .order("itens", { ascending: false })
      .limit(5_000);

    if (error) {
      console.error("Catalog expert class taxonomy failed.", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      throw error;
    }

    for (const row of Array.isArray(data) ? data : []) {
      const codigoClasse = String(row.codigo_classe || "sem-classe").trim();
      const key = buildCatalogExpertNodeKey({ ...parentPath, class: codigoClasse });
      const count = Number(row.itens || 0);
      const existing = map.get(key);
      if (existing) {
        existing.count += count;
      } else {
        map.set(
          key,
          makeNode(
            key,
            withCodeLabel(row.codigo_classe, row.nome_classe, "Sem classe"),
            count,
            false,
          ),
        );
      }
    }
  }

  const children = sortLazyNodes(Array.from(map.values()));
  lazyChildrenCache.set(safeParentKey, {
    expiresAt: now + CATALOG_EXPERT_CACHE_TTL_MS,
    children,
  });
  return children;
}

function applyCatalogExpertNodeFilter(builder: any, selectedNodeKey: string | null) {
  const node = parseCatalogExpertNodeKey(selectedNodeKey);
  let next = builder;

  if (node.gnd && node.gnd !== "sem-gnd") {
    next = next.like("gnd_preferencial", `${node.gnd}%`);
  } else if (node.gnd === "sem-gnd") {
    next = next.is("gnd_preferencial", null);
  }

  if (node.type) {
    next = node.type === "serviço" || node.type === "servico"
      ? next.eq("tipo_objeto", "SERVIÇO")
      : next.eq("tipo_objeto", "MATERIAL");
  }

  if (node.group && node.group !== "sem-grupo") {
    next = next.eq("codigo_grupo", node.group);
  }

  if (node.class && node.class !== "sem-classe") {
    next = next.eq("codigo_classe", node.class);
  }

  return next;
}

export async function listCatalogExpertNodeItems(
  supabaseLike: SupabaseLike,
  selectedNodeKey: string | null,
  limit: number,
  offset: number,
) {
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(1, Math.min(120, limit));
  const to = safeOffset + safeLimit - 1;

  const baseQuery = applyCatalogExpertNodeFilter(
    supabaseLike
      .from("catalogo_efisco_v2")
      .select(CATALOG_EXPERT_SELECT_COLUMNS, { count: "exact" }),
    selectedNodeKey,
  );
  const { data, error, count } = await baseQuery
    .order("id", { ascending: true })
    .range(safeOffset, to);

  if (error) {
    console.error("Catalog expert node items failed.", {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    throw error;
  }

  const items = (Array.isArray(data) ? data : []).map((row, index) =>
    mapCatalogExpertRowToProduct(row, safeOffset + index),
  );
  const total = Number(count || 0);

  return {
    items,
    total,
    hasMore: safeOffset + safeLimit < total,
  };
}
