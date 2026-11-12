import type { AnalysisSessionSnapshot } from "./analysis-session";

export function analysisSaveFeedback(snapshot: AnalysisSessionSnapshot) {
  if (snapshot.conflict) return { label: "Conflito — revisar DFD", tone: "error", saving: false };
  if (snapshot.pendingFormal) return { label: "Confirmação pendente — abrir DFD", tone: "error", saving: false };
  if (snapshot.error) return { label: "Falha ao salvar — tentar novamente", tone: "error", saving: false };
  if (snapshot.busy || snapshot.saveState.startsWith("Salvando")) return { label: "Salvando…", tone: "pending", saving: true };
  if (snapshot.dirty) return { label: "Alteração ainda não salva", tone: "pending", saving: false };
  return { label: snapshot.saveState, tone: "success", saving: false };
}
