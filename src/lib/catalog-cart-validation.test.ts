import assert from "node:assert/strict";
import test from "node:test";

import { validateCatalogCartItem } from "./catalog-cart-validation";

test("catalog cart blocks a zero price before either DFD route", () => {
  const result = validateCatalogCartItem({
    quantidade: 1,
    valor_unitario_estimado: 0,
    link_referencia: "https://exemplo.gov.br/precos",
    justificativa_item: "Armário necessário para guardar materiais do setor.",
  });

  assert.equal(result.ready, false);
  assert.deepEqual(result.issues, ["Valor unitário"]);
});

test("catalog cart accepts a complete item", () => {
  const result = validateCatalogCartItem({
    quantidade: 2,
    valor_unitario_estimado: 230.5,
    link_referencia: "https://exemplo.gov.br/precos",
    justificativa_item: "Armário necessário para guardar materiais do setor.",
  });

  assert.equal(result.ready, true);
  assert.equal(result.subtotal, 461);
});
