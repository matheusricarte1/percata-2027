import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import {
  buildMonthSeries,
  detectPriceOutliers,
  linearRegression,
  normalizeCurrency,
  toYearMonth,
  type PriceObservation,
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

function buildMonthlyAnalytics(dfds: DfdRow[], items: ItemRow[]) {
  const dfdMonthById = new Map<string, string>();
  const itemMonthMap = new Map<string, number>();
  const itemValueMap = new Map<string, number>();
  const dfdVolumeMap = new Map<string, number>();

  for (const dfd of dfds) {
    const month = toYearMonth(String(dfd.created_at || ""));
    if (!month) continue;
    dfdMonthById.set(String(dfd.id), month);
    dfdVolumeMap.set(month, (dfdVolumeMap.get(month) || 0) + 1);
  }

  for (const item of items) {
    const month = dfdMonthById.get(String(item.dfd_id));
    if (!month) continue;
    const quantidade = Math.max(0, Number(item.quantidade || 0));
    const unitPrice = Math.max(0, Number(item.valor_unitario_estimado || 0));
    itemMonthMap.set(month, (itemMonthMap.get(month) || 0) + quantidade);
    itemValueMap.set(month, (itemValueMap.get(month) || 0) + quantidade * unitPrice);
  }

  const quantitySeries = buildMonthSeries(itemMonthMap);
  const valueSeries = buildMonthSeries(itemValueMap);
  const dfdSeries = buildMonthSeries(dfdVolumeMap);

  return {
    months: Array.from(
      new Set([...quantitySeries.months, ...valueSeries.months, ...dfdSeries.months]),
    ).sort((a, b) => a.localeCompare(b)),
    quantityRegression: linearRegression(quantitySeries.points),
    valueRegression: linearRegression(valueSeries.points),
    dfdRegression: linearRegression(dfdSeries.points),
  };
}

function buildTopForecasts(dfds: DfdRow[], items: ItemRow[]) {
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

  const forecasts = Array.from(byCode.entries())
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
      };
    })
    .filter((row) => row.sampleMonths >= 4)
    .sort((a, b) => {
      const predictionDiff = b.predictedNextQuantity - a.predictedNextQuantity;
      if (predictionDiff !== 0) return predictionDiff;
      return b.observations - a.observations;
    })
    .slice(0, 25);

  return forecasts;
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

    const dfds = [...currentDfds, ...legacyDfds];
    const items = [...currentItems, ...legacyItems];

    const monthly = buildMonthlyAnalytics(dfds, items);
    const forecasts = buildTopForecasts(dfds, items);

    const priceObservations = buildPriceObservationRows(dfds, items);
    const priceOutliers = detectPriceOutliers(priceObservations)
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
        dfds: dfds.length,
        items: items.length,
        current_dfds: currentDfds.length,
        current_items: currentItems.length,
        legacy_dfds: legacyDfds.length,
        legacy_items: legacyItems.length,
        unique_codes: new Set(items.map((item) => resolveCodigoEfisco(item)).filter(Boolean))
          .size,
        months_covered: monthly.months.length,
      },
      regression: {
        total_quantity: monthly.quantityRegression,
        total_value: monthly.valueRegression,
        dfd_volume: monthly.dfdRegression,
      },
      top_forecasts: forecasts,
      price_outliers: priceOutliers,
    });
  },
  { requireAdminClient: true },
);
