import { NextRequest, NextResponse } from "next/server";
import {
  applyCatalogSearchOverrides,
  normalizeCatalogSearchQuery,
} from "@/lib/catalog-search-learning";
import { rerankCatalogSearchResults } from "@/lib/catalog-search-ranking";
import { searchCatalogWithTypesense } from "@/lib/catalog-typesense";
import { createSupabaseAdminClient, hasSupabaseAdminCredentials } from "@/lib/supabase-admin";
import { createClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;
const SQL_FALLBACK_LIMIT = 30;
const CATALOG_SELECT_COLUMNS =
  "id,codigo_efisco,descricao,tipo,categoria,grupo,classe,tipo_objeto,codigo_grupo,nome_grupo,codigo_classe,nome_classe,codigo_material_servico,nome_material_servico,codigo_natureza_preferencial,gnd_preferencial,natureza_count,unidade_medida";

function sanitizeSearchInput(value: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 180);
}

function normalizeCategory(value: string | null) {
  const normalized = String(value || "all")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (["material", "materiais", "produto", "produtos"].includes(normalized)) return "material";
  if (["servico", "servicos"].includes(normalized)) return "servico";
  return "all";
}

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function sanitizeLikePattern(value: string) {
  return String(value || "")
    .replace(/[%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function normalizeQueryTerms(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function isLikelyCodeQuery(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  const compact = normalized.replace(/[^a-zA-Z0-9]/g, "");
  if (compact.length < 6) return false;
  return /^[0-9][0-9A-Za-z._/-]*$/.test(normalized);
}

function isGenericShortQuery(value: string) {
  const terms = normalizeQueryTerms(value);
  if (terms.length === 0 || terms.length > 3) return false;
  const generic = new Set([
    "material",
    "materiais",
    "servico",
    "servicos",
    "manutencao",
    "fornecido",
    "fornecimento",
    "baixo",
    "alto",
    "item",
    "itens",
    "equipamento",
    "equipamentos",
  ]);
  return terms.some((term) => generic.has(term));
}

function isLowSignalQuery(value: string) {
  const terms = normalizeQueryTerms(value);
  if (terms.length === 0) return false;
  if (terms.length === 1 && terms[0].length <= 5) return true;
  const broad = new Set([
    "tipo",
    "forma",
    "conforme",
    "interna",
    "externa",
    "altura",
    "diametro",
    "resistente",
    "material",
    "equipamento",
    "item",
    "itens",
    "baixo",
    "alto",
    "para",
  ]);
  return terms.length <= 3 && terms.every((term) => broad.has(term));
}

function applyCategoryFilter(builder: any, category: string) {
  if (category === "material") return builder.eq("tipo_objeto", "MATERIAL");
  if (category === "servico") return builder.eq("tipo_objeto", "SERVIÇO");
  return builder.in("tipo_objeto", ["MATERIAL", "SERVIÇO"]);
}

async function searchCatalogWithSqlFallback(
  supabaseLike: Pick<Awaited<ReturnType<typeof createClient>>, "from">,
  query: string,
  category: string,
  limit: number,
  offset: number,
) {
  const safeLimit = Math.max(1, Math.min(SQL_FALLBACK_LIMIT, limit));
  const from = Math.max(0, offset);
  const to = from + safeLimit - 1;
  const normalized = sanitizeLikePattern(query);

  if (!normalized) return [] as any[];

  // 1) tenta FTS direto (mais leve que a RPC complexa)
  try {
    const ftsBuilder = applyCategoryFilter(
      supabaseLike
        .from("catalogo")
        .select(CATALOG_SELECT_COLUMNS),
      category,
    );
    const { data, error } = await ftsBuilder
      .textSearch("search_vector", normalized, { type: "websearch", config: "portuguese" } as any)
      .order("id", { ascending: true })
      .range(from, to);
    if (!error && Array.isArray(data) && data.length > 0) {
      return rerankCatalogSearchResults(query, data as any[]);
    }
  } catch (error) {
    console.error("Catalog SQL fallback (FTS) failed.", error);
  }

  return [] as any[];
}

async function searchCatalogByCodeQuick(
  supabaseLike: Pick<Awaited<ReturnType<typeof createClient>>, "from">,
  query: string,
  category: string,
  limit: number,
  offset: number,
) {
  const raw = String(query || "").trim();
  if (!raw) return [] as any[];
  const safeLimit = Math.max(1, Math.min(SQL_FALLBACK_LIMIT, limit));
  const from = Math.max(0, offset);
  const to = from + safeLimit - 1;

  // 1) match exato (rápido e preciso para código e-Fisco)
  try {
    const exactBuilder = applyCategoryFilter(
      supabaseLike
        .from("catalogo")
        .select(CATALOG_SELECT_COLUMNS),
      category,
    );
    const { data, error } = await exactBuilder
      .eq("codigo_efisco", raw)
      .order("id", { ascending: true })
      .range(from, to);
    if (!error && Array.isArray(data) && data.length > 0) {
      return rerankCatalogSearchResults(query, data as any[]);
    }
  } catch (error) {
    console.error("Catalog code quick search (exact) failed.", error);
  }

  return [] as any[];
}

async function searchCatalogWithSupabase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  adminClient: ReturnType<typeof createSupabaseAdminClient> | null,
  query: string,
  category: string,
  limit: number,
  offset: number,
) {
  const { data, error } = await supabase.rpc("buscar_catalogo_inteligente", {
    query_text: query,
    categoria_filtro: category,
    limit_val: limit,
    offset_val: offset,
  });

  if (error) {
    const isTimeout =
      String(error.code || "") === "57014" ||
      /statement timeout/i.test(String(error.message || ""));
    console.error("Catalog RPC failed.", {
      code: error.code,
      message: error.message,
      details: error.details,
      timeout: isTimeout,
    });

    const fallbackRows = await searchCatalogWithSqlFallback(
      adminClient ?? supabase,
      query,
      category,
      limit,
      offset,
    );
    if (fallbackRows.length > 0) {
      return {
        rows: fallbackRows,
        source: isTimeout ? "supabase-timeout-fallback" : "supabase-error-fallback",
      };
    }

    return {
      rows: [],
      source: isTimeout ? "supabase-timeout-empty" : "supabase-error-empty",
    };
  }

  return {
    rows: rerankCatalogSearchResults(query, (data || []) as any[]),
    source: "supabase-rpc",
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  // Rate limit: 120 buscas/min por usuário. Suficiente para digitação
  // com debounce; bloqueia scraping ou loop acidental que esgotaria a
  // quota Typesense free tier ou o orçamento de RPC do Supabase.
  const limited = await enforceRateLimit(
    request,
    { bucket: "catalog-search", limit: 120, windowSec: 60 },
    user.id,
  );
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const query = sanitizeSearchInput(searchParams.get("q"));
  const category = normalizeCategory(searchParams.get("category"));
  const context = sanitizeSearchInput(searchParams.get("context")) || "catalogo";
  const limit = parseBoundedInt(searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = parseBoundedInt(searchParams.get("offset"), 0, 0, 200_000);
  const queryNorm = normalizeCatalogSearchQuery(query);
  const admin = hasSupabaseAdminCredentials() ? createSupabaseAdminClient() : null;

  if (!query) {
    return NextResponse.json({ items: [], source: "empty", hasMore: false });
  }

  let rows: any[] = [];
  let source = "supabase";
  const codeLikeQuery = isLikelyCodeQuery(query);
  const genericShortQuery = isGenericShortQuery(query);
  const lowSignalQuery = isLowSignalQuery(query);
  const baseClient = admin ?? supabase;

  try {
    const typesenseRows = await searchCatalogWithTypesense({
      query,
      category,
      limit,
      offset,
    });

    if (typesenseRows) {
      rows = typesenseRows;
      source = "typesense";
    }
  } catch (error) {
    console.error("Typesense catalog search failed; falling back to Supabase.", error);
  }

  if (rows.length === 0) {
    if (codeLikeQuery) {
      const codeRows = await searchCatalogByCodeQuick(
        baseClient,
        query,
        category,
        limit,
        offset,
      );
      if (codeRows.length > 0) {
        rows = codeRows;
        source = "supabase-code-fast";
      } else {
        source = "supabase-code-empty";
      }
    } else if (lowSignalQuery) {
      rows = [];
      source = "supabase-low-signal-skip";
    } else if (genericShortQuery) {
      const genericRows = await searchCatalogWithSqlFallback(
        baseClient,
        query,
        category,
        limit,
        offset,
      );
      rows = genericRows;
      source =
        genericRows.length > 0
          ? "supabase-generic-sql"
          : "supabase-generic-empty";
    }
  }

  if (rows.length === 0 && !codeLikeQuery && !genericShortQuery && !lowSignalQuery) {
    const fallback = await searchCatalogWithSupabase(
      supabase,
      admin,
      query,
      category,
      limit,
      offset,
    );
    if (fallback.source) source = fallback.source;
    rows = fallback.rows || [];
  }

  if (admin) {
    try {
      const { data: overrides } = await admin
        .from("catalog_search_overrides")
        .select("query_norm,match_mode,override_type,catalog_id,codigo_efisco,weight")
        .eq("is_active", true)
        .limit(200);

      rows = applyCatalogSearchOverrides(query, rows, (overrides || []) as any[]);
    } catch (error) {
      console.error("Catalog search overrides failed.", error);
    }

    try {
      await admin.from("catalog_search_logs").insert({
        user_id: user.id,
        query_text: query,
        query_norm: queryNorm,
        category,
        context,
        source,
        offset_val: offset,
        limit_val: limit,
        result_count: rows.length,
        top_catalog_id: Number(rows[0]?.id || 0) || null,
        top_codigo_efisco: rows[0]?.codigo_efisco || null,
      });
    } catch (error) {
      console.error("Catalog search logging failed.", error);
    }
  }

  return NextResponse.json({
    items: rows,
    source,
    hasMore: rows.length === limit,
  });
}
