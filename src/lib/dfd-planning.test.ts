import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendPlanningSubsidiesToJustification,
  buildCollectiveDfdJustification,
  formatPlanningSubsidiesForText,
  getMissingPlanningSubsidyLabels,
  hasPlanningSubsidies,
  sanitizePlanningSubsidies,
} from "./dfd-planning.ts";

describe("dfd-planning", () => {
  it("keeps only known planning subsidy fields with trimmed readable text", () => {
    const result = sanitizePlanningSubsidies({
      problem: "  falta de projetores nas salas  ",
      expectedResult: "aulas mais fluidas\n\ncom menos interrupcao",
      unknown: "nao deve entrar",
      constraints: "",
    });

    assert.deepEqual(result, {
      problem: "falta de projetores nas salas",
      expectedResult: "aulas mais fluidas com menos interrupcao",
    });
  });

  it("formats filled subsidies as a reusable planning block", () => {
    const text = formatPlanningSubsidiesForText({
      problem: "falta de insumos",
      beneficiaries: "laboratorios de ensino",
      essentialRequirements: "compatibilidade com equipamentos existentes",
    });

    assert.match(text, /^Subsídios de planejamento:/);
    assert.match(text, /Problema a resolver: falta de insumos/);
    assert.match(text, /Quem será beneficiado: laboratorios de ensino/);
    assert.match(text, /O que não pode faltar: compatibilidade/);
  });

  it("appends planning subsidies to the justification without replacing the DFD text", () => {
    const text = appendPlanningSubsidiesToJustification("Necessidade institucional.", {
      expectedResult: "reduzir retrabalho",
    });

    assert.equal(
      text,
      "Necessidade institucional.\n\nSubsídios de planejamento:\nResultado esperado: reduzir retrabalho",
    );
    assert.equal(hasPlanningSubsidies({ expectedResult: "reduzir retrabalho" }), true);
    assert.equal(hasPlanningSubsidies({}), false);
  });

  it("reports missing required planning subsidy fields with human labels", () => {
    const missing = getMissingPlanningSubsidyLabels({
      problem: "salas sem equipamentos suficientes",
      beneficiaries: "turmas de graduação",
      expectedResult: "aulas sem interrupção",
    });

    assert.deepEqual(missing, [
      "O que não pode faltar",
      "Cuidados ou restrições",
      "Alternativas consideradas",
      "Observações finais",
    ]);
  });

  it("builds the collective DFD justification from room context and planning subsidies", () => {
    const text = buildCollectiveDfdJustification({
      description: "Demanda comum dos laboratorios.",
      scope: "Entram apenas itens de uso compartilhado.",
      planningSubsidies: {
        problem: "itens comprados de forma fragmentada",
        expectedResult: "reduzir compras duplicadas",
      },
    });

    assert.match(text, /Demanda comum dos laboratorios/);
    assert.match(text, /Entram apenas itens de uso compartilhado/);
    assert.match(text, /Problema a resolver: itens comprados/);
    assert.match(text, /Resultado esperado: reduzir compras duplicadas/);
  });

  it("uses a clear fallback for collective DFDs without room context", () => {
    assert.equal(
      buildCollectiveDfdJustification({}),
      "DFD coletiva gerada a partir da demanda do setor.",
    );
  });
});
