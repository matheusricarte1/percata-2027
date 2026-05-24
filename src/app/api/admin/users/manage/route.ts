import { NextResponse } from "next/server";
import {
  SUPERADMIN_EMAIL,
  normalizeRole,
  type UserRole,
} from "@/lib/access";
import { sanitizePlainText, sanitizeUuid } from "@/lib/settings-sanitize";
import { withAuthorizedRole } from "@/lib/api-auth";

type ManageAction =
  | {
      action: "update_role";
      profile_id: string;
      role: UserRole;
    }
  | {
      action: "update_profile";
      profile_id: string;
      full_name?: string | null;
      campus_id?: string | null;
    }
  | {
      action: "send_access_reminder";
      profile_id: string;
    }
  | {
      action: "reset_onboarding";
      profile_id: string;
    };

type TargetProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  campus_id: string | null;
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

function isProtectedSuperadmin(
  email: string | null | undefined,
  role: string | null | undefined,
) {
  return (
    role === "superadmin" ||
    (Boolean(SUPERADMIN_EMAIL) &&
      String(email || "").toLowerCase() === SUPERADMIN_EMAIL)
  );
}

export const POST = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ request, supabaseAdmin, user, role: actorRole }) => {
    const admin = supabaseAdmin!;
    const actorEmail = String(user.email || "").toLowerCase();
    const actor = {
      id: user.id,
      email: actorEmail,
      role: actorRole,
      full_name: null as string | null,
    };

    const body = (await request.json()) as ManageAction;
    const profileId = sanitizeUuid((body as any).profile_id);
    if (!profileId) {
      return NextResponse.json(
        { error: "Parâmetro profile_id é obrigatório." },
        { status: 400 },
      );
    }

    const { data: targetData, error: targetError } = await admin
      .from("profiles")
      .select("id,email,full_name,role,campus_id")
      .eq("id", profileId)
      .maybeSingle();
    if (targetError) throw targetError;
    const target = (targetData || null) as TargetProfile | null;
    if (!target) {
      return NextResponse.json(
        { error: "Perfil de destino não encontrado." },
        { status: 404 },
      );
    }

    async function insertAuditLog(params: {
      action:
        | "update_role"
        | "update_profile"
        | "send_access_reminder"
        | "reset_onboarding";
      details: Record<string, unknown>;
    }) {
      const { error } = await admin.from("admin_user_audit_logs").insert({
        actor_user_id: actor.id,
        actor_email: actor.email,
        actor_role: actor.role,
        target_profile_id: target!.id,
        target_email:
          String(target!.email || "").toLowerCase() || "sem-email",
        action: params.action,
        details: params.details,
      });
      if (error && !isMissingAuditTableError(error)) throw error;
    }

    if (body.action === "update_role") {
      const nextRole = normalizeRole(body.role);
      if (nextRole === "superadmin") {
        return NextResponse.json(
          { error: "Atribuição de superadmin é bloqueada por segurança." },
          { status: 400 },
        );
      }
      if (nextRole === "admin" && actor.role !== "superadmin") {
        return NextResponse.json(
          { error: "Somente superadmin pode atribuir perfil admin." },
          { status: 403 },
        );
      }
      if (isProtectedSuperadmin(target.email, target.role)) {
        return NextResponse.json(
          { error: "O papel do superadmin institucional é protegido." },
          { status: 400 },
        );
      }

      const { error } = await admin
        .from("profiles")
        .update({ role: nextRole })
        .eq("id", target.id);
      if (error) throw error;

      await insertAuditLog({
        action: "update_role",
        details: {
          previous_role: normalizeRole(target.role, target.email),
          next_role: nextRole,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "update_profile") {
      const nextName = sanitizePlainText(body.full_name, 160);
      const nextCampusId = body.campus_id ? sanitizeUuid(body.campus_id) : null;
      if (body.campus_id && !nextCampusId) {
        return NextResponse.json(
          { error: "Campus informado é inválido." },
          { status: 400 },
        );
      }

      const { error } = await admin
        .from("profiles")
        .update({
          full_name: nextName || null,
          campus_id: nextCampusId || null,
        })
        .eq("id", target.id);
      if (error) throw error;

      await insertAuditLog({
        action: "update_profile",
        details: {
          previous_full_name: target.full_name,
          next_full_name: nextName || null,
          previous_campus_id: target.campus_id,
          next_campus_id: nextCampusId,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "send_access_reminder") {
      const { error: notificationError } = await admin
        .from("notifications")
        .insert({
          user_id: target.id,
          title: "Acesso ao PERCATA atualizado",
          message:
            "Seu perfil foi revisado pela governança. Entre no sistema para validar seus dados de unidade e campanhas ativas.",
          type: "info",
        });
      if (notificationError) throw notificationError;

      await insertAuditLog({
        action: "send_access_reminder",
        details: { queued_email: Boolean(target.email) },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "reset_onboarding") {
      if (isProtectedSuperadmin(target.email, target.role)) {
        return NextResponse.json(
          {
            error:
              "Reset de onboarding bloqueado para superadmin institucional.",
          },
          { status: 400 },
        );
      }

      const [unitsDelete, profileUpdate, notifInsert] = await Promise.all([
        admin.from("user_units").delete().eq("user_id", target.id),
        admin.from("profiles").update({ campus_id: null }).eq("id", target.id),
        admin.from("notifications").insert({
          user_id: target.id,
          title: "Onboarding redefinido",
          message:
            "Seu onboarding foi redefinido pela administração. No próximo acesso, selecione campus, departamento e laboratório novamente.",
          type: "warning",
        }),
      ]);

      if (unitsDelete.error) throw unitsDelete.error;
      if (profileUpdate.error) throw profileUpdate.error;
      if (notifInsert.error) throw notifInsert.error;

      await insertAuditLog({
        action: "reset_onboarding",
        details: { previous_campus_id: target.campus_id },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Ação não suportada." },
      { status: 400 },
    );
  },
  { requireAdminClient: true },
);
