const LEGACY_HISTORY_PRIMARY_VIEW = "legacy_pa_minhas_demandas_v3";
const LEGACY_HISTORY_FALLBACK_VIEW = "legacy_pa_minhas_demandas_v2";

type SupabaseLikeResult<T> = {
  data: T[] | null;
  error: { message?: string; code?: string } | null;
};

function relationNotFound(error: { message?: string; code?: string } | null, relation: string) {
  if (!error) return false;
  const code = String(error.code || "").trim().toUpperCase();
  const text = String(error.message || "").toLowerCase();
  return (
    code === "42P01" ||
    (text.includes(relation.toLowerCase()) &&
      (text.includes("does not exist") ||
        text.includes("schema cache") ||
        text.includes("could not find the table")))
  );
}

export async function withLegacyHistoryViewFallback<T>(
  runQuery: (viewName: string) => Promise<SupabaseLikeResult<T>>,
): Promise<{ data: T[] | null; error: { message?: string; code?: string } | null; view: string }> {
  const primary = await runQuery(LEGACY_HISTORY_PRIMARY_VIEW);
  if (!relationNotFound(primary.error, LEGACY_HISTORY_PRIMARY_VIEW)) {
    return { ...primary, view: LEGACY_HISTORY_PRIMARY_VIEW };
  }

  const fallback = await runQuery(LEGACY_HISTORY_FALLBACK_VIEW);
  return { ...fallback, view: LEGACY_HISTORY_FALLBACK_VIEW };
}

