import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getDfdDeleteStepLabels,
  isDfdDeleteConfirmationValid,
} from "./superadmin-dfd-delete.ts";

describe("superadmin-dfd-delete", () => {
  it("requires the exact DFD protocol before deletion", () => {
    assert.equal(isDfdDeleteConfirmationValid("DFD-2027-001", "DFD-2027-001"), true);
    assert.equal(isDfdDeleteConfirmationValid(" DFD-2027-001 ", "DFD-2027-001"), true);
    assert.equal(isDfdDeleteConfirmationValid("DFD-2027-002", "DFD-2027-001"), false);
  });

  it("keeps dfds as the final deletion step", () => {
    const labels = getDfdDeleteStepLabels();

    assert.equal(labels.at(-1), "delete:dfds.id");
    assert(labels.includes("delete:dfd_items.dfd_id"));
    assert(labels.includes("clear_source:dfd_collective_contributions.consolidated_dfd_id"));
  });
});
