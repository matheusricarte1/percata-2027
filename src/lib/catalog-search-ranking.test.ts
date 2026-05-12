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

  it("exposes a compact visual interpretation of the user query", () => {
    const analysis = analyzeCatalogSearchQuery("TV televisor 85 polegadas smart");

    assert.deepEqual(analysis.primaryTerms, ["tv/televisor"]);
    assert.deepEqual(analysis.specificationTerms, ["85", "polegadas", "smart"]);
  });
});
