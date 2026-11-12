export type DashboardDfdRow = {
  id: string;
  status?: string | null;
  created_at?: string | null;
  valor_total_estimado?: number | null;
  unidade_id?: string | null;
  analysis_unidade_id?: string | null;
  tipo_unidade?: string | null;
  analysis_tipo_unidade?: string | null;
  origin_type?: string | null;
  numero_protocolo?: string | null;
  objeto_contratacao?: string | null;
  prioridade?: number | null;
};

export type DashboardItemRow = {
  dfd_id: string;
  quantidade?: number | null;
  valor_unitario_estimado?: number | null;
  codigo_item_efisco?: string | null;
  codigo_tce?: string | null;
  gnd?: string | null;
  gnd_derivado?: string | null;
  nome_grupo?: string | null;
  nome_classe?: string | null;
  requires_natureza_review?: boolean | null;
};

export type DashboardLogRow = {
  dfd_id: string;
  action?: string | null;
  created_at?: string | null;
};

type StatusCounts = Record<string, number>;

const STATUS_KEYS = [
  "rascunho",
  "triagem",
  "devolvida",
  "aprovada",
  "pactuando",
  "concluida",
] as const;

const APPROVED_STATUSES = new Set(["aprovada", "pactuando", "concluida", "homologada"]);
const RISK_STATUSES = new Set(["triagem", "devolvida"]);

function normalizeStatus(value?: string | null) {
  const status = String(value || "rascunho").trim().toLowerCase();
  return status || "rascunho";
}

