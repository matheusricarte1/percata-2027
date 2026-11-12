export const PRIORITIES = [
  ["deve_ter", "Essencial"],
  ["deveria_ter", "Relevante"],
  ["poderia_ter", "Oportuno"],
  ["nao_tera_agora", "Postergado"],
] as const;
export const IMPACTS = [
  ["critica", "Crítico"],
  ["alta", "Alto"],
  ["media", "Médio"],
  ["baixa", "Baixo"],
] as const;
export const IMPACT_STEPS = ["baixa", "media", "alta", "critica"] as const;
export const PRIORITY_STEPS = [
  "nao_tera_agora",
  "poderia_ter",
  "deveria_ter",
  "deve_ter",
] as const;

export type AnalysisItem = {
  id: string;
  descricao: string;
  quantidade: number;
  valor_unitario_estimado: number;
  criticidade: string | null;
  moscow_categoria: string | null;
  is_highlight_item: boolean;
  codigo_tce?: string;
  unidade_medida?: string;
  justificativa_quantidade?: string | null;
  justificativa_item?: string | null;
  local_uso?: string | null;
  link_referencia?: string | null;
  remove?: boolean;
  removalReason?: string;
  correctionNote?: string;
  analysis_default_score?: number | null;
};
export type AnalysisDraft = {
  revision: number;
  base_revision: string;
  updated_at: string;
  payload: { items: AnalysisItem[]; reason?: string };
};
export type AnalysisEvaluator = {
  actorId: string;
  name: string;
  avatarUrl: string | null;
  updatedAt: string;
};
export type AnalysisEvaluation = AnalysisEvaluator & {
  baseRevision: string;
  items: AnalysisItem[];
};
export type AnalysisDfd = {
  id: string;
  numero_protocolo: string;
  objeto_contratacao: string;
  justificativa_contratacao: string;
  justificativa_quantidade?: string | null;
  status: string;
  requester: string;
  solicitante_id?: string;
  requesterEmail?: string | null;
  requesterAvatarUrl?: string | null;
  campus?: string | null;
  chefiaName?: string | null;
  chefiaAvatarUrl?: string | null;
  sector: string;
  created_at: string;
  valor_total_estimado: number;
  revision: string;
  items: AnalysisItem[];
  draft: AnalysisDraft | null;
  evaluations?: AnalysisEvaluation[];
  referenceEvaluation?: AnalysisEvaluation | null;
  evaluators?: AnalysisEvaluator[];
};
export type AnalysisWorkspaceData = {
  role: string;
  actorId: string;
  calendar: { open: boolean; start: string; end: string } | null;
  dfds: AnalysisDfd[];
};
export const highlightLimit = (count: number) =>
  count > 0 ? Math.max(1, Math.ceil(count * 0.2)) : 0;
export const priorityLabel = (value: string | null) =>
  PRIORITIES.find(([key]) => key === value)?.[1] || "Não definida";
export const prioritySliderLabel = (value: string | null) => {
  if (!value) return "Não definida";
  if (value === "nao_tera_agora") return "Baixa";
  if (value === "poderia_ter") return "Baixa";
  if (value === "deveria_ter") return "Média";
  if (value === "deve_ter") return "Alta";
  return priorityLabel(value);
};
export const impactLabel = (value: string | null) =>
  IMPACTS.find(([key]) => key === value)?.[1] || "Não definido";
export const analysisTotal = (items: AnalysisItem[]) =>
  items
    .filter((i) => !i.remove)
    .reduce(
      (sum, i) =>
        sum +
        Number(i.quantidade || 0) * Number(i.valor_unitario_estimado || 0),
      0,
    );
