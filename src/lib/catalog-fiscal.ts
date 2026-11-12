export type CatalogFiscalItem = {
  id?: string | number | null;
  codigo_tce?: string | null;
  codigo_efisco?: string | null;
  descricao?: string | null;
  codigo_natureza_despesa?: string | null;
  codigo_natureza_preferencial?: string | null;
  gnd?: string | null;
  gnd_derivado?: string | null;
  gnd_preferencial?: string | null;
  natureza_count?: string | number | null;
  has_mixed_expense_classes?: boolean | null;
  has_missing_natureza?: boolean | null;
  efisco_item_id?: string | number | null;
  efisco_item_natureza_id?: string | number | null;
};

export type CatalogFiscalIssue =
  | "missing_natureza"
  | "mixed_expense_classes"
  | "requires_natureza_selection"
  | null;

export type ResolvedDfdFiscalFields = {
  codigo_natureza_despesa: string | null;
  gnd: string;
  gnd_derivado: string;
  efisco_item_id: number | null;
  efisco_item_natureza_id: number | null;
  requires_natureza_review: boolean;
};

function normalizeOptionalText(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeNatureza(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

function getNaturezaCount(item: CatalogFiscalItem) {
  const count = Number(item.natureza_count);
  return Number.isFinite(count) ? count : null;
}

export function deriveGndFromNatureza(value: unknown): string | null {
  const natureza = normalizeNatureza(value);
  if (!natureza) return null;
  return `${natureza[0]}.${natureza[1]}.${natureza.slice(2, 4)}.${natureza.slice(
    4,
    6,
  )}`;
}

export function requiresExplicitNaturezaSelection(item: CatalogFiscalItem) {
  const count = getNaturezaCount(item);
  return Boolean(item.has_mixed_expense_classes) || Boolean(count && count > 1);
}

export function getCatalogFiscalIssue(item: CatalogFiscalItem): CatalogFiscalIssue {
  const natureza =
    normalizeNatureza(item.codigo_natureza_despesa) ||
    normalizeNatureza(item.codigo_natureza_preferencial);
  const gnd =
    normalizeOptionalText(item.gnd_derivado) ||
    normalizeOptionalText(item.gnd) ||
    normalizeOptionalText(item.gnd_preferencial) ||
    deriveGndFromNatureza(natureza);
  const count = getNaturezaCount(item);

  if (item.has_missing_natureza || count === 0 || (!natureza && !gnd)) {
    return "missing_natureza";
  }
  if (item.has_mixed_expense_classes) {
    return "mixed_expense_classes";
  }
  if (requiresExplicitNaturezaSelection(item) && !item.efisco_item_natureza_id) {
    return "requires_natureza_selection";
  }
  return null;
}

export function getCatalogFiscalIssueMessage(issue: CatalogFiscalIssue) {
  if (issue === "missing_natureza") {
    return "Este item está sem natureza de despesa e será separado para revisão e saneamento pela equipe.";
  }
  if (issue === "mixed_expense_classes") {
    return "Este item mistura custeio e investimento. Selecione a natureza correta antes de adicioná-lo.";
  }
  if (issue === "requires_natureza_selection") {
    return "Este item possui mais de uma natureza de despesa. Selecione a natureza correta antes de adicioná-lo.";
  }
  return null;
}

export function resolveDfdFiscalFields(
  item: CatalogFiscalItem,
): ResolvedDfdFiscalFields {
  const natureza =
    normalizeNatureza(item.codigo_natureza_despesa) ||
    normalizeNatureza(item.codigo_natureza_preferencial);
  const gnd =
    normalizeOptionalText(item.gnd_derivado) ||
    normalizeOptionalText(item.gnd) ||
    normalizeOptionalText(item.gnd_preferencial) ||
    deriveGndFromNatureza(natureza);
  const issue = getCatalogFiscalIssue(item);
  // Legacy collective rows can already carry the chosen natureza code even when the
  // original natureza-row id was not persisted by the older UI flow.
  const canUseSelectedNatureza =
    (issue === "requires_natureza_selection" || issue === "mixed_expense_classes") &&
    Boolean(natureza && gnd);
  const selectedNaturezaId = normalizeOptionalNumber(item.efisco_item_natureza_id);
  if (issue && issue !== "missing_natureza" && !canUseSelectedNatureza) {
    throw new Error(getCatalogFiscalIssueMessage(issue) || "Item e-Fisco inválido.");
  }

  if (!natureza) {
    return {
      codigo_natureza_despesa: null,
      gnd: "SEM_NATUREZA",
      gnd_derivado: "SEM_NATUREZA",
      efisco_item_id: normalizeOptionalNumber(item.efisco_item_id ?? item.id),
      efisco_item_natureza_id: normalizeOptionalNumber(item.efisco_item_natureza_id),
      requires_natureza_review: true,
    };
  }
  if (!gnd) {
    throw new Error("Item sem GND derivável da natureza de despesa não pode gerar DFD.");
  }

  return {
    codigo_natureza_despesa: natureza,
    gnd,
    gnd_derivado: gnd,
    efisco_item_id: normalizeOptionalNumber(item.efisco_item_id ?? item.id),
    efisco_item_natureza_id: selectedNaturezaId,
    requires_natureza_review: canUseSelectedNatureza && !selectedNaturezaId,
  };
}
