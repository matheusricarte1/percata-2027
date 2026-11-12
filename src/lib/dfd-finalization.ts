export type DfdFinalizationMode = "draft" | "triagem";

type DfdFinalizationCopy = {
  actionLabel: string;
  confirmationTitle: string;
  description: string;
  progressTitle: string;
  progressDescription: string;
  confirmLabel: string;
};

export function getDfdFinalizationCopy(
  mode: DfdFinalizationMode,
): DfdFinalizationCopy {
  if (mode === "triagem") {
    return {
      actionLabel: "Finalizar e enviar à chefia",
      confirmationTitle: "Finalizar e enviar à chefia",
      description:
        "As DFDs serão finalizadas e enviadas diretamente para a fila da chefia.",
      progressTitle: "Finalizando e enviando para a chefia",
      progressDescription:
        "Estamos salvando os itens e encaminhando as DFDs para a fila de análise.",
      confirmLabel: "Finalizar e enviar",
    };
  }

  return {
    actionLabel: "Salvar como rascunho",
    confirmationTitle: "Salvar como rascunho",
    description: "As DFDs ficarão em Minhas DFDs para sua revisão antes do envio.",
    progressTitle: "Salvando seus rascunhos",
    progressDescription: "Estamos salvando os itens e as informações de análise.",
    confirmLabel: "Salvar como rascunho",
  };
}
