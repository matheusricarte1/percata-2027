"use client";

import { useEffect, useState } from "react";
import { ArrowClockwise } from "@/components/icons/phosphor/exports/ArrowClockwise";
import { ChartLineUp } from "@/components/icons/phosphor/exports/ChartLineUp";
import { ShieldWarning } from "@/components/icons/phosphor/exports/ShieldWarning";
import { WarningCircle } from "@/components/icons/phosphor/exports/WarningCircle";
import { cn } from "@/lib/utils";

type SummaryPayload = {
  generated_at: string;
  quality: {
    total_items: number;
    missing_natureza: number;
    missing_pct: number;
    mixed_expense_classes: number;
    mixed_pct: number;
  };
  review: {
    open: number;
    pending: number;
    in_analysis: number;
    saneados: number;
  };
  analytics: {
    available: boolean;
    scope: string;
  };
  recommendation: {
    action: string;
    risk_level: "baixo" | "moderado" | "alto";
  };
};

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function formatPercent(value: unknown) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function riskTone(risk: string) {
  if (risk === "alto") return "border-red-200 bg-red-50 text-red-800";
  if (risk === "moderado") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

export function EfiscoIntelligenceSummary() {
  const [payload, setPayload] = useState<SummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadSummary() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/efisco-intelligence/summary", {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Falha ao carregar resumo e-Fisco.");
      setPayload(data as SummaryPayload);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  if (loading) {
    return (
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        Carregando resumo integrado...
      </section>
    );
  }

  if (!payload) return null;

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="type-kicker font-semibold uppercase tracking-[0.18em] text-[var(--p-color-brand-400)]">
            Painel integrado
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--p-color-brand-500)]">
            Governança, saneamento e analytics em uma única leitura
          </h2>
        </div>
        <button
          type="button"
          onClick={loadSummary}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-[var(--p-color-brand-500)] hover:bg-slate-50"
        >
          <ArrowClockwise size={14} />
          Atualizar
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="type-kicker font-semibold uppercase tracking-wide text-slate-500">
            Cadastro
          </p>
          <p className="mt-1 text-xl font-semibold text-[var(--p-color-brand-500)]">
            {formatNumber(payload.quality.total_items)}
          </p>
          <p className="text-xs text-slate-500">itens e-Fisco normalizados</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50/70 p-3">
          <div className="flex items-center gap-2">
            <WarningCircle size={16} className="text-red-700" />
            <p className="type-kicker font-semibold uppercase tracking-wide text-red-700">
              Sem natureza
            </p>
          </div>
          <p className="mt-1 text-xl font-semibold text-red-800">
            {formatNumber(payload.quality.missing_natureza)}
          </p>
          <p className="text-xs text-red-700">
            {formatPercent(payload.quality.missing_pct)} do catálogo
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-3">
          <div className="flex items-center gap-2">
            <ShieldWarning size={16} className="text-amber-700" />
            <p className="type-kicker font-semibold uppercase tracking-wide text-amber-700">
              Fila interna
            </p>
          </div>
          <p className="mt-1 text-xl font-semibold text-amber-800">
            {formatNumber(payload.review.open)}
          </p>
          <p className="text-xs text-amber-700">
            {formatNumber(payload.review.saneados)} já saneados
          </p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-3">
          <div className="flex items-center gap-2">
            <ChartLineUp size={16} className="text-[var(--p-color-brand-500)]" />
            <p className="type-kicker font-semibold uppercase tracking-wide text-[var(--p-color-brand-500)]">
              Analytics
            </p>
          </div>
          <p className="mt-1 text-xl font-semibold text-[var(--p-color-brand-500)]">
            {payload.analytics.available ? "Ativo" : "Restrito"}
          </p>
          <p className="text-xs text-[var(--p-color-brand-400)]">planejamento institucional</p>
        </div>
      </div>

      <div
        className={cn(
          "mt-4 rounded-xl border px-4 py-3 text-sm font-medium",
          riskTone(payload.recommendation.risk_level),
        )}
      >
        Risco {payload.recommendation.risk_level}: {payload.recommendation.action}
      </div>
    </section>
  );
}
