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

type SegmentInsight = {
  level: "info" | "warning" | "critical";
  title: string;
  detail: string;
};

type SegmentGuide = {
  title: string;
  action: string;
};

type SegmentMonthlyPoint = {
  month: string;
  dfd_count: number;
  total_quantity: number;
  total_value: number;
};

type SegmentCodePoint = {
  codigoEfisco: string;
  descricao: string;
  observations: number;
  activeMonths: number;
  totalQuantity: number;
  withPriceObservations: number;
};

type IntermittencyClass = "smooth" | "intermittent" | "erratic" | "lumpy" | "insufficient";

type SegmentDeepSeriesStats = {
  mean: number;
  std_dev: number;
  cv: number;
  median: number;
  mad: number;
  iqr: number;
  skewness: number;
  theil_sen_slope: number;
  mann_kendall_s: number;
  mann_kendall_z: number;
  mann_kendall_p_value: number;
  mann_kendall_trend: "up" | "down" | "flat";
  hhi: number;
  effective_periods: number;
  top1_share_pct: number;
};

type SegmentIntermittencyStats = {
  series_count: number;
  class_distribution: Record<IntermittencyClass, number>;
  median_adi: number;
  median_cv2: number;
  top_lumpy: Array<{
    codigoEfisco: string;
    adi: number;
    cv2: number;
    observations: number;
  }>;
};

type SegmentAnalytics = {
  segment: "legacy" | "current" | "combined";
  scope: {
    price_signals_enabled: boolean;
  };
  dataset: {
    dfds: number;
    items: number;
    unique_codes: number;
    months_covered: number;
    code_coverage_pct: number;
    quantity_coverage_pct: number;
    price_coverage_pct: number;
    repeated_codes: number;
    peak_month: string;
    peak_month_dfd_count: number;
    month_concentration_pct: number;
  };
  regression: {
    dfd_volume: RegressionSummary;
    total_quantity: RegressionSummary;
    total_value: RegressionSummary;
  };
  statistics: {
    dfd_series: SegmentDeepSeriesStats;
    quantity_series: SegmentDeepSeriesStats;
    value_series: SegmentDeepSeriesStats;
    intermittency: SegmentIntermittencyStats;
  };
  charts: {
    monthly: SegmentMonthlyPoint[];
    top_codes_by_quantity: SegmentCodePoint[];
    top_codes_by_frequency: SegmentCodePoint[];
  };
  insights: SegmentInsight[];
  guides: SegmentGuide[];
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
  segments?: {
    legacy: SegmentAnalytics;
    current: SegmentAnalytics;
    combined: SegmentAnalytics;
  };
};

type SegmentKey = "current" | "legacy" | "combined";

