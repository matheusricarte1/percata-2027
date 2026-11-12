import assert from "node:assert/strict";
import test from "node:test";
import { analysisError, getReviewBlocker } from "./dfd-analysis.ts";
test("remoção do último item orienta a devolver a DFD e preserva o motivo", () => {
  const item = {
    id: "item",
    descricao: "Mesa",
    quantidade: 1,
    valor_unitario_estimado: 10,
    criticidade: null,
    moscow_categoria: null,
    is_highlight_item: false,
    remove: true,
    removalReason: "Duplicado",
  };
  assert.match(getReviewBlocker([item], "apply")!, /Devolva/);
  assert.equal(analysisError("LAST_ITEM").status, 409);
  assert.match(analysisError("LAST_ITEM").message, /Devolver para correção/);
});
