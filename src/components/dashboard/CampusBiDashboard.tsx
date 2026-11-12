"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowClockwise } from "@/components/icons/phosphor/exports/ArrowClockwise";
import { ArrowRight } from "@/components/icons/phosphor/exports/ArrowRight";
import { ChartLineUp } from "@/components/icons/phosphor/exports/ChartLineUp";
import { CheckCircle } from "@/components/icons/phosphor/exports/CheckCircle";
import { CurrencyCircleDollar } from "@/components/icons/phosphor/exports/CurrencyCircleDollar";
import { Database } from "@/components/icons/phosphor/exports/Database";
import { Files } from "@/components/icons/phosphor/exports/Files";
import { FlowArrow } from "@/components/icons/phosphor/exports/FlowArrow";
import { ShieldCheck } from "@/components/icons/phosphor/exports/ShieldCheck";
import { Sparkle } from "@/components/icons/phosphor/exports/Sparkle";
import { UsersThree } from "@/components/icons/phosphor/exports/UsersThree";
import { WarningCircle } from "@/components/icons/phosphor/exports/WarningCircle";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { MechanicalValue } from "@/components/ui/MechanicalValue";
import { OperationalAccordion, OperationalEmptyState } from "@/components/ui/operational";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveCampusBranding } from "@/lib/campus-branding";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

type DashboardTab = "overview" | "flow" | "budget" | "efisco" | "collaboration" | "risks";

type DashboardPayload = {
  scope: {
    campus_id: string;
    campus_name: string;
    campus_sigla: string;
    role: string;
    window_months: number;
    generated_at: string;
  };
  summary: {
    totalDfds: number;
    plannedValue: number;
    approvedValue: number;
    atRiskValue: number;
    approvalRatePct: number;
    collectiveDfds: number;
    collectiveRatePct: number;
    efiscoCoveragePct: number;
    natureReviewCount: number;
    pending: number;
    concluded: number;
  };
  flow: {
    origins: { individual: number; collective: number };
    statuses: Record<string, number>;
  };
  monthly: Array<{ month: string; dfds: number; value: number; approved: number; concluded: number }>;
  units: Array<{
    id: string;
    name: string;
    statuses: Record<string, number>;
    total: number;
    value: number;
  }>;
  priorities: Array<{
    id: string;
    protocol: string;
    title: string;
    status: string;
    value: number;
    ageDays: number;
    priority: number;
    unit: string;
  }>;
  leadTimeByStage: Array<{ stage: string; days: number; samples: number }>;
  budgetByGnd: Array<{ name: string; value: number }>;
  topCategories: Array<{
    name: string;
    value: number;
    items: number;
    codedItems: number;
    natureReviewCount: number;
    coveragePct: number;
  }>;
  aging: Array<{ label: string; count: number }>;
  collaboration: {
    rooms: number;
    active_rooms: number;
    converted_rooms: number;
    unique_creators: number;
  };
  people: { campus_profiles: number };
};

const TABS: Array<{ key: DashboardTab; label: string; icon: typeof Files }> = [
  { key: "overview", label: "Visão geral", icon: ChartLineUp },
  { key: "flow", label: "Fluxo e tempo", icon: FlowArrow },
  { key: "budget", label: "Orçamento", icon: CurrencyCircleDollar },
  { key: "efisco", label: "Inteligência e-Fisco", icon: Database },
  { key: "collaboration", label: "Colaboração", icon: UsersThree },
  { key: "risks", label: "Riscos", icon: WarningCircle },
];

const MANAGER_TABS = new Set<DashboardTab>([
  "overview",
  "flow",
  "budget",
  "efisco",
  "collaboration",
  "risks",
]);

const SOLICITANTE_TABS = new Set<DashboardTab>([
  "overview",
  "flow",
  "budget",
  "efisco",
  "collaboration",
]);

const STATUS = {
  rascunho: { label: "Rascunho", color: "var(--p-color-fg-subtle)" },
  triagem: { label: "Triagem", color: "var(--p-color-brand-400)" },
  devolvida: { label: "Devolvida", color: "var(--p-color-warning)" },
  aprovada: { label: "Aprovada", color: "var(--p-color-success)" },
  pactuando: { label: "Pactuando", color: "var(--p-color-insight)" },
  concluida: { label: "Concluída", color: "var(--p-color-collab)" },
} as const;

const CHART_COLORS = [
  "var(--p-color-brand-500)",
  "var(--p-color-collab)",
  "var(--p-color-warning)",
  "var(--p-color-insight)",
  "var(--p-color-danger)",
  "var(--p-color-fg-subtle)",
];

function currency(value: number, compact = false) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  });
}

function percent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function number(value: number) {
  return value.toLocaleString("pt-BR");
}

function monthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00.000Z`);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(".", "")
    : value;
}

export default function CampusBiDashboard() {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [windowMonths, setWindowMonths] = useState(12);
  const reduceMotion = useReducedMotion();
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/dashboard/overview?window_months=${windowMonths}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar o painel.");
      if (version === requestVersion.current) setPayload(data);
    } catch (loadError) {
      if (version === requestVersion.current) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o painel.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [windowMonths]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handleCampusChanged = () => void load();
    window.addEventListener("percata:campus-changed", handleCampusChanged);
    return () => window.removeEventListener("percata:campus-changed", handleCampusChanged);
  }, [load]);

  const campusBranding = resolveCampusBranding(payload?.scope.campus_name);
  const campusImage =
    campusBranding.campusKey === "ouricuri"
      ? "/brands/dashboard-hero-ouricuri-v3.png"
      : "/brands/dashboard-hero-petrolina-v3.png";

  const roleLabel =
    payload?.scope.role === "superadmin"
      ? "visão superadmin"
      : payload?.scope.role === "admin"
        ? "visão administrativa"
        : payload?.scope.role === "chefia"
          ? "visão da chefia"
          : "meu panorama";
  const allowedTabs = payload?.scope.role === "solicitante" ? SOLICITANTE_TABS : MANAGER_TABS;
  const visibleTabs = TABS.filter((tab) => allowedTabs.has(tab.key));

  return (
    <div className="min-w-0 space-y-5 py-3">
      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--p-color-border)] bg-white p-4 xl:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Assunto do painel" className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:flex xl:flex-wrap">
          {visibleTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "inline-flex min-h-11 min-w-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p-color-brand-500)]",
                activeTab === key
                  ? "border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-500)]"
                  : "border-transparent text-[var(--p-color-fg-muted)] hover:bg-[var(--p-color-surface-muted)]",
              )}
            >
              <Icon size={14} weight={activeTab === key ? "fill" : "duotone"} />
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ScopeChip label={payload?.scope.campus_name || "Campus"} loading={loading} />
          <label className="flex shrink-0 items-center gap-2 text-sm text-[var(--p-color-fg-muted)]">
            Período
            <select aria-label="Período do painel" value={windowMonths} onChange={event => setWindowMonths(Number(event.target.value))} className="min-h-11 rounded-xl border border-[var(--p-color-border)] bg-white px-3 font-semibold text-[var(--p-color-brand-500)]">
              {[6, 12, 18].map(months => <option key={months} value={months}>{months} meses</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--p-color-border)] bg-white text-[var(--p-color-brand-500)]"
            title="Atualizar painel"
            aria-label="Atualizar painel"
            aria-busy={loading}
            disabled={loading}
          >
            <ArrowClockwise size={14} weight="bold" className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </section>

      {error ? (
        <OperationalEmptyState
          title="Não conseguimos carregar o painel"
          description={error}
          icon={<WarningCircle size={24} />}
          action={
            <button type="button" onClick={() => void load()} className="ux-btn-primary rounded-lg px-4 py-2 text-xs font-semibold">
              Tentar novamente
            </button>
          }
        />
      ) : (
        <>
          <BiHero
            loading={loading}
            image={campusImage}
            campus={payload?.scope.campus_name || "Campus"}
            roleLabel={roleLabel}
            tab={activeTab}
            payload={payload}
            reduceMotion={reduceMotion}
          />
          <KpiRail loading={loading} tab={activeTab} payload={payload} />
          <motion.div
            key={activeTab}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut" }}
          >
            {activeTab === "overview" && <OverviewPage loading={loading} payload={payload} />}
            {activeTab === "flow" && <FlowPage loading={loading} payload={payload} />}
            {activeTab === "budget" && <BudgetPage loading={loading} payload={payload} />}
            {activeTab === "efisco" && <EfiscoPage loading={loading} payload={payload} />}
            {activeTab === "collaboration" && <CollaborationPage loading={loading} payload={payload} />}
            {activeTab === "risks" && <RiskPage loading={loading} payload={payload} />}
          </motion.div>
          <footer className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--p-color-border)] bg-white px-4 py-3 type-kicker font-semibold text-[var(--p-color-fg-muted)]">
            <LegendDot color="var(--p-color-brand-500)" label="Dados do campus ativo" />
            <LegendDot color="var(--p-color-collab)" label="Resultado saudável" />
            <LegendDot color="var(--p-color-warning)" label="Atenção" />
            <LegendDot color="var(--p-color-danger)" label="Risco" />
            <LegendDot color="var(--p-color-insight)" label="Colaboração" />
            <span className="ml-auto">
              Atualizado {payload?.scope.generated_at ? new Date(payload.scope.generated_at).toLocaleString("pt-BR") : "agora"}
            </span>
          </footer>
        </>
      )}
    </div>
  );
}

function ScopeChip({ label, loading }: { label: string; loading: boolean }) {
  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] px-3 type-kicker font-semibold text-[var(--p-color-success)]">
      <span className={cn("h-2 w-2 rounded-full bg-[var(--p-color-success)]", loading && "animate-pulse")} />
      {label}
    </span>
  );
}

function BiHero({
  loading,
  image,
  campus,
  roleLabel,
  tab,
  payload,
  reduceMotion,
}: {
  loading: boolean;
  image: string;
  campus: string;
  roleLabel: string;
  tab: DashboardTab;
  payload: DashboardPayload | null;
  reduceMotion: boolean;
}) {
  const content = getHeroContent(tab, payload);
  return (
    <section className="bi-campus-hero relative grid min-h-[200px] overflow-hidden rounded-2xl border border-[var(--p-color-border)] bg-white shadow-sm lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_220px]">
      <div className="relative hidden min-h-[170px] overflow-hidden lg:block">
        <motion.img
          src={image}
          alt={campus}
          className="absolute bottom-0 left-0 h-[94%] w-full object-contain object-left-bottom"
          initial={reduceMotion ? false : { opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.35 }}
        />
      </div>
      <div className="flex flex-col justify-center px-5 py-6">
        <p className="type-kicker font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">
          {campus} · {roleLabel}
        </p>
        {loading ? (
          <><Skeleton className="mt-3 h-12 w-full max-w-xl" /><Skeleton className="mt-3 h-10 w-full max-w-2xl" /></>
        ) : (
          <>
            <h1 className="mt-2 max-w-3xl text-2xl font-semibold leading-tight text-[var(--p-color-brand-500)]">{content.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--p-color-fg-muted)]">{content.description}</p>
          </>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={content.href} className="ux-btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold">
            {content.cta}<ArrowRight size={12} weight="bold" />
          </Link>
          {payload?.scope.role === "superadmin" ? (
            <Link href="/admin/analytics-superadmin" className="ux-btn-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold">
              Análise institucional
            </Link>
          ) : null}
        </div>
      </div>
      <aside className="m-3 hidden flex-col justify-between rounded-xl border border-[var(--p-color-brand-600)] bg-[var(--p-color-brand-700)] p-4 text-white shadow-sm xl:col-start-3 xl:row-start-1 xl:flex">
        <div className="space-y-3">
          <p className="type-micro font-semibold uppercase tracking-[0.14em] text-white/55">Indicador do período</p>
          <p className="text-4xl font-semibold leading-none tracking-tight tabular-nums">{content.signal}</p>

        </div>
        <p className="mt-4 type-kicker leading-5 text-white/68">{content.signalText}</p>
      </aside>
    </section>
  );
}

function getHeroContent(tab: DashboardTab, payload: DashboardPayload | null) {
  const pending = payload?.summary.pending || 0;
  const risk = currency(payload?.summary.atRiskValue || 0, true);
  const coverage = payload?.summary.efiscoCoveragePct || 0;
  const rooms = payload?.collaboration.active_rooms || 0;
  const role = payload?.scope.role;
  const operationalHref =
    role === "solicitante"
      ? "/minhas-dfds"
      : role === "admin"
        ? "/admin/consolidacao"
        : "/triagem";
  const budgetHref =
    role === "solicitante"
      ? "/minhas-dfds"
      : role === "chefia"
        ? "/triagem/orcamento"
        : "/admin/consolidacao";
  const efiscoHref =
    role === "solicitante"
      ? "/catalogo"
      : role === "admin" || role === "superadmin"
        ? "/admin/efisco-natureza-review"
        : "/triagem";
  const content = {
    overview: {
      title: "Resumo do campus",
      description: `${number(pending)} ${pending === 1 ? "solicitação aguarda" : "solicitações aguardam"} decisão no recorte atual. Acompanhe o andamento e abra a fila para dar continuidade à análise.`,
      href: operationalHref, cta: role === "solicitante" ? "Ver minhas solicitações" : "Explorar prioridades", signal: percent(payload?.summary.approvalRatePct || 0),
      confidence: payload?.summary.approvalRatePct || 0, signalText: "Taxa de aprovação dentro do recorte selecionado.",
    },
    flow: {
      title: "Fluxo e prazos",
      description: "Acompanhe triagem, devoluções, backlog e tempo por etapa para orientar a análise do campus.",
      href: operationalHref, cta: "Abrir fluxo detalhado", signal: `${payload?.summary.pending || 0}`,
      confidence: Math.max(12, 100 - Math.min(90, pending * 4)), signalText: "Itens aguardando análise ou correção.",
    },
    budget: {
      title: "Orçamento do campus",
      description: "Compare composição, evolução, prioridades financeiras e valores sob atenção no recorte selecionado.",
      href: budgetHref, cta: "Explorar orçamento", signal: risk,
      confidence: 76, signalText: "Valor em triagem ou devolvido no campus ativo.",
    },
    efisco: {
      title: "Cobertura e-Fisco",
      description: "Acompanhe cobertura, saneamento, itens sem natureza e categorias que precisam de revisão.",
      href: efiscoHref, cta: role === "admin" || role === "superadmin" ? "Abrir saneamento" : "Explorar catálogo", signal: percent(coverage),
      confidence: coverage, signalText: "Percentual de itens com código e-Fisco identificado.",
    },
    collaboration: {
      title: "DFDs coletivas",
      description: "Acompanhe salas, conversão, participação e itens recorrentes antes da formalização.",
      href: "/dfds-coletivas", cta: "Explorar coletivas", signal: `${rooms}`,
      confidence: Math.min(100, rooms * 12), signalText: "Salas abertas ou em revisão no período.",
    },
    risks: {
      title: "Riscos operacionais",
      description: "Priorize solicitações por idade, valor, devolução, unidade e cobertura e-Fisco.",
      href: operationalHref, cta: "Tratar riscos", signal: risk,
      confidence: 68, signalText: "Valor estimado atualmente sob atenção.",
    },
  };
  return content[tab];
}

function KpiRail({ loading, tab, payload }: { loading: boolean; tab: DashboardTab; payload: DashboardPayload | null }) {
  const summary = payload?.summary;
  const common = [
    { label: "DFDs do campus", value: number(summary?.totalDfds || 0), helper: "Recorte selecionado", color: "var(--p-color-brand-500)", icon: Files },
    { label: "Valor planejado", value: currency(summary?.plannedValue || 0, true), helper: `${currency(summary?.approvedValue || 0, true)} aprovados`, color: "var(--p-color-collab)", icon: CurrencyCircleDollar },
    { label: "Taxa de aprovação", value: percent(summary?.approvalRatePct || 0), helper: `${summary?.concluded || 0} concluídas`, color: "var(--p-color-success)", icon: CheckCircle },
    { label: "Sob atenção", value: number(summary?.pending || 0), helper: currency(summary?.atRiskValue || 0, true), color: "var(--p-color-warning)", icon: WarningCircle },
    { label: "Cobertura e-Fisco", value: percent(summary?.efiscoCoveragePct || 0), helper: `${summary?.natureReviewCount || 0} itens para revisar`, color: "var(--p-color-brand-400)", icon: ShieldCheck },
    { label: "DFDs coletivas", value: number(summary?.collectiveDfds || 0), helper: `${percent(summary?.collectiveRatePct || 0)} do total`, color: "var(--p-color-insight)", icon: UsersThree },
  ];
  const items = tab === "collaboration" && payload
    ? [
        { label: "Salas coletivas", value: number(payload.collaboration.rooms), helper: "No período", color: "var(--p-color-insight)", icon: UsersThree },
        { label: "Salas ativas", value: number(payload.collaboration.active_rooms), helper: "Abertas ou em revisão", color: "var(--p-color-brand-400)", icon: Sparkle },
        { label: "Convertidas", value: number(payload.collaboration.converted_rooms), helper: "Viraram DFD oficial", color: "var(--p-color-success)", icon: CheckCircle },
        ...common.slice(3),
      ]
    : common;
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {loading ? [...Array(6)].map((_, index) => <Skeleton key={index} className="h-[104px] rounded-lg" />) : items.map((item) => <BiKpi key={item.label} {...item} />)}
    </section>
  );
}

function BiKpi({ label, value, helper, color, icon: Icon }: { label: string; value: string; helper: string; color: string; icon: typeof Files }) {
  return (
    <motion.article whileHover={{ y: -2 }} className="relative flex min-h-[136px] min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--p-color-border)] bg-white p-3 shadow-sm transition-colors hover:border-[var(--p-color-info-border)] hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-xs font-semibold leading-4 text-[var(--p-color-fg-muted)]">{label}</p>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}><Icon size={16} weight="duotone" /></span>
      </div>
      <p className="mt-2 flex min-h-[2rem] min-w-0 items-center overflow-visible text-2xl font-semibold leading-[1.18] text-[var(--p-color-brand-500)]">
        <MechanicalValue value={value} />
      </p>
      <p className="mt-auto min-w-0 break-words pt-2 text-xs font-medium leading-4 text-[var(--p-color-fg-subtle)]" title={helper}>{helper}</p>
      <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: color }} />
    </motion.article>
  );
}

function OverviewPage({ loading, payload }: PageProps) {
  const flowData = Object.entries(payload?.flow.statuses || {}).map(([key, value]) => ({
    name: STATUS[key as keyof typeof STATUS]?.label || key,
    value,
    color: STATUS[key as keyof typeof STATUS]?.color || "var(--p-color-fg-subtle)",
  })).filter((row) => row.value > 0);
  return (
    <section className="grid grid-cols-1 gap-3 xl:grid-cols-12">
      <BiPanel className="xl:col-span-7" eyebrow="Fluxo institucional" title="Para onde as DFDs estão fluindo?" badge="Status do campus">
        {loading ? <ChartSkeleton /> : <StatusFlow payload={payload} />}
      </BiPanel>
      <BiPanel className="xl:col-span-5" eyebrow="Composição do fluxo" title="Onde está concentrado o trabalho?" badge="Distribuição">
        <div className="h-[250px] min-w-0">{loading ? <ChartSkeleton /> : <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={180}><PieChart><Pie data={flowData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={95} paddingAngle={2} animationDuration={850}>{flowData.map((row) => <Cell key={row.name} fill={row.color} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>}</div>
      </BiPanel>
      <BiPanel className="xl:col-span-8" eyebrow="Evolução mensal" title="Como volume e valor estão evoluindo?" badge={`${payload?.scope.window_months || 12} meses`}>
        <MonthlyChart payload={payload} loading={loading} />
      </BiPanel>
      <BiPanel className="xl:col-span-4" eyebrow="Prioridades" title="O que precisa de ação primeiro?" badge="Top 6">
        <PriorityList payload={payload} loading={loading} />
      </BiPanel>
    </section>
  );
}

function FlowPage({ loading, payload }: PageProps) {
  return (
    <section className="grid grid-cols-1 gap-3 xl:grid-cols-12">
      <BiPanel className="xl:col-span-7" eyebrow="Tempo por etapa" title="Onde o ciclo permanece mais tempo?" badge="Mediana">
        <div className="h-[260px] min-w-0">{loading ? <ChartSkeleton /> : <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={180}><BarChart data={payload?.leadTimeByStage || []}><CartesianGrid stroke="var(--p-color-surface-subtle)" strokeDasharray="4 4" /><XAxis dataKey="stage" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="days" name="Dias" radius={[6, 6, 0, 0]} fill="var(--p-color-brand-400)" animationDuration={800} /></BarChart></ResponsiveContainer>}</div>
      </BiPanel>
      <BiPanel className="xl:col-span-5" eyebrow="Backlog envelhecido" title="Há quanto tempo os itens aguardam?" badge="Faixas">
        <div className="h-[260px] min-w-0">{loading ? <ChartSkeleton /> : <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={180}><BarChart data={payload?.aging || []}><CartesianGrid stroke="var(--p-color-surface-subtle)" strokeDasharray="4 4" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" name="DFDs" radius={[6, 6, 0, 0]}>{(payload?.aging || []).map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer>}</div>
      </BiPanel>
      <BiPanel className="xl:col-span-12" eyebrow="Unidades × status" title="Qual unidade concentra cada etapa?" badge="Matriz operacional">
        <UnitMatrix payload={payload} loading={loading} />
      </BiPanel>
    </section>
  );
}

function BudgetPage({ loading, payload }: PageProps) {
  const gnd = payload?.budgetByGnd || [];
  const categories = payload?.topCategories || [];
  return (
    <section className="grid grid-cols-1 gap-3 xl:grid-cols-12">
      <BiPanel className="xl:col-span-7" eyebrow="Evolução orçamentária" title="Como o valor planejado evolui?" badge="Mensal">
        <MonthlyChart payload={payload} loading={loading} />
      </BiPanel>
      <BiPanel className="xl:col-span-5" eyebrow="Tipo de despesa" title="Como o valor está distribuído?" badge="Composição">
        <div className="h-[260px] min-w-0">{loading ? <ChartSkeleton /> : <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={180}><PieChart><Pie data={gnd} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>{gnd.map((row, index) => <Cell key={row.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={(value) => currency(Number(value), true)} /><Legend /></PieChart></ResponsiveContainer>}</div>
      </BiPanel>
      <BiPanel className="xl:col-span-7" eyebrow="Categorias" title="Quais famílias concentram o orçamento?" badge="Treemap">
        <div className="h-[260px] min-w-0">{loading ? <ChartSkeleton /> : <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={180}><Treemap data={categories} dataKey="value" nameKey="name" stroke="#fff" fill="var(--p-color-brand-500)" animationDuration={850}><Tooltip formatter={(value) => currency(Number(value), true)} /></Treemap></ResponsiveContainer>}</div>
      </BiPanel>
      <BiPanel className="xl:col-span-5" eyebrow="Prioridades financeiras" title="Onde o valor está sob risco?" badge="Triagem + devolvidas">
        <PriorityList payload={payload} loading={loading} />
      </BiPanel>
    </section>
  );
}

function EfiscoPage({ loading, payload }: PageProps) {
  const scatter = (payload?.topCategories || []).map((row, index) => ({
    name: row.name,
    items: row.items,
    value: row.value,
    coverage: row.coveragePct,
    natureReviewCount: row.natureReviewCount,
    sequence: index + 1,
  }));
  return (
    <section className="grid grid-cols-1 gap-3 xl:grid-cols-12">
      <BiPanel className="xl:col-span-7" eyebrow="Valor × quantidade × cobertura" title="Quais categorias exigem saneamento primeiro?" badge="Dispersão">
        <div className="h-[280px] min-w-0">{loading ? <ChartSkeleton /> : <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={180}><ScatterChart><CartesianGrid stroke="var(--p-color-surface-subtle)" strokeDasharray="4 4" /><XAxis type="number" dataKey="items" name="Itens" tick={{ fontSize: 11 }} /><YAxis type="number" dataKey="coverage" name="Cobertura" unit="%" tick={{ fontSize: 11 }} /><ZAxis type="number" dataKey="value" range={[80, 900]} /><Tooltip cursor={{ strokeDasharray: "4 4" }} /><Scatter data={scatter} fill="var(--p-color-brand-400)" animationDuration={850} /></ScatterChart></ResponsiveContainer>}</div>
      </BiPanel>
      <BiPanel className="xl:col-span-5" eyebrow="Qualidade e-Fisco" title="O que limita a inteligência?" badge={`${percent(payload?.summary.efiscoCoveragePct || 0)} coberto`}>
        <OperationalAccordion items={[
          { title: "Cobertura de códigos", badge: percent(payload?.summary.efiscoCoveragePct || 0), defaultOpen: true, content: "Itens com código e-Fisco identificado dentro das DFDs do campus ativo." },
          { title: "Itens para saneamento", badge: number(payload?.summary.natureReviewCount || 0), content: "Itens enviados sem natureza ou que exigem revisão administrativa." },
          { title: "Categorias críticas", badge: number(payload?.topCategories.length || 0), content: "Categorias de maior impacto financeiro e volume no recorte." },
        ]} />
      </BiPanel>
      <BiPanel className="xl:col-span-12" eyebrow="Cobertura por categoria" title="Onde a padronização gera maior retorno?" badge="Top categorias">
        <CategoryCoverage payload={payload} loading={loading} />
      </BiPanel>
    </section>
  );
}

function CollaborationPage({ loading, payload }: PageProps) {
  const data = [
    { name: "Salas", value: payload?.collaboration.rooms || 0 },
    { name: "Ativas", value: payload?.collaboration.active_rooms || 0 },
    { name: "Convertidas", value: payload?.collaboration.converted_rooms || 0 },
    { name: "DFDs coletivas", value: payload?.summary.collectiveDfds || 0 },
  ];
  return (
    <section className="grid grid-cols-1 gap-3 xl:grid-cols-12">
      <BiPanel className="xl:col-span-7" eyebrow="Jornada coletiva" title="Salas estão virando DFDs oficiais?" badge="Conversão">
        <div className="h-[280px] min-w-0">{loading ? <ChartSkeleton /> : <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={180}><BarChart data={data} layout="vertical"><CartesianGrid stroke="var(--p-color-surface-subtle)" strokeDasharray="4 4" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" radius={[0, 8, 8, 0]}>{data.map((_, index) => <Cell key={index} fill={CHART_COLORS[(index + 3) % CHART_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer>}</div>
      </BiPanel>
      <BiPanel className="xl:col-span-5" eyebrow="Impacto coletivo" title="O que a colaboração entrega?" badge="Campus ativo">
        <div className="grid gap-3 p-1">
          <Insight title="DFDs construídas coletivamente" value={number(payload?.summary.collectiveDfds || 0)} helper={`${percent(payload?.summary.collectiveRatePct || 0)} do total`} />
          <Insight title="Salas abertas ou em revisão" value={number(payload?.collaboration.active_rooms || 0)} helper="Demandas ainda colaboráveis" />
          <Insight title="Salas convertidas" value={number(payload?.collaboration.converted_rooms || 0)} helper="Viraram DFD oficial" />
        </div>
      </BiPanel>
      <BiPanel className="xl:col-span-12" eyebrow="Unidades participantes" title="Onde existe mais espaço para colaboração?" badge="Volume por unidade">
        <UnitMatrix payload={payload} loading={loading} />
      </BiPanel>
    </section>
  );
}

function RiskPage({ loading, payload }: PageProps) {
  return (
    <section className="grid grid-cols-1 gap-3 xl:grid-cols-12">
      <BiPanel className="xl:col-span-7" eyebrow="Risco operacional" title="Quais solicitações combinam idade e valor?" badge="Prioridade">
        <div className="h-[290px] min-w-0">{loading ? <ChartSkeleton /> : <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={180}><ScatterChart><CartesianGrid stroke="var(--p-color-surface-subtle)" strokeDasharray="4 4" /><XAxis type="number" dataKey="ageDays" name="Idade" unit=" dias" /><YAxis type="number" dataKey="value" name="Valor" tickFormatter={(value) => currency(value, true)} /><ZAxis type="number" dataKey="priority" range={[280, 80]} /><Tooltip cursor={{ strokeDasharray: "4 4" }} formatter={(value, name) => name === "Valor" ? currency(Number(value)) : value} /><Scatter data={payload?.priorities || []} fill="var(--p-color-danger)" animationDuration={850} /></ScatterChart></ResponsiveContainer>}</div>
      </BiPanel>
      <BiPanel className="xl:col-span-5" eyebrow="Fila crítica" title="O que tratar primeiro?" badge={`${payload?.priorities.length || 0} itens`}>
        <PriorityList payload={payload} loading={loading} />
      </BiPanel>
      <BiPanel className="xl:col-span-12" eyebrow="Explicação dos sinais" title="Como o risco é interpretado?" badge="Accordion">
        <OperationalAccordion items={[
          { title: "Valor sob atenção", defaultOpen: true, content: "Soma do valor estimado das DFDs em triagem ou devolvidas no campus ativo." },
          { title: "Prioridade operacional", content: "Ordena prioridade registrada, idade sem resolução e valor estimado." },
          { title: "Risco cadastral e-Fisco", content: "Considera itens sem código e-Fisco ou marcados para revisão de natureza." },
        ]} />
      </BiPanel>
    </section>
  );
}

type PageProps = { loading: boolean; payload: DashboardPayload | null };

function BiPanel({ eyebrow, title, badge, className, children }: { eyebrow: string; title: string; badge?: string; className?: string; children: React.ReactNode }) {
  return (
    <article className={cn("min-w-0 rounded-2xl border border-[var(--p-color-border)] bg-white p-4 shadow-sm", className)}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div><p className="type-micro font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">{eyebrow}</p><h2 className="mt-1 text-base font-semibold text-[var(--p-color-brand-500)]">{title}</h2></div>
        {badge ? <span className="shrink-0 rounded-lg border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] px-2 py-1 type-micro font-semibold text-[var(--p-color-fg-muted)]">{badge}</span> : null}
      </div>
      {children}
    </article>
  );
}

function ChartSkeleton() { return <Skeleton className="h-full min-h-[240px] w-full rounded-xl" />; }

function MonthlyChart({ payload, loading }: PageProps) {
  const data = (payload?.monthly || []).map((row) => ({ ...row, label: monthLabel(row.month) }));
  return <div className="h-[260px] min-w-0">{loading ? <ChartSkeleton /> : <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={180}><ComposedChart data={data}><CartesianGrid stroke="var(--p-color-surface-subtle)" strokeDasharray="4 4" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis yAxisId="value" tick={{ fontSize: 11 }} tickFormatter={(value) => currency(value, true)} /><YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip formatter={(value, name) => name === "Valor" ? currency(Number(value)) : value} /><Legend /><Area yAxisId="value" dataKey="value" name="Valor" stroke="var(--p-color-brand-500)" fill="var(--p-color-info-bg)" animationDuration={750} /><Line yAxisId="count" dataKey="dfds" name="DFDs" stroke="var(--p-color-collab)" strokeWidth={2} animationDuration={950} /></ComposedChart></ResponsiveContainer>}</div>;
}

function StatusFlow({ payload }: { payload: DashboardPayload | null }) {
  const flow = payload?.flow;
  const origins = [
    { label: "Individual", value: flow?.origins.individual || 0, color: "var(--p-color-brand-400)" },
    { label: "Coletiva", value: flow?.origins.collective || 0, color: "var(--p-color-insight)" },
  ];
  const statuses = Object.entries(flow?.statuses || {}).filter(([, value]) => value > 0).map(([key, value]) => ({
    label: STATUS[key as keyof typeof STATUS]?.label || key,
    value,
    color: STATUS[key as keyof typeof STATUS]?.color || "var(--p-color-fg-subtle)",
  }));
  const total = origins.reduce((acc, row) => acc + row.value, 0);
  const max = Math.max(1, ...origins.map((row) => row.value), ...statuses.map((row) => row.value));
  return (
    <div className="relative grid min-h-[250px] grid-cols-1 gap-4 overflow-hidden rounded-xl bg-[var(--p-color-bg-elevated)] p-4 md:grid-cols-[minmax(110px,.72fr)_minmax(130px,.78fr)_minmax(130px,1fr)] md:items-center md:gap-7">
      <svg
        className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M20 31 C34 31 36 50 47 50" fill="none" stroke="var(--p-color-brand-400)" strokeWidth="1.6" strokeLinecap="round" opacity="0.24" />
        <path d="M20 70 C34 70 36 50 47 50" fill="none" stroke="var(--p-color-insight)" strokeWidth="1.2" strokeLinecap="round" opacity="0.22" />
        <path d="M57 50 C66 50 68 20 80 20" fill="none" stroke="var(--p-color-fg-subtle)" strokeWidth="1.1" strokeLinecap="round" opacity="0.22" />
        <path d="M57 50 C66 50 68 40 80 40" fill="none" stroke="var(--p-color-brand-400)" strokeWidth="1.1" strokeLinecap="round" opacity="0.22" />
        <path d="M57 50 C66 50 68 60 80 60" fill="none" stroke="var(--p-color-warning)" strokeWidth="1.1" strokeLinecap="round" opacity="0.22" />
        <path d="M57 50 C66 50 68 80 80 80" fill="none" stroke="var(--p-color-success)" strokeWidth="1.6" strokeLinecap="round" opacity="0.24" />
      </svg>
      <div className="space-y-3">{origins.map((row) => <FlowNode key={row.label} {...row} max={max} />)}</div>
      <div className="relative flex items-center justify-center">
        <motion.div className="absolute h-20 w-full rounded-full bg-[var(--p-color-info-bg)]/80 blur-xl" animate={{ scaleX: [0.96, 1.02, 0.96] }} transition={{ duration: 4, repeat: Infinity }} />
        <FlowNode label="Total do campus" value={total} color="var(--p-color-brand-500)" max={max} emphasis />
      </div>
      <div className="space-y-2">{statuses.map((row) => <FlowNode key={row.label} {...row} max={max} />)}</div>
    </div>
  );
}

function FlowNode({ label, value, color, max, emphasis = false }: { label: string; value: number; color: string; max: number; emphasis?: boolean }) {
  return <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className={cn("relative z-10 overflow-hidden rounded-lg border border-[var(--p-color-border)] bg-white px-3 py-2 shadow-sm", emphasis && "border-[var(--p-color-info-border)] shadow-md")}><motion.span className="absolute inset-y-0 left-0 opacity-15" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${Math.max(8, (value / max) * 100)}%` }} transition={{ duration: 0.7 }} /><p className="relative type-micro font-semibold uppercase text-[var(--p-color-fg-muted)]">{label}</p><p className="relative mt-1 text-lg font-semibold text-[var(--p-color-brand-500)]">{number(value)}</p></motion.div>;
}

