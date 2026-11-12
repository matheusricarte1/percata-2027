import {
  DFD_PLANNING_FIELD_ORDER,
  formatPlanningSubsidiesForText,
  sanitizePlanningSubsidies,
  type DfdPlanningFieldKey,
  type DfdPlanningSubsidies,
} from "./dfd-planning";
import { parseCollectiveDistributionText } from "./collective-dfd";

export type ConsolidadoReportRow = {
  codigo_tce?: string | null;
  descricao?: string | null;
  quantidade_total?: number | null;
  valor_total_estimado?: number | null;
  total_dfds?: number | null;
  total_solicitantes?: number | null;
  destaque_pareto?: boolean | null;
  gnd?: string | null;
};

export type DfdReportRow = {
  id: string;
  numero_protocolo?: string | null;
  objeto_contratacao?: string | null;
  status?: string | null;
  origin_type?: string | null;
  collective_origin_room_id?: string | null;
  collective_origin_room_title?: string | null;
  collective_origin_expense_class?: string | null;
  coautoria_coletiva_relatorio?: string | null;
  campus?: string | null;
  campus_nome?: string | null;
  campus_nome_relatorio?: string | null;
  campus_sigla_relatorio?: string | null;
  unidade_nome?: string | null;
  unidade_nome_relatorio?: string | null;
  solicitante_nome_relatorio?: string | null;
  solicitante_email_relatorio?: string | null;
  valor_total_estimado?: number | null;
  created_at?: string | null;
  planning_subsidies?: DfdPlanningSubsidies | null;
} & Record<string, unknown>;

export type DfdItemReportRow = {
  id: string;
  dfd_id?: string | null;
  codigo_tce?: string | null;
  codigo_item_efisco?: string | null;
  descricao?: string | null;
  quantidade?: number | null;
  valor_unitario_estimado?: number | null;
  gnd?: string | null;
  gnd_derivado?: string | null;
  codigo_natureza_despesa?: string | null;
  local_uso?: string | null;
  justificativa_item?: string | null;
} & Record<string, unknown>;

const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

export const FULL_EXPORT_PREFERRED_HEADERS = [
  "dataset",
  "linha",
  "dfd_id",
  "dfd_numero_protocolo",
  "dfd_objeto_contratacao",
  "dfd_status",
  "dfd_origin_type",
  "dfd_collective_origin_room_title",
  "dfd_collective_origin_expense_class",
  "dfd_coautoria_coletiva_relatorio",
  "dfd_justificativa_contratacao",
  "dfd_justificativa_quantidade",
  "dfd_subsidios_etp_tr",
  "dfd_subsidio_etp_tr_problema_resolver",
  "dfd_subsidio_etp_tr_beneficiarios",
  "dfd_subsidio_etp_tr_resultado_esperado",
  "dfd_subsidio_etp_tr_requisitos_essenciais",
  "dfd_subsidio_etp_tr_cuidados_restricoes",
  "dfd_subsidio_etp_tr_alternativas_consideradas",
  "dfd_subsidio_etp_tr_observacoes_etp_tr",
  "dfd_campus_relatorio",
  "dfd_unidade_relatorio",
  "dfd_solicitante_nome_relatorio",
  "dfd_solicitante_email_relatorio",
  "item_id",
  "item_codigo_tce",
  "item_codigo_item_efisco",
  "item_descricao",
  "item_quantidade",
  "item_unidade_medida",
  "item_valor_unitario_estimado",
  "item_valor_total_estimado",
  "item_gnd",
  "item_gnd_derivado",
  "item_codigo_natureza_despesa",
  "item_local_uso",
  "item_justificativa_item",
  "item_distribuicao_usuarios",
  "item_distribuicao_usuarios_total",
  "item_distribuicao_usuarios_json",
];

const PLANNING_REPORT_FIELD_NAMES: Record<DfdPlanningFieldKey, string> = {
  problem: "problema_resolver",
  beneficiaries: "beneficiarios",
  expectedResult: "resultado_esperado",
  essentialRequirements: "requisitos_essenciais",
  constraints: "cuidados_restricoes",
  consideredAlternatives: "alternativas_consideradas",
  etpTrNotes: "observacoes_etp_tr",
};

