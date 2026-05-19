import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeRole } from "@/lib/access";

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAdminOrSuperadmin();
    if (!actor) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body?.is_active === "boolean") patch.is_active = body.is_active;
    if (body?.notes !== undefined) patch.notes = sanitizeText(body.notes, 500) || null;
    if (body?.weight !== undefined) {
      patch.weight = Math.max(0, Math.min(5000, Number(body.weight || 0)));
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("catalog_search_overrides")
      .update(patch)
      .eq("id", Number(id))
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Falha ao atualizar override." },
      { status: 500 },
    );
  }
}
