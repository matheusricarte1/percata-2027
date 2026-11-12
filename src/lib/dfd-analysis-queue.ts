import {
  analysisTotal,
  describeChanges,
  type AnalysisDfd,
  type AnalysisWorkspaceData,
  type AnalysisEvaluator,
} from "./dfd-analysis";

export const ANALYSIS_QUEUE_PAGE_SIZE = 25;
export const ANALYSIS_QUEUE_FILTERS = [
  "all",
  "pending",
  "changed",
  "removal",
  "starred",
  "collective",
  "high_value",
] as const;
export type AnalysisQueueFilter = (typeof ANALYSIS_QUEUE_FILTERS)[number];

export type AnalysisDfdSummary = Pick<
  AnalysisDfd,
  | "id"
  | "requester"
  | "requesterAvatarUrl"
  | "sector"
  | "numero_protocolo"
  | "objeto_contratacao"
  | "status"
  | "created_at"
  | "valor_total_estimado"
> & {
  requesterId: string;
  requesterEmail?: string | null;
  campus?: string | null;
  chefiaName?: string | null;
  chefiaAvatarUrl?: string | null;
  sectorId: string;
  proposedTotal: number;
  itemCount: number;
  retainedCount: number;
  missingPriority: number;
  missingImpact: number;
  changedCount: number;
  removedCount: number;
  hasDraft: boolean;
  draftUpdatedAt: string | null;
  matchedItemIds: string[];
  items?: AnalysisDfd["items"];
  evaluators?: AnalysisEvaluator[];
  evaluationProgress?: boolean;
};

export type AnalysisQueuePerson = {
  id: string;
  name: string;
  email?: string | null;
  campus?: string | null;
  avatarUrl: string | null;
  sectors: string[];
  dfds: AnalysisDfdSummary[];
};

export type AnalysisQueueTotals = {
  items: number;
  retainedItems: number;
  missingPriority: number;
  missingImpact: number;
  changedItems: number;
  removedItems: number;
  proposedTotal: number;
  starredItems?: number;
  collectiveDfds?: number;
  highValueItems?: number;
};

export type AnalysisQueueData = Pick<
  AnalysisWorkspaceData,
  "actorId" | "role" | "calendar"
> & {
  page: number;
  pageSize: typeof ANALYSIS_QUEUE_PAGE_SIZE;
  totalPeople: number;
  totalDfds: number;
  totals: AnalysisQueueTotals;
  people: AnalysisQueuePerson[];
  groups?: AnalysisGroupProgress[];
};
export type AnalysisGroupProgress = {
  key: string; unitId: string; unitType: string; name: string; campus: string;
  total: number; sent: number; ready: number; pending: number; items: number;
  missingFields: number; pendingItems?: number; evaluatedItems?: number; readyIds: string[]; percent: number;
  dfds: { id: string; protocol: string; status: string; pendingItems?: number; missingImpact: number; missingPriority: number; retainedCount: number; proposedTotal: number; evaluator?: AnalysisEvaluator | null }[];
};

export type AnalysisDetailData = Pick<
  AnalysisWorkspaceData,
  "actorId" | "role" | "calendar"
> & {
  dfd: AnalysisDfd;
};

/** Search is literal (including %/_); the backend never interprets it as a pattern. */
export function parseAnalysisQueueQuery(params: URLSearchParams) {
  const rawPage = params.get("page") || "1";
  const rawFilter = params.get("filter") || "all";
  const search = (params.get("search") || "").trim();
  if (
    !/^\d+$/.test(rawPage) ||
    Number(rawPage) < 1 ||
    Number(rawPage) > 1_000_000
  )
    throw new Error("Informe uma página válida.");
  if (!(ANALYSIS_QUEUE_FILTERS as readonly string[]).includes(rawFilter))
    throw new Error("Filtro de análise inválido.");
  if (search.length > 200) throw new Error("Use até 200 caracteres na busca.");
  return {
    page: Number(rawPage),
    search,
    filter: rawFilter as AnalysisQueueFilter,
    all: params.get("all") === "true",
  };
}

