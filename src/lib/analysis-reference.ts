import type { AnalysisDfd, AnalysisItem } from "./dfd-analysis";

/** Institutional consultation stays separate from the actor's editable draft. */
export function analysisDisplayItem(dfd: AnalysisDfd, own: AnalysisItem): AnalysisItem {
  const reference = dfd.referenceEvaluation;
  if (!reference || reference.baseRevision !== dfd.revision) return own;
  const item = reference.items.find((entry) => entry.id === own.id);
  return item ? { ...own, ...item } : own;
}
