"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Users } from "@/components/icons/phosphor/exports/Users";
import { UserPlus } from "@/components/icons/phosphor/exports/UserPlus";
import { Gear } from "@/components/icons/phosphor/exports/Gear";
import { DotsThreeVertical } from "@/components/icons/phosphor/exports/DotsThreeVertical";
import { MagnifyingGlass } from "@/components/icons/phosphor/exports/MagnifyingGlass";
import { X } from "@/components/icons/phosphor/exports/X";
import { CaretDown } from "@/components/icons/phosphor/exports/CaretDown";
import { getSafeUser, supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  OperationalAccordion,
  OperationalChip,
  OperationalEmptyState,
  OperationalKpiCard,
  OperationalTimeline,
  SkeuoDocumentCard,
  SkeuoPaperStack,
  SkeuoProgressRail,
} from "@/components/ui/operational";
import { normalizeRole, type UserRole } from "@/lib/access";
import { sanitizeEmail, sanitizePlainText } from "@/lib/settings-sanitize";
import { getFriendlyErrorMessage, UX_SUCCESS } from "@/lib/ux-feedback";
import { SubmissionPermissionPanel } from "@/components/dfd/SubmissionPermissionPanel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type RowRole = UserRole | "legado" | "pendente";

interface UserRow {
  id: string;
  auth_user_id: string | null;
  profile_id: string | null;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: RowRole;
  campus_nome: string | null;
  campus_sigla: string | null;
  departamento_id: string | null;
  laboratorio_id: string | null;
  departamento_role?: "membro" | "chefia" | null;
  laboratorio_role?: "membro" | "chefia" | null;
  departamento_nome: string | null;
  laboratorio_nome: string | null;
  departamentos: Array<{ id: string; role: "membro" | "chefia"; nome: string }>;
  laboratorios: Array<{ id: string; role: "membro" | "chefia"; nome: string }>;
  source: "perfil" | "legado" | "auth";
  last_sign_in_at: string | null;
  created_at: string | null;
  auth_provider: string | null;
}

interface CampusOption {
  id: string;
  nome: string;
  sigla: string;
}

interface UnitOption {
  id: string;
  nome: string;
  campus_id: string | null;
}

interface UserUnitMembership {
  user_id: string | null;
  unit_type: "departamento" | "laboratorio" | string | null;
  unit_id: string | null;
  role_in_unit: string | null;
}

interface AdminAuditRow {
  id: string;
  actor_email: string;
  actor_role: string;
  target_email: string;
  action:
    | "update_role"
    | "update_profile"
    | "send_access_reminder"
    | "reset_onboarding"
    | "invite_user";
  details: Record<string, any> | null;
  created_at: string;
}

interface PendingLegacyLinkRow {
  legacy_email: string;
  legacy_name: string | null;
  in_directory: boolean;
  demand_links_count: number;
  profile_candidates_count: number;
  suggested_profile_email: string | null;
  validation_status:
    | "email_duplicado_em_profiles"
    | "pendente_de_confirmacao"
    | "sem_conta_no_sistema"
    | string;
  validation_note: string;
}

interface AuthUserSnapshot {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  provider: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
}

interface LoginEventRow {
  id: string;
  email: string;
  provider: string | null;
  full_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  logged_at: string;
  created_at: string;
}

function hasChefiaUnit(user: Pick<UserRow, "departamentos" | "laboratorios">) {
  return user.departamentos.some((departamento) => departamento.role === "chefia") || user.laboratorios.some((laboratorio) => laboratorio.role === "chefia");
}

function getUnitScope(user: Pick<UserRow, "departamentos" | "laboratorios">) {
  return {
    chiefDepartments: user.departamentos.filter((departamento) => departamento.role === "chefia"),
    chiefLaboratories: user.laboratorios.filter((laboratorio) => laboratorio.role === "chefia"),
    memberDepartments: user.departamentos.filter((departamento) => departamento.role !== "chefia"),
    memberLaboratories: user.laboratorios.filter((laboratorio) => laboratorio.role !== "chefia"),
  };
}

function formatUnitCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function hasMemberUnit(user: Pick<UserRow, "departamentos" | "laboratorios">) {
  return Boolean(user.departamentos.length || user.laboratorios.length > 0);
}