function PriorityList({ payload, loading }: PageProps) {
  if (loading) return <div className="space-y-2">{[...Array(6)].map((_, index) => <Skeleton key={index} className="h-[58px] rounded-lg" />)}</div>;
  if (!payload?.priorities.length) return <OperationalEmptyState title="Nenhuma prioridade crítica" description="Não há DFDs em triagem ou devolvidas neste recorte." className="p-6" />;
  return (
    <div className="space-y-2">
      {payload.priorities.slice(0, 6).map((row, index) => (
        <Link
          key={row.id}
          href={`/dfd/${row.id}`}
          className="grid grid-cols-[28px_minmax(0,1fr)_minmax(68px,auto)] items-center gap-2 rounded-lg border border-[var(--p-color-surface-subtle)] bg-[var(--p-color-bg-elevated)] p-2.5 transition hover:bg-white hover:shadow-sm"
          title={`${row.title} · ${row.unit} · ${currency(row.value)}`}
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--p-color-warning-bg)] type-micro font-semibold text-[var(--p-color-warning)]">
            {index + 1}
          </span>
          <span className="min-w-0">
            <span className="mb-1 block text-xs font-medium text-[var(--p-color-brand-500)]">{row.protocol} · {STATUS[row.status as keyof typeof STATUS]?.label || row.status}</span>
            <span className="line-clamp-2 type-kicker font-semibold leading-snug text-[var(--p-color-fg-default)]">
              {row.title}
            </span>
            <span className="mt-1 block type-micro leading-tight text-[var(--p-color-fg-subtle)]">
              {row.unit} · {row.ageDays} dias
            </span>
          </span>
          <span className="justify-self-end whitespace-nowrap text-right type-micro font-semibold text-[var(--p-color-brand-500)]">
            {currency(row.value, true)}
          </span>
        </Link>
      ))}
    </div>
  );
}

