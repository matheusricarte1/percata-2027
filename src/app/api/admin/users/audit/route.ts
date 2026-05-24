import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";

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

export const GET = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ request, supabaseAdmin }) => {
    const limitParam = Number(request.nextUrl.searchParams.get("limit") || 20);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(limitParam, 100))
      : 20;

    const admin = supabaseAdmin!;
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
  },
  { requireAdminClient: true },
);