export function buildPlanningSubsidyReportFields(
  value: DfdPlanningSubsidies | null | undefined,
  prefix = "",
) {
  const sanitized = sanitizePlanningSubsidies(value);
  const fields: Record<string, unknown> = {
    [`${prefix}subsidios_etp_tr`]: formatPlanningSubsidiesForText(sanitized),
  };

  for (const field of DFD_PLANNING_FIELD_ORDER) {
    fields[`${prefix}subsidio_etp_tr_${PLANNING_REPORT_FIELD_NAMES[field]}`] =
      sanitized[field] || "";
  }

  return protectReportRow(fields);
}

export function buildCollectiveDistributionReportFields(
  item: Pick<DfdItemReportRow, "justificativa_item"> | null | undefined,
  prefix = "item_",
) {
  const distribution = parseCollectiveDistributionText(item?.justificativa_item);
  return protectReportRow({
    [`${prefix}distribuicao_usuarios`]: distribution
      .map((entry) => `${entry.name}: ${entry.quantidade}`)
      .join("; "),
    [`${prefix}distribuicao_usuarios_total`]: distribution.reduce(
      (acc, entry) => acc + Number(entry.quantidade || 0),
      0,
    ),
    [`${prefix}distribuicao_usuarios_json`]:
      distribution.length > 0 ? JSON.stringify(distribution) : "",
  });
}

function flattenExportValue(value: unknown): unknown {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function prefixReportFields(prefix: string, row: Record<string, unknown> | undefined) {
  if (!row) return {};
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [`${prefix}${key}`, flattenExportValue(value)]),
  );
}

export function protectSpreadsheetCell(value: unknown) {
  const text = String(value ?? "");
  if (CSV_FORMULA_PREFIX.test(text)) return `'${text}`;
  return text;
}

function toCsvCell(value: unknown) {
  const safe = protectSpreadsheetCell(value).replace(/"/g, '""');
  return `"${safe}"`;
}

export function buildCsv(rows: Array<Record<string, unknown>>, headers: string[]) {
  const headerLine = headers.map(toCsvCell).join(",");
  const body = rows.map((row) => headers.map((header) => toCsvCell(row[header])).join(","));
  return [headerLine, ...body].join("\n");
}

export function protectReportRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof flattenExportValue(value) === "string"
        ? protectSpreadsheetCell(flattenExportValue(value))
        : flattenExportValue(value),
    ]),
  );
}

export function collectExportHeaders(
  rows: Array<Record<string, unknown>>,
  preferredHeaders: string[] = [],
) {
  const preferred = preferredHeaders.filter((header, index, source) => source.indexOf(header) === index);
  const remaining = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  )
    .filter((key) => !preferred.includes(key))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  return [...preferred.filter((header) => rows.some((row) => header in row)), ...remaining];
}

