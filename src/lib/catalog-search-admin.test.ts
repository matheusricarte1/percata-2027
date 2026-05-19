import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCatalogSearchInsights,
  buildCatalogSearchMetrics,
  type CatalogSearchClickRow,
  type CatalogSearchLogRow,
} from "./catalog-search-admin";

describe("catalog-search-admin", () => {
  it("builds 7-day metrics from logs and clicks", () => {
    const logs: CatalogSearchLogRow[] = [
      {
        id: 1,
        query_text: "marcenaria com material",
        query_norm: "marcenaria com material",
        category: "all",
        context: "catalogo",
        source: "supabase",
        result_count: 5,
        created_at: "2026-05-18T10:00:00.000Z",
      },
      {
        id: 2,
        query_text: "vidracaria",
        query_norm: "vidracaria",
        category: "all",
        context: "catalogo",
        source: "supabase",
        result_count: 5,
        created_at: "2026-05-10T10:00:00.000Z",
      },
    ];
    const clicks: CatalogSearchClickRow[] = [
      {
        id: 1,
        action_type: "add_to_cart",
        query_text: "marcenaria com material",
        query_norm: "marcenaria com material",
        category: "all",
        context: "catalogo",
        source: "catalog_search",
        codigo_efisco: "200-2",
        item_descricao: "SERVICO DE MARCENARIA",
        created_at: "2026-05-18T10:03:00.000Z",
      },
    ];

    const metrics = buildCatalogSearchMetrics(logs, clicks, new Date("2026-05-19T12:00:00.000Z"));

    assert.deepEqual(metrics, {
      searches_7d: 1,
      clicks_7d: 1,
      unique_queries_7d: 1,
      click_through_rate: 1,
    });
  });

  it("aggregates recent searches and top clicked items per normalized query", () => {
    const insights = buildCatalogSearchInsights(
      [
        {
          id: 1,
          query_text: "Marcenaria com material",
          query_norm: "marcenaria com material",
          category: "all",
          context: "catalogo",
          source: "supabase",
          result_count: 4,
          created_at: "2026-05-18T10:00:00.000Z",
        },
        {
          id: 2,
          query_text: "marcenaria com material",
          query_norm: "marcenaria com material",
          category: "all",
          context: "dfd_coletiva",
          source: "supabase",
          result_count: 4,
          created_at: "2026-05-18T11:00:00.000Z",
        },
      ],
      [
        {
          id: 3,
          action_type: "add_to_cart",
          query_text: "marcenaria com material",
          query_norm: "marcenaria com material",
          category: "all",
          context: "catalogo",
          source: "catalog_search",
          codigo_efisco: "200-2",
          item_descricao: "SERVICO DE MARCENARIA",
          created_at: "2026-05-18T11:05:00.000Z",
        },
        {
          id: 4,
          action_type: "add_to_collective_room",
          query_text: "marcenaria com material",
          query_norm: "marcenaria com material",
          category: "all",
          context: "dfd_coletiva",
          source: "collective_room",
          codigo_efisco: "200-2",
          item_descricao: "SERVICO DE MARCENARIA",
          created_at: "2026-05-18T11:15:00.000Z",
        },
      ],
    );

    assert.equal(insights.length, 1);
    assert.equal(insights[0]?.searches, 2);
    assert.equal(insights[0]?.clicks, 2);
    assert.deepEqual(insights[0]?.contexts.sort(), ["catalogo", "dfd_coletiva"]);
    assert.equal(insights[0]?.top_clicked_code, "200-2");
    assert.equal(insights[0]?.top_clicked_label, "SERVICO DE MARCENARIA");
  });
});
