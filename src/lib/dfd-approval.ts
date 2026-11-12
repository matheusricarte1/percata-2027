export type ApprovalItemInput = {
  id: string;
  quantidade: number;
  is_highlight_item: boolean;
  criticidade: string | null;
  moscow_categoria: string | null;
  justificativa_quantidade: string | null;
};

export function isDfdReadyForApproval(items: ApprovalItemInput[]) {
  return (
    items.length > 0 &&
    items.every(
      (item) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          item.id,
        ) &&
        Number.isFinite(item.quantidade) &&
        item.quantidade >= 1 &&
        Boolean(item.criticidade) &&
        Boolean(item.moscow_categoria),
    )
  );
}
