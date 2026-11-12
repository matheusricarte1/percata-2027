export type DfdPlanningFieldKey =
  | "problem"
  | "beneficiaries"
  | "expectedResult"
  | "essentialRequirements"
  | "constraints"
  | "consideredAlternatives"
  | "etpTrNotes";

export type DfdPlanningSubsidies = Partial<Record<DfdPlanningFieldKey, string>>;

export const DFD_PLANNING_FIELD_LABELS: Record<DfdPlanningFieldKey, string> = {
  problem: "Problema a resolver",
  beneficiaries: "Quem será beneficiado",
  expectedResult: "Resultado esperado",
  essentialRequirements: "O que não pode faltar",
  constraints: "Cuidados ou restrições",
  consideredAlternatives: "Alternativas consideradas",
  etpTrNotes: "Observações finais",
};

export const DFD_PLANNING_FIELD_HELPERS: Record<DfdPlanningFieldKey, string> = {
  problem: "Explique, em linguagem simples, o problema que motivou a demanda.",
  beneficiaries: "Informe setores, turmas, laboratórios, pessoas ou atividades atendidas.",
  expectedResult: "Descreva o que deve melhorar quando a contratação acontecer.",
  essentialRequirements: "Liste características mínimas para a solução funcionar bem.",
  constraints: "Registre compatibilidade, instalação, segurança, prazo, espaço ou sustentabilidade.",
  consideredAlternatives: "Cite reaproveitamento, estoque, manutenção, remanejamento ou outra solução avaliada.",
  etpTrNotes: "Guarde observações úteis para a etapa seguinte.",
};

export const DFD_PLANNING_FIELD_ORDER: DfdPlanningFieldKey[] = [
  "problem",
  "beneficiaries",
  "expectedResult",
  "essentialRequirements",
  "constraints",
  "consideredAlternatives",
  "etpTrNotes",
];

export function sanitizePlanningSubsidies(
  value: unknown,
  maxPerField = 1200,
): DfdPlanningSubsidies {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const result: DfdPlanningSubsidies = {};

  for (const key of DFD_PLANNING_FIELD_ORDER) {
    const text = String(source[key] || "").replace(/\s+/g, " ").trim().slice(0, maxPerField);
    if (text) result[key] = text;
  }

  return result;
}

export function hasPlanningSubsidies(value: DfdPlanningSubsidies | null | undefined) {
  return DFD_PLANNING_FIELD_ORDER.some((key) => Boolean(String(value?.[key] || "").trim()));
}

export function getMissingPlanningSubsidyFields(
  value: DfdPlanningSubsidies | null | undefined,
) {
  const sanitized = sanitizePlanningSubsidies(value);
  return DFD_PLANNING_FIELD_ORDER.filter(
    (key) => !String(sanitized[key] || "").trim(),
  );
}

export function getMissingPlanningSubsidyLabels(
  value: DfdPlanningSubsidies | null | undefined,
) {
  return getMissingPlanningSubsidyFields(value).map((key) => DFD_PLANNING_FIELD_LABELS[key]);
}

export function hasCompletePlanningSubsidies(value: DfdPlanningSubsidies | null | undefined) {
  return getMissingPlanningSubsidyFields(value).length === 0;
}

export function formatPlanningSubsidiesForText(
  value: DfdPlanningSubsidies | null | undefined,
) {
  const lines = DFD_PLANNING_FIELD_ORDER
    .map((key) => {
      const text = String(value?.[key] || "").trim();
      return text ? `${DFD_PLANNING_FIELD_LABELS[key]}: ${text}` : "";
    })
    .filter(Boolean);

  return lines.length > 0 ? `Subsídios de planejamento:\n${lines.join("\n")}` : "";
}

export function appendPlanningSubsidiesToJustification(
  justification: string | null | undefined,
  subsidies: DfdPlanningSubsidies | null | undefined,
) {
  return [String(justification || "").trim(), formatPlanningSubsidiesForText(subsidies)]
    .filter(Boolean)
    .join("\n\n");
}

export function buildCollectiveDfdJustification({
  description,
  scope,
  planningSubsidies,
}: {
  description?: string | null;
  scope?: string | null;
  planningSubsidies?: DfdPlanningSubsidies | null;
}) {
  const text = [
    String(description || "").trim(),
    String(scope || "").trim(),
    formatPlanningSubsidiesForText(planningSubsidies),
  ]
    .filter(Boolean)
    .join("\n\n");

  return text || "DFD coletiva gerada a partir da demanda do setor.";
}
