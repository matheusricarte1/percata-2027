"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise,
  ChartLineUp,
  ShieldCheck,
  TrendDown,
  TrendUp,
  WarningCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { getSafeUser, supabase } from "@/lib/supabase";
import { normalizeRole, type UserRole } from "@/lib/access";

type RegressionSummary = {
  sampleSize: number;
  slope: number;
  intercept: number;
  r2: number;
  currentValue: number;
  predictedNextValue: number;
  trend: "up" | "down" | "flat" | "insufficient_data";
};

type ForecastRow = {
  codigoEfisco: string;
  descricao: string;
  observations: number;
  sampleMonths: number;
  latestMonth: string;
  latestQuantity: number;
  averageLast3Months: number;
  predictedNextQuantity: number;
  slope: number;
  r2: number;
  trend: "up" | "down" | "flat" | "insufficient_data";
};

type OutlierRow = {
  codigoEfisco: string;
  descricao: string;
  unitPrice: number;
  mediaHistorica: number;
  desvioPadrao: number;
  zScore: number;
  observacoes: number;
  dfdId: string;
  protocolo: string;
  mes: string;
};

type AnalyticsPayload = {
  generated_at: string;
  window_months: number;
  scope: { statuses: string[]; since: string; include_legacy?: boolean };
  dataset: {
    dfds: number;
    items: number;
    unique_codes: number;
    months_covered: number;
    current_dfds?: number;
    current_items?: number;
    legacy_dfds?: number;
    legacy_items?: number;
  };
  regression: {
    total_quantity: RegressionSummary;
    total_value: RegressionSummary;
    dfd_volume: RegressionSummary;
  };
  top_forecasts: ForecastRow[];
  price_outliers: OutlierRow[];
};

