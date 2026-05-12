import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyGnd,
  getDfdExpenseClassViolation,
  getItemExpenseClassKey,
  normalizeGnd,
  summarizeGndDistribution,
} from "./dfd-gnd.ts";

describe("dfd-gnd", () => {
  it("derives dotted GND from codigo natureza despesa", () => {
    assert.equal(normalizeGnd("44903974"), "4.4.90.39");
    assert.equal(normalizeGnd("33903016"), "3.3.90.30");
  });

  it("keeps already dotted GND values normalized", () => {
    assert.equal(normalizeGnd(" 4.4.90.52 "), "4.4.90.52");
  });

  it("classifies common GND elements for DFD guidance", () => {
    assert.deepEqual(classifyGnd("3.3.90.30"), {
      gnd: "3.3.90.30",
      expenseClass: "custeio",
      expenseLabel: "Custeio",
      elementCode: "30",
      elementLabel: "Material de consumo",
      guidance:
        "Justifique consumo previsto, turmas, estoque atual, reposição e recorrência.",
    });
    assert.equal(classifyGnd("4.4.90.52")?.expenseLabel, "Investimento");
    assert.equal(classifyGnd("4.4.90.39")?.elementLabel, "Serviço PJ");
  });

  it("summarizes distribution and warns when a DFD mixes custeio and capital", () => {
    const summary = summarizeGndDistribution([
      { gnd: "3.3.90.30", quantity: 2, total: 100 },
      { gnd: "4.4.90.52", quantity: 1, total: 250 },
    ]);

    assert.equal(summary.entries.length, 2);
    assert.equal(summary.totalValue, 350);
    assert.equal(summary.hasMixedExpenseClasses, true);
    assert.match(summary.warnings[0], /custeio e capital/i);
  });

  it("blocks a DFD that mixes custeio and investimento", () => {
    const violation = getDfdExpenseClassViolation([
      { gnd: "3.3.90.30", quantity: 2, total: 100 },
      { gnd: "4.4.90.52", quantity: 1, total: 250 },
    ]);

    assert.match(violation || "", /não pode misturar custeio e capital/i);
  });

  it("derives a stable grouping key for custeio and capital items", () => {
    assert.equal(getItemExpenseClassKey({ gnd: "3.3.90.30" }), "custeio");
    assert.equal(getItemExpenseClassKey({ gnd: "4.4.90.52" }), "investimento");
    assert.equal(getItemExpenseClassKey({ gnd: null }), "sem-gnd");
  });
});
