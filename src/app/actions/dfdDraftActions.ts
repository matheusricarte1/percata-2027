"use server";

import { createClient } from "@/utils/supabase/server";

/**
 * Server Actions para o rascunho do wizard nova-dfd.
 *
 * Padrão de uso no cliente:
 *
 *   // Ao montar:
 *   const draft = await loadDfdDraftAction();
 *   if (draft?.payload) restoreFromDraft(draft.payload);
 *
 *   // Em cada mudança relevante (debounce ~1500ms):
 *   await saveDfdDraftAction({ payload: snapshot(), step: currentStep });
 *
 *   // Após finalize bem-sucedido:
 *   await clearDfdDraftAction();
 *
 * Schema-version: incrementar SCHEMA_VERSION quando o shape do payload
 * mudar de forma incompatível. Rascunhos antigos são ignorados pelo loader.
 */

export const DFD_DRAFT_SCHEMA_VERSION = 1;

export type DfdDraftPayload = Record<string, unknown>;

export type DfdDraftSnapshot = {
  payload: DfdDraftPayload;
  schema_version: number;
  current_step: string | null;
  updated_at: string;
  expires_at: string;
};

export async function loadDfdDraftAction(): Promise<DfdDraftSnapshot | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("dfd_drafts")
    .select("payload, schema_version, current_step, updated_at, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  // Ignora rascunhos de schemas antigos — front decide se quer migrar.
  if (Number(data.schema_version) !== DFD_DRAFT_SCHEMA_VERSION) {
    return null;
  }

  // Ignora rascunhos vencidos (defesa em profundidade; o BD não deleta sozinho).
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }

  return data as DfdDraftSnapshot;
}

export async function saveDfdDraftAction(params: {
  payload: DfdDraftPayload;
  currentStep?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado." };

    // Limita tamanho do JSON para evitar abuso (~512 KB max razoável).
    const serialized = JSON.stringify(params.payload || {});
    if (serialized.length > 512_000) {
      return { ok: false, error: "Rascunho excede o tamanho máximo permitido." };
    }

    const { error } = await supabase.from("dfd_drafts").upsert(
      {
        user_id: user.id,
        payload: params.payload,
        schema_version: DFD_DRAFT_SCHEMA_VERSION,
        current_step: params.currentStep || null,
      },
      { onConflict: "user_id" },
    );

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erro ao salvar rascunho." };
  }
}

export async function clearDfdDraftAction(): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    await supabase.from("dfd_drafts").delete().eq("user_id", user.id);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
