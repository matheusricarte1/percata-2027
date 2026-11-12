"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartLineUp } from "@/components/icons/phosphor/exports/ChartLineUp";
import { Database } from "@/components/icons/phosphor/exports/Database";
import { ShieldCheck } from "@/components/icons/phosphor/exports/ShieldCheck";
import { cn } from "@/lib/utils";

const LINKS = [
  {
    href: "/admin/analytics-superadmin",
    label: "Central Analítica",
    detail: "Painéis institucionais",
    icon: ChartLineUp,
  },
  {
    href: "/admin/efisco-governance",
    label: "Governança e-Fisco",
    detail: "Qualidade, árvore e filas",
    icon: Database,
  },
  {
    href: "/admin/efisco-natureza-review",
    label: "Saneamento e-Fisco",
    detail: "Decisão e homologação",
    icon: ShieldCheck,
  },
];

export function EfiscoIntelligenceNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Inteligência e-Fisco"
      className="mb-6 flex gap-1 overflow-x-auto border-y border-[var(--p-color-border)] bg-white px-1 py-2"
    >
      {LINKS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-11 shrink-0 items-center gap-2 rounded-lg border px-4 text-xs font-semibold uppercase tracking-[0.08em] transition",
              active
                ? "border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-500)]"
                : "border-transparent text-[var(--p-color-fg-muted)] hover:border-[var(--p-color-border)] hover:bg-[var(--p-color-surface-muted)]",
            )}
          >
            <Icon size={16} weight={active ? "fill" : "bold"} />
            <span>{item.label}</span>
            <span className="sr-only">{item.detail}</span>
          </Link>
        );
      })}
    </nav>
  );
}
