import { parseCollectiveDistributionText } from "./collective-dfd";

export type ChefiaSummaryDfd = {
  id: string;
  status?: string | null;
  valor_total_estimado?: number | null;
  previsao_recebimento?: string | null;
};

export type ChefiaSummaryItem = {
  dfd_id?: string | null;
  quantidade?: number | null;
  valor_unitario_estimado?: number | null;
  gnd?: string | null;
  justificativa_item?: string | null;
  criticidade?: string | null;
  moscow_categoria?: string | null;
  is_highlight_item?: boolean | null;
};

const APPROVED_STATUSES = new Set(["aprovada", "pactuando", "concluida"]);

function normalizeStatus(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function itemSubtotal(item: ChefiaSummaryItem) {
  return Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0);
}

function daysBetween(start: Date, end: Date) {
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000);
}

function parseInstitutionalDate(value: string | null | undefined) {
  const raw = String(value || "").trim();
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildPcaGoalMetrics({
  dfds,
  items,
  today = new Date(),
}: {
  dfds: ChefiaSummaryDfd[];
  items: ChefiaSummaryItem[];
  today?: Date;
}) {
  const totalDfds = dfds.length;
  const homologatedCount = dfds.filter((dfd) =>
    APPROVED_STATUSES.has(normalizeStatus(dfd.status)),
  ).length;
  const pendingCount = dfds.filter((dfd) => normalizeStatus(dfd.status) === "triagem").length;
  const progressPercent = totalDfds > 0 ? Math.round((homologatedCount / totalDfds) * 100) : 0;

  const classifiedItems = items.filter((item) => item.criticidade && item.moscow_categoria).length;
  const classifiedPercent = items.length > 0 ? Math.round((classifiedItems / items.length) * 100) : 0;
  const paretoCount = items.filter((item) => item.is_highlight_item).length;

  const futureDeadlines = dfds
    .map((dfd) => {
      return parseInstitutionalDate(dfd.previsao_recebimento);
    })
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());

  const overdueCount = futureDeadlines.filter((date) => daysBetween(today, date) < 0).length;
  const nextDeadline = futureDeadlines.find((date) => daysBetween(today, date) >= 0);
  const daysToNextDeadline = nextDeadline ? daysBetween(today, nextDeadline) : null;
  const deadlineLabel =
    overdueCount > 0
      ? `${overdueCount} prazo(s) vencido(s)`
      : daysToNextDeadline === null
        ? "Sem prazo definido"
        : daysToNextDeadline === 0
          ? "Vence hoje"
          : `${daysToNextDeadline} dia(s)`;

  return {
    totalDfds,
    homologatedCount,
    pendingCount,
    progressPercent,
    classifiedItems,
    classifiedPercent,
    paretoCount,
    deadlineLabel,
  };
}

export function buildSetorSummary({
  dfds,
  items,
}: {
  dfds: ChefiaSummaryDfd[];
  items: ChefiaSummaryItem[];
}) {
  const dfdById = new Map(dfds.map((dfd) => [dfd.id, dfd]));
  const itemTotalsByDfd = new Map<string, number>();
  for (const item of items) {
    const dfdId = String(item.dfd_id || "").trim();
    if (!dfdId) continue;
    itemTotalsByDfd.set(dfdId, (itemTotalsByDfd.get(dfdId) || 0) + itemSubtotal(item));
  }

  const valueByDfd = new Map(
    dfds.map((dfd) => [
      dfd.id,
      Number(dfd.valor_total_estimado || 0) || itemTotalsByDfd.get(dfd.id) || 0,
    ]),
  );

  const triagemTotal = dfds
    .filter((dfd) => normalizeStatus(dfd.status) === "triagem")
    .reduce((acc, dfd) => acc + Number(valueByDfd.get(dfd.id) || 0), 0);
  const homologadoTotal = dfds
    .filter((dfd) => APPROVED_STATUSES.has(normalizeStatus(dfd.status)))
    .reduce((acc, dfd) => acc + Number(valueByDfd.get(dfd.id) || 0), 0);

  const gndMap = new Map<string, number>();
  for (const item of items) {
    const gnd = String(item.gnd || "Sem GND").trim() || "Sem GND";
    gndMap.set(gnd, (gndMap.get(gnd) || 0) + itemSubtotal(item));
  }
  const totalByGnd = Array.from(gndMap.values()).reduce((acc, value) => acc + value, 0);
  const gndMetrics = Array.from(gndMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([gnd, valor]) => ({
      gnd,
      valor,
      percent: totalByGnd > 0 ? Math.round((valor / totalByGnd) * 100) : 0,
    }));

  const participantNames = new Set<string>();
  const collectiveDfdIds = new Set<string>();
  let collectiveItemCount = 0;
  let collectiveQuantity = 0;
  let collectiveValue = 0;

  for (const item of items) {
    const contributors = parseCollectiveDistributionText(item.justificativa_item);
    if (contributors.length === 0) continue;
    collectiveItemCount += 1;
    collectiveQuantity += Number(item.quantidade || 0);
    collectiveValue += itemSubtotal(item);
    const dfdId = String(item.dfd_id || "").trim();
    if (dfdId && dfdById.has(dfdId)) collectiveDfdIds.add(dfdId);
    contributors.forEach((entry) => participantNames.add(entry.name));
  }

  return {
    totalGerenciado: triagemTotal + homologadoTotal,
    triagemTotal,
    homologadoTotal,
    triagemCount: dfds.filter((dfd) => normalizeStatus(dfd.status) === "triagem").length,
    homologadoCount: dfds.filter((dfd) => APPROVED_STATUSES.has(normalizeStatus(dfd.status))).length,
    gndMetrics,
    collective: {
      dfdCount: collectiveDfdIds.size,
      itemCount: collectiveItemCount,
      participantCount: participantNames.size,
      totalQuantity: collectiveQuantity,
      totalValue: collectiveValue,
    },
  };
}
