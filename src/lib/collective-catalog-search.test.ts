import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCollectiveCatalogFallbackFilter,
  buildCollectiveCatalogSearchArgs,
  buildCollectiveCatalogPageState,
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
});
