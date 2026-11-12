export const SUPPORTED_UNITS = ["UN", "CX", "PCT", "KG", "L", "M", "M2", "M3"] as const;

type ContributionInput = {
  quantidade: number;
  valor_unitario_estimado: number;
  unidade_medida: string;
  justificativa_item: string;
  justificativa_quantidade: string;
};

export function isSupportedUnit(value: string): boolean {
  return SUPPORTED_UNITS.includes(value.trim().toUpperCase() as (typeof SUPPORTED_UNITS)[number]);
}

export function validateCollectiveContribution(input: ContributionInput): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(input.quantidade) || input.quantidade <= 0) errors.push("informe uma quantidade maior que zero");
  if (!Number.isFinite(input.valor_unitario_estimado) || input.valor_unitario_estimado <= 0) errors.push("informe um valor unitário maior que zero");
  if (!isSupportedUnit(input.unidade_medida)) errors.push("selecione uma unidade de medida válida");
  if (!input.justificativa_item.trim()) errors.push("informe a justificativa do item");
  return errors;
}
