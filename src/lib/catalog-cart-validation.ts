export type CatalogCartValidationInput = {
  quantidade?: unknown;
  valor_unitario_estimado?: unknown;
  link_referencia?: unknown;
  justificativa_item?: unknown;
};

export const MIN_CATALOG_ITEM_JUSTIFICATION_CHARS = 12;

function isValidHttpReference(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The cart can feed either an individual DFD or a collective contribution.
 * Validate the same required data before either route is enabled.
 */
export function validateCatalogCartItem(item: CatalogCartValidationInput) {
  const quantidade = Number(item.quantidade || 0);
  const valorUnitario = Number(item.valor_unitario_estimado || 0);
  const linkReferencia = String(item.link_referencia || "").trim();
  const justificativa = String(item.justificativa_item || "").trim();
  const issues: string[] = [];

  if (!Number.isFinite(quantidade) || quantidade <= 0) issues.push("Quantidade");
  if (!Number.isFinite(valorUnitario) || valorUnitario <= 0) issues.push("Valor unitário");
  if (!isValidHttpReference(linkReferencia)) issues.push("Referência");
  if (justificativa.length < MIN_CATALOG_ITEM_JUSTIFICATION_CHARS) {
    issues.push("Justificativa");
  }

  return {
    quantidade,
    valorUnitario,
    linkReferencia,
    justificativa,
    hasValidReferenceLink: isValidHttpReference(linkReferencia),
    hasJustificativa: justificativa.length >= MIN_CATALOG_ITEM_JUSTIFICATION_CHARS,
    ready: issues.length === 0,
    issues,
    subtotal: Math.max(0, quantidade) * Math.max(0, valorUnitario),
  };
}
