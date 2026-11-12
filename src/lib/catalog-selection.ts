import { classifyGnd } from "./dfd-gnd";

export type CatalogSelectionLike = {
  id?: unknown;
  codigo_tce?: unknown;
  codigo_efisco?: unknown;
  efiscoCode?: unknown;
  siad?: unknown;
  efisco_item_natureza_id?: unknown;
  codigo_natureza_despesa?: unknown;
  gnd?: unknown;
  gnd_derivado?: unknown;
  has_missing_natureza?: unknown;
};

export type CatalogNaturezaOptionLike = {
  gnd?: string | number | null;
  codigo_natureza_despesa?: string | number | null;
};

function normalizeText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().toLocaleUpperCase("pt-BR");
}

function normalizeDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

export function buildCatalogSelectionKey(item: CatalogSelectionLike): string | null {
  const code = normalizeText(
    item.codigo_tce ?? item.codigo_efisco ?? item.efiscoCode ?? item.siad ?? item.id,
  );
  if (!code) return null;

  const naturezaId = normalizeText(item.efisco_item_natureza_id);
  if (naturezaId) return `${code}::natureza-id:${naturezaId}`;

  const natureza = normalizeDigits(item.codigo_natureza_despesa);
  if (natureza) return `${code}::natureza:${natureza}`;

  const gnd = normalizeDigits(item.gnd ?? item.gnd_derivado);
  if (gnd) return `${code}::gnd:${gnd}`;

  if (item.has_missing_natureza) return `${code}::sem-natureza`;

  return `${code}::sem-variante`;
}

export function selectNaturezaOptionByExpenseClass<T extends CatalogNaturezaOptionLike>(
  options: T[],
  selectedExpenseClass: "custeio" | "investimento",
): T | null {
  return (
    options.find((option) => {
      const classification = classifyGnd(option.gnd ?? option.codigo_natureza_despesa);
      return classification?.expenseClass === selectedExpenseClass;
    }) || null
  );
}
