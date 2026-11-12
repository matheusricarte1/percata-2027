import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getTriagemTargetUnitId,
  resolveTriagemUnitIds,
  shouldIncludeCampusOrphanTriagemRow,
} from "./dfd-triagem-scope";

describe("resolveTriagemUnitIds", () => {
  it("keeps a chefia restricted to units explicitly assigned as chefia", () => {
    const unitIds = resolveTriagemUnitIds({
      profileRole: "chefia",
      units: [
        {
          unit_id: "member-unit",
          role_in_unit: "membro",
        },
        {
          unit_id: "chefia-unit",
          role_in_unit: "chefia",
        },
      ],
    });

    assert.deepEqual(unitIds, ["chefia-unit"]);
  });

  it("keeps solicitantes limited to explicit chefia unit links", () => {
    const unitIds = resolveTriagemUnitIds({
      profileRole: "solicitante",
      units: [
        { unit_id: "member-unit", role_in_unit: "membro" },
        { unit_id: "chefia-unit", role_in_unit: "chefia" },
      ],
    });

    assert.deepEqual(unitIds, ["chefia-unit"]);
  });
});

describe("triagem campus orphan visibility", () => {
  it("uses the analysis unit before the origin unit", () => {
    assert.equal(
      getTriagemTargetUnitId({
        unidade_id: "origin-unit",
        analysis_unidade_id: "analysis-unit",
      }),
      "analysis-unit",
    );
  });

  it("does not expand a multi-unit chief to unassigned units in the campus", () => {
    assert.equal(
      shouldIncludeCampusOrphanTriagemRow({
        row: {
          campus_id: "campus-1",
          analysis_unidade_id: "unit-without-chief",
        },
        profileRole: "chefia",
        campusId: "campus-1",
        directUnitIds: ["other-unit"],
        unitsWithAssignedChefia: new Set(["other-unit"]),
      }),
      false,
    );
  });

  it("does not include rows from units that already have an assigned chief", () => {
    assert.equal(
      shouldIncludeCampusOrphanTriagemRow({
        row: {
          campus_id: "campus-1",
          analysis_unidade_id: "unit-with-chief",
        },
        profileRole: "chefia",
        campusId: "campus-1",
        directUnitIds: [],
        unitsWithAssignedChefia: new Set(["unit-with-chief"]),
      }),
      false,
    );
  });
});
