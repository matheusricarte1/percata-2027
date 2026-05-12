import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeRole } from "@/lib/access";

function isMissingAuditTableError(error: any): boolean {
  const text = String(error?.message || error || "").toLowerCase();
  return (
    text.includes("admin_user_audit_logs") &&
    (text.includes("schema cache") ||
      text.includes("could not find the table") ||
      text.includes("does not exist") ||
      text.includes("42p01"))
  );
}

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

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminOrSuperadmin();
    if (!actor) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const limitParam = Number(request.nextUrl.searchParams.get("limit") || 20);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(limitParam, 100))
      : 20;

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("admin_user_audit_logs")
      .select(
        "id,actor_email,actor_role,target_email,action,details,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (isMissingAuditTableError(error)) {
        return NextResponse.json({
          data: [],
          warning:
            "Tabela de auditoria ainda não implantada no banco atual. Aplique a migration 20260423201000_admin_user_audit_logs.sql.",
        });
      }
      throw error;
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Falha ao carregar trilha de auditoria." },
      { status: 500 },
    );
  }
}