function finite(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function toMonth(value?: string | null) {
  const date = new Date(String(value || ""));
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ageDays(value: string | null | undefined, now: Date) {
  const date = new Date(String(value || ""));
  if (!Number.isFinite(date.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 10_000) / 100;
}

function emptyStatusCounts(): StatusCounts {
  return Object.fromEntries(STATUS_KEYS.map((status) => [status, 0]));
}

export function buildDashboardBi({
  dfds,
  items,
  logs,
  unitNames,
  now = new Date(),
}: {
  dfds: DashboardDfdRow[];
  items: DashboardItemRow[];
  logs: DashboardLogRow[];
  unitNames: Map<string, string>;
  now?: Date;
}) {
  const statusCounts = emptyStatusCounts();
  const origins = { individual: 0, collective: 0 };
  const monthlyMap = new Map<
    string,
    { month: string; dfds: number; value: number; approved: number; concluded: number }
  >();
  const unitMap = new Map<
    string,
    { id: string; name: string; statuses: StatusCounts; total: number; value: number }
  >();

  let plannedValue = 0;
  let approvedValue = 0;
  let atRiskValue = 0;

  for (const dfd of dfds) {
    const status = normalizeStatus(dfd.status);
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    const value = finite(dfd.valor_total_estimado);
    plannedValue += value;
    if (APPROVED_STATUSES.has(status)) approvedValue += value;
    if (RISK_STATUSES.has(status)) atRiskValue += value;

    const origin = dfd.origin_type === "collective" ? "collective" : "individual";
    origins[origin] += 1;

    const month = toMonth(dfd.created_at);
    if (month) {
      const bucket = monthlyMap.get(month) || {
        month,
        dfds: 0,
        value: 0,
        approved: 0,
        concluded: 0,
      };
      bucket.dfds += 1;
      bucket.value += value;
      if (APPROVED_STATUSES.has(status)) bucket.approved += 1;
      if (status === "concluida") bucket.concluded += 1;
      monthlyMap.set(month, bucket);
    }

    const unitId = String(dfd.analysis_unidade_id || dfd.unidade_id || "sem-unidade");
    const unit = unitMap.get(unitId) || {
      id: unitId,
      name: unitNames.get(unitId) || "Sem unidade definida",
      statuses: emptyStatusCounts(),
      total: 0,
      value: 0,
    };
    unit.statuses[status] = (unit.statuses[status] || 0) + 1;
    unit.total += 1;
    unit.value += value;
    unitMap.set(unitId, unit);
  }

  const itemValue = (item: DashboardItemRow) =>
    finite(item.quantidade) * finite(item.valor_unitario_estimado);
  const budgetMap = new Map<string, number>();
  const categoryMap = new Map<
    string,
    {
      name: string;
      value: number;
      items: number;
      codedItems: number;
      natureReviewCount: number;
    }
  >();
  let codedItems = 0;
  let natureReviewCount = 0;

  for (const item of items) {
    if (String(item.codigo_item_efisco || item.codigo_tce || "").trim()) codedItems += 1;
    if (item.requires_natureza_review) natureReviewCount += 1;
    const value = itemValue(item);
    const gnd = String(item.gnd_derivado || item.gnd || "Sem GND").trim() || "Sem GND";
    budgetMap.set(gnd, (budgetMap.get(gnd) || 0) + value);
    const category = String(item.nome_grupo || item.nome_classe || "Outros").trim() || "Outros";
    const current = categoryMap.get(category) || {
      name: category,
      value: 0,
      items: 0,
      codedItems: 0,
      natureReviewCount: 0,
    };
    current.value += value;
    current.items += 1;
    if (String(item.codigo_item_efisco || item.codigo_tce || "").trim()) current.codedItems += 1;
    if (item.requires_natureza_review) current.natureReviewCount += 1;
    categoryMap.set(category, current);
  }

  const logsByDfd = new Map<string, DashboardLogRow[]>();
  for (const log of logs) {
    if (!logsByDfd.has(log.dfd_id)) logsByDfd.set(log.dfd_id, []);
    logsByDfd.get(log.dfd_id)!.push(log);
  }
  const leadTimes = new Map<string, number[]>();
  for (const dfdLogs of logsByDfd.values()) {
    const sorted = [...dfdLogs].sort(
      (a, b) => new Date(String(a.created_at)).getTime() - new Date(String(b.created_at)).getTime(),
    );
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const current = sorted[index];
      const next = sorted[index + 1];
      const start = new Date(String(current.created_at));
      const end = new Date(String(next.created_at));
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) continue;
      const stage = normalizeStatus(current.action);
      const days = Math.max(0, Math.round(((end.getTime() - start.getTime()) / 86_400_000) * 10) / 10);
      if (!leadTimes.has(stage)) leadTimes.set(stage, []);
      leadTimes.get(stage)!.push(days);
    }
  }

  const priorityRows = dfds
    .filter((dfd) => RISK_STATUSES.has(normalizeStatus(dfd.status)))
    .map((dfd) => ({
      id: dfd.id,
      protocol: String(dfd.numero_protocolo || "Sem protocolo"),
      title: String(dfd.objeto_contratacao || "Solicitação sem título"),
      status: normalizeStatus(dfd.status),
      value: finite(dfd.valor_total_estimado),
      ageDays: ageDays(dfd.created_at, now),
      priority: finite(dfd.prioridade) || 3,
      unit: unitNames.get(String(dfd.analysis_unidade_id || dfd.unidade_id || "")) || "Sem unidade",
    }))
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        b.ageDays - a.ageDays ||
        b.value - a.value,
    )
    .slice(0, 8);

  const aging = [
    { label: "0-3 dias", count: 0 },
    { label: "4-7 dias", count: 0 },
    { label: "8-14 dias", count: 0 },
    { label: "15-30 dias", count: 0 },
    { label: "30+ dias", count: 0 },
  ];
  for (const dfd of dfds.filter((row) => RISK_STATUSES.has(normalizeStatus(row.status)))) {
    const age = ageDays(dfd.created_at, now);
    const index = age <= 3 ? 0 : age <= 7 ? 1 : age <= 14 ? 2 : age <= 30 ? 3 : 4;
    aging[index].count += 1;
  }

  return {
    summary: {
      totalDfds: dfds.length,
      plannedValue,
      approvedValue,
      atRiskValue,
      approvalRatePct: percentage(
        statusCounts.aprovada + statusCounts.pactuando + statusCounts.concluida,
        dfds.length,
      ),
      collectiveDfds: origins.collective,
      collectiveRatePct: percentage(origins.collective, dfds.length),
      efiscoCoveragePct: percentage(codedItems, items.length),
      natureReviewCount,
      pending: statusCounts.triagem + statusCounts.devolvida,
      concluded: statusCounts.concluida,
    },
    flow: { origins, statuses: statusCounts },
    monthly: Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
    units: Array.from(unitMap.values()).sort((a, b) => b.total - a.total),
    priorities: priorityRows,
    leadTimeByStage: Array.from(leadTimes.entries())
      .map(([stage, values]) => ({ stage, days: Math.round(median(values) * 10) / 10, samples: values.length }))
      .sort((a, b) => b.days - a.days),
    budgetByGnd: Array.from(budgetMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    topCategories: Array.from(categoryMap.values())
      .map((category) => ({
        ...category,
        coveragePct: percentage(category.codedItems, category.items),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    aging,
  };
}
