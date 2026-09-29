export const CAPITAL_PRIORITY_VERSION = "capital-two-level-v1";

export type CapitalPriorityInput = {
  key: string;
  campusId: string | null;
  unitKey: string | null;
  value: number;
  criticidadeLevel: number;
  prioridadeLevel: number;
  chefiaPareto: boolean;
  eligible: boolean;
};

export type CapitalPriorityResult = {
  status: "calculated" | "pending";
  reason?: string;
  version: string;
  campusSize?: number;
  unitSize?: number;
  campusTotal?: number;
  unitTotal?: number;
  campusReference?: number;
  unitReference?: number;
  humanScore?: number;
  paretoBonus?: number;
  campusPenalty?: number;
  unitIncrement?: number;
  totalPenalty?: number;
  finalScore?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function quantile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function upperReference(values: number[]): number {
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  return Math.max(q3 + 1.5 * (q3 - q1), quantile(values, 0.9));
}

function penalty(value: number, total: number, reference: number): number {
  if (value <= 0 || total <= 0 || reference <= 0) return 0;
  const dominance = (value / total) * Math.max(0, Math.log(value / reference));
  return 112 * (1 - Math.exp(-4 * dominance));
}

export function calculateCapitalPriorities(inputs: CapitalPriorityInput[]): Map<string, CapitalPriorityResult> {
  const result = new Map<string, CapitalPriorityResult>();
  const valid = inputs.filter((item) =>
    item.eligible && Boolean(item.campusId) && Number.isFinite(item.value) && item.value > 0 &&
    Number.isInteger(item.criticidadeLevel) && item.criticidadeLevel >= 1 && item.criticidadeLevel <= 4 &&
    Number.isInteger(item.prioridadeLevel) && item.prioridadeLevel >= 1 && item.prioridadeLevel <= 4,
  );
  const campusGroups = new Map<string, CapitalPriorityInput[]>();
  const unitGroups = new Map<string, CapitalPriorityInput[]>();
  for (const item of valid) {
    const campusId = item.campusId!;
    campusGroups.set(campusId, [...(campusGroups.get(campusId) || []), item]);
    if (item.unitKey) {
      const unitKey = `${campusId}:${item.unitKey}`;
      unitGroups.set(unitKey, [...(unitGroups.get(unitKey) || []), item]);
    }
  }

  for (const item of inputs) {
    const pending = (reason: string): CapitalPriorityResult => ({ status: "pending", reason, version: CAPITAL_PRIORITY_VERSION });
    if (!item.eligible) { result.set(item.key, pending("Item fora da carteira consolidada de capital.")); continue; }
    if (!item.campusId) { result.set(item.key, pending("Campus não identificado.")); continue; }
    if (!Number.isFinite(item.value) || item.value <= 0) { result.set(item.key, pending("Valor total inválido ou ausente.")); continue; }
    if (!Number.isInteger(item.criticidadeLevel) || item.criticidadeLevel < 1 || item.criticidadeLevel > 4 ||
        !Number.isInteger(item.prioridadeLevel) || item.prioridadeLevel < 1 || item.prioridadeLevel > 4) {
      result.set(item.key, pending("Avaliação de criticidade e prioridade da chefia incompleta.")); continue;
    }
    const campus = campusGroups.get(item.campusId) || [];
    if (campus.length < 6) { result.set(item.key, pending("Menos de seis necessidades válidas de capital no campus.")); continue; }

    const campusPeers = campus.filter((peer) => peer.key !== item.key).map((peer) => peer.value);
    const campusTotal = campus.reduce((sum, peer) => sum + peer.value, 0);
    const campusReference = upperReference(campusPeers);
    const campusPenalty = penalty(item.value, campusTotal, campusReference);
    const unit = item.unitKey ? unitGroups.get(`${item.campusId}:${item.unitKey}`) || [] : [];
    const unitTotal = unit.reduce((sum, peer) => sum + peer.value, 0);
    const confidence = clamp((unit.length - 5) / 15, 0, 1);
    const unitReference = confidence > 0
      ? upperReference(unit.filter((peer) => peer.key !== item.key).map((peer) => peer.value))
      : undefined;
    const unitPenalty = unitReference === undefined ? 0 : penalty(item.value, unitTotal, unitReference);
    const unitIncrement = confidence * Math.min(28, Math.max(0, unitPenalty - campusPenalty));
    const totalPenalty = Math.min(112, campusPenalty + unitIncrement);
    const humanScore = 14 * item.criticidadeLevel * item.prioridadeLevel;
    const paretoBonus = item.chefiaPareto ? 28 : 0;
    result.set(item.key, {
      status: "calculated",
      version: CAPITAL_PRIORITY_VERSION,
      campusSize: campus.length,
      unitSize: unit.length,
      campusTotal: round2(campusTotal),
      unitTotal: round2(unitTotal),
      campusReference: round2(campusReference),
      unitReference: unitReference === undefined ? undefined : round2(unitReference),
      humanScore,
      paretoBonus,
      campusPenalty: round2(campusPenalty),
      unitIncrement: round2(unitIncrement),
      totalPenalty: round2(totalPenalty),
      finalScore: round2(clamp(humanScore + paretoBonus - totalPenalty, 0, 280)),
    });
  }
  return result;
}
