export function getDfdItemRemovalBlocker(input: {
  itemCount: number;
  reason: string | null | undefined;
}): string | null {
  if (!String(input.reason || "").trim()) {
    return "Informe o motivo da remoção deste item.";
  }

  if (!Number.isFinite(input.itemCount) || input.itemCount <= 1) {
    return "A DFD ficaria sem itens. Devolva a DFD inteira para correção.";
  }

  return null;
}