export function getReviewBlocker(
  items: AnalysisItem[],
  action: "apply" | "approve",
) {
  const retained = items.filter((i) => !i.remove);
  if (!retained.length)
    return "A DFD ficaria sem itens. Devolva a DFD inteira para correção.";
  if (items.some((i) => i.remove && (i.removalReason?.trim().length || 0) < 3))
    return "Informe o motivo de cada retirada (pelo menos 3 caracteres).";
  if (retained.some((i) => !Number.isInteger(i.quantidade) || i.quantidade < 1))
    return "Informe uma quantidade inteira maior que zero em cada item.";
  if (
    retained.filter((i) => i.is_highlight_item).length >
    highlightLimit(retained.length)
  )
    return `Esta DFD permite até ${highlightLimit(retained.length)} item(ns) em destaque.`;
  if (
    action === "approve" &&
    retained.some((i) => !i.criticidade || !i.moscow_categoria)
  )
    return "Defina a prioridade e o impacto dos itens mantidos antes de homologar.";
  return null;
}
export function describeChanges(
  original: AnalysisItem[],
  draft: AnalysisItem[],
) {
  const changes: string[] = [];
  for (const item of draft) {
    const before = original.find((i) => i.id === item.id);
    if (!before) continue;
    const label = `${item.descricao} [${item.codigo_tce || item.id}]`;
    if (item.remove) {
      changes.push(
        `${label}: retirar. Motivo: ${item.removalReason?.trim() || "pendente"}.`,
      );
      continue;
    }
    if (before.quantidade !== item.quantidade)
      changes.push(
        `${label}: quantidade ${before.quantidade} → ${item.quantidade}.`,
      );
    if (before.moscow_categoria !== item.moscow_categoria)
      changes.push(
        `${label}: prioridade ${priorityLabel(before.moscow_categoria)} → ${priorityLabel(item.moscow_categoria)}.`,
      );
    if (before.criticidade !== item.criticidade)
      changes.push(
        `${label}: impacto ${impactLabel(before.criticidade)} → ${impactLabel(item.criticidade)}.`,
      );
    if (Boolean(before.is_highlight_item) !== Boolean(item.is_highlight_item))
      changes.push(
        `${label}: ${item.is_highlight_item ? "incluir em" : "retirar do"} destaque estratégico.`,
      );
    if (
      (before.justificativa_quantidade || "") !==
      (item.justificativa_quantidade || "")
    )
      changes.push(
        `${label}: justificativa da quantidade alterada para “${item.justificativa_quantidade || "não informada"}”.`,
      );
  }
  return changes;
}
const ERRORS: Record<string, [number, string]> = {
  EVALUATION_NOT_READY: [409, "A avaliação ainda tem pendências ou mudou. Atualize o grupo e confira os itens antes de enviar."],
  CORRECTION_IN_PROGRESS: [409, "O solicitante está corrigindo esta DFD. Aguarde o reenvio ou encerre a autorização antes de decidir."],
  DFD_NOT_FOUND: [
    404,
    "Esta DFD foi excluída ou não está mais disponível. Atualize a lista.",
  ],
  ITEM_NOT_FOUND: [
    404,
    "O item não pertence mais a esta DFD. Atualize a lista.",
  ],
  FORBIDDEN: [
    403,
    "Você não é a chefia responsável pela unidade que analisa esta DFD.",
  ],
  STATUS_CHANGED: [
    409,
    "A DFD já mudou de etapa. Atualize a lista para conferir a decisão registrada.",
  ],
  REVISION_CONFLICT: [
    409,
    "A DFD foi alterada por outra pessoa. Seu rascunho foi preservado; atualize e compare antes de continuar.",
  ],
  DRAFT_CONFLICT: [
    409,
    "O rascunho foi salvo em outra aba. Atualize e compare as alterações antes de continuar.",
  ],
  REQUEST_CONFLICT: [
    409,
    "Esta tentativa já foi usada para outra alteração. Atualize antes de tentar novamente.",
  ],
  CALENDAR_CLOSED: [
    409,
    "O período de trabalho da Análise da Chefia foi encerrado.",
  ],
  CALENDAR_HOMOLOGATION_ONLY: [
    409,
    "A fase de homologação já começou. Nesta etapa, a DFD só pode ser homologada.",
  ],
  LAST_ITEM: [
    409,
    "A DFD ficaria sem itens. Use Devolver para correção para tratar a demanda inteira.",
  ],
  REASON_REQUIRED: [
    400,
    "Informe o motivo da retirada ou da devolução (pelo menos 3 caracteres).",
  ],
  INVALID_QUANTITY: [
    400,
    "A quantidade precisa ser um número inteiro maior que zero.",
  ],
  INVALID_PRIORITY: [
    400,
    "Escolha uma prioridade e um impacto entre as opções disponíveis.",
  ],
  PRIORITY_REQUIRED: [
    400,
    "Defina a prioridade e o impacto de cada item mantido antes de homologar.",
  ],
  HIGHLIGHT_LIMIT: [
    409,
    "O destaque estratégico deve respeitar o limite de 20% por DFD, arredondado para cima.",
  ],
  PROTOCOL_MISMATCH: [
    409,
    "Digite exatamente o protocolo da DFD para confirmar a exclusão.",
  ],
  INVALID_ITEMS: [400, "Os itens enviados são inválidos. Atualize a lista."],
  INVALID_ACTION: [400, "Operação inválida."],
};
export function analysisError(code: string) {
  const [status, message] = ERRORS[code] || [
    500,
    "Não foi possível registrar a alteração. Ela não foi confirmada. Tente novamente com o código desta tentativa.",
  ];
  return { status, message };
}
