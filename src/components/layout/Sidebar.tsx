"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getSafeUser, supabase } from "@/lib/supabase";
import { resolveCampusBranding } from "@/lib/campus-branding";
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
  const [campusName, setCampusName] = useState("");
  const [cycleYear, setCycleYear] = useState<number>(new Date().getFullYear());

  const isActivePath = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    let active = true;
    async function loadCampus() {
      const user = await getSafeUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("campus_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!active || !profile?.campus_id) return;

      const { data: campus } = await supabase
        .from("campi")
        .select("nome,sigla")
        .eq("id", profile.campus_id)
        .maybeSingle();
      if (!active) return;
      if (campus?.nome || campus?.sigla) {
        setCampusName(String(campus.nome || campus.sigla));
      }
    }
    loadCampus();
    return () => {
      active = false;
    };
  }, []);

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
  const campusBranding = resolveCampusBranding(campusName);

  return (
    <>
      <nav className="fixed left-0 top-0 z-50 h-screen w-[var(--sidebar-width)] border-r border-[#D2D0CE] bg-[#F3F2F1] backdrop-blur-md flex flex-col p-3">
        <div className="rounded-2xl border border-[#D2D0CE] bg-[#EBE9E8] px-3 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-[#D9E0E8] shadow-sm p-1">
              <img
                src={campusBranding.logoSrc}
                alt={campusBranding.label}
                className="max-h-8 w-auto object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#605E5C]">
                Plataforma
              </p>
              <p className="text-sm font-semibold text-[#323130] truncate">
                PERCATA
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#605E5C]">
                Ciclo {cycleYear}
              </p>
            </div>
          </div>
        </div>

        <div className="sidebar-scroll mt-4 flex-1 w-full flex flex-col gap-3 overflow-y-auto pr-1">
          {sections.map((section) => (
            <div key={section.label} className="w-full">
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
            </div>
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

  const solicitanteSection: NavSection = {
    label: "Meu Espaço",
    items: [
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
        href: "/dfds-coletivas",
        icon: UsersThree,
        label: "DFDs Coletivas",
      },
      {
        href: "/historico",
        icon: ClockCounterClockwise,
        label: "Solicitações Anteriores",
      },
    ],
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
        label: "Salas Coletivas",
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
    <Link
      href={href}
      prefetch
      aria-label={label}
      className={cn(
        "group flex items-center gap-3 transition-all duration-300 relative no-underline",
        "w-full min-h-[46px] rounded-xl mb-1 px-2.5 py-2 text-[#323130] border",
        active
          ? "bg-white text-[#164073] border-[#C8C6C4] shadow-[0_8px_20px_-14px_rgba(50,49,48,0.22)]"
          : "border-transparent hover:bg-[#EBE9E8] hover:border-[#D2D0CE]",
      )}
    >
      {badge && (
        <span className="absolute top-1.5 right-2 font-bold text-white text-[10px] px-1.5 py-0.5 rounded-full border-2 bg-[#B3261E] border-[#FEF7FF]">
          {badge}
        </span>
      )}
      <div
        className={cn(
          "w-9 h-9 rounded-lg inline-flex items-center justify-center shrink-0",
          active ? "bg-[#F3F2F1] text-[#164073]" : "bg-[#EDEBE9] text-[#605E5C]",
        )}
      >
        <Icon size={18} weight={active ? "fill" : "bold"} />
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-wider truncate",
            active ? "text-[#164073]" : "text-[#2E3A4A]",
          )}
        >
          {label}
        </p>
      </div>
    </Link>
  );
}
