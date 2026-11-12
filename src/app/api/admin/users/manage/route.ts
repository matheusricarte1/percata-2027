import { NextResponse } from "next/server";
import {
  normalizeRole,
  type UserRole,
} from "@/lib/access";
import { sanitizePlainText, sanitizeUuid } from "@/lib/settings-sanitize";
import { withAuthorizedRole } from "@/lib/api-auth";
import {
  evaluateAdminTargetAccess,
  resolveManagedCampus,
} from "@/lib/admin-role-policy";
import { normalizeManagedUnitLinks } from "@/lib/admin-unit-memberships";

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
      departamento_id?: string | null;
      departamentos?: Array<{ id?: string | null; role?: "membro" | "chefia" | null }>;
      laboratorio_id?: string | null;
      laboratorios?: Array<{
        id?: string | null;
        role?: "membro" | "chefia" | null;
      }>;
      departamento_role?: "membro" | "chefia" | null;
      laboratorio_role?: "membro" | "chefia" | null;
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
  void email;
  return role === "superadmin";
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

    let actorCampusId: string | null = null;
    if (actorRole === "admin") {
      const { data: actorProfile, error: actorProfileError } = await admin
        .from("profiles")
        .select("campus_id")
        .eq("id", user.id)
        .maybeSingle();
      if (actorProfileError) throw actorProfileError;
      actorCampusId = String(actorProfile?.campus_id || "").trim() || null;
    }

    const targetAccess = evaluateAdminTargetAccess({
      actorRole,
      actorCampusId,
      targetCampusId: target.campus_id,
      targetRole: target.role,
    });
    if (!targetAccess.allowed) {
      return NextResponse.json(
        { error: "Administrador só pode gerenciar perfis não protegidos do próprio campus." },
        { status: 403 },
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

      if (nextRole === "solicitante" || nextRole === "admin") {
        const { data: chefiaLinks, error: chefiaLinksError } = await admin
          .from("user_units")
          .select("id")
          .eq("user_id", target.id)
          .eq("role_in_unit", "chefia")
          .limit(1);
        if (chefiaLinksError) throw chefiaLinksError;
        if (chefiaLinks?.length) {
          return NextResponse.json(
            { error: "Remova os papéis de chefia dos setores e laboratórios antes de alterar o perfil para Solicitante ou Admin." },
            { status: 409 },
          );
        }
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
      const requestedCampusId = body.campus_id ? sanitizeUuid(body.campus_id) : null;
      const nextDepartamentoId = body.departamento_id
        ? sanitizeUuid(body.departamento_id)
        : null;
      const nextLaboratorioId = body.laboratorio_id
        ? sanitizeUuid(body.laboratorio_id)
        : null;
      const requestedDepartamentos = Array.isArray(body.departamentos)
        ? body.departamentos
        : nextDepartamentoId
          ? [{ id: nextDepartamentoId, role: body.departamento_role }]
          : [];
      const nextDepartamentos = normalizeManagedUnitLinks(
        requestedDepartamentos.map((departamento) => ({
          unit_id: sanitizeUuid(departamento?.id) || "",
          unit_type: "departamento" as const,
          role_in_unit: departamento?.role === "chefia" ? "chefia" : "membro",
        })),
      );
      const requestedLaboratorios = Array.isArray(body.laboratorios)
        ? body.laboratorios
        : nextLaboratorioId
          ? [{ id: nextLaboratorioId, role: body.laboratorio_role }]
          : [];
      const nextLaboratorios = normalizeManagedUnitLinks(
        requestedLaboratorios.map((laboratorio) => ({
          unit_id: sanitizeUuid(laboratorio?.id) || "",
          unit_type: "laboratorio" as const,
          role_in_unit: laboratorio?.role === "chefia" ? "chefia" : "membro",
        })),
      );
      if (body.campus_id && !requestedCampusId) {
        return NextResponse.json(
          { error: "Campus informado é inválido." },
          { status: 400 },
        );
      }
      const managedCampus = resolveManagedCampus({
        actorRole,
        actorCampusId,
        requestedCampusId,
      });
      if (!managedCampus.allowed) {
        return NextResponse.json(
          { error: "Administrador não pode mover perfis para outro campus." },
          { status: 403 },
        );
      }
      const nextCampusId = managedCampus.campusId;
      if (target.role === "admin" && [...nextDepartamentos, ...nextLaboratorios].some((unit) => unit.role_in_unit === "chefia")) {
        return NextResponse.json(
          { error: "O perfil Admin não possui acesso à avaliação. Revise o perfil antes de atribuir chefia." },
          { status: 409 },
        );
      }
      if (target.role === "solicitante" || target.role === "chefia") {
        if (nextDepartamentos.length === 0 && nextLaboratorios.length === 0) {
          return NextResponse.json(
            { error: "Solicitante e chefia precisam estar vinculados a um setor ou laboratório." },
            { status: 400 },
          );
        }
      }
      if (
        (body.departamento_id && !nextDepartamentoId) ||
        requestedDepartamentos.some((departamento) => departamento?.id && !sanitizeUuid(departamento.id))
      ) {
        return NextResponse.json(
          { error: "Setor informado é inválido." },
          { status: 400 },
        );
      }
      if (
        (body.laboratorio_id && !nextLaboratorioId) ||
        requestedLaboratorios.some((laboratorio) => laboratorio?.id && !sanitizeUuid(laboratorio.id))
      ) {
        return NextResponse.json(
          { error: "Laboratório informado é inválido." },
          { status: 400 },
        );
      }
      if ((nextDepartamentos.length > 0 || nextLaboratorios.length > 0) && !nextCampusId) {
        return NextResponse.json(
          {
            error:
              "Selecione o campus antes de vincular setor ou laboratório.",
          },
          { status: 400 },
        );
      }

      const { data: existingUnits, error: existingUnitsError } = await admin
        .from("user_units")
        .select("unit_type,unit_id,role_in_unit")
        .eq("user_id", target.id)
        .in("unit_type", ["departamento", "laboratorio"]);
      if (existingUnitsError) throw existingUnitsError;

      const previousDepartamentoIds = (existingUnits || [])
        .filter((row: any) => row.unit_type === "departamento")
        .map((row: any) => row.unit_id);
      const previousLaboratorioIds = (existingUnits || [])
        .filter((row: any) => row.unit_type === "laboratorio")
        .map((row: any) => row.unit_id);

      if (nextDepartamentos.length > 0) {
        const { data: deptData, error: deptError } = await admin
          .from("departamentos")
          .select("id,campus_id")
          .in("id", nextDepartamentos.map((departamento) => departamento.unit_id));
        if (deptError) throw deptError;
        if (!deptData || deptData.length !== nextDepartamentos.length) {
          return NextResponse.json(
            { error: "Setor informado não foi encontrado." },
            { status: 404 },
          );
        }
        if (deptData.some((departamento) => String(departamento.campus_id || "") !== String(nextCampusId || ""))) {
          return NextResponse.json(
            { error: "Setor não pertence ao campus selecionado." },
            { status: 400 },
          );
        }
      }

      if (nextLaboratorios.length > 0) {
        const { data: labData, error: labError } = await admin
          .from("laboratorios")
          .select("id,campus_id")
          .in("id", nextLaboratorios.map((laboratorio) => laboratorio.unit_id));
        if (labError) throw labError;
        if (!labData || labData.length !== nextLaboratorios.length) {
          return NextResponse.json(
            { error: "Laboratório informado não foi encontrado." },
            { status: 404 },
          );
        }
        if (labData.some((laboratorio) => String(laboratorio.campus_id || "") !== String(nextCampusId || ""))) {
          return NextResponse.json(
            { error: "Laboratório não pertence ao campus selecionado." },
            { status: 400 },
          );
        }
      }

      const { error } = await admin
        .from("profiles")
        .update({
          full_name: nextName || null,
          campus_id: nextCampusId || null,
        })
        .eq("id", target.id);
      if (error) throw error;

      const { error: deleteUnitsError } = await admin
        .from("user_units")
        .delete()
        .eq("user_id", target.id)
        .in("unit_type", ["departamento", "laboratorio"]);
      if (deleteUnitsError) throw deleteUnitsError;

      const unitInserts = [
        ...nextDepartamentos.map((departamento) => ({
          user_id: target.id,
          unit_type: "departamento" as const,
          unit_id: departamento.unit_id,
          role_in_unit: departamento.role_in_unit,
        })),
        ...nextLaboratorios.map((laboratorio) => ({
          user_id: target.id,
          unit_type: "laboratorio" as const,
          unit_id: laboratorio.unit_id,
          role_in_unit: laboratorio.role_in_unit,
        })),
      ].filter(Boolean) as Array<{
        user_id: string;
        unit_type: "departamento" | "laboratorio";
        unit_id: string;
         role_in_unit: "membro" | "chefia";
      }>;

      if (unitInserts.length > 0) {
        const { error: insertUnitsError } = await admin
          .from("user_units")
          .insert(unitInserts);
        if (insertUnitsError) throw insertUnitsError;
      }

      await insertAuditLog({
        action: "update_profile",
        details: {
          previous_full_name: target.full_name,
          next_full_name: nextName || null,
          previous_campus_id: target.campus_id,
          next_campus_id: nextCampusId,
          previous_departamento_ids: previousDepartamentoIds,
          next_departamento_ids: nextDepartamentos.map((departamento) => departamento.unit_id),
          previous_laboratorio_ids: previousLaboratorioIds,
          next_laboratorio_ids: nextLaboratorios.map((laboratorio) => laboratorio.unit_id),
          previous_role: target.role,
          next_role: target.role === "solicitante" && unitInserts.some((unit) => unit.role_in_unit === "chefia")
            ? "chefia" : target.role,
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
