import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCatalogSelectionKey,
  selectNaturezaOptionByExpenseClass,
} from "./catalog-selection";

describe("catalog-selection", () => {
  it("allows the same e-Fisco code to have different natureza variants", () => {
    const first = buildCatalogSelectionKey({
      codigo_tce: "214444-1",
      efisco_item_natureza_id: 10,
      codigo_natureza_despesa: "33903900",
      gnd: "3.3.90.39",
    });
    const second = buildCatalogSelectionKey({
      codigo_tce: "214444-1",
      efisco_item_natureza_id: 11,
      codigo_natureza_despesa: "44903900",
      gnd: "4.4.90.39",
    });

    assert.notEqual(first, second);
  });

  it("treats the same natureza id as the same cart variant", () => {
    assert.equal(
      buildCatalogSelectionKey({
        codigo_tce: "214444-1",
        efisco_item_natureza_id: 10,
        gnd: "3.3.90.39",
      }),
      buildCatalogSelectionKey({
        codigo_efisco: "214444-1",
        efisco_item_natureza_id: "10",
        gnd_derivado: "3.3.90.36",
      }),
    );
  });

  it("falls back to natureza or GND when the official natureza row id is not present", () => {
    assert.notEqual(
      buildCatalogSelectionKey({
        codigo_tce: "214444-1",
        codigo_natureza_despesa: "33903900",
      }),
      buildCatalogSelectionKey({
        codigo_tce: "214444-1",
        codigo_natureza_despesa: "44903900",
      }),
    );

    assert.notEqual(
      buildCatalogSelectionKey({ codigo_tce: "214444-1", gnd: "3.3.90.39" }),
      buildCatalogSelectionKey({ codigo_tce: "214444-1", gnd: "4.4.90.39" }),
    );
  });

  it("returns null when no stable e-Fisco code exists", () => {
    assert.equal(buildCatalogSelectionKey({ gnd: "3.3.90.39" }), null);
  });

  it("selects only the matching natureza option for the chosen expense class", () => {
    const options = [
      {
        codigo_efisco: "250936-9",
        efisco_item_natureza_id: 1,
        codigo_natureza_despesa: "33903900",
        gnd: "3.3.90.39",
      },
      {
        codigo_efisco: "250936-9",
        efisco_item_natureza_id: 2,
        codigo_natureza_despesa: "44905200",
        gnd: "4.4.90.52",
      },
    ];

    assert.equal(
      selectNaturezaOptionByExpenseClass(options, "custeio")?.efisco_item_natureza_id,
      1,
    );
    assert.equal(
      selectNaturezaOptionByExpenseClass(options, "investimento")?.efisco_item_natureza_id,
      2,
    );
  });
});
