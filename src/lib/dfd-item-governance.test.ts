import assert from "node:assert/strict";
import test from "node:test";
import { getDfdItemRemovalBlocker } from "./dfd-item-governance";

test("bloqueia a remoção de item sem justificativa auditável", () => {
  assert.equal(
    getDfdItemRemovalBlocker({ itemCount: 2, reason: "   " }),
    "Informe o motivo da remoção deste item.",
  );
});

test("não permite esvaziar uma DFD em triagem pela remoção unitária", () => {
  assert.equal(
    getDfdItemRemovalBlocker({ itemCount: 1, reason: "Item duplicado na DFD coletiva." }),
    "A DFD ficaria sem itens. Devolva a DFD inteira para correção.",
  );
});

test("permite remover um item justificado quando permanecem itens na DFD", () => {
  assert.equal(
    getDfdItemRemovalBlocker({ itemCount: 2, reason: "Item duplicado na DFD coletiva." }),
    null,
  );
});
