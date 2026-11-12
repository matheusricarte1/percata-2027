import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCatalogExpertTaxonomy,
  filterCatalogExpertItemsByNode,
  getCatalogGroupSymbol,
  getCatalogGroupSymbolFromNode,
} from "./catalog-expert";

const items = [
  {
    id: 1,
    gnd: "3",
    tipo_objeto: "SERVICO",
    codigo_grupo: "10",
    nome_grupo: "Transporte",
    codigo_classe: "20",
    nome_classe: "Cargas",
  },
  {
    id: 2,
    gnd: "3",
    tipo_objeto: "MATERIAL",
    codigo_grupo: "11",
    nome_grupo: "Informática",
    codigo_classe: "21",
    nome_classe: "Notebook",
  },
  {
    id: 3,
    gnd: "4",
    tipo_objeto: "MATERIAL",
    codigo_grupo: "11",
    nome_grupo: "Informática",
    codigo_classe: "21",
    nome_classe: "Notebook",
  },
];

describe("catalog-expert", () => {
  it("filters items by any selected taxonomy depth", () => {
    const taxonomy = buildCatalogExpertTaxonomy(items);
    const custeio = taxonomy.children.find((node) => node.label === "3 - Custeio");
    assert.ok(custeio);

    const servicos = custeio.children.find((node) => node.label === "Serviços");
    assert.ok(servicos);

    const group = servicos.children.find((node) => node.label.includes("Transporte"));
    assert.ok(group);

    const classe = group.children.find((node) => node.label.includes("Cargas"));
    assert.ok(classe);

    assert.deepEqual(filterCatalogExpertItemsByNode(items, custeio.key).map((item) => item.id), [1, 2]);
    assert.deepEqual(filterCatalogExpertItemsByNode(items, servicos.key).map((item) => item.id), [1]);
    assert.deepEqual(filterCatalogExpertItemsByNode(items, group.key).map((item) => item.id), [1]);
    assert.deepEqual(filterCatalogExpertItemsByNode(items, classe.key).map((item) => item.id), [1]);
  });

  it("creates stable visual symbols for E-Fisco groups", () => {
    const first = getCatalogGroupSymbol({ code: "10", label: "Transporte" });
    const same = getCatalogGroupSymbol({ code: "10", label: "Transporte" });
    const other = getCatalogGroupSymbol({ code: "11", label: "Informática" });

    assert.deepEqual(first, same);
    assert.equal(first.token, "G10");
    assert.equal(other.token, "G11");
    assert.notEqual(first.title, other.title);
  });

  it("reads group symbols from taxonomy node keys", () => {
    const symbol = getCatalogGroupSymbolFromNode(
      "gnd:3|group:10|class:20",
      "10 - Transporte",
    );

    assert.ok(symbol);
    assert.equal(symbol.token, "G10");
  });
});
