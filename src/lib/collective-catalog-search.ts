import {
  formatCatalogDisplayText,
  parseCatalogDescription,
} from "./catalog-description";

export const COLLECTIVE_CATALOG_SEARCH_LIMIT = 12;
// Keep the collective panel compact, but rank a wider candidate window before
// slicing the visible page. This matches the quality of the main catalog.
export const COLLECTIVE_CATALOG_SEARCH_WINDOW = 50;

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

export function summarizeCollectiveCatalogItemForDisplay(item: {
  id?: string | number | null;
  codigo_efisco?: string | null;
  codigo_tce?: string | null;
  descricao?: string | null;
  tipo_objeto?: string | null;
  nome_classe?: string | null;
  classe?: string | null;
  nome_grupo?: string | null;
  grupo?: string | null;
}) {
  const rawDescription = String(item.descricao || "Descrição não informada")
    .replace(/\s+/g, " ")
    .trim();
  const parsed = parseCatalogDescription(rawDescription);
  const term = formatCatalogDisplayText(parsed.term);
  const details = formatCatalogDisplayText(parsed.details);
  const code = String(item.codigo_efisco || item.codigo_tce || item.id || "Sem código").trim();
  const classLabel = String(
    item.nome_classe || item.classe || item.nome_grupo || item.grupo || "Sem categoria",
  )
    .replace(/\s+/g, " ")
    .trim();

  return {
    code,
    term,
    details,
    fullDescription: parsed.hasDetails ? `${term} - ${details}` : term,
    classLabel,
    typeLabel: String(item.tipo_objeto || "Item do catálogo e-Fisco").trim(),
    hasDetails: parsed.hasDetails,
  };
}