function hasPendingUnitDefinition(user: UserRow) {
  if (user.role !== "solicitante" && user.role !== "chefia") return false;
  if (!hasMemberUnit(user)) return true;
  return user.role === "chefia" && !hasChefiaUnit(user);
}

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("Todos");
  const [currentUserRole, setCurrentUserRole] =
    useState<UserRole>("solicitante");
  const [campi, setCampi] = useState<CampusOption[]>([]);
  const [departamentos, setDepartamentos] = useState<UnitOption[]>([]);
  const [laboratorios, setLaboratorios] = useState<UnitOption[]>([]);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [exceptionUser, setExceptionUser] = useState<UserRow | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCampusId, setEditingCampusId] = useState<string>("__none__");
  const [editingDepartamentoId, setEditingDepartamentoId] =
    useState<string>("__none__");
  const [editingLaboratorios, setEditingLaboratorios] = useState<
    Array<{ id: string; role: "membro" | "chefia" }>
  >([]);
  const [editingDepartamentoRole, setEditingDepartamentoRole] =
    useState<"membro" | "chefia">("membro");
  const [editingDepartamentos, setEditingDepartamentos] = useState<Array<{ id: string; role: "membro" | "chefia" }>>([]);
  const [showLaboratoryCatalog, setShowLaboratoryCatalog] = useState(false);
  const [laboratorySearch, setLaboratorySearch] = useState("");
  const [actionUser, setActionUser] = useState<UserRow | null>(null);
  const [savingAction, setSavingAction] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("solicitante");
  const [inviteCampusId, setInviteCampusId] = useState<string>("__none__");
  const [auditLogs, setAuditLogs] = useState<AdminAuditRow[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [pendingLegacyLinks, setPendingLegacyLinks] = useState<
    PendingLegacyLinkRow[]
  >([]);
  const [loadingPendingLegacyLinks, setLoadingPendingLegacyLinks] =
    useState(true);
  const [pendingLegacyLinksNotice, setPendingLegacyLinksNotice] = useState<
    string | null
  >(null);
  const [syncingAuthProfiles, setSyncingAuthProfiles] = useState(false);
  const [loginEvents, setLoginEvents] = useState<LoginEventRow[]>([]);
  const [loadingLoginEvents, setLoadingLoginEvents] = useState(true);
  const [loginEventsNotice, setLoginEventsNotice] = useState<string | null>(null);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const authUser = await getSafeUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authUser.id)
          .maybeSingle();
        setCurrentUserRole(normalizeRole(profile?.role, authUser.email));
      }

      const [
        profilesResult,
        legacyResult,
        campiResult,
        departamentosResult,
        laboratoriosResult,
        userUnitsResult,
        authUsersResponse,
      ] =
        await Promise.all([
        supabase
          .from("profiles")
          .select(
            `
            id,
            full_name,
            email,
            avatar_url,
            role,
            campi:campus_id (nome, sigla)
          `,
          )
          .order("full_name", { ascending: true }),
        supabase
          .from("legacy_user_directory")
          .select("email, server_name, source")
          .order("email", { ascending: true }),
        supabase
          .from("campi")
          .select("id,nome,sigla")
          .eq("ativo", true)
          .order("nome"),
        supabase
          .from("departamentos")
          .select("id,nome,campus_id")
          .order("nome"),
        supabase
          .from("laboratorios")
          .select("id,nome,campus_id")
          .order("nome"),
        supabase
          .from("user_units")
          .select("user_id,unit_type,unit_id,role_in_unit")
           .in("unit_type", ["departamento", "laboratorio"]),
        fetch("/api/admin/users/auth-users?limit=3000"),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (legacyResult.error) throw legacyResult.error;
      if (campiResult.error) throw campiResult.error;
      if (departamentosResult.error) throw departamentosResult.error;
      if (laboratoriosResult.error) throw laboratoriosResult.error;
      if (userUnitsResult.error) throw userUnitsResult.error;
      if (!authUsersResponse.ok) {
        const payload = await authUsersResponse.json().catch(() => ({}));
        throw new Error(
          payload?.error || "Falha ao carregar snapshot de contas autenticadas.",
        );
      }
      setCampi((campiResult.data || []) as CampusOption[]);
      const departamentoRows = (departamentosResult.data || []) as UnitOption[];
      const laboratorioRows = (laboratoriosResult.data || []) as UnitOption[];
      setDepartamentos(departamentoRows);
      setLaboratorios(laboratorioRows);
      const deptById = new Map(departamentoRows.map((row) => [row.id, row]));
      const labById = new Map(laboratorioRows.map((row) => [row.id, row]));
      const unitByUserId = new Map<
        string,
         { departamento_id: string | null; laboratorio_id: string | null; departamento_role: "membro" | "chefia" | null; laboratorio_role: "membro" | "chefia" | null; departamentos: Array<{ id: string; role: "membro" | "chefia" }>; laboratorios: Array<{ id: string; role: "membro" | "chefia" }> }
      >();
      ((userUnitsResult.data || []) as UserUnitMembership[]).forEach((unit) => {
        const userId = String(unit.user_id || "");
        const unitId = String(unit.unit_id || "");
        if (!userId || !unitId) return;
        const current = unitByUserId.get(userId) || {
          departamento_id: null,
          laboratorio_id: null,
          departamento_role: null,
          laboratorio_role: null,
          departamentos: [],
          laboratorios: [],
        };
        if (unit.unit_type === "departamento") {
          const role = unit.role_in_unit === "chefia" ? "chefia" : "membro";
          current.departamentos.push({ id: unitId, role });
          if (!current.departamento_id) {
            current.departamento_id = unitId;
            current.departamento_role = role;
          }
        }
        if (unit.unit_type === "laboratorio") {
          const role = unit.role_in_unit === "chefia" ? "chefia" : "membro";
          current.laboratorios.push({ id: unitId, role });
          if (!current.laboratorio_id) {
            current.laboratorio_id = unitId;
            current.laboratorio_role = role;
          }
        }
        unitByUserId.set(userId, current);
      });

      const authPayload = (await authUsersResponse.json()) as {
        data?: AuthUserSnapshot[];
        unavailable?: boolean;
        reason?: string;
      };
      if (authPayload.unavailable) {
        toast.info(
          authPayload.reason ||
            "Snapshot de contas autenticadas indisponível neste ambiente.",
        );
      }
      const authUsers = (authPayload.data || []) as AuthUserSnapshot[];
      const authByEmail = new Map(
        authUsers
          .filter((entry) => Boolean(entry.email))
          .map((entry) => [String(entry.email).toLowerCase(), entry]),
      );

      const profileRows: UserRow[] = (profilesResult.data || [])
        .filter((profile: any) => Boolean(profile.email))
        .map((profile: any) => ({
          ...(unitByUserId.get(String(profile.id)) || {
          departamento_id: null,
          laboratorio_id: null,
          departamentos: [],
          laboratorios: [],
          }),
          id: profile.id,
          auth_user_id: profile.id,
          profile_id: profile.id,
          full_name: profile.full_name || "Usuário sem nome",
          email: String(profile.email).toLowerCase(),
          avatar_url:
            profile.avatar_url ||
            authByEmail.get(String(profile.email).toLowerCase())?.avatar_url ||
            null,
          role: normalizeRole(profile.role, profile.email),
          campus_nome: profile.campi?.nome || null,
          campus_sigla: profile.campi?.sigla || null,
          departamento_nome: (unitByUserId.get(String(profile.id))?.departamento_id
            ? deptById.get(String(unitByUserId.get(String(profile.id))?.departamento_id || ""))?.nome
            : null) || null,
          laboratorio_nome: (unitByUserId.get(String(profile.id))?.laboratorio_id
            ? labById.get(String(unitByUserId.get(String(profile.id))?.laboratorio_id || ""))?.nome
            : null) || null,
          departamentos: (unitByUserId.get(String(profile.id))?.departamentos || []).map((departamento) => ({
            ...departamento,
            nome: deptById.get(departamento.id)?.nome || "Setor não localizado",
          })),
          laboratorios: (unitByUserId.get(String(profile.id))?.laboratorios || []).map((laboratorio) => ({
            ...laboratorio,
            nome: labById.get(laboratorio.id)?.nome || "Laboratório não localizado",
          })),
          source: "perfil",
          last_sign_in_at:
            authByEmail.get(String(profile.email).toLowerCase())?.last_sign_in_at ||
            null,
          created_at:
            authByEmail.get(String(profile.email).toLowerCase())?.created_at || null,
          auth_provider:
            authByEmail.get(String(profile.email).toLowerCase())?.provider || null,
        }));

      profileRows.forEach((profile) => {
        authByEmail.delete(profile.email);
      });

      const emailSet = new Set(profileRows.map((row) => row.email));
      const legacyRows: UserRow[] = (legacyResult.data || [])
        .filter(
          (legacy: any) =>
            legacy.email &&
            !emailSet.has(String(legacy.email).toLowerCase()),
        )
        .map((legacy: any) => {
          const normalizedEmail = String(legacy.email).toLowerCase();
          const authUser = authByEmail.get(normalizedEmail) || null;
          if (authUser) authByEmail.delete(normalizedEmail);

          return {
            id: authUser?.id ? `auth:${authUser.id}` : `legacy:${legacy.email}`,
            auth_user_id: authUser?.id || null,
            profile_id: null,
            full_name:
              authUser?.full_name ||
              legacy.server_name ||
              "Usuário ativo importado",
            email: normalizedEmail,
            avatar_url: authUser?.avatar_url || null,
            role: authUser ? "pendente" : "legado",
            campus_nome: null,
            campus_sigla: null,
            departamento_id: null,
            laboratorio_id: null,
            departamento_nome: null,
            laboratorio_nome: null,
            departamentos: [],
            laboratorios: [],
            source: authUser ? "auth" : "legado",
            last_sign_in_at: authUser?.last_sign_in_at || null,
            created_at: authUser?.created_at || null,
            auth_provider: authUser?.provider || null,
          } satisfies UserRow;
        });

      const authOnlyRows: UserRow[] = Array.from(authByEmail.values())
        .map((authUser) => {
          return {
            id: `auth:${authUser.id}`,
            auth_user_id: authUser.id,
            profile_id: null,
            full_name:
              authUser.full_name ||
              String(authUser.email || "")
                .split("@")[0]
                .replace(/[._-]/g, " ")
                .trim() ||
              "Conta autenticada",
            email: String(authUser.email).toLowerCase(),
            avatar_url: authUser.avatar_url || null,
            role: "pendente",
            campus_nome: null,
            campus_sigla: null,
            departamento_id: null,
            laboratorio_id: null,
            departamento_nome: null,
            laboratorio_nome: null,
            departamentos: [],
            laboratorios: [],
            source: "auth",
            last_sign_in_at: authUser.last_sign_in_at,
            created_at: authUser.created_at,
            auth_provider: authUser.provider,
          } satisfies UserRow;
        })
        .sort((a, b) => a.email.localeCompare(b.email, "pt-BR"));

      const merged = [...profileRows, ...legacyRows, ...authOnlyRows].sort((a, b) =>
        a.full_name.localeCompare(b.full_name, "pt-BR"),
      );

      setUsuarios(merged);
    } catch (error: any) {
      toast.error(
        getFriendlyErrorMessage(
          error,
          "Não conseguimos carregar os usuários agora. Tente atualizar em instantes.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const response = await fetch("/api/admin/users/audit?limit=25");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao carregar auditoria.");
      }
      setAuditLogs((payload?.data || []) as AdminAuditRow[]);
    } catch (error: any) {
      toast.error(
        getFriendlyErrorMessage(
          error,
          "Não conseguimos carregar a trilha de auditoria agora.",
        ),
      );
      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchLoginEvents = async () => {
    setLoadingLoginEvents(true);
    setLoginEventsNotice(null);
    try {
      const response = await fetch("/api/admin/users/login-events?limit=30");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao carregar eventos de login.");
      }
      if (payload?.warning) {
        setLoginEventsNotice(String(payload.warning));
      }
      setLoginEvents((payload?.data || []) as LoginEventRow[]);
    } catch (error: any) {
      toast.error(
        getFriendlyErrorMessage(
          error,
          "Não conseguimos carregar os eventos de login agora.",
        ),
      );
      setLoginEvents([]);
    } finally {
      setLoadingLoginEvents(false);
    }
  };

  useEffect(() => {
    fetchLoginEvents();
  }, []);

  const fetchPendingLegacyLinks = async () => {
    setLoadingPendingLegacyLinks(true);
    setPendingLegacyLinksNotice(null);
    try {
      const { data, error } = await supabase
        .from("legacy_user_links_pending_v1")
        .select(
          "legacy_email,legacy_name,in_directory,demand_links_count,profile_candidates_count,suggested_profile_email,validation_status,validation_note",
        )
        .limit(40);
      if (error) {
        const message = String(error.message || "");
        if (
          /legacy_user_links_pending_v1|schema cache|does not exist|could not find the table/i.test(
            message,
          )
        ) {
          setPendingLegacyLinks([]);
          setPendingLegacyLinksNotice(
            "Validação de vínculos legados ainda não disponível neste banco. Aplique a migration 20260424013000_legacy_profile_mapping_safe_rollout.sql.",
          );
          return;
        }
        throw error;
      }
      setPendingLegacyLinks((data || []) as PendingLegacyLinkRow[]);
    } catch (error: any) {
      toast.error(
        getFriendlyErrorMessage(
          error,
          "Não conseguimos carregar os vínculos pendentes agora.",
        ),
      );
      setPendingLegacyLinks([]);
    } finally {
      setLoadingPendingLegacyLinks(false);
    }
  };

  useEffect(() => {
    fetchPendingLegacyLinks();
  }, []);

  const openEditPanel = (user: UserRow) => {
    setActionUser(null);
    setEditingUser(user);
    setEditingName(user.full_name || "");
    const campus = campi.find(
      (entry) =>
        (user.campus_nome && entry.nome === user.campus_nome) ||
        (user.campus_sigla && entry.sigla === user.campus_sigla),
    );
    setEditingCampusId(campus?.id || "__none__");
    setEditingDepartamentoId(user.departamento_id || "__none__");
    setEditingDepartamentos(user.departamentos.map(({ id, role }) => ({ id, role })));
    setEditingLaboratorios(user.laboratorios.map(({ id, role }) => ({ id, role })));
    setEditingDepartamentoRole(user.departamento_role || "membro");
  };

  const saveUserConfig = async () => {
    if (!editingUser?.profile_id) return;
    setSavingAction(true);
    try {
      const response = await fetch("/api/admin/users/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_profile",
          profile_id: editingUser.profile_id,
          full_name: sanitizePlainText(editingName, 160) || null,
          campus_id: editingCampusId === "__none__" ? null : editingCampusId,
          departamento_id:
            editingDepartamentoId === "__none__" ? null : editingDepartamentoId,
          departamentos: editingDepartamentos,
          laboratorios: editingLaboratorios,
          departamento_role: editingDepartamentoRole,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao salvar configuração.");
      }
      toast.success(UX_SUCCESS.saved);
      setEditingUser(null);
      await Promise.all([fetchUsuarios(), fetchAuditLogs()]);
    } catch (error: any) {
      toast.error(
        getFriendlyErrorMessage(
          error,
          "Não conseguimos salvar as configurações deste usuário agora.",
        ),
      );
    } finally {
      setSavingAction(false);
    }
  };

  const sendAccessReminder = async (user: UserRow) => {
    if (!user.profile_id) {
      toast.info(
        user.source === "auth"
          ? "Conta autenticada sem perfil local. Sincronize os acessos primeiro."
          : "Cadastro importado ativo, ainda sem conta autenticada.",
      );
      return;
    }
    setSavingAction(true);
    try {
      const response = await fetch("/api/admin/users/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_access_reminder",
          profile_id: user.profile_id,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao enviar aviso.");
      }
      toast.success("Notificação e e-mail enfileirados para o usuário.");
      await fetchAuditLogs();
    } catch (error: any) {
      toast.error(
        getFriendlyErrorMessage(
          error,
          "Não conseguimos enviar o aviso agora. Tente novamente em instantes.",
        ),
      );
    } finally {
      setSavingAction(false);
    }
  };

  const resetUserOnboarding = async (user: UserRow) => {
    if (!user.profile_id) {
      toast.info(
        user.source === "auth"
          ? "Conta autenticada sem perfil local. Sincronize os acessos primeiro."
          : "Cadastro importado ativo, ainda sem conta autenticada.",
      );
      return;
    }
    setSavingAction(true);
    try {
      const response = await fetch("/api/admin/users/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_onboarding",
          profile_id: user.profile_id,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao redefinir onboarding.");
      }

      toast.success("Onboarding redefinido para este usuário.");
      setActionUser(null);
      await Promise.all([fetchUsuarios(), fetchAuditLogs()]);
    } catch (error: any) {
      toast.error(
        getFriendlyErrorMessage(
          error,
          "Não conseguimos redefinir o onboarding agora.",
        ),
      );
    } finally {
      setSavingAction(false);
    }
  };

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteName("");
    setInviteRole("solicitante");
    setInviteCampusId("__none__");
  };

  const submitInvite = async () => {
    const email = sanitizeEmail(inviteEmail);
    if (!email) {
      toast.error("Esse e-mail não parece correto. Revise o endereço antes de enviar o convite.");
      return;
    }
    if (inviteRole === "admin" && currentUserRole !== "superadmin") {
      toast.warning("Somente superadmin pode convidar perfil admin.");
      return;
    }

    setInviting(true);
    try {
      const response = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          full_name: sanitizePlainText(inviteName, 160) || null,
          role: inviteRole,
          campus_id: inviteCampusId === "__none__" ? null : inviteCampusId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao convidar usuário.");
      }

      toast.success("Convite enviado e perfil inicial configurado.");
      setInviteOpen(false);
      resetInviteForm();
      await Promise.all([fetchUsuarios(), fetchAuditLogs()]);
    } catch (error: any) {
      toast.error(
        getFriendlyErrorMessage(
          error,
          "Não conseguimos enviar o convite agora. Revise os dados e tente novamente.",
        ),
      );
    } finally {
      setInviting(false);
    }
  };

  const syncAuthProfiles = async () => {
    setSyncingAuthProfiles(true);
    try {
      const response = await fetch("/api/admin/users/sync-auth-profiles", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error || "Falha ao sincronizar contas autenticadas.",
        );
      }
      toast.success(
        `Sincronização concluída: ${payload.upserted || 0} perfis atualizados e ${payload.linkedLegacy || 0} cadastros importados vinculados.`,
      );
      await Promise.all([fetchUsuarios(), fetchLoginEvents(), fetchAuditLogs()]);
    } catch (error: any) {
      toast.error(
        getFriendlyErrorMessage(
          error,
          "Não conseguimos sincronizar os perfis agora.",
        ),
      );
    } finally {
      setSyncingAuthProfiles(false);
    }
  };

  const filtered = useMemo(() => {
    const roleFilterMap: Record<string, RowRole | null> = {
      todos: null,
      solicitantes: null,
      chefias: "chefia",
      gestores: "chefia",
      admin: "admin",
      superadmin: "superadmin",
      pendentes: null,
      legado: "legado",
      "ativos importados": "legado",
    };
    const selectedRole = roleFilterMap[filterRole.toLowerCase()] ?? null;

    return usuarios.filter((user) => {
      const text = `${user.full_name} ${user.email}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      const normalizedFilter = filterRole.toLowerCase();
      const matchesRole = !selectedRole || user.role === selectedRole;
      const matchesView =
        normalizedFilter !== "chefias" && normalizedFilter !== "solicitantes" && normalizedFilter !== "pendentes"
          ? true
          : normalizedFilter === "chefias"
            ? user.role === "chefia"
            : normalizedFilter === "solicitantes"
              ? user.role === "solicitante" || user.role === "chefia"
              : hasPendingUnitDefinition(user);
      return matchesSearch && matchesRole && matchesView;
    });
  }, [usuarios, search, filterRole]);

  const userKpis = useMemo(() => {
    const activeProfiles = usuarios.filter((user) => user.source === "perfil").length;
    const chiefs = usuarios.filter((user) => user.role === "chefia").length;
    const admins = usuarios.filter((user) => user.role === "admin" || user.role === "superadmin").length;
    const pending = usuarios.filter((user) => user.role === "pendente").length;
    const imported = usuarios.filter((user) => user.source === "legado").length;
    return {
      total: usuarios.length,
      activeProfiles,
      chiefs,
      admins,
      pending,
      imported,
      pendingLegacy: pendingLegacyLinks.length,
    };
  }, [usuarios, pendingLegacyLinks.length]);

  const filteredDepartamentos = useMemo(() => {
    if (editingCampusId === "__none__") return [] as UnitOption[];
    return departamentos.filter(
      (item) => String(item.campus_id || "") === String(editingCampusId),
    );
  }, [departamentos, editingCampusId]);

  const filteredLaboratorios = useMemo(() => {
    if (editingCampusId === "__none__") return [] as UnitOption[];
    return laboratorios.filter(
      (item) => String(item.campus_id || "") === String(editingCampusId),
    );
  }, [laboratorios, editingCampusId]);

  const visibleLaboratorios = useMemo(() => {
    const term = laboratorySearch.trim().toLocaleLowerCase("pt-BR");
    if (!showLaboratoryCatalog) {
      return filteredLaboratorios.filter((laboratorio) =>
        editingLaboratorios.some((membership) => membership.id === laboratorio.id),
      );
    }
    return filteredLaboratorios.filter((laboratorio) =>
      !term || laboratorio.nome.toLocaleLowerCase("pt-BR").includes(term),
    );
  }, [editingLaboratorios, filteredLaboratorios, laboratorySearch, showLaboratoryCatalog]);

  useEffect(() => {
    if (editingCampusId === "__none__") {
      setEditingDepartamentoId("__none__");
      setEditingDepartamentoRole("membro");
      setEditingDepartamentos([]);
      setEditingLaboratorios([]);
      return;
    }

    const deptStillValid = filteredDepartamentos.some(
      (item) => item.id === editingDepartamentoId,
    );
    if (!deptStillValid) setEditingDepartamentoId("__none__");
    if (!deptStillValid) setEditingDepartamentoRole("membro");

    setEditingDepartamentos((current) =>
      current.filter((departamento) => filteredDepartamentos.some((item) => item.id === departamento.id)),
    );

    setEditingLaboratorios((current) =>
      current.filter((laboratorio) =>
        filteredLaboratorios.some((item) => item.id === laboratorio.id),
      ),
    );
  }, [
    editingCampusId,
    editingDepartamentoId,
    editingDepartamentos,
    filteredDepartamentos,
    filteredLaboratorios,
  ]);

  return (
    <div className="p-8 bg-[var(--p-color-bg-muted)] min-h-screen space-y-8">
      <div className="flex justify-between items-center bg-white p-8 rounded-[40px] border border-[var(--p-color-border)] shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-[var(--p-color-brand-500)] text-white rounded-3xl flex items-center justify-center text-3xl shadow-lg">
            <Users weight="fill" />
          </div>
          <div>
            <h1 className="font-display text-4xl font-semibold text-[var(--p-color-brand-500)] tracking-tighter uppercase">
              Pessoas e Permissões
            </h1>
            <p className="text-black/40 text-sm font-medium">
              Lista unificada de perfis ativos e registros anteriores por e-mail.
            </p>
          </div>
        </div>
        <SkeuoPaperStack
          title="Fichário de acessos"
          subtitle={`${userKpis.activeProfiles} perfis locais, ${userKpis.imported} importados e ${userKpis.pendingLegacy} vínculos legados pendentes.`}
          stamp={userKpis.pending + userKpis.pendingLegacy > 0 ? "Revisar" : "Regular"}
          tone={userKpis.pending + userKpis.pendingLegacy > 0 ? "warning" : "success"}
          className="hidden 2xl:block"
        />
        <div className="flex flex-wrap items-center gap-2">
          {currentUserRole === "superadmin" && (
            <button
              type="button"
              onClick={syncAuthProfiles}
              disabled={syncingAuthProfiles}
              className="flex items-center gap-2 border border-[var(--p-color-border)] bg-white text-[var(--p-color-fg-muted)] px-4 py-3 rounded-2xl font-semibold type-kicker uppercase tracking-widest hover:bg-[var(--p-color-bg-muted)] transition-all disabled:opacity-70"
            >
              <Users size={16} weight="bold" />
              {syncingAuthProfiles ? "Sincronizando..." : "Sincronizar acessos"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-3 bg-[var(--p-color-brand-500)] text-white px-8 py-4 rounded-3xl font-semibold text-xs uppercase tracking-widest shadow-2xl shadow-upe-accent-washed-blue/60 hover:scale-105 active:scale-95 transition-all"
          >
            <UserPlus size={20} weight="bold" />
            Convidar Servidor
          </button>
        </div>
      </div>

      {currentUserRole === "superadmin" && (
        <div className="rounded-2xl border border-upe-accent-washed-blue/70 bg-upe-accent-washed-blue/25 px-4 py-3 type-caption font-bold uppercase tracking-widest text-upe-blue-upe">
          Sessão superadmin: acesso completo para configurar perfis.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <OperationalKpiCard
          label="Pessoas listadas"
          value={loading ? "..." : userKpis.total}
          icon={<Users size={17} weight="duotone" />}
          tone="action"
        />
        <OperationalKpiCard
          label="Perfis ativos"
          value={loading ? "..." : userKpis.activeProfiles}
          icon={<UserPlus size={17} weight="duotone" />}
          tone="success"
          helper="Com cadastro local"
        />
        <OperationalKpiCard
          label="Chefias"
          value={loading ? "..." : userKpis.chiefs}
          icon={<Gear size={17} weight="duotone" />}
          tone="collab"
          helper="Também solicitantes"
        />
        <OperationalKpiCard
          label="Admins"
          value={loading ? "..." : userKpis.admins}
          icon={<DotsThreeVertical size={17} weight="duotone" />}
          tone="insight"
          helper="Admin/superadmin"
        />
        <OperationalKpiCard
          label="Pendências"
          value={loading ? "..." : userKpis.pending + userKpis.pendingLegacy}
          icon={<CaretDown size={17} weight="duotone" />}
          tone="warning"
          helper="Perfil ou vínculo"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <OperationalAccordion
          items={[
            {
              title: "Perfis e permissões",
              badge: <OperationalChip tone="action">Referência</OperationalChip>,
              defaultOpen: true,
              content: (
                <div className="flex flex-wrap gap-2">
                  <OperationalChip tone="neutral">Solicitante</OperationalChip>
                  <OperationalChip tone="collab">Chefia + Solicitante</OperationalChip>
                  <OperationalChip tone="insight">Admin</OperationalChip>
                  <OperationalChip tone="warning">Pendente</OperationalChip>
                </div>
              ),
            },
          ]}
        />
        <div className="rounded-2xl border border-[var(--p-color-border)] bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-[var(--p-color-brand-500)]">Como os acessos são administrados</p>
          <OperationalTimeline
            items={[
              { title: "Sincronizar acessos", description: "Cria ou vincula perfis locais a contas autenticadas.", tone: "action" },
              { title: "Ajustar permissões", description: "Mudanças de papel e vínculo geram trilha de auditoria.", tone: "collab" },
              { title: "Convidar servidor", description: "Cria o perfil inicial e registra o convite na trilha administrativa.", tone: "success" },
            ]}
          />
        </div>
      </div>

      <SkeuoDocumentCard
        title="Saúde cadastral"
        meta="Distribuição da base entre perfis ativos, chefias e pendências."
        stamp="Base"
        tone="collab"
      >
        <SkeuoProgressRail
          items={[
            {
              label: "Perfis ativos",
              value: userKpis.total ? (userKpis.activeProfiles / userKpis.total) * 100 : 0,
              tone: "success",
            },
            {
              label: "Chefias",
              value: userKpis.total ? (userKpis.chiefs / userKpis.total) * 100 : 0,
              tone: "collab",
            },
            {
              label: "Pendências",
              value: userKpis.total ? ((userKpis.pending + userKpis.pendingLegacy) / userKpis.total) * 100 : 0,
              tone: "warning",
            },
          ]}
          className="border-0 p-0 shadow-none"
        />
      </SkeuoDocumentCard>

      <CollapsibleSection
        title="Vínculos Legados Pendentes"
        description="E-mails legados que ainda precisam de confirmação de vínculo com conta ativa."
        defaultOpen={pendingLegacyLinks.length > 0}
        actions={
          <button
            type="button"
            onClick={fetchPendingLegacyLinks}
            className="h-9 rounded-xl border border-black/10 bg-[var(--p-color-bg-muted)] px-3 type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-fg-muted)] hover:bg-[var(--p-color-border-muted)]"
          >
            Atualizar validação
          </button>
        }
      >

        {pendingLegacyLinksNotice && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            {pendingLegacyLinksNotice}
          </div>
        )}

        <div className="mt-3 space-y-2">
          {loadingPendingLegacyLinks &&
            [1, 2, 3].map((idx) => (
              <Skeleton
                key={`legacy-pending-${idx}`}
                className="h-14 w-full rounded-xl"
              />
            ))}

          {!loadingPendingLegacyLinks && pendingLegacyLinks.length === 0 && (
            <OperationalEmptyState
              title="Nenhum vínculo pendente"
              description="Os cadastros legados disponíveis já foram vinculados ou não exigem ação agora."
              className="p-6"
            />
          )}

          {!loadingPendingLegacyLinks &&
            pendingLegacyLinks.map((row) => (
              <div
                key={row.legacy_email}
                className="rounded-xl border border-black/5 bg-[var(--p-color-bg-elevated)] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--p-color-fg-strong)]">
                      {row.legacy_name || "Servidor legado"}
                    </p>
                    <p className="text-xs font-semibold text-[var(--p-color-fg-muted)]">
                      {row.legacy_email}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 type-kicker font-semibold uppercase tracking-widest ${
                      row.validation_status === "email_duplicado_em_profiles"
                        ? "bg-red-50 text-red-700"
                        : row.validation_status === "pendente_de_confirmacao"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {row.validation_status === "email_duplicado_em_profiles"
                      ? "Duplicidade"
                      : row.validation_status === "pendente_de_confirmacao"
                        ? "Confirmar vínculo"
                        : "Sem conta ativa"}
                  </span>
                </div>

                <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">{row.validation_note}</p>
                <p className="mt-1 type-caption font-semibold text-[var(--p-color-fg-muted)]">
                  Sugestão de conta: {row.suggested_profile_email || "não encontrada"} •
                  vínculos em demandas: {row.demand_links_count}
                </p>
              </div>
            ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Usuários cadastrados"
        description="Abra para buscar, filtrar e administrar os perfis do sistema."
        defaultOpen={false}
      >
      <div className="bg-white p-6 rounded-[24px] border border-[var(--p-color-border)] shadow-sm flex flex-wrap gap-4 items-center">
        <div className="relative min-w-0 basis-full flex-1 sm:min-w-[300px] sm:basis-auto">
          <MagnifyingGlass
            className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20"
            size={18}
          />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            aria-label="Buscar usuários por nome ou e-mail"
            className="w-full pl-12 pr-4 py-3 bg-[var(--p-color-bg-muted)] border border-[var(--p-color-border)] rounded-2xl text-sm font-medium focus:ring-2 focus:ring-upe-accent-washed-blue/70 transition-all outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Todos", count: userKpis.total, tone: "action" as const },
            { label: "Solicitantes", count: usuarios.filter((user) => user.role === "solicitante" || user.role === "chefia").length, tone: "neutral" as const },
            { label: "Chefias", count: userKpis.chiefs, tone: "collab" as const },
            { label: "Admin", count: usuarios.filter((user) => user.role === "admin").length, tone: "insight" as const },
            { label: "Superadmin", count: usuarios.filter((user) => user.role === "superadmin").length, tone: "insight" as const },
            { label: "Pendentes", count: usuarios.filter(hasPendingUnitDefinition).length + userKpis.pending, tone: "warning" as const },
            { label: "Ativos importados", count: userKpis.imported, tone: "success" as const },
          ].map(({ label, count, tone }) => (
              <button
                key={label}
                type="button"
                aria-pressed={filterRole === label}
                onClick={() => setFilterRole(label)}
                className="rounded-full transition hover:-translate-y-0.5"
              >
                <OperationalChip tone={tone} active={filterRole === label} className="min-h-10 px-4 uppercase tracking-widest">
                  {label} ({count})
                </OperationalChip>
              </button>
          ))}
        </div>

        <div className="w-full rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-muted)] px-3 py-2 type-caption font-semibold text-[var(--p-color-fg-muted)]">
          Regra de acesso: perfil <b>Chefia</b> mantém as funções de <b>Solicitante</b> (catálogo, nova DFD e minhas DFDs).
          {" "}Cadastros importados são tratados como ativos e passam a operar como perfil local após sincronização.
        </div>
      </div>

      <p className="px-2 text-xs text-[var(--p-color-fg-muted)] md:hidden">Deslize a tabela para ver lotação, perfil e ações.</p>
      <div className="overflow-x-auto rounded-[24px] border border-[var(--p-color-border)] bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2" role="region" aria-label="Tabela de usuários cadastrados" tabIndex={0}>
        <table className="min-w-[1040px] w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[21%]" />
            <col className="w-[24%]" />
            <col className="w-[26%]" />
            <col className="w-[17%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead>
            <tr className="bg-[var(--p-color-bg-muted)] text-[var(--p-color-fg-muted)]">
              <th className="px-5 py-4 font-semibold uppercase tracking-[0.2em] type-kicker">
                Servidor
              </th>
              <th className="px-5 py-4 font-semibold uppercase tracking-[0.2em] type-kicker">
                E-mail
              </th>
              <th className="px-5 py-4 font-semibold uppercase tracking-[0.2em] type-kicker">
                Lotação
              </th>
              <th className="px-5 py-4 font-semibold uppercase tracking-[0.2em] type-kicker">
                Perfil
              </th>
              <th className="px-5 py-4 font-semibold uppercase tracking-[0.2em] type-kicker text-right">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {loading
              ? [1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={5} className="p-4">
                      <Skeleton className="h-12 w-full rounded-2xl" />
                    </td>
                  </tr>
                ))
              : filtered.map((user) => {
                  const isProtectedSuperadmin = user.role === "superadmin";
                  const isLegacyOnly = user.source === "legado";
                  const unitScope = getUnitScope(user);
                  const chiefSummary = [
                    formatUnitCount(unitScope.chiefDepartments.length, "setor", "setores"),
                    formatUnitCount(unitScope.chiefLaboratories.length, "laboratório", "laboratórios"),
                  ];
                  const memberSummary = [
                    ...unitScope.memberDepartments.map((departamento) => `Setor: ${departamento.nome}`),
                    ...unitScope.memberLaboratories.map((laboratorio) => `Laboratório: ${laboratorio.nome}`),
                  ];

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-[var(--p-color-bg-muted)] transition-colors group"
                    >
                      <td className="px-5 py-4 align-middle">
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar
                            name={user.full_name}
                            avatarUrl={user.avatar_url}
                            sizeClassName="h-10 w-10 shrink-0 group-hover:scale-105 transition-transform"
                            textClassName="text-xs"
                          />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-[var(--p-color-fg-strong)] uppercase tracking-tight" title={user.full_name}>
                              {user.full_name}
                            </div>
                            <div className="type-kicker font-semibold uppercase tracking-widest text-black/25">
                              {user.source === "perfil"
                                ? "Perfil ativo"
                                : user.source === "auth"
                                  ? "Conta autenticada"
                                  : "Cadastro importado ativo"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[var(--p-color-fg-muted)]" title={user.email}>
                            {user.email}
                          </span>
                          <div className="mt-1 type-kicker font-semibold uppercase tracking-widest text-black/35">
                            Último acesso:{" "}
                            {user.last_sign_in_at
                              ? new Date(user.last_sign_in_at).toLocaleString(
                                  "pt-BR",
                                )
                              : "não registrado"}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="truncate font-semibold text-[var(--p-color-fg-muted)] uppercase tracking-widest type-kicker" title={user.campus_nome || "Não vinculado"}>
                          {user.campus_nome || "Não vinculado"}
                        </div>
                        <div className="type-micro uppercase font-semibold text-black/20 tracking-tighter">
                          SIGLA: {user.campus_sigla || "N/A"}
                        </div>
                        <div className="mt-2 space-y-1.5 text-[var(--p-color-fg-muted)]">
                          <p className="type-kicker font-semibold leading-4">
                            <span className="mr-1 uppercase tracking-widest text-emerald-700">Chefia:</span>
                            {hasChefiaUnit(user)
                              ? chiefSummary.join(" · ")
                              : "Nenhuma unidade definida"}
                          </p>
                          <p className="line-clamp-2 type-kicker font-semibold leading-4" title={memberSummary.join(" · ") || "Nenhuma unidade como membro"}>
                            <span className="mr-1 uppercase tracking-widest text-sky-700">Membro:</span>
                            {memberSummary.length ? memberSummary.join(" · ") : "Nenhuma unidade como membro"}
                          </p>
                          {hasPendingUnitDefinition(user) && (
                            <OperationalChip tone="warning" className="w-fit px-2 py-0.5 type-micro uppercase tracking-widest">
                              Vínculo pendente
                            </OperationalChip>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isLegacyOnly ? (
                            <OperationalChip tone="success" className="px-3 py-1.5 type-kicker uppercase tracking-widest">
                              Ativo importado
                            </OperationalChip>
                          ) : user.role === "pendente" ? (
                            <OperationalChip tone="warning" className="px-3 py-1.5 type-kicker uppercase tracking-widest">
                              Pendente perfil
                            </OperationalChip>
                          ) : isProtectedSuperadmin ? (
                            <OperationalChip tone="insight" className="px-3 py-1.5 type-kicker uppercase tracking-widest">
                              Superadmin
                            </OperationalChip>
                          ) : user.role === "chefia" ? (
                            <>
                              <OperationalChip tone="success" className="px-3 py-1.5 type-kicker uppercase tracking-widest">
                                Chefia
                              </OperationalChip>
                              <OperationalChip tone="action" className="px-3 py-1.5 type-kicker uppercase tracking-widest">
                                Solicitante
                              </OperationalChip>
                            </>
                          ) : user.role === "admin" ? (
                            <OperationalChip tone="danger" className="px-3 py-1.5 type-kicker uppercase tracking-widest">
                              Admin
                            </OperationalChip>
                          ) : (
                            <OperationalChip tone="action" className="px-3 py-1.5 type-kicker uppercase tracking-widest">
                              Solicitante
                            </OperationalChip>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 align-middle text-right">
                        <div className="relative flex min-w-[88px] justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditPanel(user)}
                            aria-label={`Editar ${user.full_name}`}
                            title="Editar perfil e vínculos"
                            className="rounded-xl bg-black/5 p-2.5 text-black/40 shadow-sm transition-all hover:bg-black/10 hover:text-slate-800"
                          >
                            <Gear size={19} weight="fill" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setActionUser((prev) =>
                                prev?.id === user.id ? null : user,
                              )
                            }
                            aria-label={`Mais ações para ${user.full_name}`}
                            title="Mais ações"
                            className="rounded-xl bg-black/5 p-2.5 text-black/40 shadow-sm transition-all hover:bg-black/10 hover:text-slate-800"
                          >
                            <DotsThreeVertical size={20} weight="bold" />
                          </button>
                          {actionUser?.id === user.id && (
                            <div className="absolute right-0 top-12 z-20 w-60 rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
                              <button
                                type="button"
                                onClick={() => sendAccessReminder(user)}
                                disabled={savingAction}
                                className="w-full rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-upe-blue-upe hover:bg-upe-neutral-cool-ice"
                              >
                                Enviar aviso de acesso
                              </button>
                              {currentUserRole === "superadmin" && user.profile_id && (
                                <button type="button" onClick={() => { setExceptionUser(user); setActionUser(null); }} className="min-h-11 w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-[var(--semantic-collab)] hover:bg-[var(--p-color-info-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-action)]">Solicitações fora do prazo</button>
                              )}
                              <button
                                type="button"
                                onClick={() => resetUserOnboarding(user)}
                                disabled={savingAction}
                                className="w-full rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-upe-red-dark hover:bg-red-50"
                              >
                                Resetar onboarding
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>

        {!loading && filtered.length === 0 && (
          <div className="p-8">
            <OperationalEmptyState
              icon={<MagnifyingGlass size={34} weight="thin" />}
              title="Nenhum usuário encontrado"
              description="Ajuste busca, perfil ou sincronize acessos para atualizar a base."
              action={(search || filterRole !== "Todos") ? <button type="button" onClick={() => { setSearch(""); setFilterRole("Todos"); }} className="min-h-10 rounded-xl border border-[var(--p-color-border)] px-4 text-sm font-semibold text-[var(--p-color-brand-500)]">Limpar busca e perfil</button> : undefined}
            />
          </div>
        )}
      </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Últimas ações administrativas"
        description="Trilha de auditoria das alterações feitas por admins e superadmins."
        defaultOpen={false}
        actions={
          <button
            type="button"
            onClick={fetchAuditLogs}
            className="h-9 rounded-xl border border-black/10 bg-[var(--p-color-bg-muted)] px-3 type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-fg-muted)] hover:bg-[var(--p-color-border-muted)]"
          >
            Atualizar
          </button>
        }
      >

        <div className="mt-4 space-y-2">
          {loadingAudit &&
            [1, 2, 3].map((i) => (
              <Skeleton key={`audit-${i}`} className="h-14 w-full rounded-xl" />
            ))}

          {!loadingAudit &&
            auditLogs.map((row) => {
              const actionLabelMap: Record<AdminAuditRow["action"], string> = {
                update_role: "Alteração de papel",
                update_profile: "Alteração de cadastro",
                send_access_reminder: "Aviso de acesso",
                reset_onboarding: "Reset de onboarding",
                invite_user: "Convite de usuário",
              };
              return (
                <div
                  key={row.id}
                  className="rounded-xl border border-black/5 bg-[var(--p-color-bg-elevated)] px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-fg-subtle)]">
                      {actionLabelMap[row.action] || row.action}
                    </span>
                    <span className="type-kicker font-semibold uppercase tracking-widest text-black/35">
                      {new Date(row.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
                    <b>{row.actor_email}</b> ({row.actor_role}) →{" "}
                    <b>{row.target_email}</b>
                  </p>
                </div>
              );
            })}

          {!loadingAudit && auditLogs.length === 0 && (
            <OperationalEmptyState
              title="Sem eventos de auditoria"
              description="Alterações de perfil, convite e avisos aparecerão aqui."
              className="p-6"
            />
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Eventos recentes de login"
        description="Acompanhamento de acessos recentes para suporte e segurança."
        defaultOpen={false}
        actions={
          <button
            type="button"
            onClick={fetchLoginEvents}
            className="h-9 rounded-xl border border-black/10 bg-[var(--p-color-bg-muted)] px-3 type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-fg-muted)] hover:bg-[var(--p-color-border-muted)]"
          >
            Atualizar
          </button>
        }
      >

        {loginEventsNotice && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            {loginEventsNotice}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {loadingLoginEvents &&
            [1, 2, 3].map((idx) => (
              <Skeleton
                key={`login-event-${idx}`}
                className="h-14 w-full rounded-xl"
              />
            ))}

          {!loadingLoginEvents &&
            loginEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-black/5 bg-[var(--p-color-bg-elevated)] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[var(--p-color-fg-strong)]">
                    {event.full_name || event.email}
                  </p>
                  <span className="type-kicker font-semibold uppercase tracking-widest text-black/35">
                    {new Date(event.logged_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
                  {event.email} • provedor:{" "}
                  <b>{event.provider || "não informado"}</b>
                </p>
                <p className="mt-1 type-kicker text-[var(--p-color-fg-muted)]">
                  IP: {event.ip_address || "não informado"}
                </p>
              </div>
            ))}

          {!loadingLoginEvents && loginEvents.length === 0 && (
            <OperationalEmptyState
              title="Sem eventos de login"
              description="Quando houver acessos recentes, os registros aparecem nesta seção."
              className="p-6"
            />
          )}
        </div>
      </CollapsibleSection>

      {inviteOpen && (
        <div className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-[28px] border border-black/10 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl font-semibold text-[var(--p-color-brand-500)] uppercase tracking-tight">
                  Convidar Servidor
                </h3>
                <p className="mt-1 text-xs text-black/45">
                  Convite por e-mail com criação de perfil inicial.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="h-9 w-9 rounded-xl border border-black/10 text-black/50 hover:bg-black/5 inline-flex items-center justify-center"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <label className="type-kicker font-semibold uppercase tracking-widest text-black/40">
                E-mail institucional
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="servidor@upe.br"
                className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
              />

              <label className="type-kicker font-semibold uppercase tracking-widest text-black/40">
                Nome completo (opcional)
              </label>
              <input
                value={inviteName}
                onChange={(event) => setInviteName(event.target.value)}
                className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <label className="type-kicker font-semibold uppercase tracking-widest text-black/40">
                    Papel inicial
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(event) =>
                      setInviteRole(event.target.value as UserRole)
                    }
                    className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
                  >
                    <option value="solicitante">Solicitante</option>
                    <option value="chefia">Chefia + Solicitante</option>
                    {currentUserRole === "superadmin" && (
                      <option value="admin">Admin</option>
                    )}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="type-kicker font-semibold uppercase tracking-widest text-black/40">
                    Campus inicial
                  </label>
                  <select
                    value={inviteCampusId}
                    onChange={(event) => setInviteCampusId(event.target.value)}
                    className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
                  >
                    <option value="__none__">Sem vínculo inicial</option>
                    {campi.map((campus) => (
                      <option key={campus.id} value={campus.id}>
                        {campus.nome} ({campus.sigla})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setInviteOpen(false);
                  resetInviteForm();
                }}
                className="h-10 rounded-xl border border-black/10 px-4 text-xs font-semibold uppercase tracking-widest text-black/55"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitInvite}
                disabled={inviting}
                className="h-10 rounded-xl bg-[var(--p-color-brand-500)] px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-upe-blue-deep disabled:opacity-70"
              >
                {inviting ? "Enviando..." : "Enviar convite"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={Boolean(exceptionUser)} onOpenChange={(open) => { if (!open) setExceptionUser(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto bg-[var(--p-color-bg)] text-[var(--p-color-fg)] sm:max-w-3xl">
          <DialogHeader><DialogTitle>Liberação individual</DialogTitle><DialogDescription>{exceptionUser?.full_name} · {exceptionUser?.email}</DialogDescription></DialogHeader>
          {exceptionUser?.profile_id && <SubmissionPermissionPanel userId={exceptionUser.profile_id} />}
        </DialogContent>
      </Dialog>
      {editingUser && (
        <div className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-[28px] border border-black/10 bg-white p-6 shadow-2xl">
            <h3 className="font-display text-2xl font-semibold text-[var(--p-color-brand-500)] uppercase tracking-tight">
              Perfil Completo do Usuário
            </h3>
            <p className="mt-1 text-xs text-black/45">{editingUser.email}</p>

            <div className="mt-4 rounded-2xl border border-black/10 bg-[var(--p-color-surface-soft)] p-4">
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={editingUser.full_name}
                  avatarUrl={editingUser.avatar_url}
                  sizeClassName="h-14 w-14"
                  textClassName="text-sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--p-color-fg-strong)]">
                    {editingUser.full_name}
                  </p>
                  <p className="truncate text-xs text-[var(--p-color-fg-muted)]">{editingUser.email}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-white px-2 py-1 type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-brand-500)] ring-1 ring-black/10">
                      {editingUser.role === "chefia" ? "Chefia de Unidades" : editingUser.role}
                    </span>
                    <span className="rounded-lg bg-white px-2 py-1 type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-fg-muted)] ring-1 ring-black/10">
                      {editingUser.source === "perfil"
                        ? "Perfil ativo"
                        : editingUser.source === "auth"
                          ? "Conta autenticada"
                          : "Cadastro importado"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 type-caption text-[var(--p-color-fg-muted)] md:grid-cols-2">
                <p>
                  <b>Último acesso:</b>{" "}
                  {editingUser.last_sign_in_at
                    ? new Date(editingUser.last_sign_in_at).toLocaleString("pt-BR")
                    : "não registrado"}
                </p>
                <p>
                  <b>Criado em:</b>{" "}
                  {editingUser.created_at
                    ? new Date(editingUser.created_at).toLocaleString("pt-BR")
                    : "não informado"}
                </p>
                <p>
                  <b>Provedor:</b> {editingUser.auth_provider || "não informado"}
                </p>
                <p>
                  <b>ID perfil:</b> {editingUser.profile_id || "não vinculado"}
                </p>
                <p>
                  <b>Setores sob responsabilidade:</b> {getUnitScope(editingUser).chiefDepartments.length ? formatUnitCount(getUnitScope(editingUser).chiefDepartments.length, "setor", "setores") : "nenhum"}
                </p>
                <p>
                  <b>Laboratórios sob responsabilidade:</b> {getUnitScope(editingUser).chiefLaboratories.length ? formatUnitCount(getUnitScope(editingUser).chiefLaboratories.length, "laboratório", "laboratórios") : "nenhum"}
                </p>
              </div>
            </div>

            {!editingUser.profile_id && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                Este usuário ainda não tem perfil local editável. Use
                &nbsp;<b>Sincronizar acessos</b> para criar/vincular o perfil.
              </div>
            )}

            <div className="mt-5 grid gap-3">
              <label className="type-kicker font-semibold uppercase tracking-widest text-black/40">
                Nome completo
              </label>
              <input
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                disabled={!editingUser.profile_id}
                className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
              />

              <label className="type-kicker font-semibold uppercase tracking-widest text-black/40">
                Campus
              </label>
              <select
                value={editingCampusId}
                onChange={(event) => setEditingCampusId(event.target.value)}
                disabled={!editingUser.profile_id}
                className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
              >
                <option value="__none__">Sem vínculo de campus</option>
                {campi.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.nome} ({campus.sigla})
                  </option>
                ))}
              </select>

              <label className="type-kicker font-semibold uppercase tracking-widest text-black/40">
                Setores vinculados
              </label>
              <div className="space-y-2 rounded-xl border border-black/10 p-3">
                {editingDepartamentos.map((membership) => {
                  const departamento = filteredDepartamentos.find((item) => item.id === membership.id);
                  return (
                    <div key={membership.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--p-color-bg-muted)] px-3 py-2">
                      <span className="text-sm font-semibold text-[var(--p-color-fg-strong)]">{departamento?.nome || "Setor vinculado"}</span>
                      <div className="flex items-center gap-2">
                        <select value={membership.role} onChange={(event) => setEditingDepartamentos((current) => current.map((item) => item.id === membership.id ? { ...item, role: event.target.value as "membro" | "chefia" } : item))} className="h-9 rounded-lg border border-black/10 bg-white px-2 text-xs font-semibold">
                          <option value="membro">Membro</option>
                          <option value="chefia">Chefia responsável</option>
                        </select>
                        <button type="button" onClick={() => setEditingDepartamentos((current) => current.filter((item) => item.id !== membership.id))} className="text-xs font-semibold text-red-700">Remover</button>
                      </div>
                    </div>
                  );
                })}
                <select value="" onChange={(event) => { const id = event.target.value; if (id && !editingDepartamentos.some((item) => item.id === id)) setEditingDepartamentos((current) => [...current, { id, role: "membro" }]); }} disabled={!editingUser.profile_id || editingCampusId === "__none__"} className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm font-semibold outline-none">
                  <option value="">Adicionar setor…</option>
                  {filteredDepartamentos.filter((dept) => !editingDepartamentos.some((item) => item.id === dept.id)).map((dept) => <option key={dept.id} value={dept.id}>{dept.nome}</option>)}
                </select>
              </div>

              <label className="type-kicker font-semibold uppercase tracking-widest text-black/40">
                Laboratórios vinculados
              </label>
              <div className="space-y-2 rounded-xl border border-black/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-[var(--p-color-fg-muted)]">{editingLaboratorios.length} selecionado(s)</span>
                  <button type="button" onClick={() => setShowLaboratoryCatalog((current) => !current)} className="text-xs font-semibold text-[var(--p-color-brand-500)]">{showLaboratoryCatalog ? "Ocultar catálogo" : "Gerenciar laboratórios"}</button>
                </div>
                {showLaboratoryCatalog && <input value={laboratorySearch} onChange={(event) => setLaboratorySearch(event.target.value)} placeholder="Buscar laboratório" className="h-10 w-full rounded-lg border border-black/10 px-3 text-sm" />}
                {visibleLaboratorios.length === 0 ? (
                  <p className="text-sm text-[var(--p-color-fg-muted)]">
                    {editingCampusId === "__none__"
                      ? "Selecione um campus para listar os laboratórios."
                      : showLaboratoryCatalog
                        ? "Nenhum laboratório encontrado neste campus."
                        : "Nenhum laboratório vinculado."}
                  </p>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">{visibleLaboratorios.map((lab) => {
                    const membership = editingLaboratorios.find((item) => item.id === lab.id);
                    return (
                      <div key={lab.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--p-color-bg-muted)] px-3 py-2">
                        <label className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--p-color-fg-strong)]">
                          <input
                            type="checkbox"
                            checked={Boolean(membership)}
                            disabled={!editingUser.profile_id || editingCampusId === "__none__"}
                            onChange={(event) => setEditingLaboratorios((current) => event.target.checked
                              ? [...current, { id: lab.id, role: "membro" }]
                              : current.filter((item) => item.id !== lab.id))}
                          />
                          <span>{lab.nome}</span>
                        </label>
                        {membership && (
                          <select
                            value={membership.role}
                            onChange={(event) => setEditingLaboratorios((current) => current.map((item) => item.id === lab.id
                              ? { ...item, role: event.target.value as "membro" | "chefia" }
                              : item))}
                            className="h-9 rounded-lg border border-black/10 bg-white px-2 text-xs font-semibold"
                          >
                            <option value="membro">Membro</option>
                            <option value="chefia">Chefia responsável</option>
                          </select>
                        )}
                      </div>
                    );
                  })}</div>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="h-10 rounded-xl border border-black/10 px-4 text-xs font-semibold uppercase tracking-widest text-black/55"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveUserConfig}
                disabled={savingAction || !editingUser.profile_id}
                className="h-10 rounded-xl bg-[var(--p-color-brand-500)] px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-upe-blue-deep"
              >
                    Salvar escopo de atuação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({
  title,
  description,
  children,
  actions,
  defaultOpen = true,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-[24px] border border-[var(--p-color-border)] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={open}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-500)] transition-transform ${
              open ? "rotate-0" : "-rotate-90"
            }`}
          >
            <CaretDown size={16} weight="bold" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold uppercase tracking-[0.14em] text-[var(--p-color-brand-500)]">
              {title}
            </span>
            <span className="mt-1 block text-xs text-[var(--p-color-fg-muted)]">{description}</span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
      {open ? <div className="border-t border-black/5 p-5 pt-4">{children}</div> : null}
    </section>
  );
}

function UserAvatar({
  name,
  avatarUrl,
  sizeClassName = "h-12 w-12",
  textClassName = "text-xs",
}: {
  name: string;
  avatarUrl: string | null;
  sizeClassName?: string;
  textClassName?: string;
}) {
  const [broken, setBroken] = useState(false);
  const initial = String(name || "?").trim().charAt(0).toUpperCase() || "?";

  if (!avatarUrl || broken) {
    return (
      <div
        className={`${sizeClassName} rounded-2xl border border-upe-accent-washed-blue/70 bg-upe-accent-washed-blue/25 text-[var(--p-color-brand-500)] shadow-sm flex items-center justify-center font-semibold ${textClassName}`}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={`Foto de ${name}`}
      className={`${sizeClassName} rounded-2xl border border-upe-accent-washed-blue/70 object-cover shadow-sm`}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}
