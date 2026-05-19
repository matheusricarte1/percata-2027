import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCatalogSearchDocument,
  catalogDocumentToRow,
  splitCatalogDescription,
} from "./catalog-search-document";

describe("catalog-search-document", () => {
  it("splits e-FISCO descriptions into item name and specs without changing the original", () => {
    const descricao =
      "CONDICIONADOR DE AR - TIPO SPLIT, CAPACIDADE DE 12.000 BTUS, CONTROLE REMOTO";

    assert.deepEqual(splitCatalogDescription(descricao), {
      nome_item: "CONDICIONADOR DE AR",
      specs: "TIPO SPLIT, CAPACIDADE DE 12.000 BTUS, CONTROLE REMOTO",
    });
  });

  it("builds a Typesense document with verbatim descricao and structured fields", () => {
    const document = buildCatalogSearchDocument({
      id: 123,
      codigo_efisco: "569465-5",
      descricao: "CONDICIONADOR DE AR - TIPO SPLIT, CAPACIDADE DE 24.000 BTUS",
      tipo_objeto: "MATERIAL",
      nome_classe: "Equipamentos de climatização",
    });

    assert.equal(document.id, "123");
    assert.equal(document.descricao, "CONDICIONADOR DE AR - TIPO SPLIT, CAPACIDADE DE 24.000 BTUS");
    assert.equal(document.nome_item, "CONDICIONADOR DE AR");
    assert.equal(document.specs, "TIPO SPLIT, CAPACIDADE DE 24.000 BTUS");
    assert.equal(document.tipo_objeto, "MATERIAL");
  });

  it("maps a search document back to the catalog row contract used by the UI", () => {
    const document = buildCatalogSearchDocument({
      id: 123,
      codigo_efisco: "569465-5",
      descricao: "CONDICIONADOR DE AR - TIPO SPLIT",
      tipo_objeto: "MATERIAL",
    });

    const row = catalogDocumentToRow(document, 42);

    assert.equal(row.id, 123);
    assert.equal(row.codigo_efisco, "569465-5");
    assert.equal(row.descricao, "CONDICIONADOR DE AR - TIPO SPLIT");
    assert.equal(row.rank, 42);
  });
});