function formatCurrency(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function formatPercent(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })}%`;
}

function formatMonthLabel(month: string) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return month;
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
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
  const [activeSegment, setActiveSegment] = useState<SegmentKey>("current");

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

  const segments = payload?.segments;

  useEffect(() => {
    if (!segments) return;
    if (activeSegment === "current" && segments.current.dataset.dfds === 0) {
      setActiveSegment("combined");
    }
  }, [activeSegment, segments]);

  const segment = useMemo(() => {
    if (!segments) return null;
    return segments[activeSegment];
  }, [activeSegment, segments]);

  const executive = useMemo(() => {
    if (!segment) return null;

    const lumpyShare =
      segment.statistics.intermittency.series_count > 0
        ? (segment.statistics.intermittency.class_distribution.lumpy /
            segment.statistics.intermittency.series_count) *
          100
        : 0;

    const trendSignal =
      segment.statistics.quantity_series.mann_kendall_p_value <= 0.1
        ? segment.statistics.quantity_series.mann_kendall_trend
        : "flat";

    const pressure =
      trendSignal === "up"
        ? "alta"
        : trendSignal === "down"
          ? "baixa"
          : segment.dataset.month_concentration_pct >= 55
            ? "sazonal"
            : "moderada";

    const predictability =
      segment.dataset.months_covered < 6
        ? "fraca"
        : segment.statistics.quantity_series.cv <= 0.8 &&
            segment.statistics.quantity_series.mann_kendall_p_value <= 0.1
          ? "boa"
          : segment.statistics.quantity_series.cv <= 1.4
            ? "média"
            : "baixa";

    const concentrationRisk =
      segment.dataset.month_concentration_pct >= 60 || lumpyShare >= 35
        ? "alto"
        : segment.dataset.month_concentration_pct >= 40 || lumpyShare >= 20
          ? "médio"
          : "baixo";

    return {
      pressure,
      predictability,
      concentrationRisk,
      lumpyShare,
    };
  }, [segment]);

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

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[#D2D0CE] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#C7D7EA] bg-[#F4F8FC] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#164073]">
              <ShieldCheck size={14} weight="bold" />
              Somente superadmin
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-[#0F2A4A]">
              Analytics dialético de demanda
            </h1>
            <p className="mt-1 text-sm text-[#466188]">
              Legado sem preço para padrões de volume e recorrência. Corrente com leitura completa para governança financeira.
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
        <MetricCard label="DFDs analisadas" value={formatNumber(payload?.dataset.dfds || 0)} />
        <MetricCard label="Itens analisados" value={formatNumber(payload?.dataset.items || 0)} />
        <MetricCard label="Códigos únicos" value={formatNumber(payload?.dataset.unique_codes || 0)} />
        <MetricCard label="Outliers críticos (corrente)" value={formatNumber(outliersCritical)} tone="warn" />
      </div>

      <div className="rounded-2xl border border-[#D2D0CE] bg-white p-4 text-xs text-[#4F6785]">
        Base utilizada: <b>{formatNumber(payload?.dataset.current_dfds || 0)} DFDs correntes</b> + <b>{formatNumber(payload?.dataset.legacy_dfds || 0)} DFDs legadas</b>
        {" · "}
        <b>{formatNumber(payload?.dataset.current_items || 0)} itens correntes</b> + <b>{formatNumber(payload?.dataset.legacy_items || 0)} itens legados</b>
      </div>

      <div className="flex flex-wrap gap-2">
        <SegmentButton
          active={activeSegment === "current"}
          onClick={() => setActiveSegment("current")}
          title="Corrente (completo)"
          subtitle="Preço + quantidade + risco"
        />
        <SegmentButton
          active={activeSegment === "legacy"}
          onClick={() => setActiveSegment("legacy")}
          title="Legado (sem preço)"
          subtitle="Volume + recorrência + distribuição"
        />
        <SegmentButton
          active={activeSegment === "combined"}
          onClick={() => setActiveSegment("combined")}
          title="Consolidado"
          subtitle="Visão geral institucional"
        />
      </div>

      {segment ? (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <DecisionCard
              pergunta="1. Há pressão de demanda real agora?"
              resposta={executive?.pressure || "moderada"}
              explicacao={`Base em ${segment.dataset.months_covered} mês(es), tendência ${trendLabel(segment.statistics.quantity_series.mann_kendall_trend)} e concentração de ${formatPercent(segment.dataset.month_concentration_pct)}.`}
            />
            <DecisionCard
              pergunta="2. A previsão é confiável?"
              resposta={executive?.predictability || "fraca"}
              explicacao={`Confiabilidade depende de densidade temporal, CV=${segment.statistics.quantity_series.cv.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} e p-valor=${segment.statistics.quantity_series.mann_kendall_p_value.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}.`}
            />
            <DecisionCard
              pergunta="3. Qual é o risco operacional?"
              resposta={executive?.concentrationRisk || "médio"}
              explicacao={`Concentração mensal ${formatPercent(segment.dataset.month_concentration_pct)} e séries lumpy em ${formatPercent(executive?.lumpyShare || 0)}.`}
            />
          </div>

          <div className="rounded-3xl border border-[#D2D0CE] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0F2A4A]">Ações prioritárias da janela</h2>
            <p className="text-xs text-[#5A6E86]">Síntese orientada a decisão imediata, não a descrição de todos os dados.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
              {(segment.guides.length > 0 ? segment.guides.slice(0, 3) : [{ title: "Sem ação crítica", action: "Janela estável para o segmento atual." }]).map((guide, index) => (
                <div key={`guide-top-${index}`} className="rounded-xl border border-[#D9E5F2] bg-[#F7FAFF] p-3">
                  <p className="text-xs uppercase tracking-[0.1em] text-[#6A7E95]">Prioridade {index + 1}</p>
                  <p className="mt-1 text-sm font-semibold text-[#16345C]">{guide.title}</p>
                  <p className="mt-1 text-xs text-[#5A6E86]">{guide.action}</p>
                </div>
              ))}
            </div>
          </div>

          <details open className="rounded-3xl border border-[#D2D0CE] bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-base font-semibold text-[#0F2A4A]">
              Painel essencial (executivo)
            </summary>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="DFDs" value={formatNumber(segment.dataset.dfds)} />
                <MetricCard label="Itens" value={formatNumber(segment.dataset.items)} />
                <MetricCard label="Meses com dados" value={formatNumber(segment.dataset.months_covered)} />
                <MetricCard label="Códigos repetidos" value={formatNumber(segment.dataset.repeated_codes)} />
                <MetricCard label="Cobertura de código" value={formatPercent(segment.dataset.code_coverage_pct)} />
                <MetricCard label="Cobertura de preço" value={formatPercent(segment.dataset.price_coverage_pct)} tone={segment.scope.price_signals_enabled ? "default" : "muted"} />
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <RegressionCard title="Volume de DFD" summary={segment.regression.dfd_volume} formatter={formatNumber} />
                <RegressionCard title="Quantidade total" summary={segment.regression.total_quantity} formatter={formatNumber} />
                <RegressionCard title={segment.scope.price_signals_enabled ? "Valor total" : "Valor total (leitura limitada)"} summary={segment.regression.total_value} formatter={formatCurrency} />
              </div>
            </div>
          </details>

          <details className="rounded-3xl border border-[#D2D0CE] bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-base font-semibold text-[#0F2A4A]">
              Diagnóstico estatístico e ciência de dados
            </summary>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-[#E3EAF3] bg-[#FAFCFF] p-4">
                  <h3 className="text-sm font-semibold text-[#16345C]">Estatística robusta de tendência</h3>
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                    <DeepStatPill label="Theil-Sen (quantidade)" value={formatNumber(segment.statistics.quantity_series.theil_sen_slope)} />
                    <DeepStatPill label="Mann-Kendall p-valor" value={segment.statistics.quantity_series.mann_kendall_p_value.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} />
                    <DeepStatPill label="Mann-Kendall tendência" value={trendLabel(segment.statistics.quantity_series.mann_kendall_trend)} />
                    <DeepStatPill label="CV (quantidade)" value={segment.statistics.quantity_series.cv.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} />
                    <DeepStatPill label="HHI (quantidade)" value={segment.statistics.quantity_series.hhi.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} />
                    <DeepStatPill label="Meses efetivos" value={segment.statistics.quantity_series.effective_periods.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} />
                  </div>
                </div>
                <div className="rounded-2xl border border-[#E3EAF3] bg-[#FAFCFF] p-4">
                  <h3 className="text-sm font-semibold text-[#16345C]">Demanda intermitente (ADI/CV²)</h3>
                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                    <DeepStatPill label="Suave" value={formatNumber(segment.statistics.intermittency.class_distribution.smooth)} />
                    <DeepStatPill label="Intermitente" value={formatNumber(segment.statistics.intermittency.class_distribution.intermittent)} />
                    <DeepStatPill label="Errática" value={formatNumber(segment.statistics.intermittency.class_distribution.erratic)} />
                    <DeepStatPill label="Lumpy" value={formatNumber(segment.statistics.intermittency.class_distribution.lumpy)} />
                    <DeepStatPill label="Insuficiente" value={formatNumber(segment.statistics.intermittency.class_distribution.insufficient)} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <DeepStatPill label="ADI mediano" value={segment.statistics.intermittency.median_adi.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} />
                    <DeepStatPill label="CV² mediano" value={segment.statistics.intermittency.median_cv2.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <ChartCard title="Trajetória visual da série" subtitle="Sparkline de volume e quantidade por mês">
                  <DualSparkline rows={segment.charts.monthly} />
                </ChartCard>
                <ChartCard title="Mapa de calor temporal" subtitle="Concentração mensal de DFDs">
                  <SeasonalityHeatmap rows={segment.charts.monthly} />
                </ChartCard>
                <ChartCard title="Rosca de intermitência" subtitle="Distribuição ADI/CV² por classe">
                  <IntermittencyDonut distribution={segment.statistics.intermittency.class_distribution} />
                </ChartCard>
              </div>
              <div className="rounded-2xl border border-[#E3EAF3] bg-[#FAFCFF] p-4">
                <h3 className="text-sm font-semibold text-[#16345C]">Cobertura e confiabilidade</h3>
                <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <CoverageBars codeCoverage={segment.dataset.code_coverage_pct} quantityCoverage={segment.dataset.quantity_coverage_pct} priceCoverage={segment.dataset.price_coverage_pct} />
                  <ReliabilityMeters r2={segment.regression.total_quantity.r2} pValue={segment.statistics.quantity_series.mann_kendall_p_value} concentration={segment.statistics.quantity_series.top1_share_pct} />
                </div>
              </div>
            </div>
          </details>

          <details className="rounded-3xl border border-[#D2D0CE] bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-base font-semibold text-[#0F2A4A]">
              Evidências detalhadas e tabelas
            </summary>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ChartCard title="DFDs por mês" subtitle="Evolução mensal de volume">
                  <MonthlyBars rows={segment.charts.monthly} accessor="dfd_count" formatter={formatNumber} colorClass="bg-[#2B6CB0]" />
                </ChartCard>
                <ChartCard title="Quantidade por mês" subtitle="Carga operacional por período">
                  <MonthlyBars rows={segment.charts.monthly} accessor="total_quantity" formatter={formatNumber} colorClass="bg-[#0F7B54]" />
                </ChartCard>
                <ChartCard title="Top códigos por recorrência" subtitle="Mais frequentes no período">
                  <TopCodesBars rows={segment.charts.top_codes_by_frequency} valueKey="observations" formatter={formatNumber} />
                </ChartCard>
                <ChartCard title="Top códigos por quantidade" subtitle="Maior peso de consumo">
                  <TopCodesBars rows={segment.charts.top_codes_by_quantity} valueKey="totalQuantity" formatter={formatNumber} />
                </ChartCard>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-3xl border border-[#D2D0CE] bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-[#0F2A4A]">Análises automáticas</h2>
                  <div className="mt-3 space-y-2">
                    {segment.insights.length === 0 && <p className="text-sm text-[#5A6E86]">Sem alertas para a janela atual.</p>}
                    {segment.insights.map((insight, index) => (
                      <div
                        key={`${insight.title}-${index}`}
                        className={
                          insight.level === "critical"
                            ? "rounded-xl border border-[#F1BBC2] bg-[#FFF3F5] p-3"
                            : insight.level === "warning"
                              ? "rounded-xl border border-[#F4D5A8] bg-[#FFF9EE] p-3"
                              : "rounded-xl border border-[#D9E5F2] bg-[#F7FAFF] p-3"
                        }
                      >
                        <p className="text-sm font-semibold text-[#16345C]">{insight.title}</p>
                        <p className="mt-1 text-xs text-[#5A6E86]">{insight.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl border border-[#D2D0CE] bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-[#0F2A4A]">Séries lumpy prioritárias</h2>
                  {segment.statistics.intermittency.top_lumpy.length === 0 ? (
                    <p className="mt-3 text-sm text-[#5A6E86]">Nenhuma série lumpy relevante na janela.</p>
                  ) : (
                    <div className="mt-3 max-h-[280px] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                          <tr className="text-left text-xs uppercase tracking-[0.12em] text-[#6B7D92]">
                            <th className="pb-2">Código</th>
                            <th className="pb-2 text-right">ADI</th>
                            <th className="pb-2 text-right">CV²</th>
                            <th className="pb-2 text-right">Obs.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {segment.statistics.intermittency.top_lumpy.map((row) => (
                            <tr key={`lumpy-${row.codigoEfisco}`} className="border-t border-[#EEF2F7]">
                              <td className="py-2 pr-2 font-semibold text-[#16345C]">{row.codigoEfisco}</td>
                              <td className="py-2 text-right text-[#5A6E86]">{row.adi.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                              <td className="py-2 text-right text-[#5A6E86]">{row.cv2.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                              <td className="py-2 text-right text-[#5A6E86]">{formatNumber(row.observations)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </details>

          {activeSegment === "current" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <DataTableForecast rows={payload?.top_forecasts || []} />
              <DataTableOutliers rows={payload?.price_outliers || []} />
            </div>
          )}
        </>
      ) : (
        <div className="rounded-3xl border border-[#D2D0CE] bg-white p-8 text-sm text-[#466188]">
          Sem dados de segmento no momento.
        </div>
      )}
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-xl border border-[#9DC0E7] bg-[#EAF3FF] px-4 py-2 text-left"
          : "rounded-xl border border-[#D2D0CE] bg-white px-4 py-2 text-left hover:bg-[#F8FBFF]"
      }
    >
      <p className="text-sm font-semibold text-[#16345C]">{title}</p>
      <p className="text-[11px] text-[#5A6E86]">{subtitle}</p>
    </button>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "muted";
}) {
  const classes =
    tone === "warn"
      ? "rounded-2xl border border-[#F4CDD0] bg-[#FFF6F7] p-4"
      : tone === "muted"
        ? "rounded-2xl border border-[#DCE5EF] bg-[#F9FBFD] p-4"
        : "rounded-2xl border border-[#D2D0CE] bg-white p-4";

  return (
    <div className={classes}>
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
  summary: RegressionSummary;
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
          <p className="mt-1 font-semibold text-[#0F2A4A]">{formatter(summary.currentValue)}</p>
        </div>
        <div className="rounded-xl border border-[#E7ECF3] bg-[#FAFCFF] p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#6A7E95]">Próximo ciclo</p>
          <p className="mt-1 font-semibold text-[#0F2A4A]">{formatter(summary.predictedNextValue)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[#5A6E86]">
        <span>R²: {Math.round(summary.r2 * 100)}%</span>
        <span>Amostras: {summary.sampleSize}</span>
        <span className="inline-flex items-center gap-1">
          {trend === "up" ? (
            <TrendUp size={13} className="text-[#0F7B54]" />
          ) : trend === "down" ? (
            <TrendDown size={13} className="text-[#A32933]" />
          ) : (
            <ChartLineUp size={13} className="text-[#406A92]" />
          )}
          inclinação {summary.slope.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-[#D2D0CE] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[#0F2A4A]">{title}</h2>
      <p className="text-xs text-[#5A6E86]">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function MonthlyBars({
  rows,
  accessor,
  formatter,
  colorClass,
}: {
  rows: SegmentMonthlyPoint[];
  accessor: "dfd_count" | "total_quantity";
  formatter: (value: number) => string;
  colorClass: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-[#5A6E86]">Sem série para exibir.</p>;
  }

  const maxValue = Math.max(
    ...rows.map((row) => Number(row[accessor] || 0)),
    1,
  );

  return (
    <div className="space-y-2">
      <div className="flex h-48 items-end gap-2">
        {rows.map((row) => {
          const value = Number(row[accessor] || 0);
          const heightPct = Math.max(4, Math.round((value / maxValue) * 100));
          return (
            <div key={`${accessor}-${row.month}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="text-[10px] text-[#5A6E86]">{formatter(value)}</div>
              <div className="flex w-full items-end rounded-t-md bg-[#EEF2F7]" style={{ height: "140px" }}>
                <div className={`w-full rounded-t-md ${colorClass}`} style={{ height: `${heightPct}%` }} />
              </div>
              <div className="truncate text-[10px] text-[#6B7D92]">{formatMonthLabel(row.month)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopCodesBars({
  rows,
  valueKey,
  formatter,
}: {
  rows: SegmentCodePoint[];
  valueKey: "observations" | "totalQuantity";
  formatter: (value: number) => string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-[#5A6E86]">Sem códigos suficientes para ranking.</p>;
  }

  const maxValue = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);

  return (
    <div className="space-y-2">
      {rows.slice(0, 8).map((row) => {
        const value = Number(row[valueKey] || 0);
        const widthPct = Math.max(6, Math.round((value / maxValue) * 100));
        return (
          <div key={`${row.codigoEfisco}-${valueKey}`}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="truncate text-xs font-semibold text-[#16345C]">
                {row.codigoEfisco}
              </p>
              <p className="text-xs text-[#5A6E86]">{formatter(value)}</p>
            </div>
            <div className="h-2 rounded-full bg-[#EEF2F7]">
              <div className="h-2 rounded-full bg-[#2B6CB0]" style={{ width: `${widthPct}%` }} />
            </div>
            <p className="mt-1 truncate text-[11px] text-[#7C8DA2]">{row.descricao}</p>
          </div>
        );
      })}
    </div>
  );
}

function normalizeSeries(values: number[]) {
  if (values.length === 0) return [] as number[];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1e-9, max - min);
  return values.map((value) => (value - min) / range);
}

