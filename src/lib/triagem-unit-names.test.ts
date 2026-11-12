import assert from "node:assert/strict";
import test from "node:test";

import { applyTriagemUnitNames } from "./triagem-unit-names";

test("prioriza o nome da unidade de análise para a fila por setor", () => {
  const [row] = applyTriagemUnitNames(
    [
      {
        id: "dfd-1",
        analysis_unidade_id: "lab-1",
        analysis_tipo_unidade: "laboratorio",
        unidade_id: "dep-1",
        tipo_unidade: "departamento",
      },
    ],
    new Map([
      ["laboratorio:lab-1", "Laboratório de Biologia"],
      ["departamento:dep-1", "Ciências da Saúde"],
    ]),
  );

  assert.equal(row.analysis_unidade_nome, "Laboratório de Biologia");
  assert.equal(row.unidade_nome, "Ciências da Saúde");
});

test("usa a unidade de origem como fallback quando não há rota de análise", () => {
  const [row] = applyTriagemUnitNames(
    [
      {
        id: "dfd-1",
        analysis_unidade_id: null,
        analysis_tipo_unidade: null,
        unidade_id: "dep-1",
        tipo_unidade: "departamento",
      },
    ],
    new Map([["departamento:dep-1", "Setor Administrativo"]]),
  );

  assert.equal(row.analysis_unidade_nome, "Setor Administrativo");
  assert.equal(row.unidade_nome, "Setor Administrativo");
});