export function summarizeDfd(
  dfd: AnalysisDfd,
  search = "",
): AnalysisDfdSummary {
  const items = dfd.draft?.payload.items || dfd.items;
  const retained = items.filter((i) => !i.remove);
  const query = search.trim().toLocaleLowerCase("pt-BR");
  return {
    id: dfd.id,
    requester: dfd.requester,
    requesterEmail: dfd.requesterEmail || null,
    requesterAvatarUrl: dfd.requesterAvatarUrl || null,
    campus: dfd.campus || null,
    chefiaName: dfd.chefiaName || null,
    chefiaAvatarUrl: dfd.chefiaAvatarUrl || null,
    evaluators: dfd.evaluators || dfd.evaluations?.map(({ actorId, name, avatarUrl, updatedAt }) => ({ actorId, name, avatarUrl, updatedAt })),
    sector: dfd.sector,
    requesterId: dfd.solicitante_id || `dfd:${dfd.id}`,
    sectorId: dfd.sector,
    numero_protocolo: dfd.numero_protocolo,
    objeto_contratacao: dfd.objeto_contratacao,
    status: dfd.status,
    created_at: dfd.created_at,
    valor_total_estimado: dfd.valor_total_estimado,
    proposedTotal: analysisTotal(items),
    itemCount: items.length,
    retainedCount: retained.length,
    missingPriority: retained.filter((i) => !i.moscow_categoria).length,
    missingImpact: retained.filter((i) => !i.criticidade).length,
    changedCount: items.filter(
      (i) => describeChanges(dfd.items, [i]).length || i.correctionNote?.trim(),
    ).length,
    removedCount: items.filter((i) => i.remove).length,
    hasDraft: !!dfd.draft,
    draftUpdatedAt: dfd.draft?.updated_at || null,
    matchedItemIds: query
      ? items
          .filter((i) =>
            `${i.descricao} ${i.codigo_tce || ""}`
              .toLocaleLowerCase("pt-BR")
              .includes(query),
          )
          .map((i) => i.id)
      : [],
  };
}
/** In-memory adapter for isolated previews and deterministic scale tests. Production uses scoped SQL reads. */
export function queueFromWorkspace(
  data: AnalysisWorkspaceData,
  query: {
    page?: number;
    search?: string;
    filter?: AnalysisQueueFilter;
    all?: boolean;
  } = {},
): AnalysisQueueData {
  const page = query.page || 1,
    search = (query.search || "").trim().toLocaleLowerCase("pt-BR");
  const allDfds = data.dfds
    .filter(
      (d) =>
        d.status === "triagem" || (query.all && data.role === "superadmin"),
    )
    .map((d) => ({
      summary: summarizeDfd(d, search),
      items: d.draft?.payload.items || d.items,
    }));

  const dfds = allDfds.filter(
    ({ summary: d, items }) =>
      (!search ||
        `${d.requester} ${d.sector} ${d.numero_protocolo} ${d.objeto_contratacao}`
          .toLocaleLowerCase("pt-BR")
          .includes(search) ||
        d.matchedItemIds.length > 0) &&
      (!query.filter ||
        query.filter === "all" ||
        (query.filter === "pending" &&
          d.missingImpact + d.missingPriority > 0) ||
        (query.filter === "changed" && d.changedCount > 0) ||
        (query.filter === "removal" && d.removedCount > 0) ||
        (query.filter === "starred" &&
          items.some((i) => i.is_highlight_item)) ||
        (query.filter === "collective" &&
          (d.numero_protocolo.toLowerCase().includes("col") ||
            d.objeto_contratacao.toLowerCase().includes("coletiv"))) ||
        (query.filter === "high_value" &&
          (d.proposedTotal >= 5000 ||
            items.some(
              (i) =>
                Number(i.quantidade || 0) *
                  Number(i.valor_unitario_estimado || 0) >=
                1000,
            )))),
  );
  const people = new Map<string, AnalysisQueuePerson>();
  for (const { summary: d } of dfds) {
    const p = people.get(d.requesterId) || {
      id: d.requesterId,
      name: d.requester,
      email: d.requesterEmail || null,
      campus: d.campus || null,
      avatarUrl: d.requesterAvatarUrl || null,
      sectors: [],
      dfds: [],
    };
    p.dfds.push(d);
    p.sectors = [...new Set([...p.sectors, d.sector])];
    if (d.campus && !p.campus) p.campus = d.campus;
    if (d.requesterEmail && !p.email) p.email = d.requesterEmail;
    people.set(p.id, p);
  }

  // Calculate totals across all eligible DFDs in scope
  const allItems = allDfds.flatMap(({ items }) => items);
  const starredItemsCount = allItems.filter((i) => i.is_highlight_item).length;
  const collectiveDfdsCount = allDfds.filter(
    ({ summary: d }) =>
      d.numero_protocolo.toLowerCase().includes("col") ||
      d.objeto_contratacao.toLowerCase().includes("coletiv"),
  ).length;
  const highValueItemsCount = allItems.filter(
    (i) =>
      Number(i.quantidade || 0) * Number(i.valor_unitario_estimado || 0) >=
      1000,
  ).length;

  return {
    actorId: data.actorId,
    role: data.role,
    calendar: data.calendar,
    page,
    pageSize: 25,
    totalPeople: people.size,
    totalDfds: dfds.length,
    totals: {
      ...dfds.reduce(
        (a, { summary: d }) => ({
          items: a.items + d.itemCount,
          retainedItems: a.retainedItems + d.retainedCount,
          missingPriority: a.missingPriority + d.missingPriority,
          missingImpact: a.missingImpact + d.missingImpact,
          changedItems: a.changedItems + d.changedCount,
          removedItems: a.removedItems + d.removedCount,
          proposedTotal: a.proposedTotal + d.proposedTotal,
        }),
        {
          items: 0,
          retainedItems: 0,
          missingPriority: 0,
          missingImpact: 0,
          changedItems: 0,
          removedItems: 0,
          proposedTotal: 0,
        },
      ),
      starredItems: starredItemsCount,
      collectiveDfds: collectiveDfdsCount,
      highValueItems: highValueItemsCount,
    },
    people: [...people.values()]
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id),
      )
      .slice((page - 1) * 25, page * 25),
  };
}
