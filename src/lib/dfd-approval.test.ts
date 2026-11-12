import assert from "node:assert/strict";
import test from "node:test";
import { isDfdReadyForApproval } from "./dfd-approval";

const item = {
  id: "61d9f53f-63e0-4f27-aca5-4bc28c83c386",
  quantidade: 2,
  is_highlight_item: false,
  criticidade: "alta",
  moscow_categoria: "must",
  justificativa_quantidade: null,
};

test("aprovação só aceita itens completos e identificados", () => {
  assert.equal(isDfdReadyForApproval([item]), true);
  assert.equal(isDfdReadyForApproval([{ ...item, criticidade: null }]), false);
  assert.equal(isDfdReadyForApproval([{ ...item, id: "invalido" }]), false);
});
