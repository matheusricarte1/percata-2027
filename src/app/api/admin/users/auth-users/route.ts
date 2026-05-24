import { NextResponse } from "next/server";
import { hasSupabaseAdminCredentials } from "@/lib/supabase-admin";
import { withAuthorizedRole } from "@/lib/api-auth";

type AuthUserSnapshot = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  provider: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

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

export const GET = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ request, supabaseAdmin }) => {
    const limitParam = Number(request.nextUrl.searchParams.get("limit") || 1000);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(limitParam, 5000))
      : 1000;

    if (!hasSupabaseAdminCredentials() || !supabaseAdmin) {
      return NextResponse.json({
        data: [],
        unavailable: true,
        reason:
          "Credenciais administrativas do Supabase não configuradas neste ambiente.",
      });
    }

    const admin = supabaseAdmin;
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
  },
  // requireAdminClient: false porque já tratamos ausência de credenciais
  // com 200+payload neutro (mantém UX da admin/usuarios).
);
