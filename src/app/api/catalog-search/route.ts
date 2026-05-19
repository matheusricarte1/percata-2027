import { NextRequest, NextResponse } from "next/server";
import {
  applyCatalogSearchOverrides,
  normalizeCatalogSearchQuery,
} from "@/lib/catalog-search-learning";
import { rerankCatalogSearchResults } from "@/lib/catalog-search-ranking";
import { searchCatalogWithTypesense } from "@/lib/catalog-typesense";
import { createSupabaseAdminClient, hasSupabaseAdminCredentials } from "@/lib/supabase-admin";
import { createClient } from "@/utils/supabase/server";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

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

async function searchCatalogWithSupabase(
  supabase: Awaited<ReturnType<typeof createClient>>,
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
    return {
      response: NextResponse.json(
        { error: "Falha ao consultar catalogo.", detail: error.message },
        { status: 500 },
      ),
    };
  }

  return {
    rows: rerankCatalogSearchResults(query, (data || []) as any[]),
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
    const fallback = await searchCatalogWithSupabase(supabase, query, category, limit, offset);
    if (fallback.response) return fallback.response;
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
