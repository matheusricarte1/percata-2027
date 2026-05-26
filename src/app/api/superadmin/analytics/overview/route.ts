import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import {
  buildMonthSeries,
  detectPriceOutliers,
  linearRegression,
  normalizeCurrency,
  toYearMonth,
  type PriceObservation,
  type RegressionSummary,
} from "@/lib/superadmin-analytics";

const ELIGIBLE_STATUSES = ["aprovada", "pactuando", "concluida", "homologada"];

type DfdRow = {
  id: string;
  numero_protocolo: string | null;
  status: string | null;
  created_at: string | null;
  valor_total_estimado: number | null;
  source?: "current" | "legacy";
};

type ItemRow = {
  id: string;
  dfd_id: string;
  codigo_tce?: string | null;
  codigo_item_efisco?: string | null;
  descricao?: string | null;
  quantidade?: number | null;
  valor_unitario_estimado?: number | null;
  source?: "current" | "legacy";
};

type LegacyDemandRow = {
  legacy_year: number | null;
  demand_code: string | null;
  submission_at: string | null;
  delivery_forecast: string | null;
  status: string | null;
  total_estimated: number | null;
};

type LegacyItemRow = {
  id: string;
  legacy_year: number | null;
  demand_code: string | null;
  efisco_code: string | null;
  efisco_description: string | null;
  quantity_numeric: number | null;
  quantity_text: string | null;
  item_price: number | null;
};

type LegacyDemandRef = {
  unifiedId: string;
  legacyYear: number;
  demandCode: string;
};

type SegmentInsight = {
  level: "info" | "warning" | "critical";
  title: string;
  detail: string;
};

type SegmentGuide = {
  title: string;
  action: string;
};

type SegmentMonthlyPoint = {
  month: string;
  dfd_count: number;
  total_quantity: number;
  total_value: number;
};

type SegmentCodePoint = {
  codigoEfisco: string;
  descricao: string;
  observations: number;
  activeMonths: number;
  totalQuantity: number;
  withPriceObservations: number;
};

type IntermittencyClass = "smooth" | "intermittent" | "erratic" | "lumpy" | "insufficient";

type SegmentDeepSeriesStats = {
  mean: number;
  std_dev: number;
  cv: number;
  median: number;
  mad: number;
  iqr: number;
  skewness: number;
  theil_sen_slope: number;
  mann_kendall_s: number;
  mann_kendall_z: number;
  mann_kendall_p_value: number;
  mann_kendall_trend: "up" | "down" | "flat";
  hhi: number;
  effective_periods: number;
  top1_share_pct: number;
};

type SegmentIntermittencyStats = {
  series_count: number;
  class_distribution: Record<IntermittencyClass, number>;
  median_adi: number;
  median_cv2: number;
  top_lumpy: Array<{
    codigoEfisco: string;
    adi: number;
    cv2: number;
    observations: number;
  }>;
};

type SegmentAnalytics = {
  segment: "legacy" | "current" | "combined";
  scope: {
    price_signals_enabled: boolean;
  };
  dataset: {
    dfds: number;
    items: number;
    unique_codes: number;
    months_covered: number;
    code_coverage_pct: number;
    quantity_coverage_pct: number;
    price_coverage_pct: number;
    repeated_codes: number;
    peak_month: string;
    peak_month_dfd_count: number;
    month_concentration_pct: number;
  };
  regression: {
    dfd_volume: RegressionSummary;
    total_quantity: RegressionSummary;
    total_value: RegressionSummary;
  };
  statistics: {
    dfd_series: SegmentDeepSeriesStats;
    quantity_series: SegmentDeepSeriesStats;
    value_series: SegmentDeepSeriesStats;
    intermittency: SegmentIntermittencyStats;
  };
  charts: {
    monthly: SegmentMonthlyPoint[];
    top_codes_by_quantity: SegmentCodePoint[];
    top_codes_by_frequency: SegmentCodePoint[];
  };
  insights: SegmentInsight[];
  guides: SegmentGuide[];
};

type ForecastRow = {
  codigoEfisco: string;
  descricao: string;
  observations: number;
  sampleMonths: number;
  latestMonth: string;
  latestQuantity: number;
  averageLast3Months: number;
  predictedNextQuantity: number;
  slope: number;
  r2: number;
  trend: "up" | "down" | "flat" | "insufficient_data";
  confidence: "high" | "medium" | "low";
};

type PriceVolatilitySignal = {
  codigoEfisco: string;
  descricao: string;
  observations: number;
  latestPrice: number;
  meanPrice: number;
  cvPct: number;
  maxDeviationPct: number;
};

function parseWindowMonths(raw: string | null) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 18;
  return Math.max(6, Math.min(60, Math.trunc(parsed)));
}

function parseIncludeLegacy(raw: string | null) {
  if (raw == null) return true;
  const normalized = String(raw).trim().toLowerCase();
  return !["0", "false", "off", "nao", "não"].includes(normalized);
}

function monthFloor(date: Date) {
  const next = new Date(date);
  next.setUTCDate(1);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function shiftMonths(date: Date, offset: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + offset);
  return next;
}

function monthToDate(month: string) {
  const [yearText, monthText] = String(month || "").split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return null;
  if (year < 1900 || monthIndex < 0 || monthIndex > 11) return null;
  return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
}

