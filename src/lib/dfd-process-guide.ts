export type DfdProcessStatus =
  | "rascunho"
  | "triagem"
  | "aprovada"
  | "devolvida"
  | "pactuando"
  | "concluida"
  | string
  | null
  | undefined;

export type DfdChecklistState = "done" | "attention" | "pending";

export type DfdSendReadinessInput = {
  status?: DfdProcessStatus;
  isCreator: boolean;
  itemCount: number;
  hasObject: boolean;
  hasJustification: boolean;
  hasQuantityBasis: boolean;
  hasUnit: boolean;
  hasOnlyOneExpenseClass: boolean;
};

export const DFD_PROCESS_STEPS = [
  {
    id: "build",
    label: "Montar a DFD",
    description: "Escolha os itens, revise quantidades, GND e local de uso.",
  },
  {
    id: "send",
    label: "Enviar à chefia",
    description: "Somente a pessoa que criou a DFD pode enviar para análise.",
  },
  {
    id: "review",
    label: "Análise da chefia",
    description: "A chefia confere vínculo, justificativas, prioridades e orçamento.",
  },
  {
    id: "finish",
    label: "Consolidação",
    description: "DFDs homologadas seguem para pactuação e consolidação institucional.",
  },
] as const;

export function getDfdProcessStage(status: DfdProcessStatus) {
  const normalized = String(status || "rascunho").toLowerCase();
  if (normalized === "triagem") {
    return {
      label: "Com a chefia",
      description: "A DFD já saiu do rascunho e está na fila de análise da chefia.",
      stepIndex: 2,
    };
  }
  if (normalized === "aprovada" || normalized === "pactuando") {
    return {
      label: "Homologada",
      description: "A chefia concluiu a análise e a demanda segue para consolidação.",
      stepIndex: 3,
    };
  }
  if (normalized === "concluida") {
    return {
      label: "Concluída",
      description: "A demanda já passou pelo fluxo de análise e consolidação.",
      stepIndex: 4,
    };
  }
  if (normalized === "devolvida") {
    return {
      label: "Devolvida",
      description: "A DFD precisa de ajuste antes de voltar para a chefia.",
      stepIndex: 1,
    };
  }

  return {
    label: "Em preparo",
    description: "Revise os dados essenciais antes de enviar para análise.",
    stepIndex: 1,
  };
}

export function getDfdSendReadiness(input: DfdSendReadinessInput) {
  const blockers: string[] = [];
  const normalizedStatus = String(input.status || "rascunho").toLowerCase();

  if (normalizedStatus !== "rascunho" && normalizedStatus !== "devolvida") {
    blockers.push("A DFD precisa estar em rascunho ou devolvida para ser enviada.");
  }
  if (!input.isCreator) {
    blockers.push("Somente a pessoa que criou a DFD pode enviar para a chefia.");
  }
  if (input.itemCount <= 0) {
    blockers.push("Inclua ao menos um item.");
  }
  if (!input.hasObject) {
    blockers.push("Informe o objeto da contratação.");
  }
  if (!input.hasJustification) {
    blockers.push("Informe a justificativa da necessidade.");
  }
  if (!input.hasQuantityBasis) {
    blockers.push("Informe a base de cálculo das quantidades.");
  }
  if (!input.hasUnit) {
    blockers.push("Selecione o setor ou laboratório de uso/análise.");
  }
  if (!input.hasOnlyOneExpenseClass) {
    blockers.push("Separe custeio e capital em DFDs diferentes.");
  }

  return {
    canSend: blockers.length === 0,
    blockers,
  };
}

export function getDfdProcessChecklist(input: DfdSendReadinessInput) {
  const normalizedStatus = String(input.status || "rascunho").toLowerCase();
  const alreadySent = !["rascunho", "devolvida"].includes(normalizedStatus);

  return [
    {
      id: "items",
      label: "Itens e quantidades",
      helper: "A DFD precisa ter itens com quantidade e valor estimado.",
      state: input.itemCount > 0 ? "done" : "attention",
    },
    {
      id: "expense-class",
      label: "Custeio ou capital",
      helper: "Não misture custeio e capital na mesma DFD.",
      state: input.hasOnlyOneExpenseClass ? "done" : "attention",
    },
    {
      id: "context",
      label: "Objeto e justificativa",
      helper: "Explique o que será contratado e por que é necessário.",
      state: input.hasObject && input.hasJustification ? "done" : "attention",
    },
    {
      id: "quantity-basis",
      label: "Base de cálculo",
      helper: "Mostre como chegou às quantidades solicitadas.",
      state: input.hasQuantityBasis ? "done" : "attention",
    },
    {
      id: "unit",
      label: "Setor/laboratório",
      helper: "O vínculo define para qual chefia a DFD será enviada.",
      state: input.hasUnit ? "done" : "attention",
    },
    {
      id: "sent",
      label: "Envio à chefia",
      helper: "Depois do envio, a chefia analisa e pode homologar ou devolver.",
      state: alreadySent ? "done" : input.isCreator ? "pending" : "attention",
    },
  ] satisfies Array<{
    id: string;
    label: string;
    helper: string;
    state: DfdChecklistState;
  }>;
}
