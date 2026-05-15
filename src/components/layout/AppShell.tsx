"use client";

import { ReactNode, CSSProperties, useEffect, useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { UserNav } from "@/components/layout/UserNav";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { cn } from "@/lib/utils";
import { getSafeUser, supabase } from "@/lib/supabase";
import { resolveCampusBranding } from "@/lib/campus-branding";
import { usePathname } from "next/navigation";
import {
  SHELL_APP_BAR_HEIGHT,
  type ShellRole,
  getSidebarWidthForRole,
} from "@/lib/layout-shell";

interface AppShellProps {
  role: ShellRole;
  title: string;
  searchPlaceholder: string;
  children: ReactNode;
  titleClassName?: string;
  headerClassName?: string;
  searchWrapperClassName?: string;
  searchIconClassName?: string;
  searchInputClassName?: string;
  notificationButtonClassName?: string;
  contentClassName?: string;
  showUnreadCount?: boolean;
}

export function AppShell({
  role,
  title,
  searchPlaceholder,
  children,
  titleClassName,
  headerClassName,
  searchWrapperClassName,
  searchIconClassName,
  searchInputClassName,
  notificationButtonClassName,
  contentClassName,
  showUnreadCount = false,
}: AppShellProps) {
  const [campi, setCampi] = useState<Array<{ id: string; nome: string; sigla: string }>>([]);
  const [activeCampusId, setActiveCampusId] = useState<string | null>(null);
  const [activeCampusName, setActiveCampusName] = useState("");
  const [switchingCampus, setSwitchingCampus] = useState(false);
  const pathname = usePathname();
  const isSuperadmin = role === "superadmin";
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isSuperadmin) return;

    let alive = true;
    async function loadCampusContext() {
      const user = await getSafeUser();
      if (!user) return;

      const [campiRes, profileRes] = await Promise.all([
        supabase
          .from("campi")
          .select("id,nome,sigla")
          .eq("ativo", true)
          .order("nome"),
        supabase
          .from("profiles")
          .select("campus_id")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      if (!alive) return;
      if (campiRes.data) setCampi(campiRes.data);
      if (profileRes.data?.campus_id) {
        setActiveCampusId(profileRes.data.campus_id);
        const current = campiRes.data?.find((campus) => campus.id === profileRes.data?.campus_id);
        if (current) {
          setActiveCampusName(current.nome || current.sigla);
        }
      } else if (campiRes.data?.[0]?.id) {
        setActiveCampusId(campiRes.data[0].id);
        setActiveCampusName(campiRes.data[0].nome || campiRes.data[0].sigla);
      }
    }

    loadCampusContext();
    return () => {
      alive = false;
    };
  }, [isSuperadmin]);

  useEffect(() => {
    if (isSuperadmin) return;

    let alive = true;
    async function loadUserCampus() {
      const user = await getSafeUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("campus_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!alive || !profile?.campus_id) return;

      const { data: campus } = await supabase
        .from("campi")
        .select("nome,sigla")
        .eq("id", profile.campus_id)
        .maybeSingle();

      if (!alive) return;
      if (campus?.nome || campus?.sigla) {
        setActiveCampusName(String(campus.nome || campus.sigla));
      }
    }

    loadUserCampus();
    return () => {
      alive = false;
    };
  }, [isSuperadmin]);

  useEffect(() => {
    if (role !== "admin" && role !== "superadmin") return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let mounted = true;

    async function dispatchEmailQueue() {
      if (!mounted) return;
      try {
        await fetch("/api/notifications/dispatch?batch=10", {
          method: "POST",
        });
      } catch {
        // noop
      }
    }

    dispatchEmailQueue();
    timer = setInterval(dispatchEmailQueue, 45000);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [role]);

  const switchableCampi = useMemo(() => {
    const focus = campi.filter((campus) =>
      ["PTR", "OUR"].includes(String(campus.sigla || "").toUpperCase()),
    );
    return focus.length > 0 ? focus : campi;
  }, [campi]);

  const resolvedCampusName = useMemo(() => {
    if (isSuperadmin && activeCampusId && campi.length > 0) {
      const current = campi.find((campus) => campus.id === activeCampusId);
      if (current) {
        return current.nome || current.sigla;
      }
    }
    return activeCampusName;
  }, [activeCampusId, activeCampusName, campi, isSuperadmin]);

  const campusBranding = resolveCampusBranding(resolvedCampusName);

  async function handleCampusSwitch(campusId: string) {
    if (!isSuperadmin || switchingCampus || campusId === activeCampusId) return;

    setSwitchingCampus(true);
    setActiveCampusId(campusId);
    const current = campi.find((campus) => campus.id === campusId);
    if (current) {
      setActiveCampusName(current.nome || current.sigla);
    }

    try {
      const user = await getSafeUser();
      if (!user) return;

      await supabase
        .from("profiles")
        .update({ campus_id: campusId })
        .eq("id", user.id);
    } finally {
      setSwitchingCampus(false);
    }
  }

  const sidebarWidth = getSidebarWidthForRole(role);

  return (
    <div
      className="flex min-h-screen"
      style={
        {
          "--sidebar-width": sidebarWidth,
          "--app-bar-height": SHELL_APP_BAR_HEIGHT,
        } as CSSProperties
      }
    >
      <Sidebar role={role} />

      <main className="app-shell-main">
        <header
          className={cn(
            "app-bar transition-all bg-[#F3F2F1]/95 backdrop-blur-md",
            headerClassName,
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "font-display font-semibold text-xl tracking-tighter",
                titleClassName,
              )}
            >
              {title}
            </div>
            {resolvedCampusName ? (
              <div className="hidden xl:flex items-center gap-2 rounded-full border border-[#D2D0CE] bg-[#EBE9E8] px-3 py-1.5">
                <img
                  src={campusBranding.logoSrc}
                  alt={campusBranding.label}
                  className="h-5 w-auto object-contain"
                />
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#323130]">
                  {resolvedCampusName}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-4">
            {isSuperadmin && switchableCampi.length > 0 && (
              <div className="hidden lg:flex items-center gap-1 rounded-full border border-[#D2D0CE] bg-[#EDEBE9] p-1">
                {switchableCampi.map((campus) => {
                  const selected = campus.id === activeCampusId;
                  return (
                    <button
                      key={campus.id}
                      type="button"
                      disabled={switchingCampus}
                      onClick={() => handleCampusSwitch(campus.id)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
                        selected
                          ? "bg-[var(--upe-blue-upe)] text-white shadow-sm"
                          : "text-[#323130] hover:bg-white",
                      )}
                      aria-label={`Alternar para ${campus.nome}`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {campus.sigla}
                        {switchingCampus && selected ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70 motion-safe:animate-pulse" />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          <div
            className={cn(
              "rounded-full h-10 px-4 flex items-center gap-3 w-64 focus-within:w-80 transition-all duration-300",
              "bg-white border border-[#D2D0CE] focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--upe-accent-washed-blue)]",
              searchWrapperClassName,
            )}
          >
            <MagnifyingGlass
              size={20}
              className={cn("text-[#605E5C]", searchIconClassName)}
            />
              <input
                type="text"
                aria-label="Pesquisar no sistema"
                placeholder={searchPlaceholder}
                className={cn(
                  "bg-transparent border-none outline-none text-sm w-full font-medium",
                  searchInputClassName,
                )}
              />
            </div>

            <NotificationBell
              showUnreadCount={showUnreadCount}
              className={cn(
                "mr-1 text-[#323130] hover:bg-[#EDEBE9]",
                notificationButtonClassName,
              )}
            />

            <UserNav />
          </div>
        </header>

        <div className={cn("app-shell-scroll bg-[var(--md-surface)]", contentClassName)}>
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
