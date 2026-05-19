export type CatalogSearchClickPayload = {
  actionType: "add_to_cart" | "add_to_collective_cart" | "add_to_collective_room";
  queryText?: string;
  category?: string;
  context?: string;
  source?: string;
  resultPosition?: number | null;
  catalogId?: number | string | null;
  codigoEfisco?: string | null;
  itemDescricao?: string | null;
};

export function recordCatalogSearchClick(payload: CatalogSearchClickPayload) {
  return fetch("/api/catalog-search/click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}
