import assert from "node:assert/strict";
import test from "node:test";
import { canSuperadminReassignDfd } from "./dfd-reassignment";

test("superadmin só pode reencaminhar DFD antes da avaliação da chefia", () => {
  assert.equal(canSuperadminReassignDfd("rascunho"), true);
  assert.equal(canSuperadminReassignDfd("triagem"), true);
  assert.equal(canSuperadminReassignDfd("devolvida"), false);
  assert.equal(canSuperadminReassignDfd("aprovada"), false);
});
