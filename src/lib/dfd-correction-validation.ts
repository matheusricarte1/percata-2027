export type CorrectionValidationItem = {
  remove?: boolean; removalReason?: string; quantidade: number; valor_unitario_estimado: number;
  catalogId?: string; naturezaCode?: string; justificativa_quantidade?: string; link_referencia?: string;
};
export function getCorrectionIssue(input: { object: string; justification: string; reason: string; administrative: boolean; collective: boolean; items: CorrectionValidationItem[] }) {
  const issue = (field: string, message: string) => ({ field, message });
  if (!input.collective && !input.items.some(item => !item.remove)) return issue("correction-catalog", "A DFD precisa ter pelo menos um item. Adicione ou restaure um item para continuar.");
  for (const [index, item] of input.items.entries()) {
    if (item.remove) { if ((item.removalReason?.trim().length || 0) < 3) return issue(`correction-removal-${index}`, "Explique por que este item será retirado, com pelo menos 3 caracteres."); continue; }
    if (!Number.isInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 2147483647) return issue(`correction-quantity-${index}`, "Informe uma quantidade inteira maior que zero.");
    if (!Number.isFinite(item.valor_unitario_estimado) || item.valor_unitario_estimado <= 0 || item.valor_unitario_estimado > 1e12) return issue(`correction-price-${index}`, "Informe um valor unitário maior que zero e dentro do limite permitido.");
    if (input.administrative && item.catalogId && !item.naturezaCode) return issue(`correction-nature-${index}`, "Escolha a natureza da despesa para o código selecionado.");
    if (!input.administrative && (item.justificativa_quantidade?.trim().length || 0) < 3) return issue(`correction-basis-${index}`, "Explique a quantidade necessária, com pelo menos 3 caracteres.");
    if (item.link_referencia) { try { if (!["http:", "https:"].includes(new URL(item.link_referencia).protocol)) throw new Error(); } catch { return issue(`correction-link-${index}`, "Informe um link de referência válido, começando com http ou https."); } }
  }
  if (input.object.trim().length < 3) return issue("correction-object", "Preencha o objeto da contratação, com pelo menos 3 caracteres.");
  if (input.justification.trim().length < 3) return issue("correction-justification", "Preencha a justificativa da contratação, com pelo menos 3 caracteres.");
  if (input.administrative && input.reason.trim().length < 3) return issue("correction-reason", "Explique o motivo para registrar esta correção no histórico, com pelo menos 3 caracteres.");
  return null;
}
