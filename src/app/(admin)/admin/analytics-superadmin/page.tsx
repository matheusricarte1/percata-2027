"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowClockwise } from "@/components/icons/phosphor/exports/ArrowClockwise";
import { ChartLineUp } from "@/components/icons/phosphor/exports/ChartLineUp";
import { CurrencyCircleDollar } from "@/components/icons/phosphor/exports/CurrencyCircleDollar";
import { Database } from "@/components/icons/phosphor/exports/Database";
import { Gauge } from "@/components/icons/phosphor/exports/Gauge";
import { ShieldCheck } from "@/components/icons/phosphor/exports/ShieldCheck";
import { Sparkle } from "@/components/icons/phosphor/exports/Sparkle";
import { TrendDownIcon } from "@/components/icons/phosphor/exports/TrendDownIcon";
import { TrendUp } from "@/components/icons/phosphor/exports/TrendUp";
import { UsersThree } from "@/components/icons/phosphor/exports/UsersThree";
import { WarningCircle } from "@/components/icons/phosphor/exports/WarningCircle";
import { toast } from "sonner";
import { EfiscoIntelligenceSummary } from "@/components/admin/EfiscoIntelligenceSummary";
import { MechanicalValue } from "@/components/ui/MechanicalValue";
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
  confidence?: "high" | "medium" | "low";
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

type PriceVolatilitySignal = {
  codigoEfisco: string;
  descricao: string;
  observations: number;
  latestPrice: number;
  meanPrice: number;
  cvPct: number;
  maxDeviationPct: number;
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
  top_forecasts_mode?: "strict" | "exploratory" | "empty";
  top_forecasts_reason?: string;
  price_outliers: OutlierRow[];
  price_outliers_mode?: "strict" | "exploratory" | "empty";
  price_outliers_reason?: string;
  price_watchlist?: PriceVolatilitySignal[];
  people?: {
    total_profiles: number;
    with_campus: number;
    campus_coverage_pct: number;
    recent_profiles_90d: number;
    role_counts: Record<string, number>;
  };
  segments?: {
    legacy: SegmentAnalytics;
    current: SegmentAnalytics;
    combined: SegmentAnalytics;
  };
};

type SegmentKey = "current" | "legacy" | "combined";
type DashboardKey =
  | "operacao"
  | "orcamento"
  | "pessoas"
  | "governanca"
  | "efisco"
  | "previsoes";

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

const SEGMENT_TITLE: Record<SegmentKey, string> = {
  current: "Corrente (completo)",
  legacy: "Legado (sem preço)",
  combined: "Consolidado institucional",
};

const DASHBOARD_LABELS: Record<DashboardKey, string> = {
  operacao: "Operação",
  orcamento: "Orçamento",
  pessoas: "Pessoas",
  governanca: "Qualidade",
  efisco: "Inteligência",
  previsoes: "Previsões",
};

function pressureDescription(value: string) {
  if (value === "alta") return "Demanda em crescimento relevante.";
  if (value === "baixa") return "Demanda em retração no período.";
  if (value === "sazonal") return "Demanda concentrada em poucos meses.";
  return "Demanda com variação moderada.";
}

function predictabilityDescription(value: string) {
  if (value === "boa") return "Há sinal suficiente para planejar compras.";
  if (value === "média") return "Planejamento possível com margem de cautela.";
  if (value === "baixa") return "Planejamento exige monitoramento mais próximo.";
  return "Série curta para previsão robusta.";
}

function concentrationDescription(value: string) {
  if (value === "alto") return "Risco de concentração operacional elevado.";
  if (value === "baixo") return "Risco de concentração controlado.";
  return "Risco intermediário de concentração.";
}

