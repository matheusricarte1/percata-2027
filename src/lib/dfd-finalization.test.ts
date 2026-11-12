import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDfdFinalizationCopy } from "./dfd-finalization.ts";

describe("dfd finalization choices", () => {
  it("keeps saving a draft as an explicit, separate choice", () => {
    const copy = getDfdFinalizationCopy("draft");

    assert.equal(copy.actionLabel, "Salvar como rascunho");
    assert.match(copy.description, /Minhas DFDs/i);
  });

  it("treats finalizing as sending directly to chefia, without draft wording", () => {
    const copy = getDfdFinalizationCopy("triagem");

    assert.equal(copy.actionLabel, "Finalizar e enviar à chefia");
    assert.match(copy.description, /fila da chefia/i);
    assert.doesNotMatch(copy.description, /rascunho/i);
  });
});
