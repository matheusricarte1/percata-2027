const TECHNICAL_ERROR_PATTERNS: Array<[RegExp, string]> = [
  [/usuario nao autenticado|usuário não autenticado|jwt|auth|token/i, "Não conseguimos confirmar sua identidade. Entre novamente e tente mais uma vez."],
  [/acesso negado|permission|forbidden|rls/i, "Você não tem permissão para fazer isso agora. Se parecer incorreto, peça a revisão do acesso."],
  [/network|fetch failed|failed to fetch|timeout/i, "A conexão oscilou antes de concluir. Verifique a internet e tente de novo."],
  [/status invalido|transicao de status invalida|transição de status inválida/i, "Essa etapa já mudou ou não aceita essa ação. Atualize a página para ver o estado mais recente."],
  [/nao encontrada|não encontrada|not found/i, "Não encontramos esse registro. Ele pode ter sido movido, removido ou atualizado por outra pessoa."],
  [/duplicate|duplicado|unique constraint/i, "Já existe um registro parecido. Revise os dados antes de tentar novamente."],
  [/rate limit|too many|muitas tentativas/i, "Recebemos muitas tentativas em sequência. Aguarde um pouco antes de tentar novamente."],
];

export function getFriendlyErrorMessage(
  error: unknown,
  fallback = "Não foi possível concluir agora. Tente novamente em instantes.",
) {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message || "")
        : "";
  const message = raw.trim();
  if (!message) return fallback;

  for (const [pattern, friendly] of TECHNICAL_ERROR_PATTERNS) {
    if (pattern.test(message)) return friendly;
  }

  if (/erro|falha|invalid|bad request|database|schema|column|constraint/i.test(message)) {
    return fallback;
  }

  return message;
}

export const UX_SUCCESS = {
  saved: "Pronto, suas alterações foram salvas.",
  draftKept: "Rascunho mantido. Você pode continuar de onde parou.",
  collectiveRoomCreated: "Sala coletiva aberta. As pessoas do setor já podem contribuir.",
  collectiveProposalSent: "Proposta enviada para a chefia revisar.",
  itemPrepared: "Item preparado. Agora informe quantidade, valor e justificativa.",
};

export const UX_WARNING = {
  completeRequiredFields: "Falta pouco: revise os campos marcados antes de continuar.",
  chooseUnit: "Escolha o setor ou laboratório responsável para seguir.",
  addAtLeastOneItem: "Adicione pelo menos um item antes de finalizar.",
};
