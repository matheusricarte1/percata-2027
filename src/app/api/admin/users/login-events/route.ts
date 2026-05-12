import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeRole } from "@/lib/access";

function isMissingLoginTableError(error: any): boolean {
  const text = String(error?.message || error || "").toLowerCase();
  return (
    text.includes("auth_login_events") &&
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

    const limitParam = Number(request.nextUrl.searchParams.get("limit") || 40);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(limitParam, 200))
      : 40;

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("auth_login_events")
      .select(
        "id,email,provider,full_name,ip_address,user_agent,logged_at,created_at",
      )
      .order("logged_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingLoginTableError(error)) {
        return NextResponse.json({
          data: [],
          warning:
            "Tabela de login ainda não implantada. Aplique a migration 20260424024000_auth_login_events.sql.",
        });
      }
      throw error;
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Falha ao carregar eventos de login." },
      { status: 500 },
    );
  }
}
