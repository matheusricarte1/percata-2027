import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveGndFromNatureza,
  getCatalogFiscalIssue,
  requiresExplicitNaturezaSelection,
  resolveDfdFiscalFields,
} from "./catalog-fiscal";

describe("catalog-fiscal", () => {
  it("derives formatted GND from an 8 digit natureza", () => {
    assert.equal(deriveGndFromNatureza("44905218"), "4.4.90.52");
  });

  it("requires explicit natureza selection for multi-natureza catalog items", () => {
    assert.equal(
      requiresExplicitNaturezaSelection({
        natureza_count: 3,
        has_mixed_expense_classes: false,
        codigo_natureza_despesa: "33903016",
      }),
      true,
    );
  });

  it("reports missing natureza as a review fiscal issue", () => {
    assert.equal(
      getCatalogFiscalIssue({
        codigo_tce: "123456-7",
        descricao: "Item sem natureza",
        natureza_count: 0,
      }),
      "missing_natureza",
    );
  });

  it("does not default DFD fiscal fields to material de consumo", () => {
    const resolved = resolveDfdFiscalFields({
      codigo_tce: "123456-7",
      descricao: "Item sem natureza",
      natureza_count: 0,
    });

    assert.equal(resolved.codigo_natureza_despesa, null);
    assert.equal(resolved.gnd, "SEM_NATUREZA");
    assert.equal(resolved.requires_natureza_review, true);
  });

  it("accepts explicit natureza already saved on legacy collective items with multiple naturezas", () => {
    const resolved = resolveDfdFiscalFields({
      codigo_tce: "765432-1",
      descricao: "Item legado da sala coletiva",
      codigo_natureza_despesa: "33903016",
      gnd: "3.3.90.30",
      natureza_count: 2,
      has_mixed_expense_classes: false,
      efisco_item_natureza_id: null,
    });

    assert.equal(resolved.codigo_natureza_despesa, "33903016");
    assert.equal(resolved.gnd, "3.3.90.30");
    assert.equal(resolved.requires_natureza_review, true);
  });

  it("accepts selected mixed-expense variants during collective conversion", () => {
    const resolved = resolveDfdFiscalFields({
      codigo_tce: "214444-1",
      descricao: "Item misto ja separado pela sala coletiva",
      codigo_natureza_despesa: "44905218",
      gnd: "4.4.90.52",
      natureza_count: 4,
      has_mixed_expense_classes: true,
      efisco_item_id: 55,
      efisco_item_natureza_id: 777,
    });

    assert.equal(resolved.codigo_natureza_despesa, "44905218");
    assert.equal(resolved.gnd, "4.4.90.52");
    assert.equal(resolved.efisco_item_id, 55);
    assert.equal(resolved.efisco_item_natureza_id, 777);
    assert.equal(resolved.requires_natureza_review, false);
  });
});
