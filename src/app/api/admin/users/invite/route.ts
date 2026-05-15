import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeRole, type UserRole } from "@/lib/access";
import { getAuthCallbackUrl } from "@/lib/site-url";
import { sanitizeEmail, sanitizePlainText, sanitizeUuid } from "@/lib/settings-sanitize";

type InvitePayload = {
  email: string;
  full_name?: string | null;
  role?: UserRole | null;
  campus_id?: string | null;
};

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

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdminOrSuperadmin();
    if (!actor) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const payload = (await request.json()) as InvitePayload;
    const email = sanitizeEmail(payload.email);
    const fullName = sanitizePlainText(payload.full_name, 160);
    const role = normalizeRole(payload.role || "solicitante");
    const campusId = payload.campus_id ? sanitizeUuid(payload.campus_id) : null;

    if (!email) {
      return NextResponse.json(
        { error: "E-mail inválido para convite." },
        { status: 400 },
      );
    }
    if (payload.campus_id && !campusId) {
      return NextResponse.json({ error: "Campus informado é inválido." }, { status: 400 });
    }

    if (role === "superadmin") {
      return NextResponse.json(
        { error: "Convite para superadmin é bloqueado por segurança." },
        { status: 400 },
      );
    }
    if (role === "admin" && actor.role !== "superadmin") {
      return NextResponse.json(
        { error: "Somente superadmin pode convidar perfil admin." },
        { status: 403 },
      );
    }

    const admin = createSupabaseAdminClient();
    const origin = request.nextUrl.origin;

    const inviteRes = await admin.auth.admin.inviteUserByEmail(email, {
      data: fullName ? { full_name: fullName } : undefined,
      redirectTo: getAuthCallbackUrl(origin),
    });

    if (
      inviteRes.error &&
      !/already|registered|exists|invite/i.test(String(inviteRes.error.message || ""))
    ) {
      throw inviteRes.error;
    }

    let profileId = String(inviteRes.data?.user?.id || "").trim();

    if (!profileId) {
      const usersRes = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (usersRes.error) throw usersRes.error;
      const existingUser = (usersRes.data?.users || []).find(
        (row) => String(row.email || "").toLowerCase() === email,
      );
      profileId = String(existingUser?.id || "").trim();
    }

    if (!profileId) {
      return NextResponse.json({
        ok: true,
        invited: true,
        profile_upserted: false,
        message:
          "Convite enviado. O perfil será concluído quando o usuário finalizar o primeiro acesso.",
      });
    }

    const profilePayload = {
      id: profileId,
      email,
      full_name: fullName || null,
      role,
      campus_id: campusId || null,
    };

    const { error: upsertError } = await admin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });
    if (upsertError) throw upsertError;

    const auditInsert = await admin.from("admin_user_audit_logs").insert({
      actor_user_id: actor.user.id,
      actor_email: String(actor.user.email || "").toLowerCase(),
      actor_role: actor.role,
      target_profile_id: profileId,
      target_email: email,
      action: "invite_user",
      details: {
        invited: true,
        profile_upserted: true,
        role,
        campus_id: campusId || null,
        full_name: fullName || null,
      },
    });
    if (auditInsert.error && !isMissingAuditTableError(auditInsert.error)) {
      throw auditInsert.error;
    }

    return NextResponse.json({
      ok: true,
      invited: true,
      profile_upserted: true,
      role,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Falha ao convidar usuário." },
      { status: 500 },
    );
  }
}
