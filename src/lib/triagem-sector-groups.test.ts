import assert from "node:assert/strict";
import test from "node:test";

import { groupTriagemItemsBySector } from "./triagem-sector-groups";

test("agrupa pela unidade de análise e preserva o solicitante como contexto", () => {
  const groups = groupTriagemItemsBySector([
    {
      id: "item-1",
      dfd_id: "dfd-1",
      numero_protocolo: "DFD-1",
      solicitante_nome: "Ana Lúcia",
      solicitante_email: "ana@upe.br",
      analysis_unidade_nome: "Enfermagem",
      descricao: "Fio de sutura",
      quantidade: 2,
      valor_unitario_estimado: 10,
    },
    {
      id: "item-2",
      dfd_id: "dfd-2",
      numero_protocolo: "DFD-2",
      solicitante_nome: "Bruno Souza",
      solicitante_email: "bruno@upe.br",
      analysis_unidade_nome: "Enfermagem",
      descricao: "Luva cirúrgica",
      quantidade: 1,
      valor_unitario_estimado: 30,
    },
    {
      id: "item-3",
      dfd_id: "dfd-3",
      numero_protocolo: "DFD-3",
      solicitante_nome: "Ana Lúcia",
      solicitante_email: "ana@upe.br",
      analysis_unidade_nome: "Biblioteca",
      descricao: "Papel A4",
      quantidade: 5,
      valor_unitario_estimado: 4,
    },
  ]);

  assert.deepEqual(groups.map((group) => group.name), ["Biblioteca", "Enfermagem"]);
  assert.equal(groups[1].itemCount, 2);
  assert.equal(groups[1].dfdCount, 2);
  assert.equal(groups[1].total, 50);
  assert.deepEqual(groups[1].requesters.map((requester) => requester.name), ["Ana Lúcia", "Bruno Souza"]);
});

test("usa uma unidade identificável quando a DFD não possui unidade de análise", () => {
  const [group] = groupTriagemItemsBySector([
    {
      id: "item-1",
      dfd_id: "dfd-1",
      numero_protocolo: "DFD-1",
      solicitante_nome: "Ana Lúcia",
      solicitante_email: "ana@upe.br",
      analysis_unidade_nome: null,
      unidade_nome: "Setor Administrativo",
      descricao: "Papel A4",
      quantidade: 1,
      valor_unitario_estimado: 10,
    },
  ]);

  assert.equal(group.name, "Setor Administrativo");
  assert.equal(group.requesters[0].dfdCount, 1);
});
