export type UnitType = "departamento" | "laboratorio";

export type DfdPurpose = "ensino" | "pesquisa" | "extensao" | "gestao";

export type AcademicContext =
  | "disciplina"
  | "laboratorio_sem_disciplina"
  | "projeto"
  | "rotina_administrativa"
  | "uso_compartilhado";

export type DfdRoutingInput = {
  purpose: DfdPurpose;
  context: AcademicContext;
  localUnitType: UnitType;
};

export type DfdRoutingResult = {
  analysisUnitType: UnitType;
  reason: string;
  requiresAttention: boolean;
};

export function resolveDfdRouting({
  purpose,
  context,
  localUnitType,
}: DfdRoutingInput): DfdRoutingResult {
  if (context === "disciplina") {
    return {
      analysisUnitType: "departamento",
      reason:
        "Demanda vinculada a disciplina: mesmo com uso em laboratório, a análise deve seguir para o departamento.",
      requiresAttention: localUnitType === "laboratorio",
    };
  }

  if (context === "laboratorio_sem_disciplina" && localUnitType === "laboratorio") {
    return {
      analysisUnitType: "laboratorio",
      reason:
        "Uso próprio de laboratório sem vínculo com disciplina específica: a análise pode seguir para a função de chefia do laboratório.",
      requiresAttention: false,
    };
  }

  if (context === "uso_compartilhado") {
    return {
      analysisUnitType: "departamento",
      reason:
        "Uso compartilhado entre turmas, setores ou ambientes: a análise deve ficar concentrada no departamento responsável.",
      requiresAttention: localUnitType === "laboratorio",
    };
  }

  if (purpose === "pesquisa") {
    return {
      analysisUnitType: "departamento",
      reason:
        "Demanda de pesquisa: por padrão, a análise fica concentrada no departamento responsável.",
      requiresAttention: localUnitType === "laboratorio",
    };
  }

  if (purpose === "extensao") {
    return {
      analysisUnitType: "departamento",
      reason:
        "Demanda de extensão: por padrão, a análise fica concentrada no departamento responsável.",
      requiresAttention: localUnitType === "laboratorio",
    };
  }

  if (purpose === "gestao") {
    return {
      analysisUnitType: "departamento",
      reason:
        "Demanda de gestão: a análise deve seguir para o departamento ou setor responsável pela rotina administrativa.",
      requiresAttention: false,
    };
  }

  return {
    analysisUnitType: "departamento",
    reason:
      "Demanda de ensino sem regra específica de laboratório: a análise deve seguir para o departamento.",
    requiresAttention: localUnitType === "laboratorio",
  };
}
