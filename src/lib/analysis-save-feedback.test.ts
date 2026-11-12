import assert from "node:assert/strict";
import test from "node:test";
import { analysisSaveFeedback } from "./analysis-save-feedback";
import type { AnalysisSessionSnapshot } from "./analysis-session";
const base: AnalysisSessionSnapshot = { working: { items: [], reason: "" }, saveState: "Rascunho salvo às 10:30", error: "", conflict: false, pendingFormal: false, busy: false, ready: true, compared: true, dirty: false };
test("salvamento de rascunho em andamento independe do busy da decisão formal", () => {
  assert.equal(analysisSaveFeedback({ ...base, dirty: true, saveState: "Salvando rascunho…" }).saving, true);
});
test("rascunho completo continua apresentado como salvo", () => {
  assert.equal(analysisSaveFeedback(base).label, "Rascunho salvo às 10:30");
});
test("conflito e confirmação incerta exigem revisão antes de repetir uma ação", () => {
  assert.equal(analysisSaveFeedback({ ...base, error: "Erro", conflict: true }).label, "Conflito — revisar DFD");
  assert.equal(analysisSaveFeedback({ ...base, pendingFormal: true }).label, "Confirmação pendente — abrir DFD");
});
test("erro e alteração local nunca são apresentados como salvos", () => {
  assert.equal(analysisSaveFeedback({ ...base, dirty: true }).tone, "pending");
  assert.equal(analysisSaveFeedback({ ...base, error: "Rede indisponível" }).tone, "error");
  assert.equal(analysisSaveFeedback(base).label, base.saveState);
});
