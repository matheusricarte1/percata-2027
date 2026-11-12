import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import { getAdminCampusUserIds } from "@/lib/admin-campus-scope";

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
  async ({ request, supabaseAdmin, user, role }) => {
    const limitParam = Number(request.nextUrl.searchParams.get("limit") || 20);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(limitParam, 100))
      : 20;

    const admin = supabaseAdmin!;
    const allowed = await getAdminCampusUserIds(admin, user.id, role);
    if (allowed?.size === 0) return NextResponse.json({ data: [] });
    let query = admin
      .from("admin_user_audit_logs")
      .select(
        "id,actor_email,actor_role,target_email,action,details,created_at",
      )
      .order("created_at", { ascending: false });
    if (allowed) query = query.in("target_profile_id", [...allowed]);
    const { data, error } = await query.limit(limit);
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
