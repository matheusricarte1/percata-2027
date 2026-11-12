import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisEvaluation, AnalysisEvaluator, AnalysisItem } from "./dfd-analysis";
type DraftRow = { dfd_id: string; actor_id: string; updated_at: string; base_revision?: string; payload?: { items: AnalysisItem[] } };

/** Call only with IDs returned by the authorized analysis RPC. Never changes drafts. */
export async function readAnalysisEvaluations(client: SupabaseClient, role: string, ids: string[], includeItems = false) {
  const result = new Map<string, (AnalysisEvaluation | AnalysisEvaluator)[]>();
  if (role !== "superadmin" || !ids.length) return result;
  const { data, error } = await client.from("dfd_analysis_drafts")
    .select(includeItems ? "dfd_id,actor_id,updated_at,base_revision,payload" : "dfd_id,actor_id,updated_at")
    .in("dfd_id", [...new Set(ids)]).order("updated_at", { ascending: false });
  if (error) throw error;
  const drafts = data as unknown as DraftRow[] | null;
  if (!drafts?.length) return result;
  const { data: profiles, error: profileError } = await client.from("profiles")
    .select("id,full_name,avatar_url").in("id", [...new Set(drafts.map((draft) => draft.actor_id))]);
  if (profileError) throw profileError;
  for (const draft of drafts) {
    const profile = profiles?.find((entry) => entry.id === draft.actor_id);
    const evaluator: AnalysisEvaluator = { actorId: draft.actor_id, name: profile?.full_name || "Avaliador não identificado", avatarUrl: profile?.avatar_url || null, updatedAt: draft.updated_at };
    const evaluation = includeItems ? { ...evaluator, baseRevision: draft.base_revision || "", items: draft.payload?.items || [] } : evaluator;
    result.set(draft.dfd_id, [...(result.get(draft.dfd_id) || []), evaluation]);
  }
  return result;
}
