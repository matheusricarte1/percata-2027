import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";

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

export const GET = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ request, supabaseAdmin }) => {
    const limitParam = Number(request.nextUrl.searchParams.get("limit") || 40);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(limitParam, 200))
      : 40;

    const admin = supabaseAdmin!;
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
  },
  { requireAdminClient: true },
);
