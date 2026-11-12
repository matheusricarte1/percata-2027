import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getDfdSubmissionBlocker,
  requiresItemsForDfdWorkflow,
} from "./dfd-submission.ts";

describe("dfd-submission", () => {
  it("bloqueia envio para triagem quando a DFD nao possui itens", () => {
    assert.equal(requiresItemsForDfdWorkflow("triagem"), true);
    assert.match(
      getDfdSubmissionBlocker({ targetStatus: "triagem", itemCount: 0 }) || "",
      /Inclua pelo menos um item/,
    );
  });

  it("permite rascunho e devolvida sem itens para que a pessoa consiga corrigir", () => {
    assert.equal(getDfdSubmissionBlocker({ targetStatus: "rascunho", itemCount: 0 }), null);
    assert.equal(getDfdSubmissionBlocker({ targetStatus: "devolvida", itemCount: 0 }), null);
  });

  it("permite entrada no fluxo quando ha pelo menos um item", () => {
    assert.equal(getDfdSubmissionBlocker({ targetStatus: "triagem", itemCount: 1 }), null);
    assert.equal(getDfdSubmissionBlocker({ targetStatus: "aprovada", itemCount: 2 }), null);
  });
});