function UnitMatrix({ payload, loading }: PageProps) {
  if (loading) return <ChartSkeleton />;
  const units = payload?.units.slice(0, 8) || [];
  const statuses = ["triagem", "aprovada", "devolvida", "concluida"];
  if (!units.length) return <OperationalEmptyState title="Sem unidades no recorte" description="As unidades aparecerão quando houver DFDs associadas." className="p-6" />;
  return <div className="overflow-x-auto"><div className="min-w-[680px] overflow-hidden rounded-lg border border-[var(--p-color-surface-subtle)]"><div className="grid grid-cols-[minmax(180px,1.4fr)_repeat(4,minmax(90px,.7fr))_90px] bg-[var(--p-color-surface-muted)] px-3 py-2 type-micro font-semibold text-[var(--p-color-fg-muted)]"><span>Unidade</span>{statuses.map((status) => <span key={status} className="text-center">{STATUS[status as keyof typeof STATUS].label}</span>)}<span className="text-right">Total</span></div>{units.map((unit) => <div key={unit.id} className="grid grid-cols-[minmax(180px,1.4fr)_repeat(4,minmax(90px,.7fr))_90px] items-center border-t border-[var(--p-color-surface-subtle)] px-3 py-2 type-kicker"><span className="truncate font-semibold text-[var(--p-color-fg-default)]">{unit.name}</span>{statuses.map((status) => { const value = unit.statuses[status] || 0; return <span key={status} className="mx-auto inline-flex min-w-10 justify-center rounded-md px-2 py-1 font-semibold" style={{ color: STATUS[status as keyof typeof STATUS].color, background: `color-mix(in srgb, ${STATUS[status as keyof typeof STATUS].color} 10%, transparent)` }}>{value}</span>; })}<span className="text-right font-semibold text-[var(--p-color-brand-500)]">{unit.total}</span></div>)}</div></div>;
}