function buildContiguousMonths(months: string[]) {
  if (months.length === 0) return [] as string[];
  const sorted = [...months].sort((a, b) => a.localeCompare(b));
  const start = monthToDate(sorted[0]);
  const end = monthToDate(sorted[sorted.length - 1]);
  if (!start || !end) return sorted;

  const values: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    values.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return values;
}

function resolveCodigoEfisco(item: ItemRow) {
  return String(item.codigo_tce || item.codigo_item_efisco || "").trim();
}

function buildLegacyKey(legacyYear: number, demandCode: string) {
  return `legacy:${legacyYear}:${demandCode}`;
}

function parsePositiveNumber(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const hasDot = raw.includes(".");
  const hasComma = raw.includes(",");
  const normalized = hasDot && hasComma
    ? raw.replace(/\./g, "").replace(",", ".")
    : hasComma
      ? raw.replace(",", ".")
      : raw;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function normalizeLegacyCreatedAt(row: LegacyDemandRow) {
  const primary = String(row.submission_at || "").trim();
  if (primary && Number.isFinite(new Date(primary).getTime())) return primary;
  const fallback = String(row.delivery_forecast || "").trim();
  if (fallback && Number.isFinite(new Date(fallback).getTime())) return fallback;
  const year = Number(row.legacy_year || 0);
  if (Number.isFinite(year) && year >= 2000 && year <= 2100) {
    return `${year}-01-01T00:00:00.000Z`;
  }
  return null;
}

function percentage(part: number, total: number) {
  if (total <= 0) return 0;
  return normalizeCurrency((part / total) * 100);
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function sampleStdDev(values: number[], avg: number) {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((acc, value) => acc + Math.pow(value - avg, 2), 0) /
    (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function quantile(values: number[], q: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const clampedQ = Math.max(0, Math.min(1, q));
  const index = (sorted.length - 1) * clampedQ;
  const base = Math.floor(index);
  const rest = index - base;
  const left = sorted[base];
  const right = sorted[Math.min(base + 1, sorted.length - 1)];
  return left + rest * (right - left);
}

function mad(values: number[]) {
  if (values.length === 0) return 0;
  const med = median(values);
  const deviations = values.map((value) => Math.abs(value - med));
  return median(deviations);
}

function skewness(values: number[]) {
  if (values.length < 3) return 0;
  const avg = mean(values);
  const sd = sampleStdDev(values, avg);
  if (sd <= 0) return 0;
  const n = values.length;
  const m3 =
    values.reduce((acc, value) => acc + Math.pow((value - avg) / sd, 3), 0) / n;
  return Number.isFinite(m3) ? m3 : 0;
}

function erf(value: number) {
  const sign = value >= 0 ? 1 : -1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
  return sign * y;
}

function normalCdf(value: number) {
  return 0.5 * (1 + erf(value / Math.sqrt(2)));
}

function theilSenSlope(values: number[]) {
  if (values.length < 2) return 0;
  const slopes: number[] = [];
  for (let i = 0; i < values.length - 1; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      slopes.push((values[j] - values[i]) / (j - i));
    }
  }
  return median(slopes);
}

function mannKendall(values: number[]): {
  s: number;
  z: number;
  pValue: number;
  trend: "up" | "down" | "flat";
} {
  const n = values.length;
  if (n < 3) {
    return { s: 0, z: 0, pValue: 1, trend: "flat" as const };
  }

  let s = 0;
  for (let i = 0; i < n - 1; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (values[j] > values[i]) s += 1;
      else if (values[j] < values[i]) s -= 1;
    }
  }

  const tieMap = new Map<number, number>();
  for (const value of values) {
    tieMap.set(value, (tieMap.get(value) || 0) + 1);
  }

  const tieCorrection = Array.from(tieMap.values())
    .filter((count) => count > 1)
    .reduce((acc, count) => acc + count * (count - 1) * (2 * count + 5), 0);

  const varianceS = (n * (n - 1) * (2 * n + 5) - tieCorrection) / 18;
  if (varianceS <= 0) {
    return { s, z: 0, pValue: 1, trend: "flat" as const };
  }

  const stdS = Math.sqrt(varianceS);
  let z = 0;
  if (s > 0) z = (s - 1) / stdS;
  else if (s < 0) z = (s + 1) / stdS;

  const pValue = Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))));
  const trend: "up" | "down" | "flat" =
    pValue < 0.05 ? (z > 0 ? "up" : "down") : "flat";

  return { s, z, pValue, trend };
}

function hhi(values: number[]) {
  const total = values.reduce((acc, value) => acc + Math.max(0, value), 0);
  if (total <= 0) return 0;
  return values.reduce((acc, value) => {
    const share = Math.max(0, value) / total;
    return acc + share * share;
  }, 0);
}

