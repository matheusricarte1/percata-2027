import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCollectiveCatalogFallbackFilter,
  buildCollectiveCatalogSearchArgs,
  buildCollectiveCatalogPageState,
  summarizeCollectiveCatalogItemForDisplay,
  sanitizeCollectiveCatalogSearch,
} from "./collective-catalog-search.ts";

describe("collective-catalog-search", () => {
  it("uses the same all-category contract accepted by the catalog RPC", () => {
    assert.deepEqual(buildCollectiveCatalogSearchArgs("  papel a4  "), {
      query_text: "papel a4",
      categoria_filtro: "all",
      limit_val: 12,
      offset_val: 0,
    });
  });

  it("supports loading later result pages without changing the search contract", () => {
    assert.deepEqual(buildCollectiveCatalogSearchArgs("mesa", 24), {
      query_text: "mesa",
      categoria_filtro: "all",
      limit_val: 12,
      offset_val: 24,
    });
  });

  it("describes pagination controls from the current page and row count", () => {
    assert.deepEqual(
      buildCollectiveCatalogPageState(2, 12),
      {
        page: 2,
        displayPage: 3,
        hasPrevious: true,
        hasNext: true,
      },
    );
  });

  it("sanitizes fallback filter text before building PostgREST OR filters", () => {
    assert.equal(sanitizeCollectiveCatalogSearch("  papel, a4 (branco)%  "), "papel a4 branco");
    assert.equal(
      buildCollectiveCatalogFallbackFilter("  papel, a4 (branco)%  "),
      [
        "descricao.ilike.%papel a4 branco%",
        "codigo_efisco.ilike.%papel a4 branco%",
        "nome_grupo.ilike.%papel a4 branco%",
        "grupo.ilike.%papel a4 branco%",
        "nome_classe.ilike.%papel a4 branco%",
        "classe.ilike.%papel a4 branco%",
      ].join(","),
    );
  });

  it("summarizes long E-Fisco descriptions without losing the full detail text", () => {
    const summary = summarizeCollectiveCatalogItemForDisplay({
      id: "214444-1",
      codigo_efisco: "214444-1",
      descricao:
        "SERVICO DE TRANSPORTE DE CARGAS - TRANSPORTE RODOVIARIO, DE AGUA POTAVEL, SEM TAXA DE SEGURO INCLUSA, NA REGIAO METROPOLITANA",
      tipo_objeto: "SERVIÇO",
      nome_classe: "Transporte de cargas e reboque",
    });

    assert.equal(summary.code, "214444-1");
    assert.equal(summary.term, "Serviço de transporte de cargas");
    assert.equal(
      summary.details,
      "Transporte rodoviário, de água potável, sem taxa de seguro inclusa, na região metropolitana",
    );
    assert.equal(summary.fullDescription, `${summary.term} - ${summary.details}`);
    assert.equal(summary.classLabel, "Transporte de cargas e reboque");
  });
});
