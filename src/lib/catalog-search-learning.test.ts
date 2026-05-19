import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCatalogSearchOverrides,
  normalizeCatalogSearchQuery,
  type CatalogSearchOverride,
} from "./catalog-search-learning";

describe("catalog-search-learning", () => {
  it("normalizes technical search text consistently", () => {
    assert.equal(
      normalizeCatalogSearchQuery("Álcool 50% 12.000 BTUS 2,5mm"),
      "alcool 50 gl 12 000 btus 2.5mm",
    );
  });

  it("boosts and blocks exact query overrides", () => {
    const overrides: CatalogSearchOverride[] = [
      {
        query_norm: "marcenaria com material",
        match_mode: "exact",
        override_type: "block",
        codigo_efisco: "100-1",
      },
      {
        query_norm: "marcenaria com material",
        match_mode: "exact",
        override_type: "boost",
        codigo_efisco: "200-2",
        weight: 400,
      },
    ];

    const rows = applyCatalogSearchOverrides(
      "marcenaria com material",
      [
        { id: 1, codigo_efisco: "100-1", descricao: "MATERIAL PEDAGOGICO EM MDF", rank: 200 },
        { id: 2, codigo_efisco: "200-2", descricao: "SERVICO DE MARCENARIA", rank: 120 },
      ],
      overrides,
    );

    assert.deepEqual(rows.map((row) => row.codigo_efisco), ["200-2"]);
    assert.equal(rows[0]?.rank, 520);
  });

  it("supports contains overrides for broader query families", () => {
    const rows = applyCatalogSearchOverrides(
      "ar condicionado split 12000 btus",
      [
        { id: 1, codigo_efisco: "111-1", descricao: "SUPORTE PARA AR CONDICIONADO", rank: 220 },
        { id: 2, codigo_efisco: "222-2", descricao: "CONDICIONADOR DE AR - SPLIT", rank: 180 },
      ],
      [
        {
          query_norm: "ar condicionado split",
          match_mode: "contains",
          override_type: "boost",
          codigo_efisco: "222-2",
          weight: 200,
        },
      ],
    );

    assert.deepEqual(rows.map((row) => row.codigo_efisco), ["222-2", "111-1"]);
  });
});
