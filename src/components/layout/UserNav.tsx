"use client";

import React, { useEffect, useState } from "react";
import { getSafeUser, supabase } from "@/lib/supabase";
import {
  SignOut,
  User,
  CaretDown,
  Envelope,
  GearSix,
  Buildings,
  Flask,
} from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface UserData {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  initials: string;
}

interface ProfileSummary {
  campusName: string;
  departmentName: string;
  labs: string[];
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

const SETTINGS_PREFIX = "percata:user-settings:v1";

function getInitials(nameOrEmail: string): string {
  const source = String(nameOrEmail || "").trim();
  if (!source) return "US";
  const clean = source.includes("@") ? source.split("@")[0] : source;
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return clean.slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

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
  try {
    const userRaw = userId ? window.localStorage.getItem(`${SETTINGS_PREFIX}:${userId}`) : null;
    const fallbackRaw = window.localStorage.getItem(SETTINGS_PREFIX);
    const raw = userRaw || fallbackRaw;
    return raw ? normalizeProfilePrefs(JSON.parse(raw)) : DEFAULT_PROFILE_PREFS;
  } catch {
    return DEFAULT_PROFILE_PREFS;
  }
}

export function UserNav() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profilePrefs, setProfilePrefs] = useState<ProfilePrefs>(DEFAULT_PROFILE_PREFS);
  const [summary, setSummary] = useState<ProfileSummary>({
    campusName: "Não definido",
    departmentName: "Não definido",
    labs: [],
  });
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
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
          initials: getInitials(baseName || baseEmail || "US"),
        });
        setProfilePrefs(readProfilePrefs(user.id));

        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name,email,campus_id")
            .eq("id", user.id)
            .maybeSingle();

          const resolvedName = String(profile?.full_name || "").trim() || baseName;
          const resolvedEmail = String(profile?.email || "").trim().toLowerCase() || baseEmail;

          setUserData((prev) =>
            prev
              ? {
                  ...prev,
                  name: resolvedName,
                  email: resolvedEmail,
                  initials: getInitials(resolvedName || resolvedEmail || "US"),
                }
              : prev,
          );

          const { data: links } = await supabase
            .from("user_units")
            .select("unit_type,unit_id")
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

          setSummary({
            campusName: campusName || "Não definido",
            departmentName: departments[0] || "Não definido",
            labs: laboratories,
          });
        } catch {
          setSummary({
            campusName: "Não definido",
            departmentName: "Não definido",
            labs: [],
          });
        } finally {
          setProfileLoading(false);
        }
        return;
      }
      setProfileLoading(false);
    }
    getUser();
  }, []);

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

  function resolveSettingsRoute(path: string): string {
    if (path.startsWith("/admin")) return "/admin/configuracoes";
    if (path.startsWith("/triagem")) return "/triagem/configuracoes";
    return "/configuracoes";
  }

  const handleOpenProfile = () => {
    setIsOpen(false);
    setProfileOpen(true);
  };

  const handleOpenSettings = () => {
    setIsOpen(false);
    setProfileOpen(false);
    router.push(resolveSettingsRoute(pathname || "/"));
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
    return <div className="w-10 h-10 rounded-full bg-black/5 animate-pulse" />;

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
        className="flex items-center gap-3 p-2 rounded-full hover:bg-black/5 transition-all group"
      >
        <div className="relative">
          {showAvatar && userData.avatar ? (
            <img
              src={userData.avatar}
              alt={userData.name}
              className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm group-hover:border-[var(--upe-blue-medium)] transition-all"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--upe-blue-upe)] to-[var(--upe-blue-medium)] flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm">
              {userData.initials}
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
        </div>

        <div className="hidden md:flex flex-col items-start mr-1">
          <span className="text-xs font-semibold text-[#1C1B1F] leading-none uppercase tracking-tighter">
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
          <div className="absolute right-0 mt-3 w-64 bg-white rounded-3xl shadow-2xl border border-black/5 p-2 z-50 animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-black/5 flex items-center gap-4">
              {showAvatar && userData.avatar ? (
                <img
                  src={userData.avatar}
                  alt={userData.name}
                className="w-12 h-12 rounded-2xl shadow-lg object-cover"
              />
            ) : (
                <div className="w-12 h-12 rounded-2xl shadow-lg bg-gradient-to-br from-[var(--upe-blue-upe)] to-[var(--upe-blue-medium)] text-white flex items-center justify-center font-bold">
                  {userData.initials}
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <p className="font-display font-semibold text-[#1C1B1F] leading-tight truncate">
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
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-black/60 hover:bg-black/5 hover:text-[var(--upe-blue-upe)] rounded-2xl transition-all group"
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
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-black/60 hover:bg-black/5 hover:text-[var(--upe-blue-upe)] rounded-2xl transition-all group"
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
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-2xl transition-all group"
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
        <DialogContent className="max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-2xl border border-[#E8EDF2] bg-white p-5 shadow-xl sm:max-w-2xl md:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {showAvatar && userData.avatar ? (
                    <img
                      src={userData.avatar}
                      alt={userData.name}
                      className="h-24 w-24 rounded-[22px] border border-[#D9E0E8] object-cover shadow-sm"
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-[22px] border border-[#D9E0E8] bg-[var(--upe-blue-upe)] text-white text-2xl font-semibold inline-flex items-center justify-center shadow-sm">
                      {userData.initials}
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7D98B8]">
                      Perfil do Usuário
                    </p>
                    <DialogTitle className="mt-1 text-2xl font-semibold tracking-tight text-[var(--upe-blue-upe)]">
                      {userData.name}
                    </DialogTitle>
                    <p className="mt-1 inline-flex items-center gap-1 text-sm text-[#5B6675]">
                      <Envelope size={14} />
                      {displayEmail}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="h-9 rounded-xl border border-[#D9E0E8] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#3E4C5F] hover:bg-[#F4F7FA]"
                >
                  Fechar
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-[#D9E0E8] bg-[#FAFBFC] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7D98B8]">
                    Campus
                  </p>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[var(--upe-blue-upe)]">
                    <Buildings size={16} weight="duotone" />
                    {profileLoading ? "Carregando..." : summary.campusName}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#D9E0E8] bg-[#FAFBFC] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7D98B8]">
                    Setor / Departamento
                  </p>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[var(--upe-blue-upe)]">
                    <User size={16} weight="duotone" />
                    {profileLoading ? "Carregando..." : summary.departmentName}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-[#D9E0E8] bg-[#FAFBFC] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7D98B8]">
                  Laboratórios vinculados
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profileLoading ? (
                    <span className="rounded-full bg-[#E8EDF2] px-3 py-1.5 text-xs font-semibold text-[#3E4C5F]">
                      Carregando...
                    </span>
                  ) : summary.labs.length === 0 ? (
                    <span className="rounded-full bg-[#E8EDF2] px-3 py-1.5 text-xs font-semibold text-[#3E4C5F]">
                      Sem laboratório vinculado
                    </span>
                  ) : (
                    summary.labs.map((lab) => (
                      <span
                        key={lab}
                        className="inline-flex items-center gap-1 rounded-full border border-[#D9E0E8] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--upe-blue-upe)]"
                      >
                        <Flask size={12} weight="duotone" />
                        {lab}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleOpenSettings}
                  className="h-10 rounded-xl bg-[var(--upe-blue-upe)] px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-[var(--upe-blue-deep)]"
                >
                  Abrir Configurações
                </button>
              </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
