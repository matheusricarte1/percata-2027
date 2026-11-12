import assert from "node:assert/strict";
import test from "node:test";
import { canCelebrateSector, type SectorCompletionDfd } from "./analysis-sector-completion";
const saved: SectorCompletionDfd = { id: "dfd", itemCount: 2, missingDecisions: 0, confirmed: true, eligible: true, changedInSession: true };
test("conclusão exige transição de pendente para decisões confirmadas", () => {
  assert.equal(canCelebrateSector(true, [saved]), true);
  assert.equal(canCelebrateSector(false, [saved]), false);
  assert.equal(canCelebrateSector(true, [{ ...saved, changedInSession: false }]), false);
});
test("não celebra antes do salvamento ou com uma decisão pendente", () => {
  assert.equal(canCelebrateSector(true, [{ ...saved, confirmed: false }]), false);
  assert.equal(canCelebrateSector(true, [saved, { ...saved, id: "outro", missingDecisions: 1 }]), false);
});
test("retirada de todos os itens e devolução não são conclusão de classificação", () => {
  assert.equal(canCelebrateSector(true, []), false);
  assert.equal(canCelebrateSector(true, [{ ...saved, itemCount: 0 }]), false);
  assert.equal(canCelebrateSector(true, [{ ...saved, eligible: false }]), false);
});
