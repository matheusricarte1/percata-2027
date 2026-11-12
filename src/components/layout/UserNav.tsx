"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getSafeUser, supabase } from "@/lib/supabase";
import { SignOut } from "@/components/icons/phosphor/exports/SignOut";
import { User } from "@/components/icons/phosphor/exports/User";
import { CaretDown } from "@/components/icons/phosphor/exports/CaretDown";
import { Envelope } from "@/components/icons/phosphor/exports/Envelope";
import { GearSix } from "@/components/icons/phosphor/exports/GearSix";
import { Buildings } from "@/components/icons/phosphor/exports/Buildings";
import { Flask } from "@/components/icons/phosphor/exports/Flask";
import { X } from "@/components/icons/phosphor/exports/X";
import { CheckCircle } from "@/components/icons/phosphor/exports/CheckCircle";
import { ShieldCheck } from "@/components/icons/phosphor/exports/ShieldCheck";
import { Crown } from "@/components/icons/phosphor/exports/Crown";
import { ArrowUUpLeft } from "@/components/icons/phosphor/exports/ArrowUUpLeft";
import { Stack } from "@/components/icons/phosphor/exports/Stack";
import { Eye } from "@/components/icons/phosphor/exports/Eye";
import { ListChecks } from "@/components/icons/phosphor/exports/ListChecks";
import { Clock } from "@/components/icons/phosphor/exports/Clock";
import { FileText } from "@/components/icons/phosphor/exports/FileText";
import { ArrowRight } from "@/components/icons/phosphor/exports/ArrowRight";
import { usePathname, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { CategoryAvatar } from "@/components/user/CategoryAvatar";
import { roleToUserCategory, type UserCategory } from "@/lib/user-category";
import { toast } from "sonner";
import {
  USER_SETTINGS_SESSION_KEY,
  cleanupUnsafeLocalStorage,
  readSessionJson,
} from "@/lib/browser-storage";
import {
  getRolePendingWorkPath,
  getRoleSettingsPath,
  normalizeRole,
  type UserRole,
} from "@/lib/access";

interface UserData {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  category: UserCategory;
  role: UserRole;
}

interface ProfileSummary {
  campusName: string;
  departmentName: string;
  labs: string[];
  roleLabel: string;
  scopeDescription: string;
  permissions: Array<{ label: string; icon: React.ElementType }>;
  pending: Array<{
    label: string;
    value: number;
    href: string;
    icon: React.ElementType;
    tone: "blue" | "amber" | "violet";
  }>;
}

type ProfileVisibility = "campus" | "papel" | "privado";

type ProfilePrefs = {
  profileVisibility: ProfileVisibility;
  showEmail: boolean;
  showAvatar: boolean;
};

const DEFAULT_PROFILE_PREFS: ProfilePrefs = {
  profileVisibility: "campus",
  showEmail: true,
  showAvatar: true,
};

function normalizeProfilePrefs(input: any): ProfilePrefs {
  const profileVisibility =
    input?.profileVisibility === "papel" || input?.profileVisibility === "privado"
      ? input.profileVisibility
      : "campus";
  return {
    profileVisibility,
    showEmail: Boolean(input?.showEmail ?? DEFAULT_PROFILE_PREFS.showEmail),
    showAvatar: Boolean(input?.showAvatar ?? DEFAULT_PROFILE_PREFS.showAvatar),
  };
}

function readProfilePrefs(userId?: string | null): ProfilePrefs {
  void userId;
  return normalizeProfilePrefs(readSessionJson(USER_SETTINGS_SESSION_KEY));
}

function getRoleLabel(category: UserCategory) {
  if (category === "superadmin") return "Superadmin institucional";
  if (category === "admin") return "Admin institucional";
  if (category === "chefia") return "Chefia institucional";
  if (category === "laboratorio") return "Laboratório";
  if (category === "departamento") return "Departamento";
  return "Solicitante";
}

function getProfilePermissions(category: UserCategory) {
  if (category === "superadmin" || category === "admin") {
    return [
      { label: "Gerenciar fila", icon: ListChecks },
      { label: "Consolidar itens", icon: Stack },
      { label: "Visualizar PCA", icon: Eye },
      { label: "Gerenciar usuários", icon: ShieldCheck },
      { label: "Auditar sistema", icon: Crown },
    ];
  }

  if (category === "chefia") {
    return [
      { label: "Homologar DFD", icon: CheckCircle },
      { label: "Devolver demanda", icon: ArrowUUpLeft },
      { label: "Consolidar itens", icon: Stack },
      { label: "Visualizar PCA", icon: Eye },
      { label: "Gerenciar fila", icon: ListChecks },
    ];
  }

  return [
    { label: "Criar DFD", icon: FileText },
    { label: "Enviar à chefia", icon: ArrowRight },
    { label: "Participar de coletiva", icon: Stack },
    { label: "Acompanhar análise", icon: Eye },
  ];
}

function makeDefaultProfileSummary(): ProfileSummary {
  return {
    campusName: "Não definido",
    departmentName: "Não definido",
    labs: [],
    roleLabel: "Solicitante",
    scopeDescription: "Criação, acompanhamento e revisão das suas DFDs.",
    permissions: getProfilePermissions("usuario"),
    pending: [
      {
        label: "DFDs em andamento",
        value: 0,
        href: "/minhas-dfds",
        icon: FileText,
        tone: "blue",
      },
      {
        label: "Demandas com pendência",
        value: 0,
        href: "/minhas-dfds",
        icon: Clock,
        tone: "amber",
      },
      {
        label: "Itens para revisar",
        value: 0,
        href: "/minhas-dfds",
        icon: User,
        tone: "violet",
      },
    ],
  };
}

async function countRows(builder: any) {
  const { count } = await builder;
  return Number(count || 0);
}

export function UserNav() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profilePrefs, setProfilePrefs] = useState<ProfilePrefs>(DEFAULT_PROFILE_PREFS);
  const [summary, setSummary] = useState<ProfileSummary>(makeDefaultProfileSummary());
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    cleanupUnsafeLocalStorage();
    async function getUser() {
      setProfileLoading(true);
      const user = await getSafeUser();
      if (user) {
        const metadata = (user.user_metadata || {}) as Record<string, any>;
        const fallbackName =
          metadata.full_name ||
          metadata.name ||
          `${metadata.given_name || ""} ${metadata.family_name || ""}`.trim() ||
          user.email?.split("@")[0] ||
          "Usuário";

        const baseName = String(fallbackName).trim() || "Usuário";
        const baseEmail = String(user.email || "").toLowerCase();

        setUserData({
          id: user.id,
          name: baseName,
          email: baseEmail,
          avatar: String(metadata.avatar_url || metadata.picture || "").trim() || null,
          category: "usuario",
          role: "solicitante",
        });
        setProfilePrefs(readProfilePrefs(user.id));

        try {
          const [{ data: profile }, { data: settingsRow }] = await Promise.all([
            supabase
            .from("profiles")
            .select("full_name,email,campus_id,role")
            .eq("id", user.id)
              .maybeSingle(),
            supabase
              .from("user_settings")
              .select("profile_visibility,show_email,show_avatar")
              .eq("user_id", user.id)
              .maybeSingle(),
          ]);

          const resolvedName = String(profile?.full_name || "").trim() || baseName;
          const resolvedEmail = String(profile?.email || "").trim().toLowerCase() || baseEmail;
          const resolvedCategory = roleToUserCategory(profile?.role);
          const resolvedRole = normalizeRole(profile?.role, user.email);
          const roleLabel = getRoleLabel(resolvedCategory);
          const resolvedPrefs = normalizeProfilePrefs({
            profileVisibility: settingsRow?.profile_visibility,
            showEmail: settingsRow?.show_email,
            showAvatar: settingsRow?.show_avatar,
          });
          setProfilePrefs(resolvedPrefs);

          setUserData((prev) =>
            prev
              ? {
                  ...prev,
                  name: resolvedName,
                  email: resolvedEmail,
                  category: resolvedCategory,
                  role: resolvedRole,
                }
              : prev,
          );

          const { data: links } = await supabase
            .from("user_units")
            .select("unit_type,unit_id,role_in_unit")
            .eq("user_id", user.id);

          const deptIds = (links || [])
            .filter((unit) => unit.unit_type === "departamento")
            .map((unit) => unit.unit_id);
          const labIds = (links || [])
            .filter((unit) => unit.unit_type === "laboratorio")
            .map((unit) => unit.unit_id);

          const [deptRes, labRes, campusRes] = await Promise.all([
            deptIds.length > 0
              ? supabase
                  .from("departamentos")
                  .select("id,nome")
                  .in("id", deptIds)
                  .order("nome")
              : Promise.resolve({ data: [] as Array<{ id: string; nome: string }> }),
            labIds.length > 0
              ? supabase
                  .from("laboratorios")
                  .select("id,nome")
                  .in("id", labIds)
                  .order("nome")
              : Promise.resolve({ data: [] as Array<{ id: string; nome: string }> }),
            profile?.campus_id
              ? supabase
                  .from("campi")
                  .select("nome,sigla")
                  .eq("id", profile.campus_id)
                  .maybeSingle()
              : Promise.resolve({ data: null as any }),
          ]);

          const departments = (deptRes.data || []).map((entry) => entry.nome);
          const laboratories = (labRes.data || []).map((entry) => entry.nome);
          const campusName = String(campusRes?.data?.nome || campusRes?.data?.sigla || "").trim();
          const isManager =
            resolvedCategory === "chefia" ||
            resolvedCategory === "admin" ||
            resolvedCategory === "superadmin";
          const pendingHref = getRolePendingWorkPath(resolvedRole);
          const settingsHref = getRoleSettingsPath(resolvedRole);
          const analysisCount = isManager
            ? await countRows(
                supabase
                  .from("dfds")
                  .select("id", { count: "exact", head: true })
                  .eq("status", "triagem"),
              ).catch(() => 0)
            : await countRows(
                supabase
                  .from("dfds")
                  .select("id", { count: "exact", head: true })
                  .eq("solicitante_id", user.id)
                  .eq("status", "triagem"),
              ).catch(() => 0);
          const returnedCount = isManager
            ? await countRows(
                supabase
                  .from("dfds")
                  .select("id", { count: "exact", head: true })
                  .eq("status", "devolvida"),
              ).catch(() => 0)
            : await countRows(
                supabase
                  .from("dfds")
                  .select("id", { count: "exact", head: true })
                  .eq("solicitante_id", user.id)
                  .eq("status", "devolvida"),
              ).catch(() => 0);

          setSummary({
            campusName: campusName || "Não definido",
            departmentName: departments[0] || "Não definido",
            labs: laboratories,
            roleLabel,
            scopeDescription: isManager
              ? "Triagem, consolidação e acompanhamento de DFDs."
              : "Criação, acompanhamento e resposta às devoluções das suas DFDs.",
            permissions: getProfilePermissions(resolvedCategory),
            pending: [
              {
                label: isManager ? "DFDs aguardando análise" : "DFDs em análise",
                value: analysisCount,
                href: pendingHref,
                icon: FileText,
                tone: "blue",
              },
              {
                label: "Demandas com pendência",
                value: returnedCount,
                href: pendingHref,
                icon: Clock,
                tone: "amber",
              },
              {
                label: profilePrefs.profileVisibility === "privado" ? "Perfil privado" : "Perfil visível",
                value: profilePrefs.profileVisibility === "privado" ? 1 : 0,
                href: settingsHref,
                icon: User,
                tone: "violet",
              },
            ],
          });
        } catch {
          setSummary(makeDefaultProfileSummary());
        } finally {
          setProfileLoading(false);
        }
        return;
      }
      setProfileLoading(false);
    }
    getUser();
  }, [pathname, profilePrefs.profileVisibility]);

  useEffect(() => {
    function refreshPrefs() {
      setProfilePrefs(readProfilePrefs(userData?.id));
    }

    refreshPrefs();
    window.addEventListener("percata:user-settings-changed", refreshPrefs);
    window.addEventListener("storage", refreshPrefs);
    return () => {
      window.removeEventListener("percata:user-settings-changed", refreshPrefs);
      window.removeEventListener("storage", refreshPrefs);
    };
  }, [userData?.id]);

  const handleOpenProfile = () => {
    setIsOpen(false);
    setProfileOpen(true);
  };

  const handleOpenSettings = () => {
    setIsOpen(false);
    setProfileOpen(false);
    router.push(getRoleSettingsPath(userData?.role || "solicitante"));
  };

  const handleProfileNavigate = (href: string, message?: string) => {
    setIsOpen(false);
    setProfileOpen(false);
    if (message) toast.success(message);
    router.push(href);
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      await supabase.auth.signOut();
    }
    window.location.assign("/login");
  };

  if (!userData)
    return <div className="h-10 w-10 rounded-full bg-[var(--p-color-surface-muted)] animate-pulse" />;

  const showEmail = profilePrefs.showEmail && profilePrefs.profileVisibility !== "privado";
  const showAvatar = profilePrefs.showAvatar && profilePrefs.profileVisibility !== "privado";
  const displayEmail = showEmail ? userData.email : "E-mail privado";

  return (
    <>
      <div className="relative">
      <button
        aria-label="Abrir menu do usuário"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-2 rounded-full hover:bg-[var(--p-color-surface-muted)] transition-all group"
      >
        <div className="relative">
          <CategoryAvatar
            name={userData.name}
            avatarUrl={showAvatar ? userData.avatar : null}
            category={userData.category}
            size="md"
            animate
          />
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[var(--p-color-success)]"></div>
        </div>

        <div className="hidden md:flex flex-col items-start mr-1">
          <span className="text-xs font-semibold text-[var(--p-color-fg-strong)] leading-none uppercase tracking-tighter">
            {userData.name}
          </span>
              <span className="text-xs font-medium text-black/40 lowercase">
                {displayEmail}
              </span>
            </div>
        <CaretDown
          size={14}
          weight="bold"
          className={`text-black/20 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-3 w-64 animate-in rounded-3xl border border-[var(--p-color-border)] bg-white p-2 shadow-2xl fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 border-b border-[var(--p-color-border-muted)] p-4">
              <CategoryAvatar
                name={userData.name}
                avatarUrl={showAvatar ? userData.avatar : null}
                category={userData.category}
                size="lg"
                animate
              />
              <div className="flex-1 overflow-hidden">
                <p className="font-display font-semibold text-[var(--p-color-fg-strong)] leading-tight truncate">
                  {userData.name}
                </p>
                <p className="text-xs text-black/40 font-medium truncate flex items-center gap-1">
                  <Envelope size={12} weight="fill" />
                  {displayEmail}
                </p>
              </div>
            </div>

            <div className="py-2">
              <button
                type="button"
                onClick={handleOpenProfile}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-[var(--p-color-fg-muted)] hover:bg-[var(--p-color-surface-muted)] hover:text-[var(--p-color-brand-500)] rounded-2xl transition-all group"
              >
                <User
                  size={20}
                  weight="fill"
                  className="group-hover:scale-110 transition-transform"
                />
                Perfil do Usuário
              </button>
              <button
                type="button"
                onClick={handleOpenSettings}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-[var(--p-color-fg-muted)] hover:bg-[var(--p-color-surface-muted)] hover:text-[var(--p-color-brand-500)] rounded-2xl transition-all group"
              >
                <GearSix
                  size={20}
                  weight="fill"
                  className="group-hover:rotate-6 transition-transform"
                />
                Configurações
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="ux-btn-danger-soft w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all group"
              >
                <SignOut
                  size={20}
                  weight="fill"
                  className="group-hover:translate-x-1 transition-transform"
                />
                Sair do Sistema
              </button>
            </div>
          </div>
        </>
      )}
      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto rounded-[28px] border border-[var(--p-color-border)] bg-white/96 p-0 shadow-2xl backdrop-blur-xl sm:max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="p-5 md:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--p-color-info-bg)] text-[var(--p-color-action)]">
                  <User size={30} weight="duotone" />
                </span>
                <div>
                  <DialogTitle className="font-display text-2xl font-bold tracking-tight text-[var(--p-color-brand-700)]">
                    Meu perfil institucional
                  </DialogTitle>
                  <p className="mt-1 text-sm font-medium text-[var(--p-color-fg-muted)]">
                    Aqui você confere seu contexto institucional e suas permissões na plataforma.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="group inline-flex h-12 items-center gap-2 rounded-xl border border-[var(--p-color-border)] bg-white px-4 text-sm font-bold text-[var(--p-color-fg-muted)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--p-color-surface-soft)] hover:shadow-md active:scale-[0.98]"
              >
                <X size={16} weight="bold" className="transition-transform group-hover:rotate-90" />
                Fechar
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <ProfileSection delay={0.04} className="rounded-[24px] border border-[var(--p-color-info-border)] bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-6 md:flex-row md:items-center">
                  <div className="relative mx-auto shrink-0 md:mx-2">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.26, ease: "easeOut" }}
                      className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-white bg-[var(--p-color-info-bg)] shadow-xl ring-1 ring-[var(--p-color-info-border)]"
                    >
                      <CategoryAvatar
                        name={userData.name}
                        avatarUrl={showAvatar ? userData.avatar : null}
                        category={userData.category}
                        size="xl"
                        animate
                      />
                    </motion.div>
                    <motion.span
                      initial={{ opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        duration: 0.32,
                        delay: 0.18,
                        ease: [0.34, 1.56, 0.64, 1],
                      }}
                      className="absolute bottom-2 right-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)] shadow-lg"
                    >
                      <Crown size={22} weight="fill" />
                    </motion.span>
                  </div>

                  <div className="min-w-0 flex-1 text-center md:text-left">
                    <h2 className="font-display text-3xl font-bold leading-tight text-[var(--p-color-brand-700)] md:text-4xl">
                      {userData.name}
                    </h2>
                    <p className="mt-3 inline-flex items-center gap-2 text-base font-semibold text-[var(--p-color-fg-muted)]">
                      <Envelope size={18} />
                      {displayEmail}
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-3 md:justify-start">
                      <ProfileChip icon={CheckCircle} tone="green" label="Cadastro ativo" />
                      <ProfileChip icon={Buildings} tone="blue" label={summary.campusName} />
                      <ProfileChip icon={ShieldCheck} tone="violet" label={summary.roleLabel} />
                    </div>
                  </div>
                </div>
              </ProfileSection>

              <ProfileSection delay={0.08} className="rounded-[22px] border border-[var(--p-color-border)] bg-white p-5 shadow-sm">
                <div className="grid gap-5 lg:grid-cols-[auto_1fr_1fr_1fr] lg:items-center">
                  <SectionHeading icon={Buildings} title="Contexto de atuação" />
                  <ContextCell label="Campus" value={profileLoading ? "Carregando..." : summary.campusName} icon={Buildings} />
                  <ContextCell label="Setor responsável" value={profileLoading ? "Carregando..." : summary.departmentName} icon={User} />
                  <ContextCell label="Escopo de atuação" value={summary.scopeDescription} icon={ShieldCheck} />
                </div>
              </ProfileSection>

              <ProfileSection delay={0.12} className="rounded-[22px] border border-[var(--p-color-border)] bg-white p-5 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-center">
                  <SectionHeading icon={ShieldCheck} title="Permissões nesta sessão" />
                  <div className="flex flex-wrap gap-3">
                    {summary.permissions.map((permission) => (
                      <ProfileChip
                        key={permission.label}
                        icon={permission.icon}
                        tone="softBlue"
                        label={permission.label}
                      />
                    ))}
                  </div>
                </div>
              </ProfileSection>

              <ProfileSection delay={0.16} className="rounded-[22px] border border-[var(--p-color-border)] bg-white p-5 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-center">
                  <SectionHeading icon={Flask} title="Vínculos institucionais" />
                  {profileLoading ? (
                    <div className="h-16 animate-pulse rounded-2xl bg-[var(--p-color-surface-muted)]" />
                  ) : summary.labs.length === 0 ? (
                    <div className="rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] p-4">
                      <p className="font-bold text-[var(--p-color-fg-default)]">Nenhum laboratório vinculado</p>
                      <p className="mt-1 text-sm font-medium text-[var(--p-color-fg-muted)]">
                        A ausência de vínculo não impede suas ações conforme as permissões da sua função.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {summary.labs.map((lab) => (
                        <ProfileChip key={lab} icon={Flask} tone="softBlue" label={lab} />
                      ))}
                    </div>
                  )}
                </div>
              </ProfileSection>

              <ProfileSection delay={0.2} className="rounded-[22px] border border-[var(--p-color-border)] bg-white p-5 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
                  <SectionHeading icon={CheckCircle} title="Suas pendências" />
                  <div className="grid gap-3 md:grid-cols-3">
                    {summary.pending.map((pending) => (
                      <button
                        key={pending.label}
                        type="button"
                        onClick={() => handleProfileNavigate(pending.href)}
                        className="group flex items-center justify-between rounded-2xl border border-[var(--p-color-border)] bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-[var(--p-color-info-border)] hover:bg-[var(--p-color-info-bg)]/35 hover:shadow-lg active:scale-[0.98]"
                      >
                        <span className="flex items-center gap-4">
                          <span
                            className={[
                              "flex h-14 w-14 items-center justify-center rounded-2xl",
                              pending.tone === "blue" && "bg-[var(--p-color-info-bg)] text-[var(--p-color-action)]",
                              pending.tone === "amber" && "bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]",
                              pending.tone === "violet" && "bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]",
                            ].filter(Boolean).join(" ")}
                          >
                            <pending.icon size={26} weight="duotone" />
                          </span>
                          <span>
                            <motion.span
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.28, duration: 0.22 }}
                              className="block font-display text-3xl font-bold text-[var(--p-color-action)]"
                            >
                              {pending.value}
                            </motion.span>
                            <span className="block text-sm font-semibold text-[var(--p-color-fg-muted)]">
                              {pending.label}
                            </span>
                          </span>
                        </span>
                        <ArrowRight
                          size={20}
                          weight="bold"
                          className="text-[var(--p-color-fg-muted)] transition-transform group-hover:translate-x-1"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </ProfileSection>

              <ProfileSection delay={0.24} className="flex flex-wrap justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => handleProfileNavigate(summary.pending[0]?.href || "/minhas-dfds")}
                  className="group inline-flex h-12 items-center gap-2 rounded-xl border border-[var(--p-color-border)] bg-white px-6 text-sm font-bold text-[var(--p-color-brand-500)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--p-color-surface-soft)] hover:shadow-md active:scale-[0.98]"
                >
                  <ListChecks size={20} weight="bold" />
                  Ver pendências
                </button>
                <button
                  type="button"
                  onClick={handleOpenSettings}
                  className="group inline-flex h-12 items-center gap-2 rounded-xl border border-[var(--p-color-border)] bg-white px-6 text-sm font-bold text-[var(--p-color-brand-500)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--p-color-surface-soft)] hover:shadow-md active:scale-[0.98]"
                >
                  <GearSix size={20} weight="bold" className="transition-transform group-hover:rotate-12" />
                  Preferências
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleProfileNavigate(
                      getRoleSettingsPath(userData?.role || "solicitante"),
                      "Preferências abertas para revisão.",
                    )
                  }
                  className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-xl bg-[var(--p-color-action)] px-7 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[var(--p-color-action-hover)] hover:shadow-xl active:scale-[0.98]"
                >
                  <span className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg] bg-white/18 opacity-0 transition-all duration-500 group-hover:left-[120%] group-hover:opacity-100" />
                  <User size={20} weight="bold" />
                  Gerenciar perfil e preferências
                </button>
              </ProfileSection>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProfileSection({
  children,
  delay,
  className,
}: {
  children: React.ReactNode;
  delay: number;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function SectionHeading({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex min-w-[230px] items-center gap-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] text-[var(--p-color-action)]">
        <Icon size={24} weight="duotone" />
      </span>
      <h3 className="font-display text-lg font-bold text-[var(--p-color-brand-700)]">{title}</h3>
    </div>
  );
}

function ContextCell({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="border-[var(--p-color-border)] lg:border-l lg:pl-8">
      <p className="text-sm font-semibold text-[var(--p-color-fg-subtle)]">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-base font-bold leading-snug text-[var(--p-color-brand-500)]">
        <Icon size={18} weight="duotone" />
        {value}
      </p>
    </div>
  );
}

function ProfileChip({
  icon: Icon,
  label,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  tone: "green" | "blue" | "violet" | "softBlue";
}) {
  const toneClass = {
    green: "border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]",
    blue: "border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-500)]",
    violet: "border-[var(--p-color-insight-border)] bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]",
    softBlue: "border-[var(--p-color-border)] bg-[var(--p-color-surface-muted)] text-[var(--p-color-action)]",
  }[tone];

  return (
    <span
      className={[
        "group inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]",
        toneClass,
      ].join(" ")}
    >
      <Icon size={18} weight="duotone" className="transition-transform group-hover:-translate-y-px" />
      {label}
    </span>
  );
}
