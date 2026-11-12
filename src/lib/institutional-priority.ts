import units from "./institutional-unit-levels.json";

export const INSTITUTIONAL_PRIORITY_VERSION = "gestao-cursos-laboratorios-score-v2";
export type InstitutionalGroup = "administrativo" | "curso" | "laboratorio" | "nao_identificado";
/** Explicit unit IDs reviewed against the institutional registry on 2026-10-17.
 * Names are documentary only; renaming a unit never changes precedence. */
const groups = new Map(units.map(unit => [unit.id, unit.group as InstitutionalGroup]));
export function institutionalGroup(unitType: string | null | undefined, unitId?: string | null): InstitutionalGroup {
  if (unitType === "laboratorio") return "laboratorio";
  if (unitType === "departamento" && unitId) return groups.get(unitId) || "nao_identificado";
  return "nao_identificado";
}
export const INSTITUTIONAL_GROUP_LABELS: Record<InstitutionalGroup, string> = {
  administrativo: "Nível 1 · Gestão e coordenações administrativas",
  curso: "Nível 2 · Coordenações de curso e colegiados",
  laboratorio: "Nível 3 · Laboratórios",
  nao_identificado: "A classificar · Unidade sem nível institucional",
};
export const INSTITUTIONAL_GROUP_LEVELS: Record<InstitutionalGroup, number> = {
  administrativo: 1, curso: 2, laboratorio: 3, nao_identificado: 4,
};
/** Absolute precedence. The technical score may only order within a level. */
export function compareInstitutionalGroups(a: InstitutionalGroup, b: InstitutionalGroup): number {
  return INSTITUTIONAL_GROUP_LEVELS[a] - INSTITUTIONAL_GROUP_LEVELS[b];
}
export type InstitutionalPriority = { status: "ranked" | "pending"; score: number; reason: string; version: string };
export function calculateInstitutionalPriority(input: {
  eligible: boolean; impact: number; timing: number; group: InstitutionalGroup;
}): InstitutionalPriority {
  const pending = (reason: string): InstitutionalPriority => ({ status: "pending", score: 0, reason, version: INSTITUTIONAL_PRIORITY_VERSION });
  if (!input.eligible) return pending("Pedido fora dos estados elegíveis para atendimento.");
  if (![input.impact, input.timing].every(level => Number.isInteger(level) && level >= 1 && level <= 4)) return pending("Avaliação incompleta ou inválida.");
  if (input.group === "nao_identificado") return pending("Confirme o nível institucional da unidade.");
  return { status: "ranked", score: institutionalScore(input.group, 14 * input.impact * input.timing)!,
    version: INSTITUTIONAL_PRIORITY_VERSION, reason: "Gestão, cursos e laboratórios, nessa ordem; avaliação dentro de cada nível." };
}

/** Disjoint score bands. 280 is the technical scale reference, not a fitted parameter.
 * Bounded monotonic transform preserves technical order without allowing tier crossing. */
export function institutionalScore(group: InstitutionalGroup, technicalScore: number): number | null {
  if (group === "nao_identificado" || !Number.isFinite(technicalScore) || technicalScore < 0) return null;
  const base = { administrativo: 300, curso: 200, laboratorio: 100 }[group];
  const within = Math.min(99.99, Math.round((100 / (1 + 280 / Math.max(technicalScore, Number.MIN_VALUE))) * 100) / 100);
  return Math.round((base + within) * 100) / 100;
}
