/** Capital is evaluated by original request; purchasing groups are a separate concern. */
export function consolidationContextKey(input: {
  id: string; dfdId: string; campusId: string | null; code: string;
  gnd: string; unit: string; eligible: boolean;
  criticidade: string; prioridade: string; highlight: boolean; institutionalGroup?: string;
}): string {
  if (input.gnd.trim().startsWith("4") || !input.gnd.trim().startsWith("3")) {
    return JSON.stringify(["capital-request", input.campusId, input.dfdId, input.id]);
  }
  return JSON.stringify(["purchasing-group", input.campusId, input.code,
    input.gnd.trim(), input.unit.trim().toUpperCase(), input.eligible,
    input.criticidade, input.prioridade, input.highlight, input.institutionalGroup || "nao_identificado"]);
}
