import { test } from "node:test";
import assert from "node:assert/strict";
import { consolidationContextKey } from "./consolidation-context";
const request = { id: "a", dfdId: "dfd", campusId: "ouricuri", code: "123",
  gnd: "4.4.90.52", unit: "UN", eligible: true, criticidade: "critica",
  prioridade: "deve_ter", highlight: false };
test("capital preserves independent requests even with identical catalog and ratings", () => {
  assert.notEqual(consolidationContextKey(request), consolidationContextKey({ ...request, id: "b" }));
  assert.notEqual(consolidationContextKey(request), consolidationContextKey({ ...request, dfdId: "other" }));
});
test("unclassified requests stay independent until expense nature is confirmed", () => {
  for (const gnd of ["", "SEM_NATUREZA"]) {
    assert.notEqual(consolidationContextKey({ ...request, gnd }), consolidationContextKey({ ...request, gnd, id: "b" }));
  }
});
test("purchasing groups never mix campus, nature, units, eligibility or evaluations", () => {
  const current = { ...request, gnd: "3.3.90.30" };
  assert.equal(consolidationContextKey(current), consolidationContextKey({ ...current, id: "b" }));
  for (const change of [{ campusId: "petrolina" }, { gnd: "3.3.90.39" }, { unit: "CX" },
    { eligible: false }, { criticidade: "baixa" }, { prioridade: "poderia_ter" }, { highlight: true }]) {
    assert.notEqual(consolidationContextKey(current), consolidationContextKey({ ...current, ...change }));
  }
});