function formatCurrency(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function trendLabel(trend: RegressionSummary["trend"]) {
  if (trend === "up") return "Alta";
  if (trend === "down") return "Queda";
  if (trend === "flat") return "Estável";
  return "Dados insuficientes";
}

export default function SuperadminAnalyticsPage() {
  const [role, setRole] = useState<UserRole>("solicitante");
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [windowMonths, setWindowMonths] = useState(18);
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);

  const isSuperadmin = role === "superadmin";

  const resolveRole = useCallback(async () => {
    const user = await getSafeUser();
    if (!user) {
      setRole("solicitante");
      return "solicitante" as UserRole;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const resolved = normalizeRole(profile?.role, user.email);
    setRole(resolved);
    return resolved;
  }, []);

  const loadAnalytics = useCallback(async (months: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/superadmin/analytics/overview?window_months=${months}&include_legacy=1`,
        { cache: "no-store" },
      );
      const data = (await response.json().catch(() => ({}))) as Partial<AnalyticsPayload> & {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Falha ao carregar analytics.");
      setPayload(data as AnalyticsPayload);
    } catch (error: any) {
      toast.error(error?.message || "Erro ao carregar analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        const resolved = await resolveRole();
        if (!active) return;
        if (resolved === "superadmin") {
          await loadAnalytics(windowMonths);
        }
      } finally {
        if (active) setBootstrapping(false);
      }
    }
    void bootstrap();
    return () => {
      active = false;
    };
  }, [loadAnalytics, resolveRole, windowMonths]);

  const outliersCritical = useMemo(
    () => (payload?.price_outliers || []).filter((row) => Math.abs(row.zScore) >= 3).length,
    [payload],
  );

  if (bootstrapping) {
    return (
      <div className="rounded-3xl border border-[#D2D0CE] bg-white p-8 text-sm text-[#466188]">
        Carregando módulo avançado...
      </div>
    );
  }

  if (!isSuperadmin) {
    return (
      <div className="rounded-3xl border border-[#F3D7D9] bg-[#FFF7F8] p-8">
        <h1 className="text-2xl font-semibold text-[#7A1F26]">Acesso restrito</h1>
        <p className="mt-2 text-sm text-[#8A3C44]">
          Este módulo de ciência de dados é exclusivo para superadmin.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex rounded-xl border border-[#E5B6BA] bg-white px-4 py-2 text-sm font-semibold text-[#7A1F26]"
        >
          Voltar ao painel
        </Link>
      </div>
    );
  }

  const regression = payload?.regression;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[#D2D0CE] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#C7D7EA] bg-[#F4F8FC] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#164073]">
              <ShieldCheck size={14} weight="bold" />
              Superadmin only
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-[#0F2A4A]">
              Analytics avançado de demanda
            </h1>
            <p className="mt-1 text-sm text-[#466188]">
              Tendências por regressão linear, previsão por item e outliers de preço para apoio à governança.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={windowMonths}
              onChange={(event) => setWindowMonths(Number(event.target.value))}
              className="h-10 rounded-xl border border-[#D2D0CE] bg-white px-3 text-sm font-medium text-[#16345C]"
            >
              <option value={12}>Janela 12 meses</option>
              <option value={18}>Janela 18 meses</option>
              <option value={24}>Janela 24 meses</option>
              <option value={36}>Janela 36 meses</option>
            </select>
            <button
              type="button"
              onClick={() => void loadAnalytics(windowMonths)}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#164073] px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              <ArrowClockwise size={15} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="DFDs elegíveis" value={formatNumber(payload?.dataset.dfds || 0)} />
        <MetricCard label="Itens analisados" value={formatNumber(payload?.dataset.items || 0)} />
        <MetricCard label="Códigos únicos" value={formatNumber(payload?.dataset.unique_codes || 0)} />
        <MetricCard label="Outliers críticos" value={formatNumber(outliersCritical)} tone="warn" />
      </div>

      <div className="rounded-2xl border border-[#D2D0CE] bg-white p-4 text-xs text-[#4F6785]">
        Base utilizada:{" "}
        <b>{formatNumber(payload?.dataset.current_dfds || 0)} DFDs atuais</b> +{" "}
        <b>{formatNumber(payload?.dataset.legacy_dfds || 0)} DFDs legadas</b>
        {" · "}
        <b>{formatNumber(payload?.dataset.current_items || 0)} itens atuais</b> +{" "}
        <b>{formatNumber(payload?.dataset.legacy_items || 0)} itens legados</b>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <RegressionCard
          title="Volume de DFD"
          summary={regression?.dfd_volume || null}
          formatter={formatNumber}
        />
        <RegressionCard
          title="Quantidade total"
          summary={regression?.total_quantity || null}
          formatter={formatNumber}
        />
        <RegressionCard
          title="Valor total"
          summary={regression?.total_value || null}
          formatter={formatCurrency}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-[#D2D0CE] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#0F2A4A]">Top previsões de quantidade</h2>
            <span className="text-xs text-[#5A6E86]">{payload?.top_forecasts.length || 0} itens</span>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs uppercase tracking-[0.12em] text-[#6B7D92]">
                  <th className="pb-2">Código</th>
                  <th className="pb-2 text-right">Atual</th>
                  <th className="pb-2 text-right">Prev. próxima</th>
                  <th className="pb-2 text-right">R²</th>
                </tr>
              </thead>
              <tbody>
                {(payload?.top_forecasts || []).map((row) => (
                  <tr key={row.codigoEfisco} className="border-t border-[#EEF2F7]">
                    <td className="py-2 pr-2">
                      <p className="font-semibold text-[#16345C]">{row.codigoEfisco}</p>
                      <p className="line-clamp-1 text-xs text-[#5A6E86]">{row.descricao}</p>
                    </td>
                    <td className="py-2 text-right font-medium text-[#16345C]">
                      {formatNumber(row.latestQuantity)}
                    </td>
                    <td className="py-2 text-right font-semibold text-[#0B5E3F]">
                      {formatNumber(row.predictedNextQuantity)}
                    </td>
                    <td className="py-2 text-right text-xs text-[#5A6E86]">
                      {Math.round((row.r2 || 0) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-[#D2D0CE] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#0F2A4A]">Outliers de preço unitário</h2>
            <span className="text-xs text-[#5A6E86]">{payload?.price_outliers.length || 0} sinais</span>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs uppercase tracking-[0.12em] text-[#6B7D92]">
                  <th className="pb-2">Código</th>
                  <th className="pb-2 text-right">Preço</th>
                  <th className="pb-2 text-right">Média</th>
                  <th className="pb-2 text-right">Z-score</th>
                </tr>
              </thead>
              <tbody>
                {(payload?.price_outliers || []).map((row, index) => (
                  <tr key={`${row.dfdId}-${row.codigoEfisco}-${index}`} className="border-t border-[#EEF2F7]">
                    <td className="py-2 pr-2">
                      <p className="font-semibold text-[#16345C]">{row.codigoEfisco}</p>
                      <p className="line-clamp-1 text-xs text-[#5A6E86]">{row.descricao}</p>
                      <p className="text-[11px] text-[#7C8DA2]">{row.protocolo || row.dfdId}</p>
                    </td>
                    <td className="py-2 text-right font-semibold text-[#8A1E2A]">
                      {formatCurrency(row.unitPrice)}
                    </td>
                    <td className="py-2 text-right text-[#2B4C6F]">
                      {formatCurrency(row.mediaHistorica)}
                    </td>
                    <td className="py-2 text-right">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#F4CDD0] bg-[#FFF3F4] px-2 py-0.5 text-xs font-semibold text-[#8A1E2A]">
                        <WarningCircle size={12} weight="fill" />
                        {row.zScore.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  return (
    <div
      className={
        tone === "warn"
          ? "rounded-2xl border border-[#F4CDD0] bg-[#FFF6F7] p-4"
          : "rounded-2xl border border-[#D2D0CE] bg-white p-4"
      }
    >
      <p className="text-xs uppercase tracking-[0.12em] text-[#6A7E95]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#0F2A4A]">{value}</p>
    </div>
  );
}

function RegressionCard({
  title,
  summary,
  formatter,
}: {
  title: string;
  summary: RegressionSummary | null;
  formatter: (value: number) => string;
}) {
  const trend = summary?.trend || "insufficient_data";
  return (
    <div className="rounded-2xl border border-[#D2D0CE] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#16345C]">{title}</p>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#D9E5F2] bg-[#F6FAFE] px-2 py-1 text-[11px] font-semibold text-[#294D74]">
          <ChartLineUp size={13} />
          {trendLabel(trend)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-[#E7ECF3] bg-[#FAFCFF] p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#6A7E95]">Atual</p>
          <p className="mt-1 font-semibold text-[#0F2A4A]">
            {summary ? formatter(summary.currentValue) : "--"}
          </p>
        </div>
        <div className="rounded-xl border border-[#E7ECF3] bg-[#FAFCFF] p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#6A7E95]">Próximo ciclo</p>
          <p className="mt-1 font-semibold text-[#0F2A4A]">
            {summary ? formatter(summary.predictedNextValue) : "--"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[#5A6E86]">
        <span>R²: {summary ? `${Math.round(summary.r2 * 100)}%` : "--"}</span>
        <span>Amostras: {summary?.sampleSize || 0}</span>
        <span className="inline-flex items-center gap-1">
          {trend === "up" ? (
            <TrendUp size={13} className="text-[#0F7B54]" />
          ) : trend === "down" ? (
            <TrendDown size={13} className="text-[#A32933]" />
          ) : (
            <ChartLineUp size={13} className="text-[#406A92]" />
          )}
          inclinação {summary ? summary.slope.toFixed(2) : "--"}
        </span>
      </div>
    </div>
  );
}
