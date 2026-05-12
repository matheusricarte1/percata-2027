import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getDfdProcessChecklist,
  getDfdProcessStage,
  getDfdSendReadiness,
} from "./dfd-process-guide.ts";

describe("dfd-process-guide", () => {
  it("marks a complete draft as ready to send", () => {
    const readiness = getDfdSendReadiness({
      status: "rascunho",
      isCreator: true,
      itemCount: 2,
      hasObject: true,
      hasJustification: true,
      hasQuantityBasis: true,
      hasUnit: true,
      hasOnlyOneExpenseClass: true,
    });

    assert.equal(readiness.canSend, true);
    assert.deepEqual(readiness.blockers, []);
  });

  it("explains why a draft cannot be sent", () => {
    const readiness = getDfdSendReadiness({
      status: "rascunho",
      isCreator: false,
      itemCount: 0,
      hasObject: false,
      hasJustification: false,
      hasQuantityBasis: false,
      hasUnit: false,
      hasOnlyOneExpenseClass: false,
    });

    assert.equal(readiness.canSend, false);
    assert.match(readiness.blockers.join(" "), /criou a DFD/i);
    assert.match(readiness.blockers.join(" "), /custeio e capital/i);
  });

  it("returns didactic checklist states for review", () => {
    const checklist = getDfdProcessChecklist({
      status: "triagem",
      isCreator: true,
      itemCount: 1,
      hasObject: true,
      hasJustification: true,
      hasQuantityBasis: false,
      hasUnit: true,
      hasOnlyOneExpenseClass: true,
    });

    assert.equal(getDfdProcessStage("triagem").label, "Com a chefia");
    assert.equal(checklist.find((item) => item.id === "quantity-basis")?.state, "attention");
    assert.equal(checklist.find((item) => item.id === "sent")?.state, "done");
  });
});