function CategoryCoverage({ payload, loading }: PageProps) {
  const data = payload?.topCategories || [];
  return <div className="h-[280px] min-w-0">{loading ? <ChartSkeleton /> : <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={180}><BarChart data={data} layout="vertical"><CartesianGrid stroke="var(--p-color-surface-subtle)" strokeDasharray="4 4" /><XAxis type="number" domain={[0, 100]} unit="%" /><YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="coveragePct" name="Cobertura" fill="var(--p-color-collab)" radius={[0, 8, 8, 0]} animationDuration={850} /></BarChart></ResponsiveContainer>}</div>;
}

function Insight({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <article className="flex min-h-[104px] min-w-0 flex-col rounded-lg border border-[var(--p-color-surface-subtle)] bg-[var(--p-color-bg-elevated)] p-4">
      <p className="type-kicker font-semibold uppercase leading-3 text-[var(--p-color-fg-subtle)]">{title}</p>
      <p className="mt-3 flex min-h-[2.4rem] min-w-0 items-center overflow-visible text-[clamp(1.08rem,1.35vw,1.38rem)] font-semibold leading-[1.18] text-[var(--p-color-brand-500)]">
        <MechanicalValue value={value} />
      </p>
      <p className="mt-auto truncate pt-2 type-kicker leading-4 text-[var(--p-color-fg-muted)]" title={helper}>{helper}</p>
    </article>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>;
}

