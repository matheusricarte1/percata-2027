export const NATUREZA_REVIEW_STATUSES = [
  "pendente",
  "em_analise",
  "saneado",
  "substituido",
  "bloqueado",
] as const;

export type NaturezaReviewStatus = (typeof NATUREZA_REVIEW_STATUSES)[number];

export type NaturezaReviewDecisionInput = {
  status?: unknown;
  efisco_item_id?: unknown;
  dfd_item_id?: unknown;
  codigo_natureza_despesa?: unknown;
  replacement_efisco_item_id?: unknown;
  justificativa?: unknown;
};

export type NormalizedNaturezaReviewDecision = {
  status: NaturezaReviewStatus;
  efisco_item_id: number;
  dfd_item_id: string | null;
  codigo_natureza_despesa: string | null;
  replacement_efisco_item_id: number | null;
  justificativa: string;
};

export type NaturezaReviewSummary = {
  total: number;
  open: number;
  closed: number;
  byStatus: Record<NaturezaReviewStatus, number>;
};

export type NaturezaReviewCsvRow = {
  codigo_efisco?: unknown;
  descricao?: unknown;
  numero_protocolo?: unknown;
  status?: unknown;
  codigo_natureza_despesa?: unknown;
  justificativa?: unknown;
};

const CLOSED_STATUSES = new Set<NaturezaReviewStatus>([
  "saneado",
  "substituido",
  "bloqueado",
]);

function normalizePositiveInteger(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} invalido.`);
  }
  return parsed;
}

function normalizeOptionalPositiveInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeOptionalUuid(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    text,
  )
    ? text
    : null;
}

function normalizeNatureza(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

function normalizeText(value: unknown, maxLength = 2000) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function normalizeNaturezaReviewStatus(
  value: unknown,
): NaturezaReviewStatus {
  const normalized = String(value || "pendente")
    .trim()
    .toLowerCase();
  if (NATUREZA_REVIEW_STATUSES.includes(normalized as NaturezaReviewStatus)) {
    return normalized as NaturezaReviewStatus;
  }
  throw new Error("Status de saneamento invalido.");
}

export function normalizeNaturezaReviewDecision(
  input: NaturezaReviewDecisionInput,
): NormalizedNaturezaReviewDecision {
  const status = normalizeNaturezaReviewStatus(input.status);
  const codigoNatureza = normalizeNatureza(input.codigo_natureza_despesa);
  const replacement = normalizeOptionalPositiveInteger(
    input.replacement_efisco_item_id,
  );

  if (status === "saneado" && !codigoNatureza) {
    throw new Error("Informe a natureza oficial para marcar como saneado.");
  }
  if (status === "substituido" && !replacement) {
    throw new Error("Informe o item e-Fisco substituto.");
  }

  return {
    status,
    efisco_item_id: normalizePositiveInteger(
      input.efisco_item_id,
      "efisco_item_id",
    ),
    dfd_item_id: normalizeOptionalUuid(input.dfd_item_id),
    codigo_natureza_despesa: codigoNatureza,
    replacement_efisco_item_id: replacement,
    justificativa: normalizeText(input.justificativa),
  };
}

export function summarizeNaturezaReviewQueue(
  rows: Array<{ status?: unknown }>,
): NaturezaReviewSummary {
  const byStatus = Object.fromEntries(
    NATUREZA_REVIEW_STATUSES.map((status) => [status, 0]),
  ) as Record<NaturezaReviewStatus, number>;

  for (const row of rows) {
    const status = normalizeNaturezaReviewStatus(row.status);
    byStatus[status] += 1;
  }

  const total = rows.length;
  const closed = NATUREZA_REVIEW_STATUSES.filter((status) =>
    CLOSED_STATUSES.has(status),
  ).reduce((sum, status) => sum + byStatus[status], 0);

  return {
    total,
    open: total - closed,
    closed,
    byStatus,
  };
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function buildNaturezaReviewCsv(rows: NaturezaReviewCsvRow[]) {
  const header = [
    "codigo_efisco",
    "descricao",
    "numero_protocolo",
    "status",
    "codigo_natureza_despesa",
    "justificativa",
  ];

  return [
    header.join(";"),
    ...rows.map((row) =>
      header
        .map((key) => csvEscape((row as Record<string, unknown>)[key]))
        .join(";"),
    ),
  ].join("\n");
}
