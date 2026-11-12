"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fetchActiveCycleYear } from "@/lib/cycle";
import { getRoleSettingsPath } from "@/lib/access";
import { getSafeUser, supabase } from "@/lib/supabase";
import {
  mapUnreadNotificationsToSidebarBadges,
  type SidebarNotificationBadge,
  type SidebarNotificationRow,
} from "@/lib/sidebar-notifications";
import { House } from "@/components/icons/phosphor/exports/House";
import { Files } from "@/components/icons/phosphor/exports/Files";
import { Package } from "@/components/icons/phosphor/exports/Package";
import { ClockCounterClockwise } from "@/components/icons/phosphor/exports/ClockCounterClockwise";
import { Gear } from "@/components/icons/phosphor/exports/Gear";
import { CheckCircle } from "@/components/icons/phosphor/exports/CheckCircle";
import { Wallet } from "@/components/icons/phosphor/exports/Wallet";
import { ArrowRight } from "@/components/icons/phosphor/exports/ArrowRight";
import { UsersThree } from "@/components/icons/phosphor/exports/UsersThree";
import { MagnifyingGlass } from "@/components/icons/phosphor/exports/MagnifyingGlass";
import { ChartLineUp } from "@/components/icons/phosphor/exports/ChartLineUp";
import { useCarrinhoStore } from "@/store/carrinho";

interface SidebarProps {
  role?: "solicitante" | "chefia" | "admin" | "superadmin";
  mobileOpen?: boolean;
  collapsed?: boolean;
  introduced?: boolean;
  onCollapsedChange?: () => void;
}

interface NavItem {
  href: string;
  icon: any;
  label: string;
  badge?: NavBadge | null;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

type NavBadge = SidebarNotificationBadge | {
  value: string;
  tone: "cart";
  title: string;
  shake?: false;
};

export function Sidebar({
  role = "solicitante",
  mobileOpen = false,
  collapsed = false,
  introduced = false,
  onCollapsedChange,
}: SidebarProps) {
  const pathname = usePathname();
  const itemCount = useCarrinhoStore((state) => state.items.length);
  const [cycleYear, setCycleYear] = useState<number>(new Date().getFullYear());
  const [notificationBadges, setNotificationBadges] = useState<Record<string, SidebarNotificationBadge>>({});
  const reduceMotion = useReducedMotion();
  const isCollapsed = collapsed && !mobileOpen;

  const isActivePath = (href: string) => {
    const hrefPath = stripHrefQuery(href);
    return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
  };

  useEffect(() => {
    let active = true;
    async function loadCycleYear() {
      try {
        const year = await fetchActiveCycleYear();
        if (active) setCycleYear(year);
      } catch {
        // fallback local year
      }
    }
    loadCycleYear();
    return () => {
      active = false;
    };
  }, []);

  const sections = useMemo(
    () => buildSections(role, itemCount, notificationBadges),
    [itemCount, notificationBadges, role],
  );
  const sidebarHrefs = useMemo(
    () => buildSections(role, itemCount, {}).flatMap((section) => section.items.map((item) => item.href)),
    [itemCount, role],
  );

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function loadNotificationBadges() {
      const user = await getSafeUser();
      if (!user || !active) return;

      const { data } = await supabase
        .from("notifications")
        .select("id,title,message,type,read")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(120);

      if (!active) return;
      setNotificationBadges(
        mapUnreadNotificationsToSidebarBadges(
          (data || []) as SidebarNotificationRow[],
          sidebarHrefs,
        ),
      );
    }

    loadNotificationBadges();
    timer = setInterval(loadNotificationBadges, 30000);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [sidebarHrefs]);

