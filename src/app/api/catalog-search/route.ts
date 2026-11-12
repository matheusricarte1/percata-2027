import { NextRequest, NextResponse } from "next/server";
import {
  applyCatalogSearchOverrides,
  normalizeCatalogSearchQuery,
} from "@/lib/catalog-search-learning";
import { rerankCatalogSearchResults } from "@/lib/catalog-search-ranking";
import { searchCatalogWithTypesense } from "@/lib/catalog-typesense";
import { deriveGndFromNatureza } from "@/lib/catalog-fiscal";
import {
  buildCatalogQueryFallbacks,
  filterArmamentRelatedCatalogRows,
  isArmamentRelatedCatalogQuery,
  isCatalogLowSignalQuery,
  isGenericCatalogShortQuery,
  isLikelyCatalogCodeQuery,
  getCatalogCodeSearchCandidates,
  normalizeCatalogCategory,
  parseBoundedCatalogInt,
  sanitizeCatalogLikePattern,
  sanitizeCatalogSearchInput,
} from "@/lib/catalog-query-signal";
import { createSupabaseAdminClient, hasSupabaseAdminCredentials } from "@/lib/supabase-admin";
import { createClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;
const SQL_FALLBACK_LIMIT = 30;
const CATALOG_SELECT_COLUMNS =
  "id,codigo_efisco,descricao,tipo,categoria,grupo,classe,tipo_objeto,codigo_grupo,nome_grupo,codigo_classe,nome_classe,codigo_material_servico,nome_material_servico,codigo_natureza_preferencial,gnd_preferencial,natureza_count,has_mixed_expense_classes,has_missing_natureza,gnds,naturezas,unidade_medida";

function applyCategoryFilter(builder: any, category: string) {
  if (category === "material") return builder.eq("tipo_objeto", "MATERIAL");
  if (category === "servico") return builder.eq("tipo_objeto", "SERVIÇO");
  return builder.in("tipo_objeto", ["MATERIAL", "SERVIÇO"]);
}

async function listCatalogInitialPage(
  supabaseLike: Pick<Awaited<ReturnType<typeof createClient>>, "from">,
  category: string,
  limit: number,
  offset: number,
) {
  const safeLimit = Math.max(1, Math.min(MAX_LIMIT, limit));
  const visibleOffset = Math.max(0, offset);
  const rawChunkSize = 200;
  const maxRawScan = 10_000;
  let rawOffset = 0;
  let visibleSeen = 0;
  const rows: any[] = [];
  let hasMoreRawRows = true;

  while (rows.length < safeLimit && rawOffset < maxRawScan && hasMoreRawRows) {
    const builder = applyCategoryFilter(
      supabaseLike
        .from("catalogo_efisco_v2")
        .select(CATALOG_SELECT_COLUMNS),
      category,
    );
    const { data, error } = await builder
      .order("id", { ascending: true })
      .range(rawOffset, rawOffset + rawChunkSize - 1);

    if (error) {
      console.error("Catalog initial page failed.", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      throw error;
    }

    const chunk = (data || []) as any[];
    hasMoreRawRows = chunk.length === rawChunkSize;
    rawOffset += rawChunkSize;

    const visibleChunk = filterArmamentRelatedCatalogRows(chunk);
    for (const row of visibleChunk) {
      if (visibleSeen < visibleOffset) {
        visibleSeen += 1;
        continue;
      }
      rows.push(row);
      visibleSeen += 1;
      if (rows.length >= safeLimit) break;
    }
  }

  return {
    rows,
    hasMore: hasMoreRawRows || rows.length === safeLimit,
  };
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
  const normalized = sanitizeCatalogLikePattern(query);

  if (!normalized) return [] as any[];

  // Fallback simples sobre a view v2 quando o mecanismo principal não responde.
  try {
    const fallbackBuilder = applyCategoryFilter(
      supabaseLike
        .from("catalogo_efisco_v2")
        .select(CATALOG_SELECT_COLUMNS),
      category,
    );

    const { data, error } = await (isLikelyCatalogCodeQuery(normalized)
      ? fallbackBuilder.ilike("codigo_efisco", `${normalized}%`)
      : fallbackBuilder.ilike("descricao", `%${normalized}%`))
      .order("id", { ascending: true })
      .range(from, to);

    if (!error && Array.isArray(data) && data.length > 0) {
      return rerankCatalogSearchResults(query, data as any[]);
    }
  } catch (error) {
    console.error("Catalog SQL fallback v2 failed.", error);
  }

  return [] as any[];
}

async function searchCatalogByTitlePrefix(
  supabaseLike: Pick<Awaited<ReturnType<typeof createClient>>, "from">,
  query: string,
  category: string,
  limit: number,
) {
  const firstToken = sanitizeCatalogSearchInput(query).split(/\s+/)[0] || "";
  if (firstToken.length < 4 || isLikelyCatalogCodeQuery(query)) return [] as any[];

  try {
    const titleBuilder = applyCategoryFilter(
      supabaseLike
        .from("catalogo_efisco_v2")
        .select(CATALOG_SELECT_COLUMNS),
      category,
    );
    const { data, error } = await titleBuilder
      .ilike("descricao", `${firstToken}%`)
      .order("id", { ascending: true })
      .limit(Math.min(100, Math.max(20, limit)));

    if (!error && Array.isArray(data)) return data as any[];
  } catch (error) {
    console.error("Catalog title-prefix search failed.", error);
  }

  return [] as any[];
}

function mergeCatalogSearchRows(...groups: any[][]) {
  const seen = new Set<string>();
  return groups.flat().filter((row) => {
    const key = String(row?.id ?? row?.codigo_efisco ?? row?.descricao ?? "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterRowsByTitlePrefix(query: string, rows: any[]) {
  const firstToken = sanitizeCatalogSearchInput(query).split(/\s+/)[0] || "";
  if (firstToken.length < 4 || isLikelyCatalogCodeQuery(query)) return rows;
  const normalizedToken = firstToken.toLowerCase();
  const titleMatches = rows.filter((row) => {
    const title = String(row?.descricao || "")
      .split(/\s+-\s+|,/)[0]
      .trim()
      .toLowerCase();
    return new RegExp(`(^|\\s)${normalizedToken}(\\s|$)`).test(title);
  });
  return titleMatches.length > 0 ? titleMatches : rows;
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
        .from("catalogo_efisco_v2")
        .select(CATALOG_SELECT_COLUMNS),
      category,
    );
    const codeCandidates = getCatalogCodeSearchCandidates(raw);
    const { data, error } = await exactBuilder
      .in("codigo_efisco", codeCandidates)
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
  if (offset > 0) {
    const pagedRows = await searchCatalogWithSqlFallback(
      adminClient ?? supabase,
      query,
      category,
      limit,
      offset,
    );
    return {
      rows: pagedRows,
      source: "supabase-v2-sql-fallback-offset",
    };
  }

  try {
    const { data: v2Data, error: v2Error } = await supabase.rpc(
      "buscar_catalogo_inteligente_v2",
      {
        query_text: query,
        categoria_filtro: category,
        limit_val: limit,
        after_id: 0,
      },
    );

    if (!v2Error && Array.isArray(v2Data)) {
      const titleRows = await searchCatalogByTitlePrefix(
        adminClient ?? supabase,
        query,
        category,
        limit,
      );
      const candidateRows = filterRowsByTitlePrefix(
        query,
        mergeCatalogSearchRows(
          titleRows,
          v2Data.map((row: any) => ({
            ...row,
            efisco_item_id: row.id,
          })),
        ),
      );
      const rows = rerankCatalogSearchResults(
        query,
        candidateRows,
      );
      if (rows.length > 0) return { rows, source: "supabase-rpc-v2" };

      for (const fallbackQuery of buildCatalogQueryFallbacks(query)) {
        const { data: fallbackData, error: fallbackError } = await supabase.rpc(
          "buscar_catalogo_inteligente_v2",
          {
            query_text: fallbackQuery,
            categoria_filtro: category,
            limit_val: limit,
            after_id: 0,
          },
        );
        if (fallbackError || !Array.isArray(fallbackData) || fallbackData.length === 0) {
          continue;
        }
        return {
          rows: rerankCatalogSearchResults(
            fallbackQuery,
            fallbackData.map((row: any) => ({
              ...row,
              efisco_item_id: row.id,
            })),
          ),
          source: "supabase-rpc-v2-reduced-query",
        };
      }

      return { rows: [], source: "supabase-rpc-v2-empty" };
    }

    if (v2Error) {
      console.error("Catalog RPC v2 failed.", {
        code: v2Error.code,
        message: v2Error.message,
        details: v2Error.details,
      });
    }
  } catch (error) {
    console.error("Catalog RPC v2 unavailable.", error);
  }

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
      source: "supabase-v2-sql-fallback",
    };
  }

  return {
    rows: [],
    source: "supabase-v2-empty",
  };
}

async function applyNaturezaReviewReuse(
  admin: ReturnType<typeof createSupabaseAdminClient> | null,
  rows: any[],
) {
  if (!admin || rows.length === 0) return rows;

  const ids = Array.from(
    new Set(
      rows
        .map((row) => Number(row.efisco_item_id ?? row.id))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  );
  if (ids.length === 0) return rows;

  try {
    const { data, error } = await admin
      .from("efisco_natureza_review_reuse")
      .select("efisco_item_id,codigo_natureza_despesa,status")
      .in("efisco_item_id", ids)
      .eq("status", "saneado");

    if (error || !Array.isArray(data) || data.length === 0) return rows;

    const reuse = new Map(
      data.map((row: any) => [Number(row.efisco_item_id), row.codigo_natureza_despesa]),
    );

    return rows.map((row) => {
      const efiscoItemId = Number(row.efisco_item_id ?? row.id);
      const natureza = reuse.get(efiscoItemId);
      if (!natureza) return row;
      const gnd = deriveGndFromNatureza(natureza);
      return {
        ...row,
        codigo_natureza_preferencial: natureza,
        codigo_natureza_despesa: row.codigo_natureza_despesa || natureza,
        gnd_preferencial: gnd || row.gnd_preferencial || row.gnd,
        gnd_derivado: gnd || row.gnd_derivado || row.gnd,
        gnd: gnd || row.gnd,
        natureza_count: Math.max(1, Number(row.natureza_count || 0)),
        has_missing_natureza: false,
        requires_natureza_review: false,
      };
    });
  } catch (error) {
    console.error("Catalog natureza review reuse failed.", error);
    return rows;
  }
}

async function applyCatalogV2FiscalMetadata(
  supabaseLike: Pick<Awaited<ReturnType<typeof createClient>>, "from">,
  rows: any[],
) {
  if (rows.length === 0) return rows;

  const codes = Array.from(
    new Set(
      rows
        .map((row) => String(row.codigo_efisco || row.efiscoCode || row.siad || "").trim())
        .filter(Boolean),
    ),
  );
  if (codes.length === 0) return rows;

  try {
    const { data, error } = await supabaseLike
      .from("catalogo_efisco_v2")
      .select(
        "codigo_efisco,codigo_natureza_preferencial,gnd_preferencial,natureza_count,has_mixed_expense_classes,has_missing_natureza,gnds,naturezas",
      )
      .in("codigo_efisco", codes);

    if (error || !Array.isArray(data) || data.length === 0) return rows;

    const metadataByCode = new Map(
      data.map((row: any) => [String(row.codigo_efisco || "").trim(), row]),
    );

    return rows.map((row) => {
      const code = String(row.codigo_efisco || row.efiscoCode || row.siad || "").trim();
      const metadata = metadataByCode.get(code);
      if (!metadata) return row;
      return {
        ...row,
        codigo_natureza_preferencial:
          metadata.codigo_natureza_preferencial || row.codigo_natureza_preferencial,
        gnd_preferencial: metadata.gnd_preferencial || row.gnd_preferencial,
        natureza_count: Number(metadata.natureza_count || row.natureza_count || 0),
        has_mixed_expense_classes: Boolean(metadata.has_mixed_expense_classes),
        has_missing_natureza: Boolean(metadata.has_missing_natureza),
        gnds: metadata.gnds || row.gnds || [],
        naturezas: metadata.naturezas || row.naturezas || [],
      };
    });
  } catch (error) {
    console.error("Catalog v2 fiscal metadata enrichment failed.", error);
    return rows;
  }
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
  const query = sanitizeCatalogSearchInput(searchParams.get("q"));
  const category = normalizeCatalogCategory(searchParams.get("category"));
  const context = sanitizeCatalogSearchInput(searchParams.get("context")) || "catalogo";
  const limit = parseBoundedCatalogInt(searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = parseBoundedCatalogInt(searchParams.get("offset"), 0, 0, 200_000);
  const queryNorm = normalizeCatalogSearchQuery(query);
  const admin = hasSupabaseAdminCredentials() ? createSupabaseAdminClient() : null;

  let rows: any[] = [];
  let source = "supabase";
  const codeLikeQuery = isLikelyCatalogCodeQuery(query);
  const genericShortQuery = isGenericCatalogShortQuery(query);
  const lowSignalQuery = isCatalogLowSignalQuery(query);
  const baseClient = admin ?? supabase;

  if (isArmamentRelatedCatalogQuery(query)) {
    return NextResponse.json({
      items: [],
      source: "blocked-sensitive-catalog-query",
      hasMore: false,
    });
  }

  if (!query) {
    try {
      const initialPage = await listCatalogInitialPage(baseClient, category, limit, offset);
      rows = initialPage.rows;
      rows = await applyNaturezaReviewReuse(admin, rows);
      return NextResponse.json({
        items: rows,
        source: admin ? "supabase-v2-initial-admin" : "supabase-v2-initial",
        hasMore: initialPage.hasMore,
      });
    } catch (error: any) {
      return NextResponse.json(
        { error: error?.message || "Erro ao listar catalogo." },
        { status: 500 },
      );
    }
  }

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

  rows = await applyCatalogV2FiscalMetadata(baseClient, rows);
  rows = filterArmamentRelatedCatalogRows(rows);
  rows = await applyNaturezaReviewReuse(admin, rows);

  return NextResponse.json({
    items: rows,
    source,
    hasMore: rows.length === limit,
  });
}
