import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  SUPERADMIN_EMAIL,
  normalizeRole,
  type UserRole,
} from "@/lib/access";
import { sanitizePlainText, sanitizeUuid } from "@/lib/settings-sanitize";

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

type ActorContext = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
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

async function requireAdminOrSuperadmin(): Promise<ActorContext | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  const role = normalizeRole(profile?.role, user.email);
  if (role !== "admin" && role !== "superadmin") return null;

  return {
    id: user.id,
    email: String(user.email).toLowerCase(),
    role,
    full_name: String(profile?.full_name || "").trim() || null,
  };
}

async function loadTargetProfile(profileId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id,email,full_name,role,campus_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as TargetProfile | null;
}

async function insertAuditLog(params: {
  actor: ActorContext;
  target: TargetProfile;
  action: "update_role" | "update_profile" | "send_access_reminder" | "reset_onboarding";
  details: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("admin_user_audit_logs").insert({
    actor_user_id: params.actor.id,
    actor_email: params.actor.email,
    actor_role: params.actor.role,
    target_profile_id: params.target.id,
    target_email: String(params.target.email || "").toLowerCase() || "sem-email",
    action: params.action,
    details: params.details,
  });
  if (error && !isMissingAuditTableError(error)) throw error;
}

function isProtectedSuperadmin(email: string | null | undefined) {
  return String(email || "").toLowerCase() === SUPERADMIN_EMAIL;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdminOrSuperadmin();
    if (!actor) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = (await request.json()) as ManageAction;
    const profileId = sanitizeUuid((body as any).profile_id);
    if (!profileId) {
      return NextResponse.json(
        { error: "Parâmetro profile_id é obrigatório." },
        { status: 400 },
      );
    }

    const target = await loadTargetProfile(profileId);
    if (!target) {
      return NextResponse.json(
        { error: "Perfil de destino não encontrado." },
        { status: 404 },
      );
    }

    const admin = createSupabaseAdminClient();

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
      if (isProtectedSuperadmin(target.email)) {
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
        actor,
        target,
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
        return NextResponse.json({ error: "Campus informado é inválido." }, { status: 400 });
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
        actor,
        target,
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
      const { error: notificationError } = await admin.from("notifications").insert({
        user_id: target.id,
        title: "Acesso ao PERCATA atualizado",
        message:
          "Seu perfil foi revisado pela governança. Entre no sistema para validar seus dados de unidade e campanhas ativas.",
        type: "info",
      });
      if (notificationError) throw notificationError;

      await insertAuditLog({
        actor,
        target,
        action: "send_access_reminder",
        details: {
          queued_email: Boolean(target.email),
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "reset_onboarding") {
      if (isProtectedSuperadmin(target.email)) {
        return NextResponse.json(
          { error: "Reset de onboarding bloqueado para superadmin institucional." },
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
        actor,
        target,
        action: "reset_onboarding",
        details: {
          previous_campus_id: target.campus_id,
        },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Falha ao executar ação de usuário." },
      { status: 500 },
    );
  }
}