  return (
    <>
      <nav
        className={cn(
          "app-sidebar fixed left-0 top-0 z-50 h-screen flex-col border-r border-[var(--p-color-border)] bg-[var(--md-surface)] p-3 backdrop-blur-md transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex",
          mobileOpen
            ? "w-[min(320px,calc(100vw-2rem))] md:w-[var(--sidebar-width)]"
            : "w-[var(--sidebar-width)]",
          mobileOpen ? "flex" : "hidden",
        )}
        aria-label={isCollapsed ? "Navegação recolhida" : "Navegação principal"}
      >
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "relative overflow-visible rounded-2xl border border-[var(--p-color-border)] bg-white shadow-[0_14px_34px_-28px_rgba(16,43,74,0.55)] transition-all duration-500",
            "before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[var(--p-color-info-border)] before:to-transparent",
            isCollapsed ? "px-2 py-2.5" : "px-3 py-3",
          )}
        >
            <button
              type="button"
              onClick={onCollapsedChange}
              className={cn(
                "absolute -right-3 top-3 hidden h-7 w-7 items-center justify-center rounded-full border border-[var(--p-color-border)] bg-white text-[var(--p-color-brand-500)] shadow-[0_8px_18px_-10px_rgba(16,43,74,0.55)] transition hover:-translate-y-0.5 hover:bg-[var(--p-color-surface-muted)] md:inline-flex",
                !introduced && "motion-safe:animate-pulse",
              )}
              aria-label={isCollapsed ? "Expandir navegação" : "Recolher navegação"}
              title={isCollapsed ? "Expandir navegação" : "Recolher navegação"}
            >
              <ArrowRight
                size={14}
                weight="bold"
                className={cn("transition-transform duration-300", !isCollapsed && "rotate-180")}
              />
            </button>

            <div className={cn("flex flex-col", isCollapsed ? "items-center gap-2" : "gap-3")}>
              <div
                className={cn(
                  "relative flex items-center transition-all duration-500",
                  isCollapsed
                    ? "h-11 w-11 justify-start overflow-hidden rounded-xl bg-[var(--p-color-surface-soft)]"
                    : "min-h-[70px] justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[var(--p-color-surface-soft)] via-white to-[var(--p-color-info-bg)] px-3 py-2",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute rounded-full bg-[var(--p-color-danger-bg)] blur-md transition-all duration-500",
                    isCollapsed ? "inset-2" : "left-3 top-3 h-12 w-12",
                  )}
                />
                <img
                  src="/brands/percata-logo.png"
                  alt="PERCATA"
                  className={cn(
                    "relative z-10 object-contain transition-all duration-500",
                    isCollapsed ? "h-8 w-[112px] max-w-none object-left" : "max-h-[58px] w-full max-w-[176px]",
                  )}
                />
              </div>

              <div
                className={cn(
                  "rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] transition-all duration-500",
                  isCollapsed ? "w-full px-1.5 py-1.5" : "px-3 py-2.5",
                )}
              >
                <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between gap-2")}>
                  <div className={cn("min-w-0", isCollapsed && "sr-only")}>
                    <span className="block type-micro font-semibold uppercase tracking-[0.18em] text-[var(--p-color-fg-subtle)]">
                      Ciclo vigente
                    </span>
                    <span className="mt-0.5 block font-display text-lg font-semibold leading-none text-[var(--p-color-brand-500)]">
                      {cycleYear}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full bg-[var(--p-color-success-bg)] font-semibold uppercase text-[var(--p-color-success)] ring-1 ring-[var(--p-color-success-border)]",
                      isCollapsed ? "h-2.5 w-2.5 p-0 text-[0px]" : "px-2 py-0.5 type-micro tracking-[0.16em]",
                    )}
                  >
                    {!isCollapsed ? "Ativo" : null}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-1.5 type-kicker font-medium leading-4 text-[var(--p-color-fg-muted)] transition-all duration-300",
                    isCollapsed && "sr-only",
                  )}
                >
                  Planejamento e administração
                </p>
              </div>
            </div>
          </motion.div>

        <div className="sidebar-scroll mt-4 flex-1 w-full flex flex-col gap-3 overflow-y-auto pr-1">
          {sections.map((section, index) => (
            <motion.div
              key={section.label}
              initial={reduceMotion ? false : { opacity: 0, x: -10 }}
              animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
              transition={{
                duration: 0.28,
                delay: reduceMotion ? 0 : index * 0.04,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="w-full"
            >
              <SidebarSectionDivider label={section.label} collapsed={isCollapsed} />
              <div className="flex flex-col">
                {section.items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    active={isActivePath(item.href)}
                    badge={item.badge}
                    collapsed={isCollapsed}
                    reduceMotion={Boolean(reduceMotion)}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </nav>
    </>
  );
}

function buildSections(
  role: SidebarProps["role"],
  itemCount: number,
  notificationBadges: Record<string, SidebarNotificationBadge>,
): NavSection[] {
  const settingsHref = getRoleSettingsPath(role || "solicitante");

  const painelUnificadoSection: NavSection = {
    label: "Painel",
    items: [
      {
        href: "/dashboard",
        icon: House,
        label: "Painel Unificado",
        badge: notificationBadges["/dashboard"],
      },
      {
        href: settingsHref,
        icon: Gear,
        label: "Configurações",
        badge: notificationBadges[settingsHref],
      },
    ],
  };

  const solicitanteItems: NavItem[] = [
    {
      href: "/minhas-dfds",
      icon: Files,
      label: "Minhas Solicitações",
      badge: notificationBadges["/minhas-dfds"],
    },
    {
      href: "/nova-dfd",
      icon: Gear,
      label: "Nova Solicitação",
      badge: notificationBadges["/nova-dfd"],
    },
    {
      href: "/catalogo",
      icon: Package,
      label: "Catálogo",
      badge: notificationBadges["/catalogo"] || createCartBadge(itemCount),
    },
    {
      href: "/historico",
      icon: ClockCounterClockwise,
      label: "Solicitações Anteriores",
      badge: notificationBadges["/historico"],
    },
  ];

  if (role === "solicitante") {
    solicitanteItems.splice(3, 0, {
      href: "/dfds-coletivas?view=rooms",
      icon: UsersThree,
      label: "DFDs Coletivas",
      badge: notificationBadges["/dfds-coletivas"],
    });
  }

  const solicitanteSection: NavSection = {
    label: "Meu Espaço",
    items: solicitanteItems,
  };

  const chefiaSection: NavSection = {
    label: "Chefia",
    items: [
      {
        href: "/triagem",
        icon: CheckCircle,
        label: "Análise da Chefia",
        badge: notificationBadges["/triagem"],
      },
      {
        href: "/triagem/orcamento",
        icon: Wallet,
        label: "Resumo do Setor",
        badge: notificationBadges["/triagem/orcamento"],
      },
      {
        href: "/dfds-coletivas?view=rooms",
        icon: UsersThree,
        label: "DFDs Coletivas",
        badge: notificationBadges["/dfds-coletivas"],
      },
    ],
  };

  const adminSection: NavSection = {
    label: "Administração",
    items: [
      {
        href: "/admin/consolidacao",
        icon: CheckCircle,
        label: "Consolidação de Pedidos",
        badge: notificationBadges["/admin/consolidacao"],
      },
      ...(role === "superadmin"
        ? [
            {
              href: "/admin/todas-dfds",
              icon: Files,
              label: "Todas as DFDs",
              badge: notificationBadges["/admin/todas-dfds"],
            },
          ]
        : []),
      ...(role === "superadmin" || role === "admin"
        ? [
            {
              href: "/admin/analytics-superadmin",
              icon: ChartLineUp,
              label: "Central Analítica",
              badge: notificationBadges["/admin/analytics-superadmin"],
            },
          ]
        : []),
      {
        href: "/admin/catalogo-busca",
        icon: MagnifyingGlass,
        label: "Busca do Catálogo",
        badge: notificationBadges["/admin/catalogo-busca"],
      },
    ],
  };

  if (role === "superadmin") {
    return [
      painelUnificadoSection,
      adminSection,
      chefiaSection,
      solicitanteSection,
    ];
  }

  if (role === "admin") {
    return [painelUnificadoSection, adminSection];
  }

  if (role === "chefia") {
    return [painelUnificadoSection, chefiaSection, solicitanteSection];
  }

  return [painelUnificadoSection, solicitanteSection];
}

function createCartBadge(itemCount: number): NavBadge | null {
  if (itemCount <= 0) return null;
  return {
    value: itemCount > 99 ? "99+" : String(itemCount),
    tone: "cart",
    title: `${itemCount} item${itemCount === 1 ? "" : "s"} no carrinho`,
    shake: false,
  };
}

function stripHrefQuery(href: string) {
  return href.split(/[?#]/, 1)[0] || "/";
}

function SidebarSectionDivider({ label, collapsed }: { label: string; collapsed?: boolean }) {
  return (
    <div className={cn("w-full px-1 mb-2 mt-1", collapsed && "px-0")}>
      <div
        className={cn(
          "flex items-center gap-2 type-micro uppercase tracking-[0.18em] text-[var(--p-color-fg-muted)]",
          collapsed && "justify-center",
        )}
      >
        <span className={cn("font-semibold whitespace-nowrap", collapsed && "sr-only")}>
          {label}
        </span>
        <span className="flex-1 border-t border-dashed border-black/10" />
        {!collapsed ? <ArrowRight size={10} weight="bold" /> : null}
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  active,
  badge,
  collapsed,
  reduceMotion,
}: {
  href: string;
  icon: any;
  label: string;
  active: boolean;
  badge?: NavBadge | null;
  collapsed?: boolean;
  reduceMotion?: boolean;
}) {
  const badgeToneClass = badge
    ? {
        error: "bg-[var(--p-color-danger)] text-white",
        warning: "bg-[var(--p-color-warning)] text-white",
        info: "bg-[var(--p-color-action)] text-white",
        success: "bg-[var(--p-color-success)] text-white",
        cart: "bg-[var(--p-color-action)] text-white",
      }[badge.tone]
    : "";

  return (
    <motion.div layout whileHover={collapsed ? { y: -1 } : { x: 2 }} whileTap={{ scale: 0.985 }}>
      {/* A module switch starts a fresh document: the destination remains
          reachable even when the client router's prefetched state is stalled. */}
      <a
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        title={label}
        className={cn(
          "group flex items-center gap-3 transition-all duration-300 relative no-underline",
          "w-full min-h-[46px] rounded-xl mb-1 px-2.5 py-2 text-[var(--p-color-fg-strong)] border",
          collapsed && "justify-center gap-0 px-1.5",
          active
            ? "bg-white text-[var(--p-color-brand-500)] border-[var(--p-color-border-strong)] shadow-[0_8px_20px_-14px_rgba(50,49,48,0.22)]"
            : "border-transparent hover:bg-[var(--p-color-border-muted)] hover:border-[var(--p-color-border)]",
        )}
      >
        {badge && (
          <motion.span
            aria-label={badge.title}
            title={badge.title}
            initial={false}
            animate={
              !reduceMotion && badge.shake
                ? {
                    rotate: [0, -7, 6, -3, 0],
                    x: [0, -1, 1, 0],
                  }
                : undefined
            }
            transition={{
              duration: 0.58,
              ease: "easeInOut",
              repeat: Infinity,
              repeatDelay: 4.8,
            }}
            className={cn(
              "absolute z-10 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white px-1.5 py-0.5 type-kicker font-bold shadow-sm",
              badgeToneClass,
              collapsed ? "right-1 top-1" : "top-1.5 right-2",
            )}
          >
            {badge.value}
          </motion.span>
        )}
        <div
          className={cn(
            "w-9 h-9 rounded-lg inline-flex items-center justify-center shrink-0 transition-colors duration-200",
            active ? "bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-500)]" : "bg-[var(--p-color-border-muted)] text-[var(--p-color-fg-muted)]",
          )}
        >
          <Icon size={18} weight={active ? "fill" : "bold"} />
        </div>
        <div className={cn("min-w-0 flex-1 transition-all duration-300", badge && !collapsed && "pr-4", collapsed && "sr-only")}>
          <p
            className={cn(
              "text-[12px] leading-[1.4] font-semibold whitespace-normal break-words transition-colors duration-200",
              active ? "text-[var(--p-color-brand-500)]" : "text-[var(--p-color-fg-default)]",
            )}
          >
            {label}
          </p>
        </div>
      </a>
    </motion.div>
  );
}