function computeSeriesDeepStats(points: Array<{ x: number; y: number }>): SegmentDeepSeriesStats {
  const values = points.map((point) => Number(point.y || 0));
  const avg = mean(values);
  const std = sampleStdDev(values, avg);
  const cv = avg !== 0 ? std / Math.abs(avg) : 0;
  const med = median(values);
  const iqr = quantile(values, 0.75) - quantile(values, 0.25);
  const mk = mannKendall(values);
  const hhiValue = hhi(values);
  const top1 = values.length > 0 ? Math.max(...values) : 0;
  const top1Share = percentage(top1, values.reduce((acc, value) => acc + Math.max(0, value), 0));

  return {
    mean: normalizeCurrency(avg),
    std_dev: normalizeCurrency(std),
    cv: normalizeCurrency(cv),
    median: normalizeCurrency(med),
    mad: normalizeCurrency(mad(values)),
    iqr: normalizeCurrency(iqr),
    skewness: normalizeCurrency(skewness(values)),
    theil_sen_slope: normalizeCurrency(theilSenSlope(values)),
    mann_kendall_s: mk.s,
    mann_kendall_z: normalizeCurrency(mk.z),
    mann_kendall_p_value: normalizeCurrency(mk.pValue),
    mann_kendall_trend: mk.trend,
    hhi: normalizeCurrency(hhiValue),
    effective_periods: hhiValue > 0 ? normalizeCurrency(1 / hhiValue) : 0,
    top1_share_pct: normalizeCurrency(top1Share),
  };
}

function classifyIntermittency(monthlyQuantities: number[]) {
  const n = monthlyQuantities.length;
  if (n < 2) {
    return { className: "insufficient" as IntermittencyClass, adi: 0, cv2: 0 };
  }

  const nonZero = monthlyQuantities.filter((value) => value > 0);
  if (nonZero.length < 2) {
    return { className: "insufficient" as IntermittencyClass, adi: 0, cv2: 0 };
  }

  const adi = n / nonZero.length;
  const avg = mean(nonZero);
  const std = sampleStdDev(nonZero, avg);
  const cv2 = avg !== 0 ? Math.pow(std / Math.abs(avg), 2) : 0;

  let className: IntermittencyClass;
  if (adi <= 1.32 && cv2 <= 0.49) className = "smooth";
  else if (adi > 1.32 && cv2 <= 0.49) className = "intermittent";
  else if (adi <= 1.32 && cv2 > 0.49) className = "erratic";
  else className = "lumpy";

  return {
    className,
    adi: normalizeCurrency(adi),
    cv2: normalizeCurrency(cv2),
  };
}

