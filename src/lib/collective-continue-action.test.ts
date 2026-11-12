import { strict as assert } from "node:assert";
import { test } from "node:test";
import { collectiveContinueAction } from "./collective-continue-action";

test("participant conclusion explains that consolidation remains with the head", () => {
  const action = collectiveContinueAction(false, "aberta", 0);
  assert.equal(action.label, "Concluir participação");
  assert.match(action.hint, /chefia/);
  assert.equal(action.reviewCart, false);
});
test("open room closure and an already closed room have different actions", () => {
  assert.equal(collectiveContinueAction(true, "aberta", 0).label, "Consolidar sala");
  assert.equal(collectiveContinueAction(true, "em_consolidacao_chefia", 0).label, "Revisar consolidação");
});
test("pending cart takes precedence for every role", () => {
  for (const canConsolidate of [false, true]) {
    const action = collectiveContinueAction(canConsolidate, "aberta", 2);
    assert.equal(action.reviewCart, true);
    assert.equal(action.label, "Revisar itens pendentes");
  }
});
