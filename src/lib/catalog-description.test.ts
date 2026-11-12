import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatCatalogDisplayText,
  parseCatalogDescription,
} from "./catalog-description";

describe("catalog-description", () => {
  it("splits the catalog label from the full technical description at the first spaced dash", () => {
    const parsed = parseCatalogDescription(
      "SERVICO DE TRANSPORTE DE CARGAS - TRANSPORTE RODOVIARIO, DE AGUA POTAVEL, SEM TAXA DE SEGURO INCLUSA, NA REGIAO METROPOLITANA",
    );

    assert.equal(parsed.term, "SERVICO DE TRANSPORTE DE CARGAS");
    assert.equal(
      parsed.details,
      "TRANSPORTE RODOVIARIO, DE AGUA POTAVEL, SEM TAXA DE SEGURO INCLUSA, NA REGIAO METROPOLITANA",
    );
    assert.equal(parsed.hasDetails, true);
  });

  it("keeps later technical dashes inside the full description", () => {
    const parsed = parseCatalogDescription(
      "LANCADOR DE GRANADA - LANCADOR DE MUNICOES NAO-LETAIS, CUMPRIMENTO: 700MM - DIAMETRO: 51MM - FORMATO: CARABINA",
    );

    assert.equal(parsed.term, "LANCADOR DE GRANADA");
    assert.equal(
      parsed.details,
      "LANCADOR DE MUNICOES NAO-LETAIS, CUMPRIMENTO: 700MM - DIAMETRO: 51MM - FORMATO: CARABINA",
    );
  });

  it("uses the normalized description as the term when no spaced dash exists", () => {
    const parsed = parseCatalogDescription("  ITEM   SEM   SEPARADOR  ");

    assert.equal(parsed.term, "ITEM SEM SEPARADOR");
    assert.equal(parsed.details, "");
    assert.equal(parsed.hasDetails, false);
  });

  it("softens all-caps catalog text for display without changing technical tokens", () => {
    assert.equal(
      formatCatalogDisplayText("SERVICO DE TRANSPORTE DE CARGAS"),
      "Serviço de transporte de cargas",
    );

    assert.equal(
      formatCatalogDisplayText(
        "TRANSPORTE RODOVIARIO, DE AGUA POTAVEL, SEM TAXA DE SEGURO INCLUSA, NA REGIAO METROPOLITANA",
      ),
      "Transporte rodoviário, de água potável, sem taxa de seguro inclusa, na região metropolitana",
    );
  });

  it("preserves measurements, abbreviations and non-lethal hyphenated technical terms", () => {
    assert.equal(
      formatCatalogDisplayText(
        "LANCADOR DE MUNICOES NAO-LETAIS, CUMPRIMENTO: 700MM - DIAMETRO: 51MM - FORMATO: CARABINA, 37/38MM",
      ),
      "Lançador de munições não-letais, cumprimento: 700MM - diâmetro: 51MM - formato: carabina, 37/38MM",
    );
  });
});
