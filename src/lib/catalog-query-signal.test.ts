import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCatalogQueryFallbacks,
  getCatalogCodeSearchCandidates,
  filterArmamentRelatedCatalogRows,
  isArmamentRelatedCatalogQuery,
  isArmamentRelatedCatalogText,
  isCatalogLowSignalQuery,
  isGenericCatalogShortQuery,
  isLikelyCatalogCodeQuery,
  normalizeCatalogCategory,
  parseBoundedCatalogInt,
  sanitizeCatalogLikePattern,
  sanitizeCatalogSearchInput,
} from "./catalog-query-signal";

describe("catalog-query-signal", () => {
  it("does not discard short catalog item names", () => {
    for (const query of ["forno", "fogao", "fogão", "livro", "papel", "cabo", "mouse", "toner"]) {
      assert.equal(isCatalogLowSignalQuery(query), false, query);
    }
  });

  it("still classifies purely generic modifiers as low signal", () => {
    for (const query of ["material", "tipo", "baixo", "alto", "equipamento", "tipo material"]) {
      assert.equal(isCatalogLowSignalQuery(query), true, query);
    }
  });

  it("centralizes search input sanitization and bounded pagination parsing", () => {
    assert.equal(sanitizeCatalogSearchInput("  forno\n\nelétrico  "), "forno elétrico");
    assert.equal(sanitizeCatalogSearchInput("x".repeat(220)).length, 180);
    assert.equal(sanitizeCatalogLikePattern("100% algodao_azul"), "100 algodao azul");
    assert.equal(parseBoundedCatalogInt("999", 30, 1, 50), 50);
    assert.equal(parseBoundedCatalogInt("x", 30, 1, 50), 30);
  });

  it("centralizes category, code and generic query decisions", () => {
    assert.equal(normalizeCatalogCategory("SERVIÇOS"), "servico");
    assert.equal(normalizeCatalogCategory("produtos"), "material");
    assert.equal(normalizeCatalogCategory("qualquer"), "all");
    assert.equal(isLikelyCatalogCodeQuery("244683-9"), true);
    assert.equal(isLikelyCatalogCodeQuery("forno"), false);
    assert.equal(isGenericCatalogShortQuery("servico"), true);
    assert.equal(isGenericCatalogShortQuery("forno"), false);
  });

  it("accepts e-Fisco codes with or without punctuation", () => {
    assert.deepEqual(getCatalogCodeSearchCandidates("3226964"), ["3226964", "322696-4"]);
    assert.deepEqual(getCatalogCodeSearchCandidates("322696-4"), ["322696-4"]);
  });

  it("builds shorter fallback queries for pasted long descriptions", () => {
    assert.deepEqual(
      buildCatalogQueryFallbacks(
        "SERVICO DE TRANSPORTE DE CARGAS - DO TIPO TRANSPORTE TERRESTRE DE CONTAINER MEDINDO 6 00 X 2 50 X 2 84M COM TAXA DE SEGURO",
      ),
      [
        "servico transporte cargas",
        "servico transporte cargas transporte",
        "servico transporte cargas transporte terrestre",
        "servico transporte cargas transporte terrestre container",
      ],
    );
  });

  it("does not reduce already focused short queries", () => {
    assert.deepEqual(buildCatalogQueryFallbacks("forno eletrico"), []);
  });

  it("blocks armament-related catalog searches without blocking ordinary similar words", () => {
    for (const query of [
      "arma de fogo",
      "armamentos",
      "munição calibre 38",
      "pistola",
      "colete balístico",
      "cartucho para espingarda",
      "materiais bélicos",
      "granada lacrimogênea",
      "algema de punho",
    ]) {
      assert.equal(isArmamentRelatedCatalogQuery(query), true, query);
    }

    for (const query of ["armário de aço", "armazenamento externo", "calibração de pipeta"]) {
      assert.equal(isArmamentRelatedCatalogQuery(query), false, query);
    }
  });

  it("filters armament-related catalog rows from visible results", () => {
    const rows = [
      { id: 1, descricao: "Armário de aço para laboratório" },
      { id: 2, descricao: "Pistola calibre 9mm" },
      { id: 3, nome_classe: "Material de expediente" },
      { id: 4, nome_grupo: "Armamento" },
      { id: 5, grupo: "MATERIAIS BELICOS", descricao: "Equipamento tático" },
    ];

    assert.deepEqual(filterArmamentRelatedCatalogRows(rows).map((row) => row.id), [1, 3]);
    assert.equal(isArmamentRelatedCatalogText("armazenamento temporário"), false);
  });
});
