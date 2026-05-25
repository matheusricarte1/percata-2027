export type NumericPoint = {
  x: number;
  y: number;
};

export type RegressionSummary = {
  sampleSize: number;
  slope: number;
  intercept: number;
  r2: number;
  currentValue: number;
  predictedNextValue: number;
  trend: "up" | "down" | "flat" | "insufficient_data";
};

export type PriceObservation = {
  codigoEfisco: string;
  descricao: string;
  unitPrice: number;
  quantidade: number;
  dfdId: string;
  protocolo: string;
  mes: string;
};

export type PriceOutlier = {
  codigoEfisco: string;
  descricao: string;
  unitPrice: number;
  mediaHistorica: number;
  desvioPadrao: number;
  zScore: number;
  observacoes: number;
  dfdId: string;
  protocolo: string;
  mes: string;
};

export function toYearMonth(value: string | Date): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function buildMonthSeries(monthMap: Map<string, number>) {
  const months = Array.from(monthMap.keys()).sort((a, b) => a.localeCompare(b));
  const points: NumericPoint[] = months.map((month, index) => ({
    x: index,
    y: Number(monthMap.get(month) || 0),
  }));
  return { months, points };
}

export function linearRegression(points: NumericPoint[]): RegressionSummary {
  if (points.length < 3) {
    const current = points.at(-1)?.y || 0;
    return {
      sampleSize: points.length,
      slope: 0,
      intercept: current,
      r2: 0,
      currentValue: current,
      predictedNextValue: current,
      trend: "insufficient_data",
    };
  }

  const sampleSize = points.length;
  const meanX = points.reduce((acc, point) => acc + point.x, 0) / sampleSize;
  const meanY = points.reduce((acc, point) => acc + point.y, 0) / sampleSize;

  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    const xDelta = point.x - meanX;
    const yDelta = point.y - meanY;
    numerator += xDelta * yDelta;
    denominator += xDelta * xDelta;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanY - slope * meanX;

  let ssTot = 0;
  let ssRes = 0;
  for (const point of points) {
    const predicted = intercept + slope * point.x;
    ssTot += Math.pow(point.y - meanY, 2);
    ssRes += Math.pow(point.y - predicted, 2);
  }

  const r2 = ssTot <= 0 ? 0 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));
  const currentValue = points.at(-1)?.y || 0;
  const predictedNextValueRaw = intercept + slope * sampleSize;
  const predictedNextValue = Math.max(0, predictedNextValueRaw);

  const epsilon = Math.max(0.001, Math.abs(meanY) * 0.03);
  const trend: RegressionSummary["trend"] =
    slope > epsilon ? "up" : slope < -epsilon ? "down" : "flat";

  return {
    sampleSize,
    slope,
    intercept,
    r2,
    currentValue,
    predictedNextValue,
    trend,
  };
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function stdDev(values: number[], avg: number) {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((acc, value) => acc + Math.pow(value - avg, 2), 0) /
    (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
}

export function detectPriceOutliers(
  observations: PriceObservation[],
  minObservations = 6,
  zScoreThreshold = 2.5,
): PriceOutlier[] {
  const grouped = new Map<string, PriceObservation[]>();
  for (const observation of observations) {
    const key = String(observation.codigoEfisco || "").trim();
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(observation);
  }

  const outliers: PriceOutlier[] = [];
  for (const [codigoEfisco, rows] of grouped.entries()) {
    const prices = rows
      .map((row) => Number(row.unitPrice || 0))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (prices.length < minObservations) continue;

    const avg = mean(prices);
    const deviation = stdDev(prices, avg);
    if (deviation <= 0) continue;

    for (const row of rows) {
      const price = Number(row.unitPrice || 0);
      if (!Number.isFinite(price) || price <= 0) continue;
      const zScore = (price - avg) / deviation;
      if (Math.abs(zScore) < zScoreThreshold) continue;
      outliers.push({
        codigoEfisco,
        descricao: row.descricao,
        unitPrice: price,
        mediaHistorica: avg,
        desvioPadrao: deviation,
        zScore,
        observacoes: prices.length,
        dfdId: row.dfdId,
        protocolo: row.protocolo,
        mes: row.mes,
      });
    }
  }

  return outliers.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}

export function normalizeCurrency(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}
