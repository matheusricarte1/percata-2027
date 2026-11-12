export type TriagemUnitNameRecord = {
  [key: string]: unknown;
  analysis_unidade_id?: string | null;
  analysis_tipo_unidade?: "departamento" | "laboratorio" | null;
  unidade_id?: string | null;
  tipo_unidade?: "departamento" | "laboratorio" | null;
  analysis_unidade_nome?: string | null;
  unidade_nome?: string | null;
};

export type TriagemUnitNameHydrated<T extends TriagemUnitNameRecord> = T & {
  analysis_unidade_nome: string | null;
  unidade_nome: string | null;
};

function getUnitKey(
  type?: "departamento" | "laboratorio" | null,
  id?: string | null,
) {
  return type && id ? `${type}:${id}` : null;
}

export function applyTriagemUnitNames<T extends TriagemUnitNameRecord>(
  records: T[],
  namesByUnit: Map<string, string>,
): TriagemUnitNameHydrated<T>[] {
  return records.map((record) => {
    const originName =
      namesByUnit.get(getUnitKey(record.tipo_unidade, record.unidade_id) || "") || null;
    const analysisName =
      namesByUnit.get(
        getUnitKey(record.analysis_tipo_unidade, record.analysis_unidade_id) || "",
      ) ||
      originName ||
      null;

    return {
      ...record,
      unidade_nome: originName,
      analysis_unidade_nome: analysisName,
    };
  });
}
