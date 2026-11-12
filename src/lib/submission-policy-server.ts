import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { SubmissionState } from "./submission-policy";

type Admin = ReturnType<typeof createSupabaseAdminClient>;
export async function loadSubmissionState(admin: Admin, actorId: string, dfdId: string | null = null) {
  const { data, error } = await admin.rpc("submission_policy_state", { p_actor: actorId, p_dfd: dfdId });
  if (error) throw new Error("Não foi possível verificar o prazo e as autorizações. Tente novamente.");
  return data as SubmissionState;
}

export function submissionOperationError(message: string) {
  if (message.includes("FORBIDDEN")) return { status: 403, error: "Você não tem permissão para esta operação." };
  if (message.includes("USER_INACTIVE")) return { status: 409, error: "O usuário precisa estar ativo para receber uma liberação." };
  if (message.includes("NO_ACTIVE_CYCLE")) return { status: 409, error: "Não há um ciclo de planejamento ativo." };
  if (message.includes("INVALID_EXPIRY")) return { status: 400, error: "A validade deve estar no futuro e até o encerramento da análise da chefia." };
  if (message.includes("REASON_REQUIRED")) return { status: 400, error: "Informe o motivo ou a descrição da correção, com pelo menos 3 caracteres." };
  if (message.includes("STATUS_CHANGED")) return { status: 409, error: "A DFD mudou de etapa. Atualize a página antes de continuar." };
  if (message.includes("REVISION_CONFLICT")) return { status: 409, error: "A DFD mudou em outra sessão. Seus dados continuam no editor; atualize e compare antes de salvar." };
  if (message.includes("CORRECTION_IN_PROGRESS")) return { status: 409, error: "O solicitante está corrigindo esta DFD. Aguarde o reenvio ou encerre a autorização antes de decidir." };
  if (message.includes("SUBMISSION_CLOSED")) return { status: 409, error: message.split("SUBMISSION_CLOSED:").at(-1)?.trim() || "Prazo encerrado. Somente correções autorizadas podem continuar." };
  if (message.includes("LAST_ITEM")) return { status: 400, error: "A DFD precisa ter ao menos um item." };
  if (message.includes("INVALID_ITEMS") || message.includes("INVALID_QUANTITY")) return { status: 400, error: "Confira os itens: quantidade inteira positiva, valor positivo e justificativas preenchidas." };
  return { status: 500, error: "Não foi possível concluir a operação. Tente novamente." };
}
