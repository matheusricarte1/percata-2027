import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCollectiveDfdRoutingFields,
  resolveDfdRouting,
  type AcademicContext,
  type DfdPurpose,
} from "./dfd-routing.ts";

function route(
  purpose: DfdPurpose,
  context: AcademicContext,
  localUnitType: "departamento" | "laboratorio",
) {
  return resolveDfdRouting({ purpose, context, localUnitType });
}

describe("resolveDfdRouting", () => {
  it("routes discipline-linked lab usage to the department", () => {
    const result = route("ensino", "disciplina", "laboratorio");

    assert.equal(result.analysisUnitType, "departamento");
    assert.equal(result.requiresAttention, true);
    assert.match(result.reason, /disciplina/i);
  });

  it("routes lab-specific usage without discipline to the laboratory", () => {
    const result = route("ensino", "laboratorio_sem_disciplina", "laboratorio");

    assert.equal(result.analysisUnitType, "laboratorio");
    assert.equal(result.requiresAttention, false);
  });

  it("routes research and extension projects to the department by default", () => {
    assert.equal(route("pesquisa", "projeto", "laboratorio").analysisUnitType, "departamento");
    assert.equal(route("extensao", "projeto", "laboratorio").analysisUnitType, "departamento");
  });

  it("routes management routines to the department unless it is lab maintenance", () => {
    assert.equal(route("gestao", "rotina_administrativa", "departamento").analysisUnitType, "departamento");
    assert.equal(route("gestao", "laboratorio_sem_disciplina", "laboratorio").analysisUnitType, "laboratorio");
  });

  it("routes shared academic use to the department with a shared-use reason", () => {
    const result = route("ensino", "uso_compartilhado", "laboratorio");

    assert.equal(result.analysisUnitType, "departamento");
    assert.match(result.reason, /compartilhado/i);
  });
});

describe("buildCollectiveDfdRoutingFields", () => {
  it("routes converted collective DFDs to the room unit explicitly", () => {
    const routing = buildCollectiveDfdRoutingFields({
      unitId: "81f0a9d5-bbc1-4d18-bd47-072dbdeb1597",
      unitType: "departamento",
    });

    assert.deepEqual(routing, {
      analysis_unidade_id: "81f0a9d5-bbc1-4d18-bd47-072dbdeb1597",
      analysis_tipo_unidade: "departamento",
      analysis_routing_reason:
        "DFD coletiva convertida: analise encaminhada para a unidade responsavel pela sala coletiva.",
    });
  });
});
