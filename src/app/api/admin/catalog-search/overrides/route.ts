import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeRole } from "@/lib/access";
import { normalizeCatalogSearchQuery } from "@/lib/catalog-search-learning";

async function requireAdminOrSuperadmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = normalizeRole(profile?.role, user.email);
  if (role !== "admin" && role !== "superadmin") return null;
  return { user, role };
}

function sanitizeText(value: unknown, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdminOrSuperadmin();
    if (!actor) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const queryNorm = normalizeCatalogSearchQuery(body?.query_norm || body?.query_text || "");
    const matchMode = body?.match_mode === "contains" ? "contains" : "exact";
    const overrideType = body?.override_type === "block" ? "block" : "boost";
    const catalogId =
      Number.isFinite(Number(body?.catalog_id)) && Number(body?.catalog_id) > 0
        ? Number(body.catalog_id)
        : null;
    const codigoEfisco = sanitizeText(body?.codigo_efisco, 80) || null;
    const weight = Math.max(0, Math.min(5000, Number(body?.weight || 200)));
    const notes = sanitizeText(body?.notes, 500) || null;

    if (!queryNorm) {
      return NextResponse.json({ error: "Informe a consulta normalizada." }, { status: 400 });
    }
    if (!catalogId && !codigoEfisco) {
      return NextResponse.json({ error: "Informe catalog_id ou codigo_efisco." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("catalog_search_overrides")
      .insert({
        query_norm: queryNorm,
        match_mode: matchMode,
        override_type: overrideType,
        catalog_id: catalogId,
        codigo_efisco: codigoEfisco,
        weight,
        notes,
        created_by: actor.user.id,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Falha ao criar override." },
      { status: 500 },
    );
  }
}
