import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDfdDraftCartSaveInput,
  restoreDfdDraftCartItems,
  snapshotDfdDraftCartItems,
} from "./dfd-draft-cart.ts";

describe("dfd-draft-cart", () => {
  it("preserva os itens do carrinho no rascunho para restaurar em outro navegador", () => {
    const items = [
      {
        uid: "item-1",
        item_efisco: { codigo_tce: "123", descricao: "Material de teste" },
        quantidade: 3,
        valor_unitario_estimado: 12.5,
        justificativa_item: "Necessário para a rotina administrativa.",
        justificativa_quantidade: "Reposição trimestral.",
        link_referencia: "https://exemplo.test/item",
        local_de_uso: "Administração",
      },
    ];

    const snapshot = snapshotDfdDraftCartItems(items);

    assert.deepEqual(restoreDfdDraftCartItems(snapshot), items);
  });

  it("ignora uma carga de carrinho inválida sem apagar o carrinho atual", () => {
    assert.deepEqual(restoreDfdDraftCartItems({ uid: "nao-e-lista" }), []);
    assert.deepEqual(restoreDfdDraftCartItems([{ uid: "sem-item" }]), []);
  });

  it("prepara somente itens válidos para o salvamento automático no servidor", () => {
    const input = buildDfdDraftCartSaveInput([
      { uid: "valido", item_efisco: { codigo_tce: "1" }, quantidade: 2 },
      { uid: "invalido" },
    ]);

    assert.deepEqual(input, [
      { uid: "valido", item_efisco: { codigo_tce: "1" }, quantidade: 2 },
    ]);
  });
});
