import "server-only";

type SupabaseFromClient = {
  from: (table: string) => any;
};

export const LEGACY_KIT_CATALOG_TABLE = "catalogo";

export function normalizeCatalogCode(value: unknown) {
  return String(value || "").trim();
}

export async function resolveLegacyCatalogIdsByCode(
  supabaseLike: SupabaseFromClient,
  codes: string[],
) {
  const uniqueCodes = Array.from(new Set(codes.map(normalizeCatalogCode).filter(Boolean)));
  const legacyIdByCode = new Map<string, number | string>();
  const chunkSize = 400;

  for (let i = 0; i < uniqueCodes.length; i += chunkSize) {
    const chunk = uniqueCodes.slice(i, i + chunkSize);
    // Compatibilidade legítima: kit_items ainda guarda item_id apontando para
    // public.catalogo. Novos metadados vêm do catalogo_efisco_v2, mas a ponte
    // precisa resolver o id legado até migrarmos a FK dos kits.
    const { data, error } = await supabaseLike
      .from(LEGACY_KIT_CATALOG_TABLE)
      .select("id,codigo_efisco")
      .in("codigo_efisco", chunk);

    if (error) throw error;

    for (const row of data || []) {
      const code = normalizeCatalogCode(row.codigo_efisco);
      if (code) legacyIdByCode.set(code, row.id);
    }
  }

  return legacyIdByCode;
}
