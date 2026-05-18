import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyzeCatalogSearchQuery,
  rerankCatalogSearchResults,
} from "./catalog-search-ranking.ts";

describe("catalog-search-ranking", () => {
  it("prioritizes the requested product noun over weak measurement hits", () => {
    const [first] = rerankCatalogSearchResults("TV televisor 85 polegadas", [
      {
        id: 542844,
        rank: 116,
        descricao:
          "CONJUNTO DE IRRIGACAO - TIPO GOTEJAMENTO, COM TUBOS PVC 1 POLEGADA E CONECTORES",
      },
      {
        id: 604081,
        rank: 94,
        descricao:
          "TELEVISOR - EM CORES,32 POLEGADAS,LED SMART,ENTRADAS: 2 HDMI, 1 USB",
      },
      {
        id: 604223,
        rank: 94,
        descricao:
          "TELEVISOR - A CORES, 29 POLEGADAS, TRADICIONAL, ENTRADA DE VIDEO COMPONENTE",
      },
    ]);

    assert.equal(first.id, 604081);
  });

  it("keeps exact size matches within the same product family above weaker size matches", () => {
    const [first] = rerankCatalogSearchResults("televisor 85 polegadas", [
      {
        id: 1,
        rank: 94,
        descricao: "TELEVISOR - LED SMART, 32 POLEGADAS, COM CONTROLE REMOTO",
      },
      {
        id: 2,
        rank: 90,
        descricao: "TELEVISOR - LED SMART, 85 POLEGADAS, 4K, COM CONTROLE REMOTO",
      },
    ]);

    assert.equal(first.id, 2);
  });

  it("treats datashow and projetor multimidia as the same product intent", () => {
    const [first] = rerankCatalogSearchResults("datashow hdmi", [
      {
        id: 1,
        rank: 130,
        descricao: "CABO HDMI - 2 METROS, COMPATIVEL COM EQUIPAMENTOS DE VIDEO",
      },
      {
        id: 2,
        rank: 70,
        descricao:
          "PROJETOR MULTIMIDIA - ENTRADA HDMI, RESOLUCAO FULL HD, CONTROLE REMOTO",
      },
    ]);

    assert.equal(first.id, 2);
  });

  it("does not let the short word ar behave like a broad substring match", () => {
    const [first] = rerankCatalogSearchResults("ar condicionado 12000 btus", [
      {
        id: 1,
        rank: 140,
        descricao: "ARAME GALVANIZADO - ROLO COM 100 METROS PARA AMARRACAO",
      },
      {
        id: 2,
        rank: 80,
        descricao:
          "CONDICIONADOR DE AR - SPLIT, 12000 BTUS, FRIO, CONTROLE REMOTO",
      },
    ]);

    assert.equal(first.id, 2);
  });

  it("penalizes service results when a technical product query asks for equipment", () => {
    const [first] = rerankCatalogSearchResults("ar condicionado split 12000 btus", [
      {
        id: 1,
        rank: 160,
        tipo_objeto: "SERVIÇO",
        descricao:
          "SERVICO DE MANUTENCAO PREVENTIVA E/OU CORRETIVA EM AR CONDICIONADO TIPO SPLIT 12000 BTU/H",
      },
      {
        id: 2,
        rank: 80,
        tipo_objeto: "MATERIAL",
        descricao: "CONDICIONADOR DE AR - SPLIT, 12000 BTUS, FRIO, CONTROLE REMOTO",
      },
    ]);

    assert.equal(first.id, 2);
  });

  it("uses oficio plus material co-occurrence and blocks unrelated MDF contexts", () => {
    const [first] = rerankCatalogSearchResults("marcenaria com material", [
      {
        id: 1,
        rank: 150,
        tipo_objeto: "MATERIAL",
        descricao: "MATERIAL PEDAGOGICO EM MDF - JOGO DE MEMORIA INFANTIL",
      },
      {
        id: 2,
        rank: 75,
        tipo_objeto: "SERVIÇO",
        descricao:
          "SERVICO DE MARCENARIA - INCLUSIVE FORNECIMENTO DE MATERIAL, MDF, FERRAGENS E ACABAMENTO",
      },
    ]);

    assert.equal(first.id, 2);
  });

  it("diversifies repeated prefixes after the third result", () => {
    const ranked = rerankCatalogSearchResults("lampada led 9w bivolt", [
      { id: 1, rank: 100, descricao: "LAMPADA LED - 9W BIVOLT A60" },
      { id: 2, rank: 99, descricao: "LAMPADA LED - 9W BIVOLT BULBO" },
      { id: 3, rank: 98, descricao: "LAMPADA LED - 9W BIVOLT E27" },
      { id: 4, rank: 97, descricao: "LAMPADA LED - 9W BIVOLT FRIA" },
      { id: 5, rank: 60, descricao: "LUMINARIA LED - 9W BIVOLT DE SOBREPOR" },
    ]);

    assert.deepEqual(ranked.slice(0, 5).map((item) => item.id), [1, 2, 3, 5, 4]);
  });

  it("exposes a compact visual interpretation of the user query", () => {
    const analysis = analyzeCatalogSearchQuery("TV televisor 85 polegadas smart");

    assert.deepEqual(analysis.primaryTerms, ["tv/televisor"]);
    assert.deepEqual(analysis.specificationTerms, ["85", "polegadas", "smart"]);
  });

  it("normalizes decimal technical specs as specification terms", () => {
    const analysis = analyzeCatalogSearchQuery("cabo eletrico azul 2,5mm");

    assert.deepEqual(analysis.primaryTerms, ["cabo", "eletrico", "azul"]);
    assert.deepEqual(analysis.specificationTerms, ["2.5mm"]);
  });

  it("matches compact BTU notation against catalog descriptions with separated thousands", () => {
    const [first] = rerankCatalogSearchResults("ar condicionado split 12000 btus", [
      {
        id: 1,
        rank: 95,
        tipo_objeto: "MATERIAL",
        descricao: "CONDICIONADOR DE AR - TIPO SPLIT, CAPACIDADE DE 18 000 BTUS",
      },
      {
        id: 2,
        rank: 80,
        tipo_objeto: "MATERIAL",
        descricao: "CONDICIONADOR DE AR - TIPO SPLIT, CAPACIDADE DE 12 000 BTUS",
      },
    ]);

    assert.equal(first.id, 2);
  });
});
