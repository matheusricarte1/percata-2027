"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  UserPlus,
  Gear,
  DotsThreeVertical,
  MagnifyingGlass,
  X,
  CaretDown,
} from "@phosphor-icons/react";
import { getSafeUser, supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeRole, type UserRole } from "@/lib/access";
import { sanitizeEmail, sanitizePlainText } from "@/lib/settings-sanitize";

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
  departamento_nome: string | null;
  laboratorio_nome: string | null;
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
  const [editingName, setEditingName] = useState("");
  const [editingCampusId, setEditingCampusId] = useState<string>("__none__");
  const [editingDepartamentoId, setEditingDepartamentoId] =
    useState<string>("__none__");
  const [editingLaboratorioId, setEditingLaboratorioId] =
    useState<string>("__none__");
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
          .in("unit_type", ["departamento", "laboratorio"])
          .or("role_in_unit.eq.membro,role_in_unit.is.null"),
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
        { departamento_id: string | null; laboratorio_id: string | null }
      >();
      ((userUnitsResult.data || []) as UserUnitMembership[]).forEach((unit) => {
        const userId = String(unit.user_id || "");
        const unitId = String(unit.unit_id || "");
        if (!userId || !unitId) return;
        const current = unitByUserId.get(userId) || {
          departamento_id: null,
          laboratorio_id: null,
        };
        if (unit.unit_type === "departamento" && !current.departamento_id) {
          current.departamento_id = unitId;
        }
        if (unit.unit_type === "laboratorio" && !current.laboratorio_id) {
          current.laboratorio_id = unitId;
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
      toast.error("Erro ao carregar usuários: " + error.message);
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
      toast.error("Erro ao carregar trilha de auditoria: " + error.message);
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
      toast.error("Erro ao carregar eventos de login: " + error.message);
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
        "Erro ao carregar vínculos legados pendentes: " + error.message,
      );
      setPendingLegacyLinks([]);
    } finally {
      setLoadingPendingLegacyLinks(false);
    }
  };

  useEffect(() => {
    fetchPendingLegacyLinks();
  }, []);

  const handleUpdateRole = async (user: UserRow, newRole: string) => {
    if (newRole === "admin" && currentUserRole !== "superadmin") {
      toast.warning("Somente superadmin pode atribuir perfil admin.");
      return;
    }
    if (!user.profile_id) {
      toast.info("Usuário importado sem perfil local. Sincronize os acessos primeiro.");
      return;
    }

    try {
      const response = await fetch("/api/admin/users/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_role",
          profile_id: user.profile_id,
          role: newRole,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao atualizar papel.");
      }

      toast.success(`Papel do usuário atualizado para ${newRole}.`);
      await Promise.all([fetchUsuarios(), fetchAuditLogs()]);
    } catch (error: any) {
      toast.error("Erro ao atualizar papel: " + error.message);
    }
  };

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
    setEditingLaboratorioId(user.laboratorio_id || "__none__");
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
          laboratorio_id:
            editingLaboratorioId === "__none__" ? null : editingLaboratorioId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao salvar configuração.");
      }
      toast.success("Configurações do usuário atualizadas.");
      setEditingUser(null);
      await Promise.all([fetchUsuarios(), fetchAuditLogs()]);
    } catch (error: any) {
      toast.error("Erro ao salvar configurações: " + error.message);
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
      toast.error("Falha ao enviar aviso: " + error.message);
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
      toast.error("Erro ao redefinir onboarding: " + error.message);
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
      toast.error("Informe um e-mail válido para enviar o convite.");
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
      toast.error("Erro ao convidar usuário: " + error.message);
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
      toast.error("Erro ao sincronizar perfis: " + error.message);
    } finally {
      setSyncingAuthProfiles(false);
    }
  };

  const filtered = useMemo(() => {
    const roleFilterMap: Record<string, RowRole | null> = {
      todos: null,
      solicitantes: "solicitante",
      gestores: "chefia",
      admin: "admin",
      superadmin: "superadmin",
      pendentes: "pendente",
      legado: "legado",
      "ativos importados": "legado",
    };
    const selectedRole = roleFilterMap[filterRole.toLowerCase()] ?? null;

    return usuarios.filter((user) => {
      const text = `${user.full_name} ${user.email}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      const matchesRole = !selectedRole || user.role === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [usuarios, search, filterRole]);

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

  useEffect(() => {
    if (editingCampusId === "__none__") {
      setEditingDepartamentoId("__none__");
      setEditingLaboratorioId("__none__");
      return;
    }

    const deptStillValid = filteredDepartamentos.some(
      (item) => item.id === editingDepartamentoId,
    );
    if (!deptStillValid) setEditingDepartamentoId("__none__");

    const labStillValid = filteredLaboratorios.some(
      (item) => item.id === editingLaboratorioId,
    );
    if (!labStillValid) setEditingLaboratorioId("__none__");
  }, [
    editingCampusId,
    editingDepartamentoId,
    editingLaboratorioId,
    filteredDepartamentos,
    filteredLaboratorios,
  ]);

  return (
    <div className="p-8 bg-[#F3F2F1] min-h-screen space-y-8">
      <div className="flex justify-between items-center bg-white p-8 rounded-[40px] border border-[#D2D0CE] shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-[#164073] text-white rounded-3xl flex items-center justify-center text-3xl shadow-lg">
            <Users weight="fill" />
          </div>
          <div>
            <h1 className="font-display text-4xl font-semibold text-[#164073] tracking-tighter uppercase">
              Pessoas e Permissões
            </h1>
            <p className="text-black/40 text-sm font-medium">
              Lista unificada de perfis ativos e registros anteriores por e-mail.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={syncAuthProfiles}
            disabled={syncingAuthProfiles}
            className="flex items-center gap-2 border border-[#D2D0CE] bg-white text-[#3E4C5F] px-4 py-3 rounded-2xl font-semibold text-[10px] uppercase tracking-widest hover:bg-[#F3F2F1] transition-all disabled:opacity-70"
          >
            <Users size={16} weight="bold" />
            {syncingAuthProfiles ? "Sincronizando..." : "Sincronizar acessos"}
          </button>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-3 bg-[#164073] text-white px-8 py-4 rounded-3xl font-semibold text-xs uppercase tracking-widest shadow-2xl shadow-upe-accent-washed-blue/60 hover:scale-105 active:scale-95 transition-all"
          >
            <UserPlus size={20} weight="bold" />
            Convidar Servidor
          </button>
        </div>
      </div>

      {currentUserRole === "superadmin" && (
        <div className="rounded-2xl border border-upe-accent-washed-blue/70 bg-upe-accent-washed-blue/25 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-upe-blue-upe">
          Sessão superadmin: acesso completo para configurar perfis.
        </div>
      )}

      <CollapsibleSection
        title="Vínculos Legados Pendentes"
        description="E-mails legados que ainda precisam de confirmação de vínculo com conta ativa."
        defaultOpen={pendingLegacyLinks.length > 0}
        actions={
          <button
            type="button"
            onClick={fetchPendingLegacyLinks}
            className="h-9 rounded-xl border border-black/10 bg-[#F3F2F1] px-3 text-[10px] font-semibold uppercase tracking-widest text-[#3E4C5F] hover:bg-[#EBE9E8]"
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
            <div className="rounded-xl border border-dashed border-[#D2D0CE] p-5 text-center text-xs font-semibold uppercase tracking-widest text-black/35">
              Nenhum vínculo pendente no momento.
            </div>
          )}

          {!loadingPendingLegacyLinks &&
            pendingLegacyLinks.map((row) => (
              <div
                key={row.legacy_email}
                className="rounded-xl border border-black/5 bg-[#FAFBFC] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#323130]">
                      {row.legacy_name || "Servidor legado"}
                    </p>
                    <p className="text-xs font-semibold text-[#605E5C]">
                      {row.legacy_email}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${
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

                <p className="mt-1 text-xs text-[#5B6675]">{row.validation_note}</p>
                <p className="mt-1 text-[11px] font-semibold text-[#3E4C5F]">
                  Sugestão de conta: {row.suggested_profile_email || "não encontrada"} •
                  vínculos em demandas: {row.demand_links_count}
                </p>
              </div>
            ))}
        </div>
      </CollapsibleSection>

      <div className="bg-white p-6 rounded-[32px] border border-[#D2D0CE] shadow-sm flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[300px]">
          <MagnifyingGlass
            className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20"
            size={18}
          />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full pl-12 pr-4 py-3 bg-[#F3F2F1] border border-[#D2D0CE] rounded-2xl text-sm font-medium focus:ring-2 focus:ring-upe-accent-washed-blue/70 transition-all outline-none"
          />
        </div>
        <div className="flex gap-2">
          {[
            "Todos",
            "Solicitantes",
            "Gestores",
            "Admin",
            "Superadmin",
            "Pendentes",
            "Ativos importados",
          ].map(
            (label) => (
              <button
                key={label}
                onClick={() => setFilterRole(label)}
                className={`px-6 py-2.5 rounded-2xl text-[10px] font-semibold uppercase tracking-widest transition-all ${filterRole === label ? "bg-[#164073] text-white shadow-xl" : "bg-[#F3F2F1] text-[#605E5C] border border-[#D2D0CE] hover:bg-[#EBE9E8]"}`}
              >
                {label}
              </button>
            ),
          )}
        </div>

        <div className="w-full rounded-xl border border-[#D9E0E8] bg-[#F4F7FA] px-3 py-2 text-[11px] font-semibold text-[#3E4C5F]">
          Regra de acesso: perfil <b>Chefia</b> mantém as funções de <b>Solicitante</b> (catálogo, nova DFD e minhas DFDs).
          {" "}Cadastros importados são tratados como ativos e passam a operar como perfil local após sincronização.
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-[#D2D0CE] shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-[#F3F2F1] text-[#605E5C]">
              <th className="p-8 font-semibold uppercase tracking-[0.2em] text-[10px]">
                Servidor
              </th>
              <th className="p-8 font-semibold uppercase tracking-[0.2em] text-[10px]">
                E-mail
              </th>
              <th className="p-8 font-semibold uppercase tracking-[0.2em] text-[10px]">
                Lotação
              </th>
              <th className="p-8 font-semibold uppercase tracking-[0.2em] text-[10px]">
                Perfil
              </th>
              <th className="p-8 font-semibold uppercase tracking-[0.2em] text-[10px] text-right">
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

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-[#F3F2F1] transition-colors group"
                    >
                      <td className="p-8">
                        <div className="flex items-center gap-4">
                          <UserAvatar
                            name={user.full_name}
                            avatarUrl={user.avatar_url}
                            sizeClassName="h-12 w-12 group-hover:scale-110 transition-transform"
                            textClassName="text-xs"
                          />
                          <div>
                            <div className="font-semibold text-[#323130] uppercase tracking-tight">
                              {user.full_name}
                            </div>
                            <div className="text-[10px] font-semibold uppercase tracking-widest text-black/25">
                              {user.source === "perfil"
                                ? "Perfil ativo"
                                : user.source === "auth"
                                  ? "Conta autenticada"
                                  : "Cadastro importado ativo"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-8">
                        <div>
                          <span className="text-sm font-semibold text-[#605E5C]">
                            {user.email}
                          </span>
                          <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-black/35">
                            Último acesso:{" "}
                            {user.last_sign_in_at
                              ? new Date(user.last_sign_in_at).toLocaleString(
                                  "pt-BR",
                                )
                              : "não registrado"}
                          </div>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="font-semibold text-[#605E5C] uppercase tracking-widest text-[10px]">
                          {user.campus_nome || "Não vinculado"}
                        </div>
                        <div className="text-[9px] uppercase font-semibold text-black/20 tracking-tighter">
                          SIGLA: {user.campus_sigla || "N/A"}
                        </div>
                        <div className="mt-1 text-[10px] text-[#5B6675]">
                          Setor: {user.departamento_nome || "não vinculado"}
                        </div>
                        <div className="text-[10px] text-[#5B6675]">
                          Laboratório: {user.laboratorio_nome || "não vinculado"}
                        </div>
                      </td>
                      <td className="p-8">
                        {isLegacyOnly ? (
                          <div className="inline-flex items-center px-4 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-widest bg-[#F3F2F1] text-[#605E5C] ring-1 ring-[#D2D0CE]">
                            ATIVO IMPORTADO
                          </div>
                        ) : user.role === "pendente" ? (
                          <div className="inline-flex items-center px-4 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-widest bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                            PENDENTE PERFIL
                          </div>
                        ) : isProtectedSuperadmin ? (
                          <div className="inline-flex items-center px-4 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-widest bg-upe-accent-washed-blue/25 text-upe-blue-upe ring-1 ring-upe-accent-washed-blue/70">
                            SUPERADMIN
                          </div>
                        ) : (
                          <select
                            value={user.role}
                            onChange={(event) =>
                              handleUpdateRole(user, event.target.value)
                            }
                            className={`px-4 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-widest border-none ring-1 appearance-none cursor-pointer focus:ring-4 transition-all ${
                              user.role === "admin"
                                ? "bg-red-50 text-red-600 ring-red-100"
                                : user.role === "chefia"
                                  ? "bg-emerald-50 text-emerald-600 ring-emerald-100"
                                  : "bg-blue-50 text-blue-600 ring-blue-100"
                            }`}
                          >
                            <option value="solicitante">SOLICITANTE</option>
                            <option value="chefia">CHEFIA + SOLICITANTE</option>
                            {currentUserRole === "superadmin" && (
                              <option value="admin">ADMIN PROPLAN</option>
                            )}
                          </select>
                        )}
                      </td>
                      <td className="p-8 text-right">
                        <div className="relative flex justify-end gap-2">
                          <button
                            onClick={() => openEditPanel(user)}
                            className="p-3 bg-black/5 hover:bg-black/10 rounded-xl text-black/40 hover:text-slate-800 transition-all shadow-sm"
                          >
                            <Gear size={20} weight="fill" />
                          </button>
                          <button
                            onClick={() =>
                              setActionUser((prev) =>
                                prev?.id === user.id ? null : user,
                              )
                            }
                            className="p-3 bg-black/5 hover:bg-black/10 rounded-xl text-black/40 hover:text-slate-800 transition-all shadow-sm"
                          >
                            <DotsThreeVertical size={24} weight="bold" />
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
          <div className="py-20 text-center space-y-4 opacity-30">
            <MagnifyingGlass size={64} weight="thin" className="mx-auto" />
            <p className="font-display font-semibold text-xl uppercase tracking-widest">
              Nenhum usuário encontrado
            </p>
          </div>
        )}
      </div>

      <CollapsibleSection
        title="Últimas ações administrativas"
        description="Trilha de auditoria das alterações feitas por admins e superadmins."
        defaultOpen={false}
        actions={
          <button
            type="button"
            onClick={fetchAuditLogs}
            className="h-9 rounded-xl border border-black/10 bg-[#F3F2F1] px-3 text-[10px] font-semibold uppercase tracking-widest text-[#3E4C5F] hover:bg-[#EBE9E8]"
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
                  className="rounded-xl border border-black/5 bg-[#FAFBFC] px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#7D98B8]">
                      {actionLabelMap[row.action] || row.action}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-black/35">
                      {new Date(row.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#3E4C5F]">
                    <b>{row.actor_email}</b> ({row.actor_role}) →{" "}
                    <b>{row.target_email}</b>
                  </p>
                </div>
              );
            })}

          {!loadingAudit && auditLogs.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#D2D0CE] p-6 text-center text-xs font-semibold uppercase tracking-widest text-black/35">
              Sem eventos de auditoria no momento.
            </div>
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
            className="h-9 rounded-xl border border-black/10 bg-[#F3F2F1] px-3 text-[10px] font-semibold uppercase tracking-widest text-[#3E4C5F] hover:bg-[#EBE9E8]"
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
                className="rounded-xl border border-black/5 bg-[#FAFBFC] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#323130]">
                    {event.full_name || event.email}
                  </p>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-black/35">
                    {new Date(event.logged_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#3E4C5F]">
                  {event.email} • provedor:{" "}
                  <b>{event.provider || "não informado"}</b>
                </p>
                <p className="mt-1 text-[10px] text-[#5B6675]">
                  IP: {event.ip_address || "não informado"}
                </p>
              </div>
            ))}

          {!loadingLoginEvents && loginEvents.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#D2D0CE] p-6 text-center text-xs font-semibold uppercase tracking-widest text-black/35">
              Sem eventos de login disponíveis.
            </div>
          )}
        </div>
      </CollapsibleSection>

      {inviteOpen && (
        <div className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-[28px] border border-black/10 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl font-semibold text-[#164073] uppercase tracking-tight">
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
              <label className="text-[10px] font-semibold uppercase tracking-widest text-black/40">
                E-mail institucional
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="servidor@upe.br"
                className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
              />

              <label className="text-[10px] font-semibold uppercase tracking-widest text-black/40">
                Nome completo (opcional)
              </label>
              <input
                value={inviteName}
                onChange={(event) => setInviteName(event.target.value)}
                className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-black/40">
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
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-black/40">
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
                className="h-10 rounded-xl bg-[#164073] px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-upe-blue-deep disabled:opacity-70"
              >
                {inviting ? "Enviando..." : "Enviar convite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-[28px] border border-black/10 bg-white p-6 shadow-2xl">
            <h3 className="font-display text-2xl font-semibold text-[#164073] uppercase tracking-tight">
              Perfil Completo do Usuário
            </h3>
            <p className="mt-1 text-xs text-black/45">{editingUser.email}</p>

            <div className="mt-4 rounded-2xl border border-black/10 bg-[#F8FAFC] p-4">
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={editingUser.full_name}
                  avatarUrl={editingUser.avatar_url}
                  sizeClassName="h-14 w-14"
                  textClassName="text-sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#323130]">
                    {editingUser.full_name}
                  </p>
                  <p className="truncate text-xs text-[#5B6675]">{editingUser.email}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#164073] ring-1 ring-black/10">
                      {editingUser.role}
                    </span>
                    <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#5B6675] ring-1 ring-black/10">
                      {editingUser.source === "perfil"
                        ? "Perfil ativo"
                        : editingUser.source === "auth"
                          ? "Conta autenticada"
                          : "Cadastro importado"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-[#5B6675] md:grid-cols-2">
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
                  <b>Setor atual:</b> {editingUser.departamento_nome || "não vinculado"}
                </p>
                <p>
                  <b>Laboratório atual:</b> {editingUser.laboratorio_nome || "não vinculado"}
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
              <label className="text-[10px] font-semibold uppercase tracking-widest text-black/40">
                Nome completo
              </label>
              <input
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                disabled={!editingUser.profile_id}
                className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
              />

              <label className="text-[10px] font-semibold uppercase tracking-widest text-black/40">
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

              <label className="text-[10px] font-semibold uppercase tracking-widest text-black/40">
                Setor (departamento)
              </label>
              <select
                value={editingDepartamentoId}
                onChange={(event) => setEditingDepartamentoId(event.target.value)}
                disabled={!editingUser.profile_id || editingCampusId === "__none__"}
                className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
              >
                <option value="__none__">Sem setor vinculado</option>
                {filteredDepartamentos.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.nome}
                  </option>
                ))}
              </select>

              <label className="text-[10px] font-semibold uppercase tracking-widest text-black/40">
                Laboratório
              </label>
              <select
                value={editingLaboratorioId}
                onChange={(event) => setEditingLaboratorioId(event.target.value)}
                disabled={!editingUser.profile_id || editingCampusId === "__none__"}
                className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
              >
                <option value="__none__">Sem laboratório vinculado</option>
                {filteredLaboratorios.map((lab) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.nome}
                  </option>
                ))}
              </select>
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
                className="h-10 rounded-xl bg-[#164073] px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-upe-blue-deep"
              >
                Salvar alterações
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
    <section className="rounded-[24px] border border-[#D2D0CE] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={open}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF2FF] text-[#164073] transition-transform ${
              open ? "rotate-0" : "-rotate-90"
            }`}
          >
            <CaretDown size={16} weight="bold" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold uppercase tracking-[0.14em] text-[#164073]">
              {title}
            </span>
            <span className="mt-1 block text-xs text-[#5B6675]">{description}</span>
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
        className={`${sizeClassName} rounded-2xl border border-upe-accent-washed-blue/70 bg-upe-accent-washed-blue/25 text-[#164073] shadow-sm flex items-center justify-center font-semibold ${textClassName}`}
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
