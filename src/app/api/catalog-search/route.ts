import { NextRequest, NextResponse } from "next/server";
import { rerankCatalogSearchResults } from "@/lib/catalog-search-ranking";
import { searchCatalogWithTypesense } from "@/lib/catalog-typesense";
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

async function searchCatalogWithSupabase(query: string, category: string, limit: number, offset: number) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { response: NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 }) };
  }

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
  const { searchParams } = new URL(request.url);
  const query = sanitizeSearchInput(searchParams.get("q"));
  const category = normalizeCategory(searchParams.get("category"));
  const limit = parseBoundedInt(searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = parseBoundedInt(searchParams.get("offset"), 0, 0, 200_000);

  if (!query) {
    return NextResponse.json({ items: [], source: "empty", hasMore: false });
  }

  try {
    const typesenseRows = await searchCatalogWithTypesense({
      query,
      category,
      limit,
      offset,
    });

    if (typesenseRows) {
      return NextResponse.json({
        items: typesenseRows,
        source: "typesense",
        hasMore: typesenseRows.length === limit,
      });
    }
  } catch (error) {
    console.error("Typesense catalog search failed; falling back to Supabase.", error);
  }

  const fallback = await searchCatalogWithSupabase(query, category, limit, offset);
  if (fallback.response) return fallback.response;

  return NextResponse.json({
    items: fallback.rows || [],
    source: "supabase",
    hasMore: (fallback.rows || []).length === limit,
  });
}
