"use client";

import { ReactNode, CSSProperties, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CaretRight } from "@/components/icons/phosphor/exports/CaretRight";
import { List } from "@/components/icons/phosphor/exports/List";
import { MagnifyingGlass } from "@/components/icons/phosphor/exports/MagnifyingGlass";
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
  SHELL_APP_BAR_HEIGHT_COMPACT,
  SHELL_SIDEBAR_WIDTH,
  type ShellRole,
  getSidebarWidthForRole,
} from "@/lib/layout-shell";
import { getShellBreadcrumbs } from "@/lib/navigation-breadcrumbs";
import { SubmissionDeadlineNotice } from "@/components/dfd/SubmissionDeadlineNotice";

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarIntroduced, setSidebarIntroduced] = useState(false);
  const [compactShell, setCompactShell] = useState(false);
  const pathname = usePathname();
  const isSuperadmin = role === "superadmin";
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1536px), (max-height: 1080px)");
    const updateDensity = () => setCompactShell(query.matches);
    updateDensity();
    query.addEventListener("change", updateDensity);
    return () => query.removeEventListener("change", updateDensity);
  }, []);

  useEffect(() => {
    if (pathname === "/admin/consolidacao") {
      setSidebarCollapsed(false);
      setSidebarIntroduced(true);
      return;
    }
    const storedPreference =
      typeof window !== "undefined"
        ? window.localStorage.getItem("percata:sidebar-collapsed")
        : null;
    if (storedPreference === "expanded") {
      setSidebarCollapsed(false);
      setSidebarIntroduced(true);
      return;
    }

    const sessionIntroduced =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem("percata:sidebar-introduced") === "1";
    if (storedPreference === "collapsed" || sessionIntroduced) {
      setSidebarCollapsed(true);
      setSidebarIntroduced(true);
      return;
    }

    setSidebarCollapsed(false);
    const timer = window.setTimeout(
      () => {
        setSidebarCollapsed(true);
        setSidebarIntroduced(true);
        window.sessionStorage.setItem("percata:sidebar-introduced", "1");
      },
      reduceMotion ? 1400 : 4200,
    );
    return () => window.clearTimeout(timer);
  }, [reduceMotion, pathname]);

  function handleSidebarToggle() {
    setSidebarIntroduced(true);
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(
        "percata:sidebar-collapsed",
        next ? "collapsed" : "expanded",
      );
      window.sessionStorage.setItem("percata:sidebar-introduced", "1");
      return next;
    });
  }

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
  const breadcrumbs = useMemo(() => getShellBreadcrumbs(pathname, role), [pathname, role]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

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
      window.dispatchEvent(
        new CustomEvent("percata:campus-changed", {
          detail: {
            campusId,
            campusName: current?.nome || current?.sigla || "",
          },
        }),
      );
    } finally {
      setSwitchingCampus(false);
    }
  }

  const expandedSidebarWidth = compactShell
    ? SHELL_SIDEBAR_WIDTH.compact
    : getSidebarWidthForRole(role);
  const sidebarWidth = sidebarCollapsed
    ? compactShell
      ? SHELL_SIDEBAR_WIDTH.compactCollapsed
      : SHELL_SIDEBAR_WIDTH.collapsed
    : expandedSidebarWidth;
  const appBarHeight = compactShell
    ? SHELL_APP_BAR_HEIGHT_COMPACT
    : SHELL_APP_BAR_HEIGHT;

  return (
    <div
      className={cn("flex min-h-screen", pathname === "/admin/consolidacao" && "consolidation-shell")}
      data-shell-density={compactShell ? "compact" : "comfortable"}
      style={
        {
          "--sidebar-width": sidebarWidth,
          "--app-bar-height": appBarHeight,
        } as CSSProperties
      }
    >
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Fechar navegação"
          className="fixed inset-0 z-[45] bg-[var(--p-color-brand-700)]/18 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <Sidebar
        role={role}
        mobileOpen={mobileNavOpen}
        collapsed={sidebarCollapsed}
        introduced={sidebarIntroduced}
        onCollapsedChange={handleSidebarToggle}
      />

      <main className="app-shell-main">
        <header
          className={cn(
            "app-bar transition-all bg-[var(--p-color-bg-muted)]/95 backdrop-blur-md",
            headerClassName,
          )}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Abrir navegação"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--p-color-border)] bg-white text-[var(--p-color-brand-500)] md:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              <List size={18} weight="bold" />
            </button>
            <div
              className={cn(
                "min-w-0 truncate font-display text-base font-semibold tracking-tighter sm:text-xl",
                titleClassName,
              )}
            >
              {title}
            </div>
            {resolvedCampusName ? (
              <div className="hidden xl:flex items-center gap-2 rounded-full border border-[var(--p-color-border)] bg-[var(--p-color-border-muted)] px-3 py-1.5">
                <img
                  src={campusBranding.logoSrc}
                  alt={campusBranding.label}
                  className="h-5 w-auto object-contain"
                />
                <span className="type-kicker font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-strong)]">
                  {resolvedCampusName}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {isSuperadmin && switchableCampi.length > 0 && (
              <div className="hidden lg:flex items-center gap-1 rounded-full border border-[var(--p-color-border)] bg-[var(--p-color-border-muted)] p-1">
                {switchableCampi.map((campus) => {
                  const selected = campus.id === activeCampusId;
                  return (
                    <button
                      key={campus.id}
                      type="button"
                      disabled={switchingCampus}
                      onClick={() => handleCampusSwitch(campus.id)}
                      className={cn(
                        "rounded-full px-3 py-1.5 type-caption font-semibold transition",
                        selected
                          ? "bg-[var(--upe-blue-upe)] text-white shadow-sm"
                          : "text-[var(--p-color-fg-strong)] hover:bg-white",
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
              "hidden rounded-full h-9 px-3 2xl:flex items-center gap-2 w-56 focus-within:w-72 transition-all duration-300",
              "bg-white border border-[var(--p-color-border)] focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--upe-accent-washed-blue)]",
              searchWrapperClassName,
            )}
          >
            <MagnifyingGlass
              size={20}
              className={cn("text-[var(--p-color-fg-muted)]", searchIconClassName)}
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
                "mr-1 text-[var(--p-color-fg-strong)] hover:bg-[var(--p-color-border-muted)]",
                notificationButtonClassName,
              )}
            />

            <div className="hidden lg:block">
              <UserNav />
            </div>
          </div>
        </header>

        <div className={cn("app-shell-scroll bg-[var(--md-surface)]", contentClassName)}>
          <div className={cn(pathname === "/dashboard" ? "max-w-[1600px]" : pathname === "/admin/consolidacao" ? "max-w-[1800px]" : "max-w-7xl", "mx-auto w-full")}>
            <nav
              aria-label="Você está em"
              className="app-breadcrumb mb-4 flex min-h-8 items-center gap-1 overflow-x-auto whitespace-nowrap rounded-full border border-[var(--semantic-neutral-border)] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--semantic-text-muted)] shadow-[0_8px_22px_rgba(22,64,115,0.05)]"
            >
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
                    {crumb.href && !isLast ? (
                      <Link
                        href={crumb.href}
                        className="rounded-full px-2 py-1 text-[var(--semantic-action)] transition hover:bg-[var(--semantic-action-soft)]"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span
                        className={cn(
                          "rounded-full px-2 py-1",
                          isLast
                            ? "bg-[var(--semantic-action-soft)] text-[var(--semantic-action)]"
                            : "text-[var(--semantic-text-muted)]",
                        )}
                      >
                        {crumb.label}
                      </span>
                    )}
                    {!isLast ? <CaretRight size={12} weight="bold" className="text-[var(--p-color-fg-subtle)]" /> : null}
                  </span>
                );
              })}
            </nav>
            {pathname === "/admin/consolidacao" ? <details className="consolidation-deadline"><summary>Prazo de submissão e acesso ao ciclo</summary><SubmissionDeadlineNotice role={role} /></details> : <SubmissionDeadlineNotice role={role} />}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                data-animate-page
                data-animate-auto
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