export function summarizeByKey<T>(
  rows: T[],
  getKey: (row: T) => string,
  getValue: (row: T) => number,
) {
  const map = new Map<string, { chave: string; quantidade: number; valor: number }>();
  for (const row of rows) {
    const key = getKey(row) || "Não informado";
    const current = map.get(key) || { chave: key, quantidade: 0, valor: 0 };
    current.quantidade += 1;
    current.valor += getValue(row);
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
}

export function buildDfdSheetRows(dfds: DfdReportRow[]) {
  return dfds.map((dfd) => ({
    ...protectReportRow(dfd),
    protocolo_relatorio: dfd.numero_protocolo || dfd.id,
    objeto_relatorio: protectSpreadsheetCell(dfd.objeto_contratacao || ""),
    campus_relatorio: dfd.campus_nome_relatorio || dfd.campus_nome || dfd.campus || "",
    unidade_relatorio: dfd.unidade_nome_relatorio || dfd.unidade_nome || "",
    valor_total_estimado_relatorio: Number(dfd.valor_total_estimado || 0),
    criada_em_relatorio: dfd.created_at || "",
    ...buildPlanningSubsidyReportFields(dfd.planning_subsidies),
  }));
}

export function buildItemSheetRows(items: DfdItemReportRow[], dfds: DfdReportRow[]) {
  const dfdById = new Map(dfds.map((dfd) => [dfd.id, dfd]));
  return items.map((item) => {
    const dfd = dfdById.get(String(item.dfd_id || ""));
    const quantity = Number(item.quantidade || 0);
    const unitValue = Number(item.valor_unitario_estimado || 0);
    const distributionFields = buildCollectiveDistributionReportFields(item, "");
    return {
      ...protectReportRow(item),
      protocolo_relatorio: dfd?.numero_protocolo || item.dfd_id || "",
      dfd_objeto_relatorio: protectSpreadsheetCell(dfd?.objeto_contratacao || ""),
      dfd_status_relatorio: dfd?.status || "",
      campus_relatorio: dfd?.campus_nome_relatorio || dfd?.campus_nome || dfd?.campus || "",
      unidade_relatorio: dfd?.unidade_nome_relatorio || dfd?.unidade_nome || "",
      codigo_tce_relatorio: item.codigo_tce || "",
      codigo_efisco_relatorio: item.codigo_item_efisco || "",
      descricao_relatorio: protectSpreadsheetCell(item.descricao || ""),
      quantidade_relatorio: quantity,
      valor_unitario_estimado_relatorio: unitValue,
      valor_total_estimado_relatorio: quantity * unitValue,
      gnd_derivado_relatorio: item.gnd_derivado || "",
      codigo_natureza_despesa_relatorio: item.codigo_natureza_despesa || "",
      justificativa_item_relatorio: item.justificativa_item || "",
      distribuicao_usuarios_relatorio: distributionFields.distribuicao_usuarios || "",
      distribuicao_usuarios_total_relatorio: distributionFields.distribuicao_usuarios_total || 0,
      distribuicao_usuarios_json_relatorio: distributionFields.distribuicao_usuarios_json || "",
    };
  });
}

export function buildDfdItemDetailRows(items: DfdItemReportRow[], dfds: DfdReportRow[]) {
  const dfdById = new Map(dfds.map((dfd) => [dfd.id, dfd]));
  const seenDfdIds = new Set<string>();

  const itemRows = items.map((item, index) => {
    const dfd = dfdById.get(String(item.dfd_id || ""));
    if (dfd?.id) seenDfdIds.add(dfd.id);
    const quantity = Number(item.quantidade || 0);
    const unitValue = Number(item.valor_unitario_estimado || 0);

    return protectReportRow({
      dataset: "item_dfd",
      linha: index + 1,
      ...prefixReportFields("dfd_", dfd),
      dfd_id: dfd?.id || item.dfd_id || "",
      dfd_numero_protocolo: dfd?.numero_protocolo || "",
      dfd_objeto_contratacao: dfd?.objeto_contratacao || "",
      dfd_status: dfd?.status || "",
      dfd_campus_relatorio: dfd?.campus_nome_relatorio || dfd?.campus_nome || dfd?.campus || "",
      dfd_unidade_relatorio: dfd?.unidade_nome_relatorio || dfd?.unidade_nome || "",
      dfd_solicitante_nome_relatorio: dfd?.solicitante_nome_relatorio || "",
      dfd_solicitante_email_relatorio: dfd?.solicitante_email_relatorio || "",
      ...buildPlanningSubsidyReportFields(dfd?.planning_subsidies, "dfd_"),
      ...prefixReportFields("item_", item),
      item_id: item.id || "",
      item_codigo_tce: item.codigo_tce || "",
      item_codigo_item_efisco: item.codigo_item_efisco || "",
      item_descricao: item.descricao || "",
      item_quantidade: quantity,
      item_valor_unitario_estimado: unitValue,
      item_valor_total_estimado: quantity * unitValue,
      item_gnd: item.gnd || "",
      item_gnd_derivado: item.gnd_derivado || "",
      item_codigo_natureza_despesa: item.codigo_natureza_despesa || "",
      item_local_uso: item.local_uso || "",
      item_justificativa_item: item.justificativa_item || "",
      ...buildCollectiveDistributionReportFields(item),
    });
  });

  const emptyDfdRows = dfds
    .filter((dfd) => !seenDfdIds.has(dfd.id))
    .map((dfd, index) =>
      protectReportRow({
        dataset: "dfd_sem_item",
        linha: itemRows.length + index + 1,
        ...prefixReportFields("dfd_", dfd),
        dfd_id: dfd.id,
        dfd_numero_protocolo: dfd.numero_protocolo || "",
        dfd_objeto_contratacao: dfd.objeto_contratacao || "",
        dfd_status: dfd.status || "",
        dfd_campus_relatorio: dfd.campus_nome_relatorio || dfd.campus_nome || dfd.campus || "",
        dfd_unidade_relatorio: dfd.unidade_nome_relatorio || dfd.unidade_nome || "",
        dfd_solicitante_nome_relatorio: dfd.solicitante_nome_relatorio || "",
        dfd_solicitante_email_relatorio: dfd.solicitante_email_relatorio || "",
        ...buildPlanningSubsidyReportFields(dfd.planning_subsidies, "dfd_"),
      }),
    );

  return [...itemRows, ...emptyDfdRows];
}