async function fetchEligibleDfds(
  admin: NonNullable<Parameters<Parameters<typeof withAuthorizedRole>[1]>[0]["supabaseAdmin"]>,
  sinceIso: string,
) {
  const rows: DfdRow[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from("dfds")
      .select("id,numero_protocolo,status,created_at,valor_total_estimado")
      .in("status", ELIGIBLE_STATUSES)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    const chunk = (data || []) as DfdRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function fetchDfdItems(
  admin: NonNullable<Parameters<Parameters<typeof withAuthorizedRole>[1]>[0]["supabaseAdmin"]>,
  dfdIds: string[],
) {
  if (dfdIds.length === 0) return [] as ItemRow[];

  const rows: ItemRow[] = [];
  for (let index = 0; index < dfdIds.length; index += 120) {
    const chunk = dfdIds.slice(index, index + 120);
    const { data, error } = await admin
      .from("dfd_items")
      .select(
        "id,dfd_id,codigo_tce,codigo_item_efisco,descricao,quantidade,valor_unitario_estimado",
      )
      .in("dfd_id", chunk);

    if (error) throw error;
    rows.push(...((data || []) as ItemRow[]));
  }

  return rows;
}

async function fetchLegacyDfds(
  admin: NonNullable<Parameters<Parameters<typeof withAuthorizedRole>[1]>[0]["supabaseAdmin"]>,
  since: Date,
) {
  const rows: LegacyDemandRow[] = [];
  const pageSize = 1000;
  let offset = 0;
  const sinceYear = since.getUTCFullYear();
  const sinceMonth = toYearMonth(since) || "";

  while (true) {
    const { data, error } = await admin
      .from("legacy_pa_demandas")
      .select(
        "legacy_year,demand_code,submission_at,delivery_forecast,status,total_estimated",
      )
      .gte("legacy_year", sinceYear)
      .order("legacy_year", { ascending: true })
      .order("demand_code", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    const chunk = (data || []) as LegacyDemandRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  const normalizedDfds: DfdRow[] = [];
  const refs: LegacyDemandRef[] = [];

  for (const row of rows) {
    const legacyYear = Number(row.legacy_year || 0);
    const demandCode = String(row.demand_code || "").trim();
    if (!Number.isFinite(legacyYear) || legacyYear <= 0 || !demandCode) continue;

    const createdAt = normalizeLegacyCreatedAt(row);
    if (!createdAt) continue;
    const month = toYearMonth(createdAt);
    if (!month || month.localeCompare(sinceMonth) < 0) continue;

    const unifiedId = buildLegacyKey(legacyYear, demandCode);
    normalizedDfds.push({
      id: unifiedId,
      numero_protocolo: demandCode,
      status: row.status,
      created_at: createdAt,
      valor_total_estimado: Number(row.total_estimated || 0),
      source: "legacy",
    });
    refs.push({
      unifiedId,
      legacyYear,
      demandCode,
    });
  }

  return { dfds: normalizedDfds, refs };
}

async function fetchLegacyItems(
  admin: NonNullable<Parameters<Parameters<typeof withAuthorizedRole>[1]>[0]["supabaseAdmin"]>,
  demandRefs: LegacyDemandRef[],
) {
  if (demandRefs.length === 0) return [] as ItemRow[];

  const keyToUnifiedId = new Map<string, string>();
  const codesByYear = new Map<number, string[]>();

  for (const ref of demandRefs) {
    keyToUnifiedId.set(buildLegacyKey(ref.legacyYear, ref.demandCode), ref.unifiedId);
    if (!codesByYear.has(ref.legacyYear)) codesByYear.set(ref.legacyYear, []);
    codesByYear.get(ref.legacyYear)!.push(ref.demandCode);
  }

  const items: ItemRow[] = [];
  for (const [legacyYear, rawCodes] of codesByYear.entries()) {
    const uniqueCodes = Array.from(new Set(rawCodes));
    for (let index = 0; index < uniqueCodes.length; index += 120) {
      const demandCodeChunk = uniqueCodes.slice(index, index + 120);
      const { data, error } = await admin
        .from("legacy_pa_itens")
        .select(
          "id,legacy_year,demand_code,efisco_code,efisco_description,quantity_numeric,quantity_text,item_price",
        )
        .eq("legacy_year", legacyYear)
        .in("demand_code", demandCodeChunk);

      if (error) throw error;
      const rows = (data || []) as LegacyItemRow[];

      for (const row of rows) {
        const year = Number(row.legacy_year || legacyYear);
        const demandCode = String(row.demand_code || "").trim();
        const unifiedId = keyToUnifiedId.get(buildLegacyKey(year, demandCode));
        if (!unifiedId) continue;

        const quantityNumeric = Number(row.quantity_numeric || 0);
        const quantity =
          Number.isFinite(quantityNumeric) && quantityNumeric > 0
            ? quantityNumeric
            : parsePositiveNumber(row.quantity_text);
        const unitPrice = parsePositiveNumber(row.item_price);

        items.push({
          id: `legacy-item:${row.id}`,
          dfd_id: unifiedId,
          codigo_tce: null,
          codigo_item_efisco: String(row.efisco_code || "").trim() || null,
          descricao: String(row.efisco_description || "").trim() || null,
          quantidade: quantity,
          valor_unitario_estimado: unitPrice,
          source: "legacy",
        });
      }
    }
  }

  return items;
}

function resolveForecastConfidence(sampleMonths: number, r2: number): "high" | "medium" | "low" {
  if (sampleMonths >= 8 && r2 >= 0.5) return "high";
  if (sampleMonths >= 4 && r2 >= 0.2) return "medium";
  return "low";
}

function buildTopForecasts(
  dfds: DfdRow[],
  items: ItemRow[],
  options?: { minSampleMonths?: number; limit?: number },
) {
  const minSampleMonths = Math.max(1, Number(options?.minSampleMonths || 4));
  const limit = Math.max(1, Number(options?.limit || 25));
  const dfdMonthById = new Map<string, string>();
  for (const dfd of dfds) {
    const month = toYearMonth(String(dfd.created_at || ""));
    if (!month) continue;
    dfdMonthById.set(String(dfd.id), month);
  }

  const byCode = new Map<
    string,
    {
      descricao: string;
      monthQty: Map<string, number>;
      observations: number;
    }
  >();

  for (const item of items) {
    const codigo = resolveCodigoEfisco(item);
    const month = dfdMonthById.get(String(item.dfd_id));
    if (!codigo || !month) continue;
    const quantidade = Math.max(0, Number(item.quantidade || 0));
    if (!byCode.has(codigo)) {
      byCode.set(codigo, {
        descricao: String(item.descricao || "Descrição não informada"),
        monthQty: new Map(),
        observations: 0,
      });
    }
    const entry = byCode.get(codigo)!;
    entry.monthQty.set(month, (entry.monthQty.get(month) || 0) + quantidade);
    entry.observations += 1;
    if (!entry.descricao || entry.descricao === "Descrição não informada") {
      entry.descricao = String(item.descricao || entry.descricao);
    }
  }

  return Array.from(byCode.entries())
    .map(([codigoEfisco, entry]) => {
      const { points } = buildMonthSeries(entry.monthQty);
      const regression = linearRegression(points);
      const sortedMonths = Array.from(entry.monthQty.keys()).sort((a, b) =>
        a.localeCompare(b),
      );
      const latestMonth = sortedMonths.at(-1) || "";
      const latestQty = Number(entry.monthQty.get(latestMonth) || 0);
      const values = Array.from(entry.monthQty.values());
      const avg3m =
        values.length === 0
          ? 0
          : values.slice(Math.max(0, values.length - 3)).reduce((a, b) => a + b, 0) /
            Math.min(3, values.length);

      return {
        codigoEfisco,
        descricao: entry.descricao,
        observations: entry.observations,
        sampleMonths: points.length,
        latestMonth,
        latestQuantity: normalizeCurrency(latestQty),
        averageLast3Months: normalizeCurrency(avg3m),
        predictedNextQuantity: normalizeCurrency(regression.predictedNextValue),
        slope: regression.slope,
        r2: regression.r2,
        trend: regression.trend,
        confidence: resolveForecastConfidence(points.length, regression.r2),
      } as ForecastRow;
    })
    .filter((row) => row.sampleMonths >= minSampleMonths)
    .sort((a, b) => {
      const predictionDiff = b.predictedNextQuantity - a.predictedNextQuantity;
      if (predictionDiff !== 0) return predictionDiff;
      return b.observations - a.observations;
    })
    .slice(0, limit);
}

function buildPriceObservationRows(dfds: DfdRow[], items: ItemRow[]) {
  const dfdMeta = new Map<string, { protocol: string; month: string }>();
  for (const dfd of dfds) {
    const month = toYearMonth(String(dfd.created_at || ""));
    if (!month) continue;
    dfdMeta.set(String(dfd.id), {
      protocol: String(dfd.numero_protocolo || ""),
      month,
    });
  }

  const observations: PriceObservation[] = [];
  for (const item of items) {
    const codigoEfisco = resolveCodigoEfisco(item);
    if (!codigoEfisco) continue;
    const unitPrice = Math.max(0, Number(item.valor_unitario_estimado || 0));
    if (unitPrice <= 0) continue;
    const meta = dfdMeta.get(String(item.dfd_id));
    if (!meta) continue;
    observations.push({
      codigoEfisco,
      descricao: String(item.descricao || "Descrição não informada"),
      unitPrice,
      quantidade: Math.max(0, Number(item.quantidade || 0)),
      dfdId: String(item.dfd_id),
      protocolo: meta.protocol,
      mes: meta.month,
    });
  }

  return observations;
}

function buildPriceVolatilitySignals(observations: PriceObservation[]) {
  const byCode = new Map<string, PriceObservation[]>();
  for (const observation of observations) {
    const codigo = String(observation.codigoEfisco || "").trim();
    if (!codigo) continue;
    if (!byCode.has(codigo)) byCode.set(codigo, []);
    byCode.get(codigo)!.push(observation);
  }

  const rows: PriceVolatilitySignal[] = [];
  for (const [codigoEfisco, codeRows] of byCode.entries()) {
    if (codeRows.length < 2) continue;
    const prices = codeRows
      .map((row) => Number(row.unitPrice || 0))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (prices.length < 2) continue;
    const average = mean(prices);
    const deviation = sampleStdDev(prices, average);
    if (average <= 0) continue;
    const latest = codeRows
      .slice()
      .sort((a, b) => String(a.mes || "").localeCompare(String(b.mes || "")))
      .at(-1);
    const latestPrice = Number(latest?.unitPrice || 0);
    const maxDeviation = Math.max(...prices.map((price) => Math.abs(price - average)));
    rows.push({
      codigoEfisco,
      descricao: String(codeRows[0]?.descricao || "Descrição não informada"),
      observations: prices.length,
      latestPrice: normalizeCurrency(latestPrice),
      meanPrice: normalizeCurrency(average),
      cvPct: normalizeCurrency((deviation / average) * 100),
      maxDeviationPct: normalizeCurrency((maxDeviation / average) * 100),
    });
  }

  return rows
    .sort((a, b) => {
      const diff = b.cvPct - a.cvPct;
      if (diff !== 0) return diff;
      return b.maxDeviationPct - a.maxDeviationPct;
    })
    .slice(0, 20);
}

function buildSegmentAnalytics(
  segment: "legacy" | "current" | "combined",
  dfds: DfdRow[],
  items: ItemRow[],
  options: { priceSignalsEnabled: boolean },
): SegmentAnalytics {
  const dfdMonthById = new Map<string, string>();
  const dfdVolumeMap = new Map<string, number>();
  const itemQuantityMap = new Map<string, number>();
  const itemValueMap = new Map<string, number>();

  for (const dfd of dfds) {
    const month = toYearMonth(String(dfd.created_at || ""));
    if (!month) continue;
    dfdMonthById.set(String(dfd.id), month);
    dfdVolumeMap.set(month, (dfdVolumeMap.get(month) || 0) + 1);
  }

  let codedItems = 0;
  let quantityItems = 0;
  let pricedItems = 0;

  const byCode = new Map<
    string,
    {
      descricao: string;
      observations: number;
      totalQuantity: number;
      activeMonths: Set<string>;
      withPriceObservations: number;
      monthQty: Map<string, number>;
    }
  >();

  for (const item of items) {
    const month = dfdMonthById.get(String(item.dfd_id));
    if (!month) continue;

    const quantity = Math.max(0, Number(item.quantidade || 0));
    const unitPrice = Math.max(0, Number(item.valor_unitario_estimado || 0));
    const code = resolveCodigoEfisco(item);

    if (code) codedItems += 1;
    if (quantity > 0) quantityItems += 1;
    if (unitPrice > 0) pricedItems += 1;

    itemQuantityMap.set(month, (itemQuantityMap.get(month) || 0) + quantity);
    itemValueMap.set(month, (itemValueMap.get(month) || 0) + quantity * unitPrice);

    if (!code) continue;
    if (!byCode.has(code)) {
      byCode.set(code, {
        descricao: String(item.descricao || "Descrição não informada"),
        observations: 0,
        totalQuantity: 0,
        activeMonths: new Set<string>(),
        withPriceObservations: 0,
        monthQty: new Map<string, number>(),
      });
    }

    const entry = byCode.get(code)!;
    entry.observations += 1;
    entry.totalQuantity += quantity;
    entry.activeMonths.add(month);
    if (unitPrice > 0) entry.withPriceObservations += 1;
    entry.monthQty.set(month, (entry.monthQty.get(month) || 0) + quantity);
    if (!entry.descricao || entry.descricao === "Descrição não informada") {
      entry.descricao = String(item.descricao || entry.descricao);
    }
  }

  const dfdSeries = buildMonthSeries(dfdVolumeMap);
  const quantitySeries = buildMonthSeries(itemQuantityMap);
  const valueSeries = buildMonthSeries(itemValueMap);

  const sparseMonths = Array.from(
    new Set([...dfdSeries.months, ...quantitySeries.months, ...valueSeries.months]),
  ).sort((a, b) => a.localeCompare(b));
  const allMonths = buildContiguousMonths(sparseMonths);

  const monthly: SegmentMonthlyPoint[] = allMonths.map((month) => ({
    month,
    dfd_count: Number(dfdVolumeMap.get(month) || 0),
    total_quantity: normalizeCurrency(Number(itemQuantityMap.get(month) || 0)),
    total_value: normalizeCurrency(Number(itemValueMap.get(month) || 0)),
  }));

  const topCodes = Array.from(byCode.entries()).map(([codigoEfisco, entry]) => ({
    codigoEfisco,
    descricao: entry.descricao,
    observations: entry.observations,
    activeMonths: entry.activeMonths.size,
    totalQuantity: normalizeCurrency(entry.totalQuantity),
    withPriceObservations: entry.withPriceObservations,
  }));

  const topCodesByQuantity = [...topCodes]
    .sort((a, b) => {
      const quantityDiff = b.totalQuantity - a.totalQuantity;
      if (quantityDiff !== 0) return quantityDiff;
      return b.observations - a.observations;
    })
    .slice(0, 12);

  const topCodesByFrequency = [...topCodes]
    .sort((a, b) => {
      const obsDiff = b.observations - a.observations;
      if (obsDiff !== 0) return obsDiff;
      return b.totalQuantity - a.totalQuantity;
    })
    .slice(0, 12);

  const intermittencyList: Array<{
    codigoEfisco: string;
    adi: number;
    cv2: number;
    className: IntermittencyClass;
    observations: number;
  }> = [];
  for (const [codigoEfisco, entry] of byCode.entries()) {
    const quantitySeriesByCode = allMonths.map((month) =>
      Number(entry.monthQty.get(month) || 0),
    );
    const classification = classifyIntermittency(quantitySeriesByCode);
    intermittencyList.push({
      codigoEfisco,
      adi: classification.adi,
      cv2: classification.cv2,
      className: classification.className,
      observations: entry.observations,
    });
  }

  const classDistribution: Record<IntermittencyClass, number> = {
    smooth: 0,
    intermittent: 0,
    erratic: 0,
    lumpy: 0,
    insufficient: 0,
  };
  for (const row of intermittencyList) {
    classDistribution[row.className] += 1;
  }

  const validAdi = intermittencyList
    .filter((row) => row.className !== "insufficient")
    .map((row) => row.adi);
  const validCv2 = intermittencyList
    .filter((row) => row.className !== "insufficient")
    .map((row) => row.cv2);

  const intermittencyStats: SegmentIntermittencyStats = {
    series_count: intermittencyList.length,
    class_distribution: classDistribution,
    median_adi: normalizeCurrency(median(validAdi)),
    median_cv2: normalizeCurrency(median(validCv2)),
    top_lumpy: intermittencyList
      .filter((row) => row.className === "lumpy")
      .sort((a, b) => {
        const cv2Diff = b.cv2 - a.cv2;
        if (cv2Diff !== 0) return cv2Diff;
        return b.adi - a.adi;
      })
      .slice(0, 8)
      .map((row) => ({
        codigoEfisco: row.codigoEfisco,
        adi: row.adi,
        cv2: row.cv2,
        observations: row.observations,
      })),
  };

  const peak = monthly.reduce(
    (acc, row) => (row.dfd_count > acc.dfd_count ? row : acc),
    { month: "-", dfd_count: 0, total_quantity: 0, total_value: 0 } as SegmentMonthlyPoint,
  );

  const codeCoveragePct = percentage(codedItems, items.length);
  const quantityCoveragePct = percentage(quantityItems, items.length);
  const priceCoveragePct = percentage(pricedItems, items.length);
  const monthConcentrationPct = percentage(peak.dfd_count, Math.max(dfds.length, 1));

  const dfdRegression = linearRegression(dfdSeries.points);
  const quantityRegression = linearRegression(quantitySeries.points);
  const valueRegression = linearRegression(valueSeries.points);
  const dfdDeepStats = computeSeriesDeepStats(
    allMonths.map((month, index) => ({
      x: index,
      y: Number(dfdVolumeMap.get(month) || 0),
    })),
  );
  const quantityDeepStats = computeSeriesDeepStats(
    allMonths.map((month, index) => ({
      x: index,
      y: Number(itemQuantityMap.get(month) || 0),
    })),
  );
  const valueDeepStats = computeSeriesDeepStats(
    allMonths.map((month, index) => ({
      x: index,
      y: Number(itemValueMap.get(month) || 0),
    })),
  );

  const repeatedCodes = topCodes.filter((row) => row.observations >= 2).length;

  const insights: SegmentInsight[] = [];

  if (dfds.length === 0) {
    insights.push({
      level: "critical",
      title: "Sem dados para esta visão",
      detail: "Não há DFDs suficientes na janela escolhida para produzir indicadores.",
    });
  }

  if (allMonths.length > 0 && allMonths.length < 6) {
    insights.push({
      level: "warning",
      title: "Série temporal curta",
      detail: `A visão tem apenas ${allMonths.length} mês(es) com dados; tendência e previsão ficam menos confiáveis.`,
    });
  }

  if (monthConcentrationPct >= 60 && dfds.length > 0) {
    insights.push({
      level: "warning",
      title: "Concentração mensal elevada",
      detail: `${normalizeCurrency(monthConcentrationPct)}% das DFDs estão no mês ${peak.month}.`,
    });
  }

  if (codeCoveragePct < 90 && items.length > 0) {
    insights.push({
      level: "warning",
      title: "Cobertura de código incompleta",
      detail: `${normalizeCurrency(100 - codeCoveragePct)}% dos itens estão sem código padronizado.`,
    });
  }

  if (!options.priceSignalsEnabled) {
    insights.push({
      level: "info",
      title: "Preço indisponível no legado",
      detail: "Esta visão prioriza volume, recorrência e distribuição. Sinais de preço foram desativados.",
    });
  } else if (priceCoveragePct < 50 && items.length > 0) {
    insights.push({
      level: "warning",
      title: "Cobertura de preço baixa",
      detail: `Apenas ${priceCoveragePct}% dos itens possuem preço unitário válido para análise financeira robusta.`,
    });
  }

  if (dfdRegression.sampleSize >= 3 && dfdRegression.r2 < 0.2) {
    insights.push({
      level: "info",
      title: "Tendência de volume fraca",
      detail: "O R² do volume é baixo; trate a inclinação como sinal exploratório, não como previsão determinística.",
    });
  }

  if (topCodesByFrequency.length > 0) {
    const leader = topCodesByFrequency[0];
    insights.push({
      level: "info",
      title: "Item líder de recorrência",
      detail: `Código ${leader.codigoEfisco} aparece em ${leader.observations} observações e ${leader.activeMonths} mês(es).`,
    });
  }

  const lumpyShare = percentage(classDistribution.lumpy, Math.max(intermittencyStats.series_count, 1));
  if (lumpyShare >= 25 && intermittencyStats.series_count > 0) {
    insights.push({
      level: "warning",
      title: "Alta presença de demanda lumpy",
      detail: `${normalizeCurrency(lumpyShare)}% das séries por código apresentam intermitência e variabilidade elevadas (ADI/CV²).`,
    });
  }

  if (quantityDeepStats.mann_kendall_p_value <= 0.05) {
    insights.push({
      level: "info",
      title: "Tendência monotônica estatisticamente detectada",
      detail: `Teste Mann-Kendall para quantidade aponta tendência ${quantityDeepStats.mann_kendall_trend} (p=${quantityDeepStats.mann_kendall_p_value}).`,
    });
  }

  const guides: SegmentGuide[] = [];

  if (segment === "legacy") {
    guides.push({
      title: "Padronize o catálogo histórico",
      action: "Priorize itens recorrentes para vincular código e unidade padronizada antes da próxima rodada.",
    });
    guides.push({
      title: "Conduza planejamento por volume",
      action: "Use top recorrência + top quantidade para definir itens estruturantes por campus/setor.",
    });
    guides.push({
      title: "Não derive orçamento por preço legado",
      action: "Preço histórico legado deve ser tratado como não confiável; use referência do ano corrente.",
    });
  } else if (segment === "current") {
    guides.push({
      title: "Use outliers como triagem",
      action: "Itens com z-score alto devem entrar em revisão manual de preço e justificativa.",
    });
    guides.push({
      title: "Consolide demanda recorrente",
      action: "Converta códigos mais repetidos em kits ou compras centralizadas quando fizer sentido.",
    });
    guides.push({
      title: "Aumente densidade temporal",
      action: "Com poucos meses, atualize o painel quinzenalmente e reavalie previsões após 6+ meses.",
    });
  } else {
    guides.push({
      title: "Leia legado e corrente separadamente",
      action: "Use o legado para pressão de demanda e o corrente para análise financeira e risco de preço.",
    });
    guides.push({
      title: "Formalize ciclo de revisão",
      action: "Institua revisão mensal com registro de decisões por item crítico e por centro de custo.",
    });
  }

  return {
    segment,
    scope: {
      price_signals_enabled: options.priceSignalsEnabled,
    },
    dataset: {
      dfds: dfds.length,
      items: items.length,
      unique_codes: byCode.size,
      months_covered: allMonths.length,
      code_coverage_pct: codeCoveragePct,
      quantity_coverage_pct: quantityCoveragePct,
      price_coverage_pct: priceCoveragePct,
      repeated_codes: repeatedCodes,
      peak_month: peak.month,
      peak_month_dfd_count: peak.dfd_count,
      month_concentration_pct: monthConcentrationPct,
    },
    regression: {
      dfd_volume: dfdRegression,
      total_quantity: quantityRegression,
      total_value: valueRegression,
    },
    statistics: {
      dfd_series: dfdDeepStats,
      quantity_series: quantityDeepStats,
      value_series: valueDeepStats,
      intermittency: intermittencyStats,
    },
    charts: {
      monthly,
      top_codes_by_quantity: topCodesByQuantity,
      top_codes_by_frequency: topCodesByFrequency,
    },
    insights,
    guides,
  };
}

export const GET = withAuthorizedRole(
  ["superadmin"],
  async ({ request, supabaseAdmin }) => {
    const admin = supabaseAdmin!;
    const windowMonths = parseWindowMonths(
      request.nextUrl.searchParams.get("window_months"),
    );
    const includeLegacy = parseIncludeLegacy(
      request.nextUrl.searchParams.get("include_legacy"),
    );
    const now = monthFloor(new Date());
    const since = shiftMonths(now, -(windowMonths - 1));

    const currentDfds = (await fetchEligibleDfds(admin, since.toISOString())).map((row) => ({
      ...row,
      source: "current" as const,
    }));
    const currentDfdIds = currentDfds.map((row) => String(row.id));
    const currentItems = (await fetchDfdItems(admin, currentDfdIds)).map((row) => ({
      ...row,
      source: "current" as const,
    }));

    let legacyDfds: DfdRow[] = [];
    let legacyItems: ItemRow[] = [];
    if (includeLegacy) {
      const legacyBundle = await fetchLegacyDfds(admin, since);
      legacyDfds = legacyBundle.dfds;
      legacyItems = await fetchLegacyItems(admin, legacyBundle.refs);
    }

    const combinedDfds = [...currentDfds, ...legacyDfds];
    const combinedItems = [...currentItems, ...legacyItems];

    const currentYear = now.getUTCFullYear();
    const currentYearDfdsRaw = currentDfds.filter((row) => {
      const date = new Date(String(row.created_at || ""));
      return Number.isFinite(date.getTime()) && date.getUTCFullYear() >= currentYear;
    });
    const currentYearDfds = currentYearDfdsRaw.length > 0 ? currentYearDfdsRaw : currentDfds;
    const currentYearIdSet = new Set(currentYearDfds.map((row) => String(row.id)));
    const currentYearItems = currentItems.filter((row) => currentYearIdSet.has(String(row.dfd_id)));

    const legacySegment = buildSegmentAnalytics("legacy", legacyDfds, legacyItems, {
      priceSignalsEnabled: false,
    });
    const currentSegment = buildSegmentAnalytics("current", currentYearDfds, currentYearItems, {
      priceSignalsEnabled: true,
    });
    const combinedSegment = buildSegmentAnalytics("combined", combinedDfds, combinedItems, {
      priceSignalsEnabled: true,
    });

    const strictForecasts = buildTopForecasts(currentYearDfds, currentYearItems, {
      minSampleMonths: 4,
      limit: 25,
    });
    const exploratoryForecasts = buildTopForecasts(currentYearDfds, currentYearItems, {
      minSampleMonths: 2,
      limit: 25,
    });
    const forecasts =
      strictForecasts.length > 0 ? strictForecasts : exploratoryForecasts;
    const forecastsMode =
      strictForecasts.length > 0
        ? "strict"
        : exploratoryForecasts.length > 0
          ? "exploratory"
          : "empty";
    const forecastsReason =
      forecastsMode === "strict"
        ? "Previsões com série mínima de 4 meses por código."
        : forecastsMode === "exploratory"
          ? "Previsões exploratórias: série curta (2-3 meses) com confiança limitada."
          : "Sem séries com recorrência mínima para previsão.";

    const priceObservations = buildPriceObservationRows(currentYearDfds, currentYearItems);
    const strictPriceOutliers = detectPriceOutliers(priceObservations, 6, 2.5);
    const exploratoryPriceOutliers = detectPriceOutliers(priceObservations, 3, 2.2);
    const selectedPriceOutliers =
      strictPriceOutliers.length > 0
        ? strictPriceOutliers
        : exploratoryPriceOutliers;
    const priceOutliersMode =
      strictPriceOutliers.length > 0
        ? "strict"
        : exploratoryPriceOutliers.length > 0
          ? "exploratory"
          : "empty";
    const priceOutliersReason =
      priceOutliersMode === "strict"
        ? "Outliers com critério robusto (mín. 6 observações por código)."
        : priceOutliersMode === "exploratory"
          ? "Sinais exploratórios: critérios relaxados (mín. 3 observações por código)."
          : "Sem volume histórico suficiente para detectar outliers de preço.";
    const priceWatchlist = buildPriceVolatilitySignals(priceObservations);
    const priceOutliers = selectedPriceOutliers
      .slice(0, 40)
      .map((row) => ({
        ...row,
        unitPrice: normalizeCurrency(row.unitPrice),
        mediaHistorica: normalizeCurrency(row.mediaHistorica),
        desvioPadrao: normalizeCurrency(row.desvioPadrao),
        zScore: normalizeCurrency(row.zScore),
      }));

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      window_months: windowMonths,
      scope: {
        statuses: ELIGIBLE_STATUSES,
        since: since.toISOString(),
        include_legacy: includeLegacy,
      },
      dataset: {
        dfds: combinedDfds.length,
        items: combinedItems.length,
        current_dfds: currentSegment.dataset.dfds,
        current_items: currentSegment.dataset.items,
        legacy_dfds: legacySegment.dataset.dfds,
        legacy_items: legacySegment.dataset.items,
        unique_codes: combinedSegment.dataset.unique_codes,
        months_covered: combinedSegment.dataset.months_covered,
      },
      regression: {
        total_quantity: combinedSegment.regression.total_quantity,
        total_value: combinedSegment.regression.total_value,
        dfd_volume: combinedSegment.regression.dfd_volume,
      },
      top_forecasts: forecasts,
      top_forecasts_mode: forecastsMode,
      top_forecasts_reason: forecastsReason,
      price_outliers: priceOutliers,
      price_outliers_mode: priceOutliersMode,
      price_outliers_reason: priceOutliersReason,
      price_watchlist: priceWatchlist,
      segments: {
        legacy: legacySegment,
        current: currentSegment,
        combined: combinedSegment,
      },
      guides: {
        legacy: legacySegment.guides,
        current: currentSegment.guides,
        combined: combinedSegment.guides,
      },
    });
  },
  { requireAdminClient: true },
);
