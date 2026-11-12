export function collectiveContinueAction(canConsolidate: boolean, status: string, pendingCount: number) {
  if (pendingCount > 0) return {
    label: "Revisar itens pendentes",
    hint: "Envie os itens do carrinho para a sala antes de continuar.",
    reviewCart: true,
  };
  return {
    label: canConsolidate ? status === "aberta" ? "Consolidar sala" : "Revisar consolidação" : "Concluir participação",
    hint: canConsolidate
      ? status === "aberta" ? "Encerra a inclusão de pedidos e inicia a revisão pela chefia." : "Abre a revisão dos pedidos da sala."
      : "Seus pedidos enviados permanecem na sala. A chefia fará a consolidação.",
    reviewCart: false,
  };
}
