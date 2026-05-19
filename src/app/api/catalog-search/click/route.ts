import { NextRequest, NextResponse } from "next/server";
import { normalizeCatalogSearchQuery } from "@/lib/catalog-search-learning";
import { createSupabaseAdminClient, hasSupabaseAdminCredentials } from "@/lib/supabase-admin";
import { createClient } from "@/utils/supabase/server";

function sanitizeText(value: unknown, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeCategory(value: unknown) {
  const normalized = sanitizeText(value, 40)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (["material", "materiais", "produto", "produtos"].includes(normalized)) return "material";
  if (["servico", "servicos"].includes(normalized)) return "servico";
  if (["kit", "kits"].includes(normalized)) return "kits";
  return "all";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  if (!hasSupabaseAdminCredentials()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const body = await request.json().catch(() => ({}));
  const actionType = sanitizeText(body?.actionType, 32);
  const queryText = sanitizeText(body?.queryText, 180);
  const payload = {
    user_id: user.id,
    action_type: actionType,
    query_text: queryText || null,
    query_norm: queryText ? normalizeCatalogSearchQuery(queryText) : null,
    category: normalizeCategory(body?.category),
    context: sanitizeText(body?.context, 60) || "catalogo",
    source: sanitizeText(body?.source, 40) || "supabase",
    result_position:
      Number.isFinite(Number(body?.resultPosition)) && Number(body?.resultPosition) >= 0
        ? Number(body.resultPosition)
        : null,
    catalog_id:
      Number.isFinite(Number(body?.catalogId)) && Number(body?.catalogId) > 0
        ? Number(body.catalogId)
        : null,
    codigo_efisco: sanitizeText(body?.codigoEfisco, 80) || null,
    item_descricao: sanitizeText(body?.itemDescricao, 400) || null,
  };

  if (
    !["add_to_cart", "add_to_collective_cart", "add_to_collective_room"].includes(
      payload.action_type,
    )
  ) {
    return NextResponse.json({ error: "Acao invalida." }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("catalog_search_clicks").insert(payload);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Falha ao registrar clique." },
      { status: 500 },
    );
  }
}
