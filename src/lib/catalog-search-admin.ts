import { normalizeCatalogSearchQuery } from "@/lib/catalog-search-learning";

export type CatalogSearchLogRow = {
  id: number;
  query_text: string;
  query_norm: string;
  category: string;
  context: string;
  source: string;
  result_count: number;
  top_catalog_id?: number | null;
  top_codigo_efisco?: string | null;
  created_at: string;
};

export type CatalogSearchClickRow = {
  id: number;
  action_type: string;
  query_text?: string | null;
  query_norm?: string | null;
  category: string;
  context: string;
  source: string;
  result_position?: number | null;
  catalog_id?: number | null;
  codigo_efisco?: string | null;
  item_descricao?: string | null;
  created_at: string;
};

export type CatalogSearchOverrideRow = {
  id: number;
  query_norm: string;
  match_mode: "exact" | "contains";
  override_type: "boost" | "block";
  catalog_id?: number | null;
  codigo_efisco?: string | null;
  weight: number;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CatalogSearchQueryInsight = {
  query_norm: string;
  query_label: string;
  searches: number;
  clicks: number;
  zero_result_searches: number;
  total_result_count: number;
  avg_result_count: number;
  latest_result_count: number;
  categories: string[];
  contexts: string[];
  last_searched_at: string;
  last_clicked_at: string | null;
  top_clicked_code: string | null;
  top_clicked_label: string | null;
};

export type CatalogSearchMetrics = {
  searches_7d: number;
  clicks_7d: number;
  unique_queries_7d: number;
  click_through_rate: number;
};

export type CatalogSearchActionQueues = {
  no_click_queries: CatalogSearchQueryInsight[];
  zero_result_queries: CatalogSearchQueryInsight[];
  low_ctr_queries: CatalogSearchQueryInsight[];
};

function parseDate(value: string) {
  return new Date(value).getTime();
}

export function buildCatalogSearchMetrics(
  logs: CatalogSearchLogRow[],
  clicks: CatalogSearchClickRow[],
  now = new Date(),
): CatalogSearchMetrics {
  const threshold = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const recentLogs = logs.filter((row) => parseDate(row.created_at) >= threshold);
  const recentClicks = clicks.filter((row) => parseDate(row.created_at) >= threshold);
  const uniqueQueries = new Set(recentLogs.map((row) => row.query_norm).filter(Boolean));

  return {
    searches_7d: recentLogs.length,
    clicks_7d: recentClicks.length,
    unique_queries_7d: uniqueQueries.size,
    click_through_rate: recentLogs.length > 0 ? recentClicks.length / recentLogs.length : 0,
  };
}

export function buildCatalogSearchInsights(
  logs: CatalogSearchLogRow[],
  clicks: CatalogSearchClickRow[],
) {
  const map = new Map<string, CatalogSearchQueryInsight>();

  for (const row of logs) {
    const key = row.query_norm || normalizeCatalogSearchQuery(row.query_text);
    if (!key) continue;
    const current = map.get(key) || {
      query_norm: key,
      query_label: row.query_text || key,
      searches: 0,
      clicks: 0,
      zero_result_searches: 0,
      total_result_count: 0,
      avg_result_count: 0,
      latest_result_count: row.result_count || 0,
      categories: [],
      contexts: [],
      last_searched_at: row.created_at,
      last_clicked_at: null,
      top_clicked_code: null,
      top_clicked_label: null,
    };

    current.searches += 1;
    current.total_result_count += Math.max(0, row.result_count || 0);
    if ((row.result_count || 0) === 0) current.zero_result_searches += 1;
    if (!current.categories.includes(row.category)) current.categories.push(row.category);
    if (!current.contexts.includes(row.context)) current.contexts.push(row.context);
    if (parseDate(row.created_at) > parseDate(current.last_searched_at)) {
      current.last_searched_at = row.created_at;
      current.query_label = row.query_text || current.query_label;
      current.latest_result_count = row.result_count || 0;
    }
    current.avg_result_count = current.searches > 0 ? current.total_result_count / current.searches : 0;
    map.set(key, current);
  }

  const clickStats = new Map<
    string,
    { count: number; label: string | null; lastClickedAt: string; code: string | null }
  >();

  for (const row of clicks) {
    const key = row.query_norm || normalizeCatalogSearchQuery(row.query_text || "");
    if (!key) continue;
    const current =
      clickStats.get(`${key}:${row.codigo_efisco || row.catalog_id || ""}`) || {
        count: 0,
        label: row.item_descricao || null,
        lastClickedAt: row.created_at,
        code: row.codigo_efisco || null,
      };
    current.count += 1;
    if (parseDate(row.created_at) > parseDate(current.lastClickedAt)) {
      current.lastClickedAt = row.created_at;
      current.label = row.item_descricao || current.label;
      current.code = row.codigo_efisco || current.code;
    }
    clickStats.set(`${key}:${row.codigo_efisco || row.catalog_id || ""}`, current);

    const insight = map.get(key) || {
      query_norm: key,
      query_label: row.query_text || key,
      searches: 0,
      clicks: 0,
      zero_result_searches: 0,
      total_result_count: 0,
      avg_result_count: 0,
      latest_result_count: 0,
      categories: [],
      contexts: [],
      last_searched_at: row.created_at,
      last_clicked_at: null,
      top_clicked_code: null,
      top_clicked_label: null,
    };
    insight.clicks += 1;
    if (!insight.categories.includes(row.category)) insight.categories.push(row.category);
    if (!insight.contexts.includes(row.context)) insight.contexts.push(row.context);
    if (!insight.last_clicked_at || parseDate(row.created_at) > parseDate(insight.last_clicked_at)) {
      insight.last_clicked_at = row.created_at;
    }
    map.set(key, insight);
  }

  for (const [queryKey, insight] of map.entries()) {
    const bestClick = Array.from(clickStats.entries())
      .filter(([entryKey]) => entryKey.startsWith(`${queryKey}:`))
      .sort((a, b) => b[1].count - a[1].count || parseDate(b[1].lastClickedAt) - parseDate(a[1].lastClickedAt))[0];

    if (bestClick) {
      insight.top_clicked_code = bestClick[1].code;
      insight.top_clicked_label = bestClick[1].label;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      parseDate(b.last_searched_at) - parseDate(a.last_searched_at) ||
      b.searches - a.searches,
  );
}

export function buildCatalogSearchActionQueues(
  logs: CatalogSearchLogRow[],
  clicks: CatalogSearchClickRow[],
): CatalogSearchActionQueues {
  const insights = buildCatalogSearchInsights(logs, clicks);

  return {
    no_click_queries: insights
      .filter((query) => query.searches >= 2 && query.clicks === 0)
      .sort(
        (a, b) =>
          b.searches - a.searches ||
          parseDate(b.last_searched_at) - parseDate(a.last_searched_at),
      )
      .slice(0, 12),
    zero_result_queries: insights
      .filter((query) => query.zero_result_searches > 0)
      .sort(
        (a, b) =>
          b.zero_result_searches - a.zero_result_searches ||
          parseDate(b.last_searched_at) - parseDate(a.last_searched_at),
      )
      .slice(0, 12),
    low_ctr_queries: insights
      .filter((query) => query.searches >= 3 && query.clicks / Math.max(query.searches, 1) < 0.2)
      .sort(
        (a, b) =>
          a.clicks / Math.max(a.searches, 1) - b.clicks / Math.max(b.searches, 1) ||
          b.searches - a.searches,
      )
      .slice(0, 12),
  };
}