export default function SuperadminAnalyticsPage() {
  const [role, setRole] = useState<UserRole>("solicitante");
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [windowMonths, setWindowMonths] = useState(18);
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [activeSegment, setActiveSegment] = useState<SegmentKey>("current");
  const [activeDashboard, setActiveDashboard] = useState<DashboardKey>("operacao");

  const canViewAnalytics = role === "superadmin" || role === "admin";

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
        if (resolved === "superadmin" || resolved === "admin") {
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
  const dashboardKpis = useMemo(() => {
    const people = payload?.people;
    const roleCounts = people?.role_counts || {};
    const forecasts = payload?.top_forecasts || [];
    const topFrequency = segment?.charts.top_codes_by_frequency?.[0];

    if (activeDashboard === "orcamento") {
      return [
        { label: "Valor atual", value: formatCurrency(segment?.regression.total_value.currentValue || 0), helper: "Leitura do segmento", tone: "insight" },
        { label: "Próximo ciclo", value: formatCurrency(segment?.regression.total_value.predictedNextValue || 0), helper: "Regressão disponível", tone: "action" },
        { label: "Outliers de preço", value: formatNumber(payload?.price_outliers?.length || 0), helper: "Sinais para revisão", tone: "danger" },
        { label: "Cobertura de preço", value: formatPercent(segment?.dataset.price_coverage_pct || 0), helper: "Qualidade financeira", tone: "success" },
      ] as const;
    }
    if (activeDashboard === "pessoas") {
      return [
        { label: "Perfis ativos", value: formatNumber(people?.total_profiles || 0), helper: "Base administrativa", tone: "action" },
        { label: "Cobertura de campus", value: formatPercent(people?.campus_coverage_pct || 0), helper: "Perfis contextualizados", tone: "success" },
        { label: "Novos em 90 dias", value: formatNumber(people?.recent_profiles_90d || 0), helper: "Entradas recentes", tone: "collab" },
        { label: "Chefias", value: formatNumber(roleCounts.chefia || 0), helper: "Responsáveis por análise", tone: "warning" },
      ] as const;
    }
    if (activeDashboard === "governanca") {
      return [
        { label: "Cobertura de código", value: formatPercent(segment?.dataset.code_coverage_pct || 0), helper: "Itens classificados", tone: "action" },
        { label: "Cobertura de quantidade", value: formatPercent(segment?.dataset.quantity_coverage_pct || 0), helper: "Base utilizável", tone: "success" },
        { label: "Códigos repetidos", value: formatNumber(segment?.dataset.repeated_codes || 0), helper: "Recorrência observada", tone: "warning" },
        { label: "Séries lumpy", value: formatPercent(executive?.lumpyShare || 0), helper: "Risco de intermitência", tone: "danger" },
      ] as const;
    }
    if (activeDashboard === "efisco") {
      return [
        { label: "Códigos únicos", value: formatNumber(payload?.dataset.unique_codes || 0), helper: "Vocabulário analisado", tone: "action" },
        { label: "Códigos repetidos", value: formatNumber(segment?.dataset.repeated_codes || 0), helper: "Oportunidade de catálogo", tone: "collab" },
        { label: "Mais recorrente", value: formatNumber(topFrequency?.observations || 0), helper: topFrequency?.codigoEfisco || "Sem código", tone: "warning" },
        { label: "Cobertura de preço", value: formatPercent(segment?.dataset.price_coverage_pct || 0), helper: "Apoio ao saneamento", tone: "success" },
      ] as const;
    }
    if (activeDashboard === "previsoes") {
      return [
        { label: "Séries previstas", value: formatNumber(forecasts.length), helper: "Códigos com sinal", tone: "action" },
        { label: "Previsão atual", value: formatNumber(segment?.regression.total_quantity.predictedNextValue || 0), helper: "Quantidade do próximo ciclo", tone: "insight" },
        { label: "Confiabilidade R²", value: formatPercent((segment?.regression.total_quantity.r2 || 0) * 100), helper: "Ajuste da regressão", tone: "success" },
        { label: "Outliers críticos", value: formatNumber(outliersCritical), helper: "Revisão prioritária", tone: "danger" },
      ] as const;
    }
    return [
      { label: "DFDs analisadas", value: formatNumber(segment?.dataset.dfds || 0), helper: "Volume do segmento", tone: "action" },
      { label: "Itens analisados", value: formatNumber(segment?.dataset.items || 0), helper: "Carga operacional", tone: "collab" },
      { label: "Meses com dados", value: formatNumber(segment?.dataset.months_covered || 0), helper: "Profundidade histórica", tone: "success" },
      { label: "Risco operacional", value: executive?.concentrationRisk || "médio", helper: "Concentração e intermitência", tone: "warning" },
    ] as const;
  }, [activeDashboard, executive, outliersCritical, payload, segment]);

  if (bootstrapping) {
    return (
      <div className="rounded-3xl border border-[var(--p-color-border)] bg-white p-8 text-sm text-[var(--p-color-brand-400)]">
        Carregando módulo avançado...
      </div>
    );
  }

  if (!canViewAnalytics) {
    return (
      <div className="rounded-3xl border border-[var(--p-color-danger-border)] bg-[var(--p-color-danger-bg)] p-8">
        <h1 className="text-2xl font-semibold text-[var(--p-color-danger)]">Acesso restrito</h1>
        <p className="mt-2 text-sm text-[var(--p-color-danger)]/85">
          Este módulo analítico é destinado à administração institucional.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex rounded-xl border border-[var(--p-color-danger-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--p-color-danger)]"
        >
          Voltar ao painel
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[var(--p-color-border)] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] px-3 py-1 type-caption font-semibold uppercase tracking-[0.14em] text-[var(--p-color-brand-500)]">
              <ShieldCheck size={14} weight="bold" />
              Central analítica nativa
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-[var(--p-color-brand-700)]">
              Decisões institucionais em uma única leitura
            </h1>
            <p className="mt-1 text-sm text-[var(--p-color-brand-400)]">
              Os painéis respondem perguntas distintas sem repetir o dashboard operacional por perfil.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={windowMonths}
              onChange={(event) => setWindowMonths(Number(event.target.value))}
              className="h-10 rounded-xl border border-[var(--p-color-border)] bg-white px-3 text-sm font-medium text-[var(--p-color-brand-600)]"
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
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--p-color-brand-500)] px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              <ArrowClockwise size={15} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <DashboardTabs
        active={activeDashboard}
        onChange={(next) => {
          setActiveDashboard(next);
          toast.info(`Dashboard ${DASHBOARD_LABELS[next]} atualizado.`);
        }}
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {dashboardKpis.map((kpi) => (
          <MechanicalKpi key={`${activeDashboard}-${kpi.label}`} {...kpi} />
        ))}
      </section>

      {activeDashboard === "efisco" ? (
        <EfiscoIntelligenceSummary />
      ) : null}

      {activeDashboard !== "pessoas" ? <section className="rounded-3xl border border-[var(--p-color-border)] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="type-caption font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-muted)]">
              Escopo da leitura
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--p-color-brand-700)]">
              Escolha o segmento e leia o bloco executivo
            </h2>
            <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
              Primeiro escolha a visão (corrente, legado ou consolidado). Depois leia decisões e ações recomendadas.
            </p>
          </div>
          <span className="inline-flex rounded-full border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] px-3 py-1 text-xs font-semibold text-[var(--p-color-brand-600)]">
            Janela: {windowMonths} meses
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
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
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <InlineKpi label="DFDs analisadas" value={formatNumber(payload?.dataset.dfds || 0)} />
          <InlineKpi label="Itens analisados" value={formatNumber(payload?.dataset.items || 0)} />
          <InlineKpi label="Códigos únicos" value={formatNumber(payload?.dataset.unique_codes || 0)} />
          <InlineKpi label="Outliers críticos (corrente)" value={formatNumber(outliersCritical)} tone="warn" />
        </div>
        <p className="mt-4 rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] px-3 py-2 text-xs text-[var(--p-color-fg-muted)]">
          Base utilizada: <b>{formatNumber(payload?.dataset.current_dfds || 0)} DFDs correntes</b> +{" "}
          <b>{formatNumber(payload?.dataset.legacy_dfds || 0)} DFDs legadas</b>{" "}
          {" · "}
          <b>{formatNumber(payload?.dataset.current_items || 0)} itens correntes</b> +{" "}
          <b>{formatNumber(payload?.dataset.legacy_items || 0)} itens legados</b>
        </p>
      </section> : null}

      {segment ? (
        <>
          {activeDashboard === "operacao" ? <section className="rounded-3xl border border-[var(--p-color-border)] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="type-caption font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-muted)]">
                  Decisão em 30 segundos
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--p-color-brand-700)]">
                  Síntese executiva do segmento {SEGMENT_TITLE[activeSegment]}
                </h2>
              </div>
              <span className="inline-flex rounded-full border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] px-3 py-1 text-xs font-semibold text-[var(--p-color-brand-600)]">
                {segment.dataset.months_covered} mês(es) úteis na janela
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <DecisionCard
                pergunta="Pressão de demanda"
                resposta={executive?.pressure || "moderada"}
                explicacao={pressureDescription(executive?.pressure || "moderada")}
                detalhe={`Tendência ${trendLabel(segment.statistics.quantity_series.mann_kendall_trend)} · concentração mensal ${formatPercent(segment.dataset.month_concentration_pct)}.`}
              />
              <DecisionCard
                pergunta="Confiabilidade da previsão"
                resposta={executive?.predictability || "fraca"}
                explicacao={predictabilityDescription(executive?.predictability || "fraca")}
                detalhe={`CV=${segment.statistics.quantity_series.cv.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} · p-valor=${segment.statistics.quantity_series.mann_kendall_p_value.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}.`}
              />
              <DecisionCard
                pergunta="Risco operacional"
                resposta={executive?.concentrationRisk || "médio"}
                explicacao={concentrationDescription(executive?.concentrationRisk || "médio")}
                detalhe={`Séries lumpy: ${formatPercent(executive?.lumpyShare || 0)}.`}
              />
            </div>
            <div className="mt-4 rounded-2xl border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--p-color-fg-muted)]">Ação prioritária</p>
              <p className="mt-1 text-sm font-semibold text-[var(--p-color-brand-600)]">
                {(segment.guides[0] || { title: "Sem ação crítica" }).title}
              </p>
              <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
                {(segment.guides[0] || { action: "Janela estável para o segmento atual." }).action}
              </p>
              {segment.guides.length > 1 && (
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {segment.guides.slice(1, 3).map((guide, index) => (
                    <div key={`guide-side-${index}`} className="rounded-xl border border-[var(--p-color-border-muted)] bg-white p-2.5">
                      <p className="type-caption font-semibold text-[var(--p-color-brand-600)]">{guide.title}</p>
                      <p className="mt-0.5 type-caption text-[var(--p-color-fg-muted)]">{guide.action}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section> : null}

          {activeDashboard === "operacao" || activeDashboard === "orcamento" ? <details open className="rounded-3xl border border-[var(--p-color-border)] bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-base font-semibold text-[var(--p-color-brand-700)]">
              Monitoramento essencial · Accordion
            </summary>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <MetricCard label="DFDs no segmento" value={formatNumber(segment.dataset.dfds)} compact />
                <MetricCard label="Itens no segmento" value={formatNumber(segment.dataset.items)} compact />
                <MetricCard label="Meses com dados" value={formatNumber(segment.dataset.months_covered)} compact />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <InlineKpi label="Códigos repetidos" value={formatNumber(segment.dataset.repeated_codes)} />
                <InlineKpi label="Cobertura de código" value={formatPercent(segment.dataset.code_coverage_pct)} />
                <InlineKpi
                  label="Cobertura de preço"
                  value={formatPercent(segment.dataset.price_coverage_pct)}
                  tone={segment.scope.price_signals_enabled ? "default" : "muted"}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <RegressionCard title="Volume de DFD" summary={segment.regression.dfd_volume} formatter={formatNumber} />
                <RegressionCard title="Quantidade total" summary={segment.regression.total_quantity} formatter={formatNumber} />
                <RegressionCard
                  title={segment.scope.price_signals_enabled ? "Valor total" : "Valor total (leitura limitada)"}
                  summary={segment.regression.total_value}
                  formatter={formatCurrency}
                />
              </div>
            </div>
          </details> : null}

          {activeDashboard === "governanca" || activeDashboard === "orcamento" ? <details open className="rounded-3xl border border-[var(--p-color-border)] bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-base font-semibold text-[var(--p-color-brand-700)]">
              Diagnóstico estatístico e ciência de dados · Accordion
            </summary>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-4">
                  <h3 className="text-sm font-semibold text-[var(--p-color-brand-600)]">Estatística robusta de tendência</h3>
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                    <DeepStatPill label="Theil-Sen (quantidade)" value={formatNumber(segment.statistics.quantity_series.theil_sen_slope)} />
                    <DeepStatPill label="Mann-Kendall p-valor" value={segment.statistics.quantity_series.mann_kendall_p_value.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} />
                    <DeepStatPill label="Mann-Kendall tendência" value={trendLabel(segment.statistics.quantity_series.mann_kendall_trend)} />
                    <DeepStatPill label="CV (quantidade)" value={segment.statistics.quantity_series.cv.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} />
                    <DeepStatPill label="HHI (quantidade)" value={segment.statistics.quantity_series.hhi.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} />
                    <DeepStatPill label="Meses efetivos" value={segment.statistics.quantity_series.effective_periods.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} />
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-4">
                  <h3 className="text-sm font-semibold text-[var(--p-color-brand-600)]">Demanda intermitente (ADI/CV²)</h3>
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
              <div className="rounded-2xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-4">
                <h3 className="text-sm font-semibold text-[var(--p-color-brand-600)]">Cobertura e confiabilidade</h3>
                <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <CoverageBars codeCoverage={segment.dataset.code_coverage_pct} quantityCoverage={segment.dataset.quantity_coverage_pct} priceCoverage={segment.dataset.price_coverage_pct} />
                  <ReliabilityMeters r2={segment.regression.total_quantity.r2} pValue={segment.statistics.quantity_series.mann_kendall_p_value} concentration={segment.statistics.quantity_series.top1_share_pct} />
                </div>
              </div>
              <FutureScenariosPanel segment={segment} />
            </div>
          </details> : null}

          {activeDashboard === "efisco" || activeDashboard === "governanca" ? <details open className="rounded-3xl border border-[var(--p-color-border)] bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-base font-semibold text-[var(--p-color-brand-700)]">
              Evidências detalhadas e tabelas · Accordion
            </summary>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ChartCard title="DFDs por mês" subtitle="Evolução mensal de volume">
                  <MonthlyBars rows={segment.charts.monthly} accessor="dfd_count" formatter={formatNumber} colorClass="bg-[var(--p-color-action)]" />
                </ChartCard>
                <ChartCard title="Quantidade por mês" subtitle="Carga operacional por período">
                  <MonthlyBars rows={segment.charts.monthly} accessor="total_quantity" formatter={formatNumber} colorClass="bg-[var(--p-color-success)]" />
                </ChartCard>
                <ChartCard title="Top códigos por recorrência" subtitle="Mais frequentes no período">
                  <TopCodesBars rows={segment.charts.top_codes_by_frequency} valueKey="observations" formatter={formatNumber} />
                </ChartCard>
                <ChartCard title="Top códigos por quantidade" subtitle="Maior peso de consumo">
                  <TopCodesBars rows={segment.charts.top_codes_by_quantity} valueKey="totalQuantity" formatter={formatNumber} />
                </ChartCard>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-3xl border border-[var(--p-color-border)] bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-[var(--p-color-brand-700)]">Análises automáticas</h2>
                  <div className="mt-3 space-y-2">
                    {segment.insights.length === 0 && <p className="text-sm text-[var(--p-color-fg-muted)]">Sem alertas para a janela atual.</p>}
                    {segment.insights.map((insight, index) => (
                      <div
                        key={`${insight.title}-${index}`}
                        className={
                          insight.level === "critical"
                            ? "rounded-xl border border-[var(--p-color-danger-border)] bg-[var(--p-color-danger-bg)] p-3"
                            : insight.level === "warning"
                              ? "rounded-xl border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] p-3"
                              : "rounded-xl border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] p-3"
                        }
                      >
                        <p className="text-sm font-semibold text-[var(--p-color-brand-600)]">{insight.title}</p>
                        <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">{insight.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl border border-[var(--p-color-border)] bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-[var(--p-color-brand-700)]">Séries lumpy prioritárias</h2>
                  {segment.statistics.intermittency.top_lumpy.length === 0 ? (
                    <p className="mt-3 text-sm text-[var(--p-color-fg-muted)]">Nenhuma série lumpy relevante na janela.</p>
                  ) : (
                    <div className="mt-3 max-h-[280px] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                          <tr className="text-left text-xs uppercase tracking-[0.12em] text-[var(--p-color-fg-muted)]">
                            <th className="pb-2">Código</th>
                            <th className="pb-2 text-right">ADI</th>
                            <th className="pb-2 text-right">CV²</th>
                            <th className="pb-2 text-right">Obs.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {segment.statistics.intermittency.top_lumpy.map((row) => (
                            <tr key={`lumpy-${row.codigoEfisco}`} className="border-t border-[var(--p-color-surface-muted)]">
                              <td className="py-2 pr-2 font-semibold text-[var(--p-color-brand-600)]">{row.codigoEfisco}</td>
                              <td className="py-2 text-right text-[var(--p-color-fg-muted)]">{row.adi.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                              <td className="py-2 text-right text-[var(--p-color-fg-muted)]">{row.cv2.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                              <td className="py-2 text-right text-[var(--p-color-fg-muted)]">{formatNumber(row.observations)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </details> : null}

          {activeDashboard === "previsoes" && activeSegment === "current" ? (
            <div className="space-y-4">
              <FutureScenariosPanel segment={segment} />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <DataTableForecast
                  rows={payload?.top_forecasts || []}
                  mode={payload?.top_forecasts_mode || "empty"}
                  reason={payload?.top_forecasts_reason || ""}
                />
                <DataTableOutliers
                  rows={payload?.price_outliers || []}
                  mode={payload?.price_outliers_mode || "empty"}
                  reason={payload?.price_outliers_reason || ""}
                  watchlist={payload?.price_watchlist || []}
                />
              </div>
            </div>
          ) : null}
          {activeDashboard === "operacao" ? <AnalyticsCycleTimeline segment={segment} /> : null}
          {activeDashboard === "pessoas" ? <PeopleDashboard people={payload?.people} /> : null}
        </>
      ) : (
        <div className="rounded-3xl border border-[var(--p-color-border)] bg-white p-8 text-sm text-[var(--p-color-brand-400)]">
          Sem dados de segmento no momento.
        </div>
      )}
    </div>
  );
}

const DASHBOARD_TABS: Array<{
  key: DashboardKey;
  icon: React.ComponentType<{ size?: number; weight?: "bold" | "fill" | "regular" }>;
}> = [
  { key: "operacao", icon: Gauge },
  { key: "orcamento", icon: CurrencyCircleDollar },
  { key: "pessoas", icon: UsersThree },
  { key: "governanca", icon: ShieldCheck },
  { key: "efisco", icon: Database },
  { key: "previsoes", icon: Sparkle },
];

function DashboardTabs({
  active,
  onChange,
}: {
  active: DashboardKey;
  onChange: (next: DashboardKey) => void;
}) {
  return (
    <nav
      aria-label="Central analítica e inteligência e-Fisco"
      className="flex gap-1 overflow-x-auto border-y border-[var(--p-color-border)] bg-white px-1 py-2"
    >
      {DASHBOARD_TABS.map((item) => {
        const Icon = item.icon;
        const selected = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            aria-current={selected ? "page" : undefined}
            onClick={() => onChange(item.key)}
            className={
              selected
                ? "inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--p-color-brand-500)]"
                : "inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-transparent px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--p-color-fg-muted)] hover:bg-[var(--p-color-surface-muted)]"
            }
          >
            <Icon size={16} weight={selected ? "fill" : "bold"} />
            {DASHBOARD_LABELS[item.key]}
          </button>
        );
      })}
      <span className="mx-1 my-2 w-px shrink-0 bg-[var(--p-color-border)]" aria-hidden="true" />
      <Link
        href="/admin/efisco-governance"
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-transparent px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--p-color-fg-muted)] hover:border-[var(--p-color-border)] hover:bg-[var(--p-color-surface-muted)]"
      >
        <Database size={16} weight="bold" />
        Governança e-Fisco
      </Link>
      <Link
        href="/admin/efisco-natureza-review"
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-transparent px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--p-color-fg-muted)] hover:border-[var(--p-color-border)] hover:bg-[var(--p-color-surface-muted)]"
      >
        <WarningCircle size={16} weight="bold" />
        Saneamento e-Fisco
      </Link>
    </nav>
  );
}

function MechanicalKpi({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "action" | "collab" | "success" | "warning" | "danger" | "insight";
}) {
  const tones = {
    action: "text-[var(--p-color-brand-500)] before:bg-[var(--p-color-brand-500)]",
    collab: "text-[var(--p-color-collab)] before:bg-[var(--p-color-collab)]",
    success: "text-[var(--p-color-success)] before:bg-[var(--p-color-success)]",
    warning: "text-[var(--p-color-warning)] before:bg-[var(--p-color-warning)]",
    danger: "text-[var(--p-color-danger)] before:bg-[var(--p-color-danger)]",
    insight: "text-[var(--p-color-insight)] before:bg-[var(--p-color-insight)]",
  };

  return (
    <article className={`relative overflow-hidden rounded-2xl border border-[var(--p-color-border)] bg-gradient-to-b from-white to-[var(--p-color-surface-soft)] p-4 shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-1 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="type-kicker font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-muted)]">{label}</p>
        <span className="rounded-full border border-[var(--p-color-border)] bg-white px-2 py-0.5 type-micro font-semibold uppercase tracking-[0.1em] text-[var(--p-color-fg-subtle)]">
          KPI
        </span>
      </div>
      <MechanicalValue
        value={value}
        className={`mt-3 max-w-full font-semibold tracking-tight ${value.length > 12 ? "text-lg" : "text-2xl"}`}
      />
      <p className="mt-3 text-xs leading-5 text-[var(--p-color-fg-muted)]">{helper}</p>
    </article>
  );
}

function AnalyticsCycleTimeline({ segment }: { segment: SegmentAnalytics }) {
  const current = Math.max(0, segment.regression.dfd_volume.currentValue);
  const predicted = Math.max(0, segment.regression.dfd_volume.predictedNextValue);
  const repeated = segment.dataset.repeated_codes;
  const coverage = segment.dataset.code_coverage_pct;
  const items = [
    { title: "Recebimento", detail: `${formatNumber(segment.dataset.dfds)} DFDs no segmento` },
    { title: "Leitura", detail: `${formatNumber(segment.dataset.items)} itens analisados` },
    { title: "Consolidação", detail: `${formatNumber(repeated)} códigos recorrentes` },
    { title: "Próximo ciclo", detail: `${formatNumber(predicted || current)} DFDs projetadas` },
  ];

  return (
    <section className="rounded-3xl border border-[var(--p-color-border)] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="type-kicker font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">Timeline</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--p-color-brand-700)]">Como o ciclo avança</h2>
        </div>
        <span className="rounded-full border border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] px-3 py-1 text-xs font-semibold text-[var(--p-color-success)]">
          Cobertura {formatPercent(coverage)}
        </span>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-4">
        {items.map((item, index) => (
          <li key={item.title} className="relative rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] p-4">
            <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--p-color-info-bg)] text-xs font-bold text-[var(--p-color-brand-500)]">
              {index + 1}
            </span>
            <p className="text-sm font-semibold text-[var(--p-color-fg-default)]">{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--p-color-fg-muted)]">{item.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PeopleDashboard({ people }: { people?: AnalyticsPayload["people"] }) {
  const roles = [
    { key: "solicitante", label: "Solicitantes", color: "var(--p-color-brand-400)" },
    { key: "chefia", label: "Chefias", color: "var(--p-color-warning)" },
    { key: "admin", label: "Admins", color: "var(--p-color-collab)" },
    { key: "superadmin", label: "Superadmins", color: "var(--p-color-insight)" },
  ];
  const total = Math.max(people?.total_profiles || 0, 1);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <ChartCard title="Distribuição de responsabilidades" subtitle="Perfis por papel institucional, sem expor dados pessoais">
        <div className="space-y-4">
          {roles.map((role) => {
            const value = people?.role_counts?.[role.key] || 0;
            return (
              <div key={role.key}>
                <div className="mb-1 flex items-center justify-between text-xs text-[var(--p-color-fg-muted)]">
                  <span>{role.label}</span>
                  <span className="font-semibold text-[var(--p-color-brand-600)]">{formatNumber(value)}</span>
                </div>
                <div className="h-3 rounded-full bg-[var(--p-color-surface-subtle)]">
                  <div className="h-3 rounded-full" style={{ width: `${(value / total) * 100}%`, backgroundColor: role.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>
      <div className="space-y-4">
        <ChartCard title="Cobertura organizacional" subtitle="Capacidade de contextualizar perfis por campus">
          <div className="space-y-4">
            <ReliabilityBar label="Perfis vinculados a campus" value={people?.campus_coverage_pct || 0} goodWhenHigh />
            <div className="grid grid-cols-2 gap-3">
              <DeepStatPill label="Com campus" value={formatNumber(people?.with_campus || 0)} />
              <DeepStatPill label="Entradas em 90 dias" value={formatNumber(people?.recent_profiles_90d || 0)} />
            </div>
          </div>
        </ChartCard>
        <Link
          href="/admin/usuarios"
          className="flex items-center justify-between rounded-2xl border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] p-4 text-sm font-semibold text-[var(--p-color-brand-500)] shadow-sm"
        >
          Abrir gestão detalhada de usuários
          <UsersThree size={20} weight="bold" />
        </Link>
      </div>
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
          ? "rounded-xl border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] px-4 py-2 text-left"
          : "rounded-xl border border-[var(--p-color-border)] bg-white px-4 py-2 text-left hover:bg-[var(--p-color-info-bg)]"
      }
    >
      <p className="text-sm font-semibold text-[var(--p-color-brand-600)]">{title}</p>
      <p className="type-caption text-[var(--p-color-fg-muted)]">{subtitle}</p>
    </button>
  );
}

function InlineKpi({
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
      ? "rounded-xl border border-[var(--p-color-danger-border)] bg-[var(--p-color-danger-bg)] p-3"
      : tone === "muted"
        ? "rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-3"
        : "rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-3";

  return (
    <div className={classes}>
      <p className="type-kicker uppercase tracking-[0.1em] text-[var(--p-color-fg-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--p-color-brand-700)]">{value}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
  compact = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "muted";
  compact?: boolean;
}) {
  const classes =
    tone === "warn"
      ? "rounded-2xl border border-[var(--p-color-danger-border)] bg-[var(--p-color-danger-bg)] p-4"
      : tone === "muted"
        ? "rounded-2xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-4"
        : "rounded-2xl border border-[var(--p-color-border)] bg-white p-4";

  return (
    <div className={classes}>
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--p-color-fg-muted)]">{label}</p>
      <p className={compact ? "mt-1 text-xl font-semibold text-[var(--p-color-brand-700)]" : "mt-2 text-2xl font-semibold text-[var(--p-color-brand-700)]"}>
        <MechanicalValue value={value} />
      </p>
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
    <div className="rounded-2xl border border-[var(--p-color-border)] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--p-color-brand-600)]">{title}</p>
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] px-2 py-1 type-caption font-semibold text-[var(--p-color-brand-600)]">
          <ChartLineUp size={13} />
          {trendLabel(trend)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-3">
          <p className="type-caption uppercase tracking-[0.12em] text-[var(--p-color-fg-muted)]">Atual</p>
          <p className="mt-1 font-semibold text-[var(--p-color-brand-700)]">{formatter(summary.currentValue)}</p>
        </div>
        <div className="rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-3">
          <p className="type-caption uppercase tracking-[0.12em] text-[var(--p-color-fg-muted)]">Próximo ciclo</p>
          <p className="mt-1 font-semibold text-[var(--p-color-brand-700)]">{formatter(summary.predictedNextValue)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[var(--p-color-fg-muted)]">
        <span>R²: {Math.round(summary.r2 * 100)}%</span>
        <span>Amostras: {summary.sampleSize}</span>
        <span className="inline-flex items-center gap-1">
          {trend === "up" ? (
            <TrendUp size={13} className="text-[var(--p-color-success)]" />
          ) : trend === "down" ? (
            <TrendDownIcon size={13} className="text-[var(--p-color-danger)]" />
          ) : (
            <ChartLineUp size={13} className="text-[var(--p-color-brand-400)]" />
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
    <div className="rounded-3xl border border-[var(--p-color-border)] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--p-color-brand-700)]">{title}</h2>
      <p className="text-xs text-[var(--p-color-fg-muted)]">{subtitle}</p>
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
    return <p className="text-sm text-[var(--p-color-fg-muted)]">Sem série para exibir.</p>;
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
              <div className="type-kicker text-[var(--p-color-fg-muted)]">{formatter(value)}</div>
              <div className="flex w-full items-end rounded-t-md bg-[var(--p-color-surface-muted)]" style={{ height: "140px" }}>
                <div className={`w-full rounded-t-md ${colorClass}`} style={{ height: `${heightPct}%` }} />
              </div>
              <div className="truncate type-kicker text-[var(--p-color-fg-muted)]">{formatMonthLabel(row.month)}</div>
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
    return <p className="text-sm text-[var(--p-color-fg-muted)]">Sem códigos suficientes para ranking.</p>;
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
              <p className="truncate text-xs font-semibold text-[var(--p-color-brand-600)]">
                {row.codigoEfisco}
              </p>
              <p className="text-xs text-[var(--p-color-fg-muted)]">{formatter(value)}</p>
            </div>
            <div className="h-2 rounded-full bg-[var(--p-color-surface-muted)]">
              <div className="h-2 rounded-full bg-[var(--p-color-action)]" style={{ width: `${widthPct}%` }} />
            </div>
            <p className="mt-1 truncate type-caption text-[var(--p-color-fg-subtle)]">{row.descricao}</p>
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
    return <p className="text-sm text-[var(--p-color-fg-muted)]">Sem dados para sparkline.</p>;
  }

  const width = 520;
  const height = 150;
  const dfdValues = rows.map((row) => Number(row.dfd_count || 0));
  const qtyValues = rows.map((row) => Number(row.total_quantity || 0));
  const dfdPath = polylinePoints(dfdValues, width, height);
  const qtyPath = polylinePoints(qtyValues, width, height);

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)]">
        <defs>
          <linearGradient id="sparkQty" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--p-color-brand-400)" />
            <stop offset="100%" stopColor="var(--p-color-success)" />
          </linearGradient>
        </defs>
        <polyline fill="none" stroke="var(--p-color-brand-500)" strokeWidth="3" points={dfdPath} strokeLinecap="round" />
        <polyline fill="none" stroke="url(#sparkQty)" strokeWidth="3" points={qtyPath} strokeLinecap="round" />
      </svg>
      <div className="flex items-center gap-4 text-xs text-[var(--p-color-fg-muted)]">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--p-color-action)]" /> Volume DFD</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--p-color-success)]" /> Quantidade</span>
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
    return <p className="text-sm text-[var(--p-color-fg-muted)]">Sem dados para heatmap.</p>;
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
            className="rounded-lg border border-[var(--p-color-border-muted)] p-2 text-center"
            style={{ backgroundColor: heatColor(intensity) }}
            title={`${formatMonthLabel(row.month)} · ${formatNumber(value)} DFDs`}
          >
            <p className="type-kicker text-[var(--p-color-fg-muted)]">{formatMonthLabel(row.month)}</p>
            <p className="text-sm font-semibold text-[var(--p-color-brand-600)]">{formatNumber(value)}</p>
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
    { label: "smooth", value: distribution.smooth || 0, color: "var(--p-color-success)" },
    { label: "intermittent", value: distribution.intermittent || 0, color: "var(--p-color-brand-400)" },
    { label: "erratic", value: distribution.erratic || 0, color: "var(--p-color-warning)" },
    { label: "lumpy", value: distribution.lumpy || 0, color: "var(--p-color-danger)" },
    { label: "insufficient", value: distribution.insufficient || 0, color: "var(--p-color-fg-subtle)" },
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
          <p className="type-kicker uppercase tracking-[0.12em] text-[var(--p-color-fg-muted)]">Séries</p>
          <p className="text-xl font-semibold text-[var(--p-color-brand-600)]">{formatNumber(total)}</p>
        </div>
      </div>
      <div className="space-y-1 text-xs">
        {entries.map((entry) => (
          <p key={`donut-${entry.label}`} className="flex items-center gap-2 text-[var(--p-color-fg-muted)]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="uppercase">{labelMap[entry.label]}</span>
            <span className="font-semibold text-[var(--p-color-brand-600)]">{formatNumber(entry.value)}</span>
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
    { label: "Código", value: codeCoverage, color: "from-[var(--p-color-brand-400)] to-[var(--p-color-action)]" },
    { label: "Quantidade", value: quantityCoverage, color: "from-[var(--p-color-success)] to-[var(--p-color-success-border)]" },
    { label: "Preço", value: priceCoverage, color: "from-[var(--p-color-insight)] to-[var(--p-color-insight-border)]" },
  ];

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={`coverage-${row.label}`}>
          <div className="mb-1 flex items-center justify-between text-xs text-[var(--p-color-fg-muted)]">
            <span>{row.label}</span>
            <span className="font-semibold text-[var(--p-color-brand-600)]">{formatPercent(row.value)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-[var(--p-color-surface-subtle)]">
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
      ? "bg-[var(--p-color-success)]"
      : clamped >= 40
        ? "bg-[var(--p-color-warning)]"
        : "bg-[var(--p-color-danger)]"
    : clamped <= 35
      ? "bg-[var(--p-color-success)]"
      : clamped <= 60
        ? "bg-[var(--p-color-warning)]"
        : "bg-[var(--p-color-danger)]";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-[var(--p-color-fg-muted)]">
        <span>{label}</span>
        <span className="font-semibold text-[var(--p-color-brand-600)]">{clamped}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-[var(--p-color-surface-subtle)]">
        <div className={`h-2.5 rounded-full ${tone}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function DeepStatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-3">
      <p className="type-kicker uppercase tracking-[0.12em] text-[var(--p-color-fg-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--p-color-brand-600)]">{value}</p>
    </div>
  );
}

function FutureScenariosPanel({ segment }: { segment: SegmentAnalytics }) {
  const scenario = useMemo(() => {
    const project = (
      summary: RegressionSummary,
      cv: number,
    ) => {
      const horizon = 6;
      const base = Array.from({ length: horizon }, (_, index) =>
        Math.max(0, summary.currentValue + summary.slope * (index + 1)),
      );
      const uncertainty = Math.max(
        0.08,
        Math.min(0.5, (Number.isFinite(cv) ? cv : 0) * 0.2 + 0.08),
      );
      const expansion = base.map((value) => value * (1 + uncertainty * 0.6));
      const containment = base.map((value) =>
        Math.max(0, value * (1 - uncertainty * 0.75)),
      );
      return {
        base6m: base.reduce((acc, value) => acc + value, 0),
        expansion6m: expansion.reduce((acc, value) => acc + value, 0),
        containment6m: containment.reduce((acc, value) => acc + value, 0),
        uncertaintyPct: Math.round(uncertainty * 100),
      };
    };

    const monthly = segment.charts.monthly || [];
    const recent =
      monthly.length >= 2
        ? monthly.slice(-2).reduce((acc, row) => acc + Number(row.total_quantity || 0), 0) / 2
        : 0;
    const previous =
      monthly.length >= 4
        ? monthly
            .slice(-4, -2)
            .reduce((acc, row) => acc + Number(row.total_quantity || 0), 0) / 2
        : 0;
    const regimeShiftPct =
      previous > 0 ? ((recent - previous) / previous) * 100 : 0;

    return {
      dfd: project(segment.regression.dfd_volume, segment.statistics.dfd_series.cv),
      quantity: project(
        segment.regression.total_quantity,
        segment.statistics.quantity_series.cv,
      ),
      value: project(segment.regression.total_value, segment.statistics.value_series.cv),
      regimeShiftPct: Number.isFinite(regimeShiftPct) ? regimeShiftPct : 0,
    };
  }, [segment]);

  return (
    <div className="rounded-2xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-4">
      <h3 className="text-sm font-semibold text-[var(--p-color-brand-600)]">Cenários futuros (próximos 6 meses)</h3>
      <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
        Projeção em três cenários: base (tendência atual), expansão e contenção.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ScenarioMiniCard
          title="Volume de DFD"
          unit="DFDs"
          base={scenario.dfd.base6m}
          expansion={scenario.dfd.expansion6m}
          containment={scenario.dfd.containment6m}
          uncertaintyPct={scenario.dfd.uncertaintyPct}
          formatter={formatNumber}
        />
        <ScenarioMiniCard
          title="Quantidade total"
          unit="Unidades"
          base={scenario.quantity.base6m}
          expansion={scenario.quantity.expansion6m}
          containment={scenario.quantity.containment6m}
          uncertaintyPct={scenario.quantity.uncertaintyPct}
          formatter={formatNumber}
        />
        <ScenarioMiniCard
          title={segment.scope.price_signals_enabled ? "Valor total" : "Valor total (limitado)"}
          unit="BRL"
          base={scenario.value.base6m}
          expansion={scenario.value.expansion6m}
          containment={scenario.value.containment6m}
          uncertaintyPct={scenario.value.uncertaintyPct}
          formatter={formatCurrency}
        />
      </div>
      <div className="mt-3 rounded-xl border border-[var(--p-color-border-muted)] bg-white p-3 text-xs text-[var(--p-color-fg-muted)]">
        <b>Leitura de ruptura:</b>{" "}
        {scenario.regimeShiftPct > 20
          ? `aceleração recente de ${scenario.regimeShiftPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% na quantidade média.`
          : scenario.regimeShiftPct < -20
            ? `desaceleração recente de ${Math.abs(scenario.regimeShiftPct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% na quantidade média.`
            : "sem ruptura forte no curto prazo; variação dentro da faixa esperada."}
      </div>
    </div>
  );
}

function ScenarioMiniCard({
  title,
  unit,
  base,
  expansion,
  containment,
  uncertaintyPct,
  formatter,
}: {
  title: string;
  unit: string;
  base: number;
  expansion: number;
  containment: number;
  uncertaintyPct: number;
  formatter: (value: number) => string;
}) {
  return (
    <div className="rounded-xl border border-[var(--p-color-border-muted)] bg-white p-3">
      <p className="type-caption uppercase tracking-[0.1em] text-[var(--p-color-fg-muted)]">{title}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--p-color-brand-600)]">Base: {formatter(base)}</p>
      <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
        <span className="rounded-lg border border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] px-2 py-1 text-[var(--p-color-success)]">
          Expansão: {formatter(expansion)}
        </span>
        <span className="rounded-lg border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] px-2 py-1 text-[var(--p-color-warning)]">
          Contenção: {formatter(containment)}
        </span>
      </div>
      <p className="mt-2 type-caption text-[var(--p-color-fg-muted)]">
        Incerteza: {uncertaintyPct}% · unidade: {unit}
      </p>
    </div>
  );
}

function modeLabel(mode: "strict" | "exploratory" | "empty") {
  if (mode === "strict") return "Robusto";
  if (mode === "exploratory") return "Exploratório";
  return "Sem base";
}

function modeTone(mode: "strict" | "exploratory" | "empty") {
  if (mode === "strict") return "border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]";
  if (mode === "exploratory") return "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]";
  return "border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] text-[var(--p-color-fg-muted)]";
}

function forecastConfidenceLabel(value?: "high" | "medium" | "low") {
  if (value === "high") return "Alta";
  if (value === "medium") return "Média";
  return "Baixa";
}

function DataTableForecast({
  rows,
  mode,
  reason,
}: {
  rows: ForecastRow[];
  mode: "strict" | "exploratory" | "empty";
  reason: string;
}) {
  return (
    <div className="rounded-3xl border border-[var(--p-color-border)] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[var(--p-color-brand-700)]">Previsões de quantidade (corrente)</h2>
          <span className={`inline-flex rounded-full border px-2 py-0.5 type-caption font-semibold ${modeTone(mode)}`}>
            {modeLabel(mode)}
          </span>
        </div>
        <span className="text-xs text-[var(--p-color-fg-muted)]">{rows.length} itens</span>
      </div>
      <p className="mb-3 rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] px-3 py-2 text-xs text-[var(--p-color-fg-muted)]">
        {reason || "Sem explicação adicional para o modo atual."}
      </p>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-info-bg)] p-3 text-sm text-[var(--p-color-fg-muted)]">
          Ainda não há recorrência suficiente por código para estimar a próxima quantidade.
        </p>
      ) : (
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-[var(--p-color-fg-muted)]">
                <th className="pb-2">Código</th>
                <th className="pb-2 text-right">Atual</th>
                <th className="pb-2 text-right">Próxima</th>
                <th className="pb-2 text-right">R²</th>
                <th className="pb-2 text-right">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.codigoEfisco} className="border-t border-[var(--p-color-surface-muted)]">
                  <td className="py-2 pr-2">
                    <p className="font-semibold text-[var(--p-color-brand-600)]">{row.codigoEfisco}</p>
                    <p className="line-clamp-1 text-xs text-[var(--p-color-fg-muted)]">{row.descricao}</p>
                  </td>
                  <td className="py-2 text-right font-medium text-[var(--p-color-brand-600)]">{formatNumber(row.latestQuantity)}</td>
                  <td className="py-2 text-right font-semibold text-[var(--p-color-success)]">{formatNumber(row.predictedNextQuantity)}</td>
                  <td className="py-2 text-right text-xs text-[var(--p-color-fg-muted)]">{Math.round((row.r2 || 0) * 100)}%</td>
                  <td className="py-2 text-right text-xs font-semibold text-[var(--p-color-brand-400)]">
                    {forecastConfidenceLabel(row.confidence)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DataTableOutliers({
  rows,
  mode,
  reason,
  watchlist,
}: {
  rows: OutlierRow[];
  mode: "strict" | "exploratory" | "empty";
  reason: string;
  watchlist: PriceVolatilitySignal[];
}) {
  return (
    <div className="rounded-3xl border border-[var(--p-color-border)] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[var(--p-color-brand-700)]">Outliers de preço (corrente)</h2>
          <span className={`inline-flex rounded-full border px-2 py-0.5 type-caption font-semibold ${modeTone(mode)}`}>
            {modeLabel(mode)}
          </span>
        </div>
        <span className="text-xs text-[var(--p-color-fg-muted)]">{rows.length} sinais</span>
      </div>
      <p className="mb-3 rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] px-3 py-2 text-xs text-[var(--p-color-fg-muted)]">
        {reason || "Sem explicação adicional para o modo atual."}
      </p>
      {rows.length === 0 ? (
        <div className="space-y-3">
          <p className="rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-info-bg)] p-3 text-sm text-[var(--p-color-fg-muted)]">
            Sem outliers detectáveis no período. Isso pode significar estabilidade de preço ou base histórica curta.
          </p>
          {watchlist.length > 0 && (
            <div className="rounded-xl border border-[var(--p-color-border-muted)] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--p-color-fg-muted)]">
                Radar de volatilidade (quando não há outlier estatístico)
              </p>
              <div className="mt-2 max-h-[220px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-xs uppercase tracking-[0.12em] text-[var(--p-color-fg-muted)]">
                      <th className="pb-2">Código</th>
                      <th className="pb-2 text-right">Média</th>
                      <th className="pb-2 text-right">CV%</th>
                      <th className="pb-2 text-right">Desvio máx.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.slice(0, 12).map((row) => (
                      <tr key={`watch-${row.codigoEfisco}`} className="border-t border-[var(--p-color-surface-muted)]">
                        <td className="py-2 pr-2">
                          <p className="font-semibold text-[var(--p-color-brand-600)]">{row.codigoEfisco}</p>
                          <p className="line-clamp-1 text-xs text-[var(--p-color-fg-muted)]">{row.descricao}</p>
                        </td>
                        <td className="py-2 text-right text-[var(--p-color-brand-500)]">{formatCurrency(row.meanPrice)}</td>
                        <td className="py-2 text-right text-[var(--p-color-fg-muted)]">{row.cvPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</td>
                        <td className="py-2 text-right text-[var(--p-color-fg-muted)]">
                          {row.maxDeviationPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-[var(--p-color-fg-muted)]">
                <th className="pb-2">Código</th>
                <th className="pb-2 text-right">Preço</th>
                <th className="pb-2 text-right">Média</th>
                <th className="pb-2 text-right">Z-score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.dfdId}-${row.codigoEfisco}-${index}`} className="border-t border-[var(--p-color-surface-muted)]">
                  <td className="py-2 pr-2">
                    <p className="font-semibold text-[var(--p-color-brand-600)]">{row.codigoEfisco}</p>
                    <p className="line-clamp-1 text-xs text-[var(--p-color-fg-muted)]">{row.descricao}</p>
                  </td>
                  <td className="py-2 text-right font-semibold text-[var(--p-color-danger)]">{formatCurrency(row.unitPrice)}</td>
                  <td className="py-2 text-right text-[var(--p-color-brand-500)]">{formatCurrency(row.mediaHistorica)}</td>
                  <td className="py-2 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--p-color-danger-border)] bg-[var(--p-color-danger-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--p-color-danger)]">
                      <WarningCircle size={12} weight="fill" />
                      {row.zScore.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DecisionCard({
  pergunta,
  resposta,
  explicacao,
  detalhe,
}: {
  pergunta: string;
  resposta: string;
  explicacao: string;
  detalhe: string;
}) {
  const tone =
    resposta === "alto" || resposta === "alta"
      ? "border-[var(--p-color-danger-border)] bg-[var(--p-color-danger-bg)]"
      : resposta === "baixo" || resposta === "boa"
        ? "border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)]"
        : "border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)]";

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-xs uppercase tracking-[0.1em] text-[var(--p-color-fg-muted)]">{pergunta}</p>
      <p className="mt-1 text-lg font-semibold capitalize text-[var(--p-color-brand-600)]">{resposta}</p>
      <p className="text-xs font-medium text-[var(--p-color-brand-400)]">{explicacao}</p>
      <p className="mt-1 type-caption text-[var(--p-color-fg-muted)]">{detalhe}</p>
    </div>
  );
}