function polylinePoints(values: number[], width: number, height: number, pad = 8) {
  if (values.length === 0) return "";
  if (values.length === 1) {
    const x = width / 2;
    const y = height / 2;
    return `${x},${y}`;
  }

  const normalized = normalizeSeries(values);
  return normalized
    .map((value, index) => {
      const x = pad + (index * (width - pad * 2)) / (values.length - 1);
      const y = height - pad - value * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

function DualSparkline({ rows }: { rows: SegmentMonthlyPoint[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[#5A6E86]">Sem dados para sparkline.</p>;
  }

  const width = 520;
  const height = 150;
  const dfdValues = rows.map((row) => Number(row.dfd_count || 0));
  const qtyValues = rows.map((row) => Number(row.total_quantity || 0));
  const dfdPath = polylinePoints(dfdValues, width, height);
  const qtyPath = polylinePoints(qtyValues, width, height);

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full rounded-xl border border-[#E4ECF5] bg-[#FAFCFF]">
        <defs>
          <linearGradient id="sparkQty" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0EA5E9" />
            <stop offset="100%" stopColor="#0F7B54" />
          </linearGradient>
        </defs>
        <polyline fill="none" stroke="#2B6CB0" strokeWidth="3" points={dfdPath} strokeLinecap="round" />
        <polyline fill="none" stroke="url(#sparkQty)" strokeWidth="3" points={qtyPath} strokeLinecap="round" />
      </svg>
      <div className="flex items-center gap-4 text-xs text-[#5A6E86]">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#2B6CB0]" /> Volume DFD</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#0F7B54]" /> Quantidade</span>
      </div>
    </div>
  );
}

function heatColor(intensity: number) {
  const clamped = Math.max(0, Math.min(1, intensity));
  const blue = Math.round(244 - clamped * 120);
  const green = Math.round(248 - clamped * 70);
  return `rgb(${164 - clamped * 40}, ${green}, ${blue})`;
}

function SeasonalityHeatmap({ rows }: { rows: SegmentMonthlyPoint[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[#5A6E86]">Sem dados para heatmap.</p>;
  }

  const maxDfd = Math.max(...rows.map((row) => Number(row.dfd_count || 0)), 1);
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-8">
      {rows.map((row) => {
        const value = Number(row.dfd_count || 0);
        const intensity = value / maxDfd;
        return (
          <div
            key={`hm-${row.month}`}
            className="rounded-lg border border-[#E2EAF4] p-2 text-center"
            style={{ backgroundColor: heatColor(intensity) }}
            title={`${formatMonthLabel(row.month)} · ${formatNumber(value)} DFDs`}
          >
            <p className="text-[10px] text-[#5A6E86]">{formatMonthLabel(row.month)}</p>
            <p className="text-sm font-semibold text-[#16345C]">{formatNumber(value)}</p>
          </div>
        );
      })}
    </div>
  );
}

function IntermittencyDonut({
  distribution,
}: {
  distribution: Record<IntermittencyClass, number>;
}) {
  const labelMap: Record<IntermittencyClass, string> = {
    smooth: "Suave",
    intermittent: "Intermitente",
    erratic: "Errática",
    lumpy: "Lumpy",
    insufficient: "Insuficiente",
  };
  const entries: Array<{ label: IntermittencyClass; value: number; color: string }> = [
    { label: "smooth", value: distribution.smooth || 0, color: "#0F7B54" },
    { label: "intermittent", value: distribution.intermittent || 0, color: "#0EA5E9" },
    { label: "erratic", value: distribution.erratic || 0, color: "#F59E0B" },
    { label: "lumpy", value: distribution.lumpy || 0, color: "#A32933" },
    { label: "insufficient", value: distribution.insufficient || 0, color: "#94A3B8" },
  ];
  const total = Math.max(1, entries.reduce((acc, entry) => acc + entry.value, 0));

  let cumulative = 0;
  const segments = entries.map((entry) => {
    const start = cumulative;
    const portion = (entry.value / total) * 100;
    cumulative += portion;
    return `${entry.color} ${start.toFixed(2)}% ${cumulative.toFixed(2)}%`;
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div
        className="relative h-36 w-36 rounded-full"
        style={{ background: `conic-gradient(${segments.join(", ")})` }}
      >
        <div className="absolute inset-[18%] grid place-items-center rounded-full bg-white text-center shadow-inner">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#6A7E95]">Séries</p>
          <p className="text-xl font-semibold text-[#16345C]">{formatNumber(total)}</p>
        </div>
      </div>
      <div className="space-y-1 text-xs">
        {entries.map((entry) => (
          <p key={`donut-${entry.label}`} className="flex items-center gap-2 text-[#5A6E86]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="uppercase">{labelMap[entry.label]}</span>
            <span className="font-semibold text-[#16345C]">{formatNumber(entry.value)}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function CoverageBars({
  codeCoverage,
  quantityCoverage,
  priceCoverage,
}: {
  codeCoverage: number;
  quantityCoverage: number;
  priceCoverage: number;
}) {
  const rows = [
    { label: "Código", value: codeCoverage, color: "from-[#2563EB] to-[#38BDF8]" },
    { label: "Quantidade", value: quantityCoverage, color: "from-[#0F7B54] to-[#22C55E]" },
    { label: "Preço", value: priceCoverage, color: "from-[#7C3AED] to-[#A855F7]" },
  ];

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={`coverage-${row.label}`}>
          <div className="mb-1 flex items-center justify-between text-xs text-[#5A6E86]">
            <span>{row.label}</span>
            <span className="font-semibold text-[#16345C]">{formatPercent(row.value)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-[#E8EEF6]">
            <div
              className={`h-2.5 rounded-full bg-gradient-to-r ${row.color}`}
              style={{ width: `${Math.max(0, Math.min(100, row.value))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReliabilityMeters({
  r2,
  pValue,
  concentration,
}: {
  r2: number;
  pValue: number;
  concentration: number;
}) {
  const reliability = Math.max(0, Math.min(100, Math.round((r2 * 100) * (1 - Math.min(1, pValue)))));
  const concentrationRisk = Math.max(0, Math.min(100, concentration));

  return (
    <div className="space-y-3">
      <ReliabilityBar
        label="Confiabilidade global"
        value={reliability}
        goodWhenHigh
      />
      <ReliabilityBar
        label="Significância de tendência"
        value={Math.max(0, Math.min(100, Math.round((1 - Math.min(1, pValue)) * 100)))}
        goodWhenHigh
      />
      <ReliabilityBar
        label="Risco de concentração"
        value={concentrationRisk}
        goodWhenHigh={false}
      />
    </div>
  );
}

function ReliabilityBar({
  label,
  value,
  goodWhenHigh,
}: {
  label: string;
  value: number;
  goodWhenHigh: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const tone = goodWhenHigh
    ? clamped >= 70
      ? "bg-[#0F7B54]"
      : clamped >= 40
        ? "bg-[#F59E0B]"
        : "bg-[#A32933]"
    : clamped <= 35
      ? "bg-[#0F7B54]"
      : clamped <= 60
        ? "bg-[#F59E0B]"
        : "bg-[#A32933]";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-[#5A6E86]">
        <span>{label}</span>
        <span className="font-semibold text-[#16345C]">{clamped}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-[#E8EEF6]">
        <div className={`h-2.5 rounded-full ${tone}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function DeepStatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E3EAF3] bg-[#F9FBFE] p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#6A7E95]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#16345C]">{value}</p>
    </div>
  );
}

function DataTableForecast({ rows }: { rows: ForecastRow[] }) {
  return (
    <div className="rounded-3xl border border-[#D2D0CE] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#0F2A4A]">Previsões de quantidade (corrente)</h2>
        <span className="text-xs text-[#5A6E86]">{rows.length} itens</span>
      </div>
      <div className="max-h-[360px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-xs uppercase tracking-[0.12em] text-[#6B7D92]">
              <th className="pb-2">Código</th>
              <th className="pb-2 text-right">Atual</th>
              <th className="pb-2 text-right">Próxima</th>
              <th className="pb-2 text-right">R²</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.codigoEfisco} className="border-t border-[#EEF2F7]">
                <td className="py-2 pr-2">
                  <p className="font-semibold text-[#16345C]">{row.codigoEfisco}</p>
                  <p className="line-clamp-1 text-xs text-[#5A6E86]">{row.descricao}</p>
                </td>
                <td className="py-2 text-right font-medium text-[#16345C]">{formatNumber(row.latestQuantity)}</td>
                <td className="py-2 text-right font-semibold text-[#0B5E3F]">{formatNumber(row.predictedNextQuantity)}</td>
                <td className="py-2 text-right text-xs text-[#5A6E86]">{Math.round((row.r2 || 0) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DataTableOutliers({ rows }: { rows: OutlierRow[] }) {
  return (
    <div className="rounded-3xl border border-[#D2D0CE] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#0F2A4A]">Outliers de preço (corrente)</h2>
        <span className="text-xs text-[#5A6E86]">{rows.length} sinais</span>
      </div>
      <div className="max-h-[360px] overflow-auto">
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
            {rows.map((row, index) => (
              <tr key={`${row.dfdId}-${row.codigoEfisco}-${index}`} className="border-t border-[#EEF2F7]">
                <td className="py-2 pr-2">
                  <p className="font-semibold text-[#16345C]">{row.codigoEfisco}</p>
                  <p className="line-clamp-1 text-xs text-[#5A6E86]">{row.descricao}</p>
                </td>
                <td className="py-2 text-right font-semibold text-[#8A1E2A]">{formatCurrency(row.unitPrice)}</td>
                <td className="py-2 text-right text-[#2B4C6F]">{formatCurrency(row.mediaHistorica)}</td>
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
  );
}

function DecisionCard({
  pergunta,
  resposta,
  explicacao,
}: {
  pergunta: string;
  resposta: string;
  explicacao: string;
}) {
  const tone =
    resposta === "alto" || resposta === "alta"
      ? "border-[#F6C7CC] bg-[#FFF4F5]"
      : resposta === "baixo" || resposta === "boa"
        ? "border-[#CBE8DB] bg-[#F3FBF7]"
        : "border-[#D9E5F2] bg-[#F7FAFF]";

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-xs uppercase tracking-[0.1em] text-[#6A7E95]">{pergunta}</p>
      <p className="mt-2 text-xl font-semibold capitalize text-[#16345C]">{resposta}</p>
      <p className="mt-1 text-xs text-[#5A6E86]">{explicacao}</p>
    </div>
  );
}
