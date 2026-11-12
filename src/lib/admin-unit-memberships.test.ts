import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeManagedUnitLinks } from "./admin-unit-memberships.ts";

describe("normalizeManagedUnitLinks", () => {
  it("keeps every distinct laboratory link and its role", () => {
    assert.deepEqual(
      normalizeManagedUnitLinks([
        { unit_id: "lab-a", unit_type: "laboratorio", role_in_unit: "membro" },
        { unit_id: "lab-b", unit_type: "laboratorio", role_in_unit: "chefia" },
        { unit_id: "lab-a", unit_type: "laboratorio", role_in_unit: "chefia" },
      ]),
      [
        { unit_id: "lab-a", unit_type: "laboratorio", role_in_unit: "chefia" },
        { unit_id: "lab-b", unit_type: "laboratorio", role_in_unit: "chefia" },
      ],
    );
  });

  it("keeps multiple department links for a multi-unit chief", () => {
    assert.deepEqual(
      normalizeManagedUnitLinks([
        { unit_id: "dept-a", unit_type: "departamento", role_in_unit: "chefia" },
        { unit_id: "dept-b", unit_type: "departamento", role_in_unit: "chefia" },
        { unit_id: "dept-c", unit_type: "departamento", role_in_unit: "membro" },
      ]),
      [
        { unit_id: "dept-a", unit_type: "departamento", role_in_unit: "chefia" },
        { unit_id: "dept-b", unit_type: "departamento", role_in_unit: "chefia" },
        { unit_id: "dept-c", unit_type: "departamento", role_in_unit: "membro" },
      ],
    );
  });
});
