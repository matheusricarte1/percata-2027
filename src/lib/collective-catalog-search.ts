export const COLLECTIVE_CATALOG_SEARCH_LIMIT = 12;

const FALLBACK_SEARCH_FIELDS = [
  "descricao",
  "codigo_efisco",
  "nome_grupo",
  "grupo",
  "nome_classe",
  "classe",
];

export function sanitizeCollectiveCatalogSearch(value: string) {
  return value
    .replace(/[%,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildCollectiveCatalogSearchArgs(value: string, offset = 0) {
  return {
    query_text: sanitizeCollectiveCatalogSearch(value),
    categoria_filtro: "all",
    limit_val: COLLECTIVE_CATALOG_SEARCH_LIMIT,
    offset_val: Math.max(0, offset),
  };
}

export function buildCollectiveCatalogFallbackFilter(value: string) {
  const term = sanitizeCollectiveCatalogSearch(value);
  return FALLBACK_SEARCH_FIELDS.map((field) => `${field}.ilike.%${term}%`).join(",");
}

export function buildCollectiveCatalogPageState(page: number, rowCount: number) {
  const safePage = Math.max(0, page);
  return {
    page: safePage,
    displayPage: safePage + 1,
    hasPrevious: safePage > 0,
    hasNext: rowCount === COLLECTIVE_CATALOG_SEARCH_LIMIT,
  };
}
