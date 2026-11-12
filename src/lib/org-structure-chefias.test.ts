import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildChefiaAssignmentMap } from "./org-structure-chefias.ts";

describe("buildChefiaAssignmentMap", () => {
  it("maps chefia assignments from separately fetched user_units and profiles", () => {
    const map = buildChefiaAssignmentMap(
      [
        { id: "dept-1", type: "departamento" },
        { id: "lab-1", type: "laboratorio" },
      ],
      [
        {
          unit_type: "departamento",
          unit_id: "dept-1",
          user_id: "user-1",
        },
        {
          unit_type: "laboratorio",
          unit_id: "lab-1",
          user_id: "user-2",
        },
      ],
      [
        {
          id: "user-1",
          full_name: "Maria Chefia",
          email: "maria@example.edu",
        },
        {
          id: "user-2",
          full_name: "Joao Laboratorio",
          email: "joao@example.edu",
        },
      ],
    );

    assert.deepEqual(map.get("departamento:dept-1"), [{
      user_id: "user-1",
      full_name: "Maria Chefia",
      email: "maria@example.edu",
    }]);
    assert.deepEqual(map.get("laboratorio:lab-1"), [{
      user_id: "user-2",
      full_name: "Joao Laboratorio",
      email: "joao@example.edu",
    }]);
  });

  it("ignores assignments whose stored unit_type does not match the requested unit", () => {
    const map = buildChefiaAssignmentMap(
      [{ id: "shared-id", type: "departamento" }],
      [{ unit_type: "laboratorio", unit_id: "shared-id", user_id: "user-1" }],
      [{ id: "user-1", full_name: "Maria Chefia", email: "maria@example.edu" }],
    );

    assert.equal(map.size, 0);
  });

  it("retains every chefia of a unit and deduplicates repeated memberships", () => {
    const map = buildChefiaAssignmentMap(
      [{ id: "dept-1", type: "departamento" }],
      ["user-1", "user-2", "user-1"].map((user_id) => ({
        unit_type: "departamento", unit_id: "dept-1", user_id,
      })),
      [
        { id: "user-1", full_name: "Maria", email: "maria@example.edu" },
        { id: "user-2", full_name: "João", email: "joao@example.edu" },
      ],
    );
    assert.deepEqual(map.get("departamento:dept-1")?.map((person) => person.user_id), ["user-1", "user-2"]);
  });
});
