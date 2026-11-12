import assert from "node:assert/strict";
import test from "node:test";

import { groupTriagemItemsByRequester } from "./triagem-solicitante-groups";

test("agrupa itens de DFDs diferentes pelo mesmo solicitante", () => {
  const groups = groupTriagemItemsByRequester([
    {
      id: "item-1",
      dfd_id: "dfd-1",
      numero_protocolo: "DFD-1",
      solicitante_nome: "Ana Lúcia",
      solicitante_email: "ana@upe.br",
      descricao: "Papel A4",
      quantidade: 2,
      valor_unitario_estimado: 10,
    },
    {
      id: "item-2",
      dfd_id: "dfd-2",
      numero_protocolo: "DFD-2",
      solicitante_nome: "Ana Lúcia",
      solicitante_email: "ana@upe.br",
      descricao: "Filtro de linha",
      quantidade: 1,
      valor_unitario_estimado: 30,
    },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].dfdCount, 2);
  assert.equal(groups[0].itemCount, 2);
  assert.equal(groups[0].total, 50);
  assert.deepEqual(groups[0].items.map((item) => item.numero_protocolo), ["DFD-1", "DFD-2"]);
});
