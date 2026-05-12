import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
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
