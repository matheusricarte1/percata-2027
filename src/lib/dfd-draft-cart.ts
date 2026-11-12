export type DfdDraftCartItem = Record<string, unknown> & {
  uid: string;
  item_efisco: Record<string, unknown>;
};

function isDfdDraftCartItem(value: unknown): value is DfdDraftCartItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.uid === "string" &&
    item.uid.trim().length > 0 &&
    Boolean(item.item_efisco) &&
    typeof item.item_efisco === "object" &&
    !Array.isArray(item.item_efisco)
  );
}

function cloneCartItem(item: DfdDraftCartItem): DfdDraftCartItem {
  return {
    ...item,
    item_efisco: { ...item.item_efisco },
  };
}

export function snapshotDfdDraftCartItems(items: unknown[]): DfdDraftCartItem[] {
  return items.filter(isDfdDraftCartItem).map(cloneCartItem);
}

/**
 * Normaliza a carga usada pelo sincronizador global antes de enviá-la ao
 * servidor. A mesma validação é usada na restauração, evitando que uma carga
 * inválida gravada localmente comprometa o rascunho remoto.
 */
export function buildDfdDraftCartSaveInput(items: unknown[]): DfdDraftCartItem[] {
  return snapshotDfdDraftCartItems(items);
}

export function restoreDfdDraftCartItems(value: unknown): DfdDraftCartItem[] {
  if (!Array.isArray(value)) return [];
  return snapshotDfdDraftCartItems(value);
}
