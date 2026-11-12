import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import {
  LEGACY_KIT_CATALOG_TABLE,
  normalizeCatalogCode,
  resolveLegacyCatalogIdsByCode,
} from "@/lib/catalog-legacy-bridge";

const KIT_CATALOG_SELECT =
  "id,codigo_efisco,descricao,tipo,categoria,grupo,classe,tipo_objeto,codigo_grupo,nome_grupo,codigo_classe,nome_classe,codigo_material_servico,nome_material_servico,codigo_natureza_preferencial,gnd_preferencial,natureza_count,unidade_medida";

export const GET = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ request, supabaseAdmin }) => {
    const admin = supabaseAdmin!;
    const { searchParams } = new URL(request.url);
    const kitId = String(searchParams.get("kitId") || "").trim();
    if (!kitId) {
      return NextResponse.json({ error: "Informe o kit." }, { status: 400 });
    }

    const { data: kitRows, error: kitError } = await admin
      .from("kit_items")
      .select("id,kit_id,item_id,quantidade,created_at")
      .eq("kit_id", kitId)
      .order("created_at", { ascending: true });
    if (kitError) throw kitError;

    const legacyIds = Array.from(
      new Set((kitRows || []).map((row: any) => row.item_id).filter(Boolean)),
    );
    const { data: legacyRows, error: legacyError } =
      legacyIds.length > 0
        ? await admin
            // Compatibilidade legítima: kit_items.item_id ainda referencia
            // public.catalogo. A resposta é enriquecida com catalogo_efisco_v2
            // logo abaixo para não expor metadados antigos ao admin.
            .from(LEGACY_KIT_CATALOG_TABLE)
            .select(KIT_CATALOG_SELECT)
            .in("id", legacyIds)
        : { data: [], error: null };
    if (legacyError) throw legacyError;

    const legacyById = new Map((legacyRows || []).map((row: any) => [String(row.id), row]));
    const codes = Array.from(
      new Set((legacyRows || []).map((row: any) => normalizeCatalogCode(row.codigo_efisco)).filter(Boolean)),
    );
    const { data: v2Rows, error: v2Error } =
      codes.length > 0
        ? await admin
            .from("catalogo_efisco_v2")
            .select(KIT_CATALOG_SELECT)
            .in("codigo_efisco", codes)
        : { data: [], error: null };
    if (v2Error) throw v2Error;

    const v2ByCode = new Map(
      (v2Rows || []).map((row: any) => [normalizeCatalogCode(row.codigo_efisco), row]),
    );

    const items = (kitRows || []).map((row: any) => {
      const legacy = legacyById.get(String(row.item_id)) || null;
      const v2 = legacy ? v2ByCode.get(normalizeCatalogCode(legacy.codigo_efisco)) : null;
      return {
        ...row,
        catalogo: v2
          ? {
              ...legacy,
              ...v2,
              id: legacy?.id || v2.id,
              efisco_item_id: v2.id,
            }
          : legacy,
      };
    });

    return NextResponse.json({ items });
  },
  { requireAdminClient: true },
);

export const POST = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ request, supabaseAdmin }) => {
    const admin = supabaseAdmin!;
    const body = await request.json().catch(() => ({}));
    const kitId = String(body?.kitId || "").trim();
    const codigoEfisco = normalizeCatalogCode(body?.codigoEfisco);
    const quantidade = Math.max(1, Math.floor(Number(body?.quantidade || 1)));

    if (!kitId || !codigoEfisco) {
      return NextResponse.json(
        { error: "Informe o kit e o código e-Fisco do item." },
        { status: 400 },
      );
    }

    const { data: v2Item, error: v2Error } = await admin
      .from("catalogo_efisco_v2")
      .select("id,codigo_efisco,descricao")
      .eq("codigo_efisco", codigoEfisco)
      .maybeSingle();
    if (v2Error) throw v2Error;
    if (!v2Item) {
      return NextResponse.json(
        { error: "Item não encontrado no catálogo e-Fisco v2." },
        { status: 404 },
      );
    }

    const legacyIdByCode = await resolveLegacyCatalogIdsByCode(admin, [codigoEfisco]);
    const legacyCatalogId = legacyIdByCode.get(codigoEfisco);
    if (!legacyCatalogId) {
      return NextResponse.json(
        {
          error:
            "Este item existe no catálogo v2, mas ainda não possui vínculo com os modelos de kit legados.",
        },
        { status: 422 },
      );
    }

    const { data, error } = await admin
      .from("kit_items")
      .insert({
        kit_id: kitId,
        item_id: legacyCatalogId,
        quantidade,
      })
      .select("id")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, id: data.id });
  },
  { requireAdminClient: true },
);
