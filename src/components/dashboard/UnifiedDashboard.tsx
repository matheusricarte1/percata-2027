"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Buildings,
  CalendarBlank,
  ChartLineUp,
  CheckCircle,
  ClipboardText,
  CrownSimple,
  Files,
  FunnelSimple,
  Hourglass,
  Lightning,
  ListChecks,
  ShieldCheck,
  UserCircle,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { getSafeUser, supabase } from "@/lib/supabase";
import { normalizeRole, type UserRole } from "@/lib/access";
import { resolveCampusBranding } from "@/lib/campus-branding";

type QueueItem = {
  id: string;
  numero_protocolo: string;
  objeto_contratacao: string;
  status?: string | null;
  created_at: string | null;
  valor_total_estimado: number | null;
};

type DfdListRow = QueueItem & {
  status: string | null;
};

type DfdChartRow = {
  status: string | null;
  valor_total_estimado: number | null;
  created_at: string | null;
};

type Metrics = {
  ownDrafts: number;
  ownTriagem: number;
  ownApproved: number;
  ownApprovedValue: number;
  ownLegacyCount: number;
  ownReturned: number;
  globalDfds: number;
  globalDrafts: number;
  globalTriagem: number;
  globalReturned: number;
  globalAprovadas: number;
  globalConcluded: number;
  globalAprovadasValue: number;
  totalUsers: number;
  totalCampi: number;
};

type StatusData = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type TrendData = {
  key: string;
  mes: string;
  total: number;
  aprovadas: number;
};

const DASHBOARD_TOUR_DISMISS_KEY = "percata:dashboard:tour-dismissed";

const INITIAL_METRICS: Metrics = {
  ownDrafts: 0,
  ownTriagem: 0,
  ownApproved: 0,
  ownApprovedValue: 0,
  ownLegacyCount: 0,
  ownReturned: 0,
  globalDfds: 0,
  globalDrafts: 0,
  globalTriagem: 0,
  globalReturned: 0,
  globalAprovadas: 0,
  globalConcluded: 0,
  globalAprovadasValue: 0,
  totalUsers: 0,
  totalCampi: 0,
};

const STATUS_PALETTE: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "#2D5D94" },
  triagem: { label: "Em análise", color: "#1F6F78" },
  devolvida: { label: "Devolvida", color: "#B88A2F" },
  aprovada: { label: "Aprovada", color: "#5F735C" },
  pactuando: { label: "Em pactuação", color: "#7D98B8" },
  concluida: { label: "Concluída", color: "#164073" },
};

const DASHBOARD_HERO_BY_CAMPUS = {
  petrolina: "/brands/dashboard-hero-petrolina-v3.png",
  ouricuri: "/brands/dashboard-hero-ouricuri-v3.png",
  default: "/brands/dashboard-hero-petrolina-v3.png",
} as const;

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "");
}

function normalizeStatus(status: string | null | undefined) {
  const key = String(status || "").toLowerCase().trim();
  return STATUS_PALETTE[key] ? key : "rascunho";
}

