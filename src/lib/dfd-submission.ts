const WORKFLOW_STATUSES_REQUIRING_ITEMS = new Set([
  "triagem",
  "aprovada",
  "pactuando",
  "concluida",
]);

export function normalizeDfdStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function requiresItemsForDfdWorkflow(status: unknown) {
  return WORKFLOW_STATUSES_REQUIRING_ITEMS.has(normalizeDfdStatus(status));
}

export function getDfdSubmissionBlocker({
  targetStatus,
  itemCount,
}: {
  targetStatus: unknown;
  itemCount: unknown;
}) {
  const count = Number(itemCount || 0);
  if (requiresItemsForDfdWorkflow(targetStatus) && (!Number.isFinite(count) || count < 1)) {
    return "Inclua pelo menos um item antes de enviar a DFD para análise. A chefia precisa dos itens para avaliar quantidade, valor e natureza da demanda.";
  }
  return null;
}
