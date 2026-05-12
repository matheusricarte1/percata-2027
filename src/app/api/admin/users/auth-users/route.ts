import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient, hasSupabaseAdminCredentials } from "@/lib/supabase-admin";
import { normalizeRole } from "@/lib/access";

type AuthUserSnapshot = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  provider: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

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

function readFullName(metadata: Record<string, any> | undefined): string | null {
  const fullName = String(metadata?.full_name || metadata?.name || "").trim();
  if (fullName) return fullName;
  const given = String(metadata?.given_name || "").trim();
  const family = String(metadata?.family_name || "").trim();
  const joined = `${given} ${family}`.trim();
  return joined || null;
}

function readAvatar(metadata: Record<string, any> | undefined): string | null {
  const avatar = String(metadata?.avatar_url || metadata?.picture || "").trim();
  return avatar || null;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminOrSuperadmin();
    if (!actor) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const limitParam = Number(request.nextUrl.searchParams.get("limit") || 1000);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(limitParam, 5000))
      : 1000;

    if (!hasSupabaseAdminCredentials()) {
      return NextResponse.json({
        data: [],
        unavailable: true,
        reason: "Credenciais administrativas do Supabase não configuradas neste ambiente.",
      });
    }

    const admin = createSupabaseAdminClient();
    const perPage = 200;
    const maxPages = Math.ceil(limit / perPage);
    let page = 1;
    const snapshots: AuthUserSnapshot[] = [];

    while (page <= maxPages) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;

      const users = data?.users || [];
      for (const row of users) {
        const email = String(row.email || "").trim().toLowerCase();
        if (!email) continue;

        const metadata = (row.user_metadata || {}) as Record<string, any>;
        const provider =
          String(
            row.app_metadata?.provider ||
              (Array.isArray((row.app_metadata as any)?.providers)
                ? (row.app_metadata as any).providers[0]
                : ""),
          ).trim() || null;

        snapshots.push({
          id: String(row.id || ""),
          email,
          full_name: readFullName(metadata),
          avatar_url: readAvatar(metadata),
          provider,
          created_at: row.created_at || null,
          last_sign_in_at: row.last_sign_in_at || null,
        });

        if (snapshots.length >= limit) break;
      }

      if (users.length < perPage || snapshots.length >= limit) break;
      page += 1;
    }

    return NextResponse.json({ data: snapshots });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Falha ao listar contas autenticadas." },
      { status: 500 },
    );
  }
}
