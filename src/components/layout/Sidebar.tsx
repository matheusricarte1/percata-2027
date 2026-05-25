"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fetchActiveCycleYear } from "@/lib/cycle";
import {
  House,
  Files,
  Package,
  ClockCounterClockwise,
  Gear,
  CheckCircle,
  Wallet,
  ArrowRight,
  UsersThree,
  MagnifyingGlass,
  ChartLineUp,
} from "@phosphor-icons/react";
import { useCarrinhoStore } from "@/store/carrinho";

interface SidebarProps {
  role?: "solicitante" | "chefia" | "admin" | "superadmin";
}

interface NavItem {
  href: string;
  icon: any;
  label: string;
  badge?: string | null;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

export function Sidebar({ role = "solicitante" }: SidebarProps) {
  const pathname = usePathname();
  const itemCount = useCarrinhoStore((state) => state.items.length);
  const [cycleYear, setCycleYear] = useState<number>(new Date().getFullYear());
  const reduceMotion = useReducedMotion();

  const isActivePath = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

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

  const sections = buildSections(role, itemCount);
  return (
    <>
      <nav className="fixed left-0 top-0 z-50 h-screen w-[var(--sidebar-width)] border-r border-[#D2D0CE] bg-[var(--md-surface)] backdrop-blur-md flex flex-col p-3">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-[#D2D0CE] bg-white px-2 py-3 shadow-sm"
        >
            <div className="flex flex-col items-center gap-2">
              <img
                src="/brands/percata-logo.png"
                alt="PERCATA"
                className="h-auto w-full object-contain"
              />
              <p className="text-center text-[9px] font-semibold uppercase leading-3 text-[#605E5C]">
                Ciclo {cycleYear}
              </p>
              <p className="text-center text-[10px] font-medium leading-4 text-[#667085]">
                Planejamento com mais clareza
              </p>
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
              <SidebarSectionDivider label={section.label} />
              <div className="flex flex-col">
                {section.items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    active={isActivePath(item.href)}
                    badge={item.badge}
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

function buildSections(role: SidebarProps["role"], itemCount: number): NavSection[] {
  const settingsHref =
    role === "superadmin" || role === "admin"
      ? "/admin/configuracoes"
      : role === "chefia"
        ? "/triagem/configuracoes"
        : "/configuracoes";

  const painelUnificadoSection: NavSection = {
    label: "Painel",
    items: [
      {
        href: "/dashboard",
        icon: House,
        label: "Painel Unificado",
      },
      {
        href: settingsHref,
        icon: Gear,
        label: "Configurações",
      },
    ],
  };

  const solicitanteItems: NavItem[] = [
    {
      href: "/minhas-dfds",
      icon: Files,
      label: "Minhas Solicitações",
    },
    {
      href: "/nova-dfd",
      icon: Gear,
      label: "Nova Solicitação",
    },
    {
      href: "/catalogo",
      icon: Package,
      label: "Catálogo",
      badge: itemCount > 0 ? itemCount.toString() : null,
    },
    {
      href: "/historico",
      icon: ClockCounterClockwise,
      label: "Solicitações Anteriores",
    },
  ];

  if (role === "solicitante") {
    solicitanteItems.splice(3, 0, {
      href: "/dfds-coletivas",
      icon: UsersThree,
      label: "DFDs Coletivas",
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
      },
      {
        href: "/triagem/orcamento",
        icon: Wallet,
        label: "Resumo do Setor",
      },
      {
        href: "/dfds-coletivas",
        icon: UsersThree,
        label: "DFDs Coletivas",
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
      },
      ...(role === "superadmin"
        ? [
            {
              href: "/admin/analytics-superadmin",
              icon: ChartLineUp,
              label: "Analytics Avançado",
            },
          ]
        : []),
      {
        href: "/admin/catalogo-busca",
        icon: MagnifyingGlass,
        label: "Busca do Catálogo",
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

function SidebarSectionDivider({ label }: { label: string }) {
  return (
    <div className="w-full px-1 mb-2 mt-1">
      <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.18em] text-[#605E5C]">
        <span className="font-semibold whitespace-nowrap">{label}</span>
        <span className="flex-1 border-t border-dashed border-black/10" />
        <ArrowRight size={10} weight="bold" />
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
}: {
  href: string;
  icon: any;
  label: string;
  active: boolean;
  badge?: string | null;
}) {
  return (
    <motion.div layout whileHover={{ x: 2 }} whileTap={{ scale: 0.985 }}>
      <Link
        href={href}
        prefetch
        aria-label={label}
        className={cn(
          "group flex items-center gap-3 transition-all duration-300 relative no-underline",
          "w-full min-h-[46px] rounded-xl mb-1 px-2.5 py-2 text-[#323130] border",
          active
            ? "bg-white text-[var(--upe-blue-upe)] border-[#C8C6C4] shadow-[0_8px_20px_-14px_rgba(50,49,48,0.22)]"
            : "border-transparent hover:bg-[#EBE9E8] hover:border-[#D2D0CE]",
        )}
      >
        {badge && (
          <span className="absolute top-1.5 right-2 font-bold text-white text-[10px] px-1.5 py-0.5 rounded-full border-2 bg-[var(--upe-red-upe)] border-[#FEF7FF]">
            {badge}
          </span>
        )}
        <div
          className={cn(
            "w-9 h-9 rounded-lg inline-flex items-center justify-center shrink-0 transition-colors duration-200",
            active ? "bg-[var(--upe-accent-washed-blue)] text-[var(--upe-blue-upe)]" : "bg-[#EDEBE9] text-[#605E5C]",
          )}
        >
          <Icon size={18} weight={active ? "fill" : "bold"} />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-wider truncate transition-colors duration-200",
              active ? "text-[var(--upe-blue-upe)]" : "text-[#2E3A4A]",
            )}
          >
            {label}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