export default function UnifiedDashboard() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>("solicitante");
  const [firstName, setFirstName] = useState("Servidor");
  const [campusName, setCampusName] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics>(INITIAL_METRICS);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [recentRows, setRecentRows] = useState<DfdListRow[]>([]);
  const [chartRows, setChartRows] = useState<DfdChartRow[]>([]);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourDismissed, setTourDismissed] = useState(false);

  useEffect(() => {
    try {
      setTourDismissed(window.localStorage.getItem(DASHBOARD_TOUR_DISMISS_KEY) === "1");
    } catch {
      setTourDismissed(false);
    }
  }, []);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      try {
        const user = await getSafeUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, full_name, email, campus_id")
          .eq("id", user.id)
          .maybeSingle();

        const resolvedRole = normalizeRole(profile?.role, user.email);
        setRole(resolvedRole);

        const preferredName = String(
          profile?.full_name ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            "Servidor",
        )
          .trim()
          .split(" ")[0];
        setFirstName(preferredName || "Servidor");

        if (profile?.campus_id) {
          const { data: campus } = await supabase
            .from("campi")
            .select("nome, sigla")
            .eq("id", profile.campus_id)
            .maybeSingle();

          setCampusName(String(campus?.nome || campus?.sigla || "").trim() || null);
        }

        const [{ data: ownRows }, { count: legacyCount }] = await Promise.all([
          supabase
            .from("dfds")
            .select("id, numero_protocolo, objeto_contratacao, status, valor_total_estimado, created_at")
            .eq("solicitante_id", user.id)
            .order("created_at", { ascending: false })
            .limit(12),
          user.email
            ? supabase
                .from("historico_demandas")
                .select("*", { count: "exact", head: true })
                .eq("solicitante_email", String(user.email).toLowerCase())
            : Promise.resolve({ count: 0 } as any),
        ]);

        const nextMetrics: Metrics = {
          ...INITIAL_METRICS,
          ownDrafts: ownRows?.filter((row) => row.status === "rascunho").length || 0,
          ownTriagem: ownRows?.filter((row) => row.status === "triagem").length || 0,
          ownApproved: ownRows?.filter((row) => row.status === "aprovada").length || 0,
          ownReturned: ownRows?.filter((row) => row.status === "devolvida").length || 0,
          ownApprovedValue:
            ownRows
              ?.filter((row) => row.status === "aprovada")
              .reduce((acc, row) => acc + Number(row.valor_total_estimado || 0), 0) || 0,
          ownLegacyCount: legacyCount || 0,
        };

        if (resolvedRole === "superadmin" || resolvedRole === "admin" || resolvedRole === "chefia") {
          const [
            { data: globalRows },
            { data: queueRows },
            { data: recentGlobalRows },
            { count: usersCount },
            { count: campiCount },
          ] = await Promise.all([
            supabase.from("dfds").select("status, valor_total_estimado, created_at"),
            supabase
              .from("dfds")
              .select(
                "id, numero_protocolo, objeto_contratacao, status, created_at, valor_total_estimado",
              )
              .eq("status", "triagem")
              .order("created_at", { ascending: false })
              .limit(8),
            supabase
              .from("dfds")
              .select("id, numero_protocolo, objeto_contratacao, status, valor_total_estimado, created_at")
              .order("created_at", { ascending: false })
              .limit(8),
            supabase.from("profiles").select("*", { count: "exact", head: true }),
            supabase.from("campi").select("*", { count: "exact", head: true }),
          ]);

          nextMetrics.globalDfds = globalRows?.length || 0;
          nextMetrics.globalDrafts =
            globalRows?.filter((row) => row.status === "rascunho").length || 0;
          nextMetrics.globalTriagem =
            globalRows?.filter((row) => row.status === "triagem").length || 0;
          nextMetrics.globalReturned =
            globalRows?.filter((row) => row.status === "devolvida").length || 0;
          nextMetrics.globalAprovadas =
            globalRows?.filter((row) => row.status === "aprovada").length || 0;
          nextMetrics.globalConcluded =
            globalRows?.filter((row) => row.status === "concluida").length || 0;
          nextMetrics.globalAprovadasValue =
            globalRows
              ?.filter((row) => row.status === "aprovada")
              .reduce((acc, row) => acc + Number(row.valor_total_estimado || 0), 0) || 0;
          nextMetrics.totalUsers = usersCount || 0;
          nextMetrics.totalCampi = campiCount || 0;

          setQueue((queueRows || []) as QueueItem[]);
          setRecentRows((recentGlobalRows || []) as DfdListRow[]);
          setChartRows((globalRows || []) as DfdChartRow[]);
        } else {
          setRecentRows((ownRows || []) as DfdListRow[]);
          setChartRows((ownRows || []) as DfdChartRow[]);
        }

        setMetrics(nextMetrics);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  useEffect(() => {
    if (!loading && role === "solicitante" && !tourDismissed) {
      setTourOpen(true);
    }
  }, [loading, role, tourDismissed]);

  const trendData = useMemo<TrendData[]>(() => {
    const now = new Date();
    const months: Array<{ key: string; mes: string }> = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: monthKey(d), mes: monthLabel(d) });
    }
    const buckets: Record<string, TrendData> = {};
    months.forEach((m) => {
      buckets[m.key] = { key: m.key, mes: m.mes, total: 0, aprovadas: 0 };
    });
    chartRows.forEach((row) => {
      if (!row.created_at) return;
      const d = new Date(row.created_at);
      if (Number.isNaN(d.getTime())) return;
      const key = monthKey(new Date(d.getFullYear(), d.getMonth(), 1));
      const bucket = buckets[key];
      if (!bucket) return;
      bucket.total += 1;
      if (normalizeStatus(row.status) === "aprovada") bucket.aprovadas += 1;
    });
    return months.map((m) => buckets[m.key]);
  }, [chartRows]);

  const statusData = useMemo<StatusData[]>(() => {
    const counts: Record<string, number> = {};
    chartRows.forEach((row) => {
      const key = normalizeStatus(row.status);
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([key, value]) => ({
        key,
        label: STATUS_PALETTE[key].label,
        value,
        color: STATUS_PALETTE[key].color,
      }))
      .sort((a, b) => b.value - a.value);
  }, [chartRows]);

  const barData = useMemo(
    () =>
      statusData.map((item) => ({
        status: item.label,
        quantidade: item.value,
        color: item.color,
      })),
    [statusData],
  );

  const campusBranding = useMemo(() => resolveCampusBranding(campusName), [campusName]);
  const heroImageSrc = DASHBOARD_HERO_BY_CAMPUS[campusBranding.campusKey];

  const totalChartRows = chartRows.length;
  const approvalRate =
    totalChartRows > 0
      ? ((statusData.find((row) => row.key === "aprovada")?.value || 0) / totalChartRows) * 100
      : 0;
  const avgMonthlyVolume =
    trendData.length > 0
      ? trendData.reduce((sum, row) => sum + row.total, 0) / trendData.length
      : 0;
  const isExecutive = role === "superadmin";
  const isManager = role === "chefia" || role === "admin" || role === "superadmin";
  const consolidationHref = role === "chefia" ? "/chefia/orcamento" : "/admin/consolidacao";
  const pendingOperational =
    role === "solicitante"
      ? metrics.ownDrafts + metrics.ownReturned + metrics.ownTriagem
      : metrics.globalTriagem + metrics.globalReturned;
  const heroTitle = isExecutive
    ? `Olá, ${firstName}. Vamos cuidar do ciclo com mais clareza`
    : loading
      ? "Carregando..."
      : `Olá, ${firstName}.`;
  const heroText = isExecutive
    ? "Veja onde o ciclo precisa de apoio, onde a fila pressiona e onde a governança pode destravar o andamento."
    : isManager
      ? "Acompanhe a fila, reduza devoluções e mantenha o fluxo do setor legível para quem decide e para quem solicita."
      : "Acompanhe suas solicitações, comece novos pedidos e siga cada etapa com mais tranquilidade.";
  const quickActions = isExecutive
    ? [
        { href: "/admin/consolidacao", label: "Consolidação", detail: "Portfólio e priorização", icon: ChartLineUp, tone: "blue" as const },
        { href: "/triagem", label: "Fila estratégica", detail: "Análises pendentes", icon: FunnelSimple, tone: "teal" as const },
        { href: "/admin/usuarios", label: "Usuários", detail: "Perfis e acessos", icon: UsersThree, tone: "warm" as const },
        { href: "/admin/campanhas", label: "Ciclo", detail: "Campanhas e governança", icon: CalendarBlank, tone: "slate" as const },
      ]
    : isManager
      ? [
          { href: "/triagem", label: "Triagem", detail: "Avaliar solicitações", icon: FunnelSimple, tone: "teal" as const },
          { href: "/chefia/orcamento", label: "Orçamento", detail: "Consultar impacto", icon: ChartLineUp, tone: "blue" as const },
          { href: "/minhas-dfds", label: "Minhas solicitações", detail: "Acompanhar pedidos", icon: Files, tone: "slate" as const },
          { href: "/catalogo", label: "Catálogo", detail: "Itens e serviços", icon: ListChecks, tone: "warm" as const },
        ]
      : [
          { href: "/nova-dfd", label: "Nova Solicitação", detail: "Criar um novo pedido", icon: ClipboardText, tone: "blue" as const },
          { href: "/minhas-dfds", label: "Minhas Solicitações", detail: "Ver e gerenciar pedidos", icon: Files, tone: "slate" as const },
          { href: "/catalogo", label: "Catálogo", detail: "Ver itens disponíveis", icon: ListChecks, tone: "warm" as const },
          { href: "/historico", label: "Histórico", detail: "Consultar anos anteriores", icon: CalendarBlank, tone: "teal" as const },
        ];
  const summaryMetrics = isManager
    ? [
        { label: "Volume total", value: metrics.globalDfds, tone: "blue", icon: Files },
        { label: "Aguardando análise", value: metrics.globalTriagem, tone: "amber", icon: Hourglass },
        { label: "Aprovadas", value: metrics.globalAprovadas, tone: "green", icon: CheckCircle },
        { label: "Devolvidas", value: metrics.globalReturned, tone: "red", icon: FunnelSimple },
        { label: "Concluídas", value: metrics.globalConcluded, tone: "violet", icon: ShieldCheck },
      ]
    : [
        { label: "Em andamento", value: metrics.ownTriagem, tone: "blue", icon: Hourglass },
        { label: "Rascunhos", value: metrics.ownDrafts, tone: "violet", icon: ClipboardText },
        { label: "Concluídas", value: metrics.ownApproved, tone: "green", icon: CheckCircle },
        { label: "Devolvidas", value: metrics.ownReturned, tone: "red", icon: FunnelSimple },
        { label: "Anteriores", value: metrics.ownLegacyCount, tone: "amber", icon: CalendarBlank },
      ];
  const guidanceMoments = isExecutive
    ? [
        {
          title: "Comece pela fila",
          description: "Observe triagens e devoluções antes de olhar o volume consolidado.",
          href: "/triagem",
          cta: "Abrir fila",
          icon: Hourglass,
        },
        {
          title: "Leia o ciclo com contexto",
          description: "Conecte valor aprovado, pressão operacional e ritmo mensal antes de intervir.",
          href: "/admin/consolidacao",
          cta: "Ver consolidação",
          icon: ChartLineUp,
        },
        {
          title: "Apoie as unidades",
          description: "Use usuários e campanhas para reduzir ruído e aumentar previsibilidade.",
          href: "/admin/usuarios",
          cta: "Ver usuários",
          icon: UsersThree,
        },
      ]
    : isManager
      ? [
          {
            title: "O que precisa de decisão agora",
            description: "A fila de triagem mostra o que está aguardando leitura e encaminhamento.",
            href: "/triagem",
            cta: "Abrir triagem",
            icon: FunnelSimple,
          },
          {
            title: "Onde a devolução está pesando",
            description: "O resumo ajuda a ver gargalos, pressão e impacto do setor sem perder o contexto.",
            href: "/chefia/orcamento",
            cta: "Abrir resumo",
            icon: ChartLineUp,
          },
          {
            title: "Como colaborar melhor",
            description: "As DFDs coletivas ajudam a reunir demandas antes da aprovação formal.",
            href: "/dfds-coletivas",
            cta: "Ver coletivas",
            icon: UsersThree,
          },
        ]
      : [
          {
            title: "Se você está começando",
            description: "Abra o catálogo para escolher itens e entender melhor o que vai compor sua solicitação.",
            href: "/catalogo",
            cta: "Abrir catálogo",
            icon: ListChecks,
          },
          {
            title: "Se já tem uma demanda em mente",
            description: "Crie uma nova DFD e preencha os dados em etapas, com apoio visual do sistema.",
            href: "/nova-dfd",
            cta: "Nova solicitação",
            icon: ClipboardText,
          },
          {
            title: "Se precisa acompanhar ou ajustar",
            description: "Minhas solicitações mostra devoluções, análises em andamento e o que falta revisar.",
            href: "/minhas-dfds",
            cta: "Acompanhar",
            icon: Files,
          },
        ];

  return (
    <div className="py-6 space-y-5">
      <section className="relative overflow-hidden rounded-[20px] border border-[#C7D7EA] bg-[#F7FBFF] text-[#1E2430] px-7 py-7 shadow-sm md:h-[244px]">
        <div className="relative z-10 grid min-h-[156px] grid-cols-1 items-center gap-6 md:h-full md:min-h-0 md:grid-cols-[minmax(0,1fr)_minmax(360px,50%)]">
          <div className="max-w-[520px]">
            <h1 className="text-[30px] leading-tight font-semibold tracking-tight text-[#1E2430] md:text-[34px]">
              {heroTitle}
            </h1>
            <p className="mt-3 max-w-[430px] text-sm leading-6 text-[#5B6675]">
              {heroText}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {isExecutive ? (
                <Link
                  href="/admin/consolidacao"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#164073] px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-sm hover:bg-[#0F2E57]"
                >
                  Abrir consolidação
                  <ArrowRight size={14} weight="bold" />
                </Link>
              ) : (
                <Link
                  href={isManager ? "/triagem" : "/nova-dfd"}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#164073] px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-sm hover:bg-[#0F2E57]"
                >
                  {isManager ? "Abrir triagem" : "Criar solicitação"}
                  <ArrowRight size={14} weight="bold" />
                </Link>
              )}
              <Link
                href="/catalogo"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#C7D7EA] bg-white/80 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#164073] hover:bg-white"
              >
                Catálogo
              </Link>
            </div>
          </div>

          <div className="relative hidden h-full md:block">
            <img
              src={heroImageSrc}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-1/2 h-[80%] w-full -translate-y-1/2 object-contain object-right-center"
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => (
          <ActionTile key={action.href + action.label} {...action} />
        ))}
      </section>

      <section className="rounded-[24px] border border-[#D9E0E8] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7D98B8]">
              Seu caminho no Percata
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#164073]">
              O que faz mais sentido agora
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5B6675]">
              Em vez de procurar tudo ao mesmo tempo, siga pelo ponto que melhor representa o seu momento.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F4F7FA] px-3 py-1.5 text-xs font-semibold text-[#3E4C5F]">
            <Lightning size={14} weight="fill" className="text-[#164073]" />
            Fluxo guiado por perfil
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-3">
          {guidanceMoments.map((item) => (
            <GuidanceTile key={item.href + item.title} {...item} />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {loading
          ? [...Array(5)].map((_, idx) => <Skeleton key={idx} className="h-24 rounded-2xl" />)
          : summaryMetrics.map((metric) => <MetricTile key={metric.label} {...metric} />)}
      </section>

      {isExecutive ? (
        <ExecutiveBriefing
          total={metrics.globalDfds}
          pending={metrics.globalTriagem}
          returned={metrics.globalReturned}
          approvalRate={approvalRate}
          value={metrics.globalAprovadasValue}
        />
      ) : (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ExecutiveKpi
            title="Taxa de aprovação"
            value={`${approvalRate.toFixed(1).replace(".", ",")}%`}
            description="Percentual de demandas homologadas no recorte atual."
          />
          <ExecutiveKpi
            title={isManager ? "Pressão da fila" : "Itens sob atenção"}
            value={String(pendingOperational)}
            description={isManager ? "Solicitações exigindo análise ou ajuste." : "Rascunhos, devoluções e pedidos em análise."}
          />
          <ExecutiveKpi
            title="Média mensal"
            value={avgMonthlyVolume.toFixed(1).replace(".", ",")}
            description="Média de solicitações por mês nos últimos 6 meses."
          />
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <article className="xl:col-span-7 rounded-2xl bg-white border border-black/5 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-black/40 font-semibold">
                Pergunta estratégica
              </p>
              <h2 className="text-xl font-semibold text-[#164073]">O volume mensal está acelerando?</h2>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-black/40 font-semibold">
              Total: {totalChartRows}
            </div>
          </div>
          <div className="mt-4 h-[280px]">
            {loading ? (
              <Skeleton className="h-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2D5D94" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2D5D94" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="gApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EC2029" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#EC2029" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E8EDF2" strokeDasharray="4 4" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#5B6675" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5B6675" }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #D9E0E8",
                      boxShadow: "0 8px 24px rgba(16,43,74,0.08)",
                    }}
                  />
                  <ReferenceLine
                    y={avgMonthlyVolume}
                    stroke="#7D98B8"
                    strokeDasharray="5 5"
                    ifOverflow="extendDomain"
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    stroke="#2D5D94"
                    fill="url(#gTotal)"
                    strokeWidth={2}
                    animationDuration={700}
                  />
                  <Area
                    type="monotone"
                    dataKey="aprovadas"
                    name="Aprovadas"
                    stroke="#EC2029"
                    fill="url(#gApproved)"
                    strokeWidth={2}
                    animationDuration={900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="xl:col-span-5 rounded-2xl bg-white border border-black/5 p-5 shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.16em] text-black/40 font-semibold">
            Pergunta estratégica
          </p>
          <h2 className="text-xl font-semibold text-[#164073]">Onde está concentrado o trabalho?</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
            <div className="h-[220px] relative">
              {loading ? (
                <Skeleton className="h-full rounded-xl" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={56}
                        outerRadius={88}
                        paddingAngle={2}
                        animationDuration={800}
                      >
                        {statusData.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #D9E0E8",
                          boxShadow: "0 8px 24px rgba(16,43,74,0.08)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] uppercase tracking-widest text-[#5B6675] font-semibold">
                      Total
                    </span>
                    <span className="text-2xl font-semibold text-[#164073]">{totalChartRows}</span>
                  </div>
                </>
              )}
            </div>
            <div className="space-y-2">
              {statusData.map((item) => (
                <div
                  key={item.key}
                  className="rounded-lg border border-black/5 bg-[#FAFBFC] px-3 py-2 flex items-center justify-between"
                >
                  <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest text-[#3E4C5F] font-semibold">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                    {item.label}
                  </span>
                  <span className="text-sm font-semibold text-[#164073]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <article className="xl:col-span-7 rounded-2xl bg-white border border-black/5 p-5 shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.16em] text-black/40 font-semibold">
            Pergunta estratégica
          </p>
          <h2 className="text-xl font-semibold text-[#164073]">Quais etapas concentram risco de atraso?</h2>
          <div className="mt-4 h-[260px]">
            {loading ? (
              <Skeleton className="h-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 24 }}>
                  <CartesianGrid stroke="#E8EDF2" strokeDasharray="4 4" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#5B6675" }} />
                  <YAxis
                    type="category"
                    dataKey="status"
                    width={108}
                    tick={{ fontSize: 11, fill: "#5B6675" }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #D9E0E8",
                      boxShadow: "0 8px 24px rgba(16,43,74,0.08)",
                    }}
                  />
                  <Bar dataKey="quantidade" radius={[0, 8, 8, 0]} animationDuration={700}>
                    {barData.map((entry) => (
                      <Cell key={`bar-${entry.status}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="xl:col-span-5 rounded-2xl bg-white border border-black/5 p-5 shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.16em] text-black/40 font-semibold">
            Ações rápidas
          </p>
          <h2 className="text-xl font-semibold text-[#164073]">Navegação do seu nível</h2>
          <div className="mt-4 grid grid-cols-1 gap-2">
            <QuickLink href="/catalogo" icon={ListChecks} label="Abrir catálogo" />
            <QuickLink href="/nova-dfd" icon={ClipboardText} label="Nova solicitação" />
            <QuickLink href="/minhas-dfds" icon={Files} label="Minhas solicitações" />
            {isManager && (
              <QuickLink href="/triagem" icon={FunnelSimple} label="Fila de triagem" />
            )}
            {(role === "admin" || role === "superadmin") && (
              <QuickLink href="/admin/consolidacao" icon={ChartLineUp} label="Consolidação" />
            )}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <article className="xl:col-span-5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-black/40 font-semibold">
                O que precisa da sua atenção
              </p>
              <h2 className="text-xl font-semibold text-[#164073]">
                {isManager ? "Fila e exceções" : "Próximos passos"}
              </h2>
            </div>
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#EC2029] px-2 text-xs font-semibold text-white">
              {pendingOperational}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {isManager ? (
              <>
                <AttentionRow icon={Hourglass} tone="amber" title="Solicitações aguardando análise" text={`${metrics.globalTriagem} itens precisam de decisão.`} href="/triagem" />
                <AttentionRow icon={FunnelSimple} tone="red" title="Devoluções no fluxo" text={`${metrics.globalReturned} solicitações retornaram para ajuste.`} href="/triagem" />
                <AttentionRow icon={ChartLineUp} tone="blue" title="Consolidação executiva" text="Revise agrupamentos e impacto do portfólio." href={consolidationHref} />
              </>
            ) : (
              <>
                <AttentionRow icon={ClipboardText} tone="violet" title="Rascunhos pendentes" text={`${metrics.ownDrafts} solicitação(ões) ainda não finalizada(s).`} href="/minhas-dfds" />
                <AttentionRow icon={FunnelSimple} tone="red" title="Pedidos devolvidos" text={`${metrics.ownReturned} solicitação(ões) precisam de ajuste.`} href="/minhas-dfds" />
                <AttentionRow icon={Hourglass} tone="blue" title="Em análise" text={`${metrics.ownTriagem} pedido(s) aguardando avaliação.`} href="/minhas-dfds" />
              </>
            )}
          </div>
        </article>

        <article className="xl:col-span-7 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-black/40 font-semibold">
                Solicitações recentes
              </p>
              <h2 className="text-xl font-semibold text-[#164073]">Movimento mais recente</h2>
            </div>
            <Link href={isManager ? "/triagem" : "/minhas-dfds"} className="text-xs font-semibold text-[#164073] hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#E8EDF2]">
            {loading ? (
              [...Array(4)].map((_, idx) => <Skeleton key={idx} className="h-14 rounded-none border-b border-white" />)
            ) : recentRows.length === 0 ? (
              <div className="flex h-32 items-center justify-center bg-[#FAFBFC] text-sm font-semibold text-black/45">
                Nenhuma solicitação recente.
              </div>
            ) : (
              recentRows.slice(0, 5).map((row) => (
                <RecentRequestRow key={row.id} row={row} />
              ))
            )}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <LevelPanel
          className="xl:col-span-6"
          icon={UserCircle}
          title="Solicitante"
          subtitle="Operação"
          description="Elaboração e acompanhamento das solicitações."
          stats={[
            { label: "Rascunhos", value: metrics.ownDrafts },
            { label: "Em análise", value: metrics.ownTriagem },
            { label: "Legadas", value: metrics.ownLegacyCount },
          ]}
          actions={[
            { href: "/catalogo", label: "Catálogo", icon: ListChecks },
            { href: "/nova-dfd", label: "Nova DFD", icon: ArrowRight },
            { href: "/minhas-dfds", label: "Minhas DFDs", icon: Files },
          ]}
        />

        {isManager && (
          <LevelPanel
            className="xl:col-span-6"
            icon={ShieldCheck}
            title="Chefia/Admin"
            subtitle="Curadoria"
            description="Análise, priorização e consolidação institucional."
            stats={[
              { label: "Fila chefia", value: metrics.globalTriagem },
              { label: "Aprovadas", value: metrics.globalAprovadas },
              { label: "Valor", value: formatCurrency(metrics.globalAprovadasValue) },
            ]}
            actions={[
              { href: "/triagem", label: "Triagem", icon: FunnelSimple },
              { href: "/admin/consolidacao", label: "Consolidação", icon: ChartLineUp },
              { href: "/admin/exportacao", label: "Exportar", icon: ArrowRight },
            ]}
          />
        )}

        {role === "superadmin" && (
          <LevelPanel
            className="xl:col-span-12"
            icon={CrownSimple}
            title="Superadmin"
            subtitle="Governança"
            description="Visão de usuários, campi e ciclo institucional."
            stats={[
              { label: "Usuários", value: metrics.totalUsers },
              { label: "Campi", value: metrics.totalCampi },
              { label: "DFDs", value: metrics.globalDfds },
            ]}
            actions={[
              { href: "/admin/usuarios", label: "Usuários", icon: UsersThree },
              { href: "/admin/campanhas", label: "Campanhas", icon: CalendarBlank },
              { href: "/admin/configuracoes", label: "Configurações", icon: Buildings },
            ]}
          />
        )}
      </section>

      {isManager && (
        <section className="rounded-2xl bg-white border border-black/5 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#164073] uppercase tracking-tight">
              Fila de análise da chefia
            </h2>
            <Link href="/triagem" className="text-xs font-semibold text-[#164073] hover:underline">
              Ir para triagem
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {loading ? (
              [...Array(4)].map((_, idx) => <Skeleton key={idx} className="h-16 rounded-xl" />)
            ) : queue.length === 0 ? (
              <div className="h-24 rounded-xl border border-dashed border-black/10 bg-[#FAFBFC] flex items-center justify-center text-sm text-black/45 font-semibold">
                Sem solicitações pendentes.
              </div>
            ) : (
              queue.map((row) => (
                <div
                  key={row.id}
                  className="rounded-xl border border-black/5 bg-[#FAFBFC] p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-black/40 font-semibold">
                      {row.numero_protocolo}
                    </p>
                    <p className="text-sm font-semibold text-[#1E2430] truncate">
                      {row.objeto_contratacao}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-[#164073]">
                      {formatCurrency(Number(row.valor_total_estimado || 0))}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-black/35">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleDateString("pt-BR")
                        : "sem data"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {tourOpen && role === "solicitante" && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={() => setTourOpen(false)} />
          <div className="relative z-[121] w-full max-w-3xl rounded-[30px] border border-[#D9E0E8] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7D98B8]">
                  Comece por aqui
                </p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-[#164073]">
                  Seu primeiro caminho no Percata
                </h3>
                <p className="mt-1 text-sm text-[#5B6675]">
                  Um percurso simples para criar, enviar e acompanhar suas solicitações sem se perder nas etapas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTourOpen(false)}
                className="h-9 w-9 rounded-xl border border-[#D9E0E8] text-[#5B6675] hover:bg-[#F4F7FA] inline-flex items-center justify-center"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <TourBlock
                icon={ListChecks}
                title="Catálogo"
                text="Escolha itens e valide informações antes do envio."
                href="/catalogo"
                cta="Abrir catálogo"
              />
              <TourBlock
                icon={ClipboardText}
                title="Nova DFD"
                text="Informe local de uso, justificativas e previsão."
                href="/nova-dfd"
                cta="Abrir nova DFD"
              />
              <TourBlock
                icon={Files}
                title="Minhas DFDs"
                text="Acompanhe devoluções e homologações."
                href="/minhas-dfds"
                cta="Acompanhar"
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    window.localStorage.setItem(DASHBOARD_TOUR_DISMISS_KEY, "1");
                  } catch {}
                  setTourDismissed(true);
                  setTourOpen(false);
                }}
                className="h-10 rounded-xl border border-[#D9E0E8] bg-[#F4F7FA] px-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#3E4C5F] hover:bg-[#E8EDF2]"
              >
                Não mostrar novamente
              </button>

              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#3E4C5F]">
                <Lightning size={14} weight="fill" className="text-[#164073]" />
                Você pode abrir este guia novamente quando precisar.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionTile({
  href,
  label,
  detail,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  detail: string;
  icon: any;
  tone?: "blue" | "teal" | "warm" | "slate";
}) {
  const palette =
    tone === "teal"
      ? {
          card: "border-[#D4E6E8] bg-[#F4FBFB] hover:border-[#B8D6D9]",
          icon: "bg-[#E0F3F4] text-[#1D5A63] group-hover:bg-[#D0ECEE]",
          arrow: "text-[#6E97A0]",
        }
      : tone === "warm"
        ? {
            card: "border-[#F0DCC9] bg-[#FFF8F2] hover:border-[#E6C9AE]",
            icon: "bg-[#FBEADF] text-[#8B5A2B] group-hover:bg-[#F7E2D3]",
            arrow: "text-[#B08456]",
          }
        : tone === "slate"
          ? {
              card: "border-[#D9E1EA] bg-[#F8FAFC] hover:border-[#C7D3E0]",
              icon: "bg-[#E9EEF4] text-[#50637C] group-hover:bg-[#DDE6EF]",
              arrow: "text-[#7E91A8]",
            }
          : {
              card: "border-[#D7E2EE] bg-[#F7FAFE] hover:border-[#C7D7EA]",
              icon: "bg-[#EAF2FF] text-[#164073] group-hover:bg-[#DCEAFB]",
              arrow: "text-[#6F89AA]",
            };

  return (
    <Link
      href={href}
      className={`group min-h-[92px] rounded-2xl border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${palette.card}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${palette.icon}`}>
          <Icon size={22} weight="duotone" />
        </span>
        <ArrowRight size={16} weight="bold" className={palette.arrow} />
      </div>
      <p className="mt-3 text-sm font-semibold text-[#164073]">{label}</p>
      <p className="mt-1 text-xs leading-4 text-[#5B6675]">{detail}</p>
    </Link>
  );
}

function GuidanceTile({
  href,
  title,
  description,
  cta,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  cta: string;
  icon: any;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[#E8EDF2] bg-[#FBFCFE] p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#C7D7EA] hover:bg-white"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#164073] transition-colors group-hover:bg-[#164073] group-hover:text-white">
          <Icon size={20} weight="duotone" />
        </span>
        <ArrowRight size={16} weight="bold" className="text-[#7D98B8]" />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-[#164073]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#5B6675]">{description}</p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#164073]">
        {cta}
      </p>
    </Link>
  );
}

function MetricTile({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  tone: string;
  icon: any;
}) {
  const toneClasses: Record<string, string> = {
    blue: "bg-[#EAF2FF] text-[#164073]",
    green: "bg-[#E7F0EA] text-[#2F7D46]",
    amber: "bg-[#FFF4DF] text-[#B88A2F]",
    red: "bg-[#FDE8E8] text-[#C81822]",
    violet: "bg-[#EFE9FF] text-[#5B42A7]",
  };

  return (
    <article className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold text-[#3E4C5F]">{label}</p>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${toneClasses[tone] || toneClasses.blue}`}>
          <Icon size={20} weight="duotone" />
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-[#1E2430]">{value}</p>
    </article>
  );
}

function ExecutiveBriefing({
  total,
  pending,
  returned,
  approvalRate,
  value,
}: {
  total: number;
  pending: number;
  returned: number;
  approvalRate: number;
  value: number;
}) {
  const pressure = total > 0 ? ((pending + returned) / total) * 100 : 0;
  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <article className="xl:col-span-7 rounded-2xl border border-[#D9E0E8] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#7D98B8] font-semibold">
              Executive brief
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#164073]">
              O ciclo está saudável, mas a fila define o ritmo da execução.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5B6675]">
              Priorize redução de backlog, padronização de devoluções e coordenação entre campi para manter previsibilidade.
            </p>
          </div>
          <div className="hidden rounded-2xl bg-[#F4F7FA] px-4 py-3 text-right md:block">
            <p className="text-[10px] uppercase tracking-widest text-[#5B6675] font-semibold">Valor aprovado</p>
            <p className="text-lg font-semibold text-[#164073]">{formatCurrency(value)}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <ExecutiveSignal label="Aprovação" value={`${approvalRate.toFixed(1).replace(".", ",")}%`} />
          <ExecutiveSignal label="Pressão operacional" value={`${pressure.toFixed(1).replace(".", ",")}%`} />
          <ExecutiveSignal label="Ponto de gestão" value={pending > returned ? "Fila" : "Devolução"} />
        </div>
      </article>

      <article className="xl:col-span-5 rounded-2xl border border-[#D9E0E8] bg-[#102B4A] p-5 text-white shadow-sm">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/55 font-semibold">
          Decisões recomendadas
        </p>
        <div className="mt-4 space-y-3">
          <DecisionRow label="1" text="Revisar itens em triagem com maior valor estimado." />
          <DecisionRow label="2" text="Padronizar motivos de devolução por unidade." />
          <DecisionRow label="3" text="Conferir aderência de usuários e campi ao ciclo ativo." />
        </div>
      </article>
    </section>
  );
}

function ExecutiveSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-[#FAFBFC] p-4">
      <p className="text-[10px] uppercase tracking-widest text-[#5B6675] font-semibold">{label}</p>
      <p className="mt-2 text-xl font-semibold text-[#1E2430]">{value}</p>
    </div>
  );
}

function DecisionRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/8 p-3">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#164073]">
        {label}
      </span>
      <p className="text-sm leading-5 text-white/82">{text}</p>
    </div>
  );
}

function AttentionRow({
  icon: Icon,
  tone,
  title,
  text,
  href,
}: {
  icon: any;
  tone: string;
  title: string;
  text: string;
  href: string;
}) {
  const toneClasses: Record<string, string> = {
    blue: "bg-[#EAF2FF] text-[#164073]",
    amber: "bg-[#FFF4DF] text-[#B88A2F]",
    red: "bg-[#FDE8E8] text-[#C81822]",
    violet: "bg-[#EFE9FF] text-[#5B42A7]",
  };

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-black/5 bg-[#FAFBFC] p-3 transition-colors hover:bg-[#F4F7FA]"
    >
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneClasses[tone] || toneClasses.blue}`}>
        <Icon size={18} weight="duotone" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#1E2430]">{title}</span>
        <span className="mt-0.5 block text-xs leading-4 text-[#5B6675]">{text}</span>
      </span>
      <ArrowRight size={14} weight="bold" className="shrink-0 text-[#7D98B8]" />
    </Link>
  );
}

function RecentRequestRow({ row }: { row: DfdListRow }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[#E8EDF2] bg-white px-4 py-3 last:border-b-0 md:grid-cols-[120px_minmax(0,1fr)_130px_90px]">
      <Link href={`/dfd/${row.id}`} className="text-sm font-semibold text-[#164073] hover:underline">
        {row.numero_protocolo || "Sem protocolo"}
      </Link>
      <p className="min-w-0 truncate text-sm font-medium text-[#1E2430]">
        {row.objeto_contratacao || "Solicitação sem título"}
      </p>
      <StatusBadge status={row.status} />
      <p className="hidden text-right text-xs font-medium text-[#5B6675] md:block">
        {row.created_at ? new Date(row.created_at).toLocaleDateString("pt-BR") : "sem data"}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const key = normalizeStatus(status);
  const palette = STATUS_PALETTE[key];
  return (
    <span
      className="inline-flex h-7 items-center justify-center rounded-full px-3 text-[11px] font-semibold"
      style={{ color: palette.color, backgroundColor: `${palette.color}18` }}
    >
      {palette.label}
    </span>
  );
}

function QuickLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: any;
}) {
  return (
    <Link
      href={href}
      className="h-11 rounded-xl border border-black/10 bg-[#FAFBFC] hover:bg-[#F4F7FA] px-3 text-sm font-semibold text-[#164073] inline-flex items-center justify-between"
    >
      <span className="inline-flex items-center gap-2">
        <Icon size={17} weight="duotone" />
        {label}
      </span>
      <ArrowRight size={14} weight="bold" />
    </Link>
  );
}

function ExecutiveKpi({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl bg-white border border-black/5 p-4 shadow-sm">
      <p className="text-[10px] uppercase tracking-[0.16em] text-black/40 font-semibold">
        {title}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[#164073]">{value}</p>
      <p className="mt-1 text-xs text-[#5B6675]">{description}</p>
    </article>
  );
}

function TourBlock({
  icon: Icon,
  title,
  text,
  href,
  cta,
}: {
  icon: any;
  title: string;
  text: string;
  href: string;
  cta: string;
}) {
  return (
    <article className="rounded-2xl border border-[#D9E0E8] bg-[#FAFBFC] p-4">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#164073]/10 text-[#164073]">
        <Icon size={18} weight="duotone" />
      </div>
      <h4 className="mt-3 text-lg font-semibold tracking-tight text-[#164073]">{title}</h4>
      <p className="mt-1 text-sm text-[#5B6675]">{text}</p>
      <Link
        href={href}
        className="mt-3 inline-flex h-9 items-center gap-1 rounded-lg border border-[#C7D7EA] bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#164073] hover:bg-[#F4F7FA]"
      >
        {cta}
        <ArrowRight size={12} weight="bold" />
      </Link>
    </article>
  );
}

function LevelPanel({
  className,
  icon: Icon,
  title,
  subtitle,
  description,
  stats,
  actions,
}: {
  className?: string;
  icon: any;
  title: string;
  subtitle: string;
  description: string;
  stats: Array<{ label: string; value: string | number }>;
  actions: Array<{ href: string; label: string; icon: any }>;
}) {
  return (
    <article className={`rounded-2xl border border-black/5 bg-white p-5 shadow-sm ${className || ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-semibold">{subtitle}</p>
          <h3 className="text-2xl font-semibold tracking-tight text-[#164073]">{title}</h3>
          <p className="mt-1 text-sm text-black/60">{description}</p>
        </div>
        <div className="w-11 h-11 rounded-xl bg-[#E8EDF2] text-[#164073] inline-flex items-center justify-center shrink-0">
          <Icon size={22} weight="duotone" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-xl border border-black/5 bg-[#FAFBFC] px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-black/40 font-semibold">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-[#1E2430]">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
        {actions.map((action) => (
          <Link
            key={action.href + action.label}
            href={action.href}
            className="justify-start rounded-xl border border-black/10 bg-white h-10 px-3 text-xs font-semibold uppercase tracking-widest text-[#164073] inline-flex items-center hover:bg-[#FAFBFC] transition-colors"
          >
            <action.icon size={14} className="mr-2" />
            {action.label}
          </Link>
        ))}
      </div>
    </article>
  );
}
