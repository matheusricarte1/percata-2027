import type { CatalogSearchRow } from "@/lib/catalog-search-document";

export type CatalogSearchOverride = {
  query_norm: string;
  match_mode: "exact" | "contains";
  override_type: "boost" | "block";
  catalog_id?: number | null;
  codigo_efisco?: string | null;
  weight?: number | null;
};

export function normalizeCatalogSearchQuery(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\b([0-9]{1,2})\.?000\s*(btus?|btu\/h)\b/g, "$1 000 $2")
    .replace(/º\s*gl/g, " gl")
    .replace(/°\s*gl/g, " gl")
    .replace(/%/g, " gl ")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesOverrideQuery(queryNorm: string, override: CatalogSearchOverride) {
  if (!queryNorm || !override.query_norm) return false;
  if (override.match_mode === "contains") {
    return queryNorm.includes(override.query_norm);
  }
  return queryNorm === override.query_norm;
}

function getRowOverrideScore(
  row: CatalogSearchRow,
  queryNorm: string,
  overrides: CatalogSearchOverride[],
) {
  const rowId = Number(row.id || 0);
  const rowCode = String(row.codigo_efisco || "").trim().toLowerCase();

  return overrides.reduce(
    (current, override) => {
      if (!matchesOverrideQuery(queryNorm, override)) return current;
      const overrideId = Number(override.catalog_id || 0);
      const overrideCode = String(override.codigo_efisco || "").trim().toLowerCase();
      const idMatches = overrideId > 0 && rowId > 0 && overrideId === rowId;
      const codeMatches = Boolean(overrideCode) && Boolean(rowCode) && overrideCode === rowCode;
      if (!idMatches && !codeMatches) return current;

      const weight = Number(override.weight || 0);
      if (override.override_type === "block") {
        return { blocked: true, boost: current.boost };
      }
      return { blocked: current.blocked, boost: current.boost + weight };
    },
    { blocked: false, boost: 0 },
  );
}

export function applyCatalogSearchOverrides<T extends CatalogSearchRow>(
  query: string,
  rows: T[],
  overrides: CatalogSearchOverride[],
) {
  if (!rows.length || !overrides.length) return rows;
  const queryNorm = normalizeCatalogSearchQuery(query);
  if (!queryNorm) return rows;

  return rows
    .map((row, index) => {
      const overrideScore = getRowOverrideScore(row, queryNorm, overrides);
      return {
        row: {
          ...row,
          rank: Number(row.rank || 0) + overrideScore.boost,
        } as T,
        blocked: overrideScore.blocked,
        index,
      };
    })
    .filter((entry) => !entry.blocked)
    .sort((a, b) => Number(b.row.rank || 0) - Number(a.row.rank || 0) || a.index - b.index)
    .map((entry) => entry.row);
}
