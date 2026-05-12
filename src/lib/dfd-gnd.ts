export type GndExpenseClass = "custeio" | "investimento" | "outro";

export type GndClassification = {
  gnd: string;
  expenseClass: GndExpenseClass;
  expenseLabel: string;
  elementCode: string;
  elementLabel: string;
  guidance: string;
};

export type GndSummaryInput = {
  gnd?: string | null;
  codigoNaturezaDespesa?: string | null;
  quantity?: number;
  total?: number;
};

export type DfdExpenseClassKey = "custeio" | "investimento" | "outro" | "sem-gnd";

export type GndSummaryEntry = GndClassification & {
  itemCount: number;
  quantity: number;
  total: number;
};

export type GndDistributionSummary = {
  entries: GndSummaryEntry[];
  totalValue: number;
  hasMixedExpenseClasses: boolean;
  hasMultipleElements: boolean;
  unknownCount: number;
  warnings: string[];
};

const ELEMENT_LABELS: Record<string, { label: string; guidance: string }> = {
  "30": {
    label: "Material de consumo",
    guidance:
      "Justifique consumo previsto, turmas, estoque atual, reposição e recorrência.",
  },
  "39": {
    label: "Serviço PJ",
    guidance:
      "Justifique escopo, periodicidade, unidade atendida e resultado esperado.",
  },
  "52": {
    label: "Equipamento permanente",
    guidance:
      "Justifique patrimônio, vida útil, capacidade instalada e impacto institucional.",
  },
};

export function normalizeGnd(value?: string | number | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length >= 6) {
    return `${digits[0]}.${digits[1]}.${digits.slice(2, 4)}.${digits.slice(4, 6)}`;
  }
  return null;
}

export function classifyGnd(value?: string | number | null): GndClassification | null {
  const gnd = normalizeGnd(value);
  if (!gnd) return null;

  const digits = gnd.replace(/\D/g, "");
  const expenseClass =
    digits[0] === "3" ? "custeio" : digits[0] === "4" ? "investimento" : "outro";
  const expenseLabel =
    expenseClass === "custeio"
      ? "Custeio"
      : expenseClass === "investimento"
        ? "Investimento"
        : "Outra natureza";
  const elementCode = digits.slice(4, 6);
  const element = ELEMENT_LABELS[elementCode] || {
    label: `Elemento ${elementCode}`,
    guidance:
      "Revise a natureza da despesa e complemente a justificativa técnica do item.",
  };

  return {
    gnd,
    expenseClass,
    expenseLabel,
    elementCode,
    elementLabel: element.label,
    guidance: element.guidance,
  };
}

export function getItemExpenseClassKey(item: GndSummaryInput): DfdExpenseClassKey {
  const classification = classifyGnd(item.gnd || item.codigoNaturezaDespesa);
  return classification?.expenseClass || "sem-gnd";
}

export function getExpenseClassGroupingLabel(expenseClass: DfdExpenseClassKey) {
  if (expenseClass === "custeio") return "Custeio";
  if (expenseClass === "investimento") return "Capital";
  if (expenseClass === "outro") return "Outra natureza";
  return "GND não identificado";
}

export function getDfdExpenseClassViolation(items: GndSummaryInput[]) {
  const classes = new Set(
    items
      .map((item) => getItemExpenseClassKey(item))
      .filter((value) => value === "custeio" || value === "investimento"),
  );

  if (classes.size <= 1) return null;

  return "A DFD não pode misturar custeio e capital. Separe os itens em DFDs distintas por natureza da despesa.";
}

export function summarizeGndDistribution(
  items: GndSummaryInput[],
): GndDistributionSummary {
  const entries = new Map<string, GndSummaryEntry>();
  let unknownCount = 0;

  for (const item of items) {
    const classification = classifyGnd(item.gnd || item.codigoNaturezaDespesa);
    if (!classification) {
      unknownCount += 1;
      continue;
    }

    const current = entries.get(classification.gnd) || {
      ...classification,
      itemCount: 0,
      quantity: 0,
      total: 0,
    };
    current.itemCount += 1;
    current.quantity += Number(item.quantity || 0);
    current.total += Number(item.total || 0);
    entries.set(classification.gnd, current);
  }

  const sortedEntries = Array.from(entries.values()).sort((a, b) =>
    a.gnd.localeCompare(b.gnd),
  );
  const expenseClasses = new Set(
    sortedEntries.map((entry) => entry.expenseClass).filter((value) => value !== "outro"),
  );
  const elementCodes = new Set(sortedEntries.map((entry) => entry.elementCode));
  const hasMixedExpenseClasses = expenseClasses.size > 1;
  const hasMultipleElements = elementCodes.size > 1;
  const totalValue = sortedEntries.reduce((sum, entry) => sum + entry.total, 0);
  const warnings: string[] = [];

  if (hasMixedExpenseClasses) {
    warnings.push(
      "Esta DFD mistura custeio e capital. Separe os itens em DFDs distintas.",
    );
  } else if (hasMultipleElements) {
    warnings.push(
      "Esta DFD reúne elementos de despesa diferentes. Revise se a justificativa cobre todos os usos.",
    );
  }
  if (unknownCount > 0) {
    warnings.push(
      `${unknownCount} item(ns) sem GND identificado. Revise a natureza da despesa antes do envio.`,
    );
  }

  return {
    entries: sortedEntries,
    totalValue,
    hasMixedExpenseClasses,
    hasMultipleElements,
    unknownCount,
    warnings,
  };
}
