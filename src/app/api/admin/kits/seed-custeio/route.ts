import { NextResponse } from "next/server";
import {
  buildCusteioKitDescription,
  UNIVERSITY_CUSTEIO_KIT_TEMPLATES,
} from "@/lib/university-custeio-kits";
import { withAuthorizedRole } from "@/lib/api-auth";

export const POST = withAuthorizedRole(
  ["superadmin"],
  async ({ supabaseAdmin, user }) => {
    const admin = supabaseAdmin!;
    const allCodes = Array.from(
      new Set(
        UNIVERSITY_CUSTEIO_KIT_TEMPLATES.flatMap((template) =>
          template.itens.map((item) => item.codigoEfisco),
        ),
      ),
    );

    const { data: catalogItems, error: catalogError } = await admin
      .from("catalogo")
      .select("id,codigo_efisco,descricao,gnd_preferencial")
      .in("codigo_efisco", allCodes);
    if (catalogError) throw catalogError;

    const catalogByCode = new Map(
      (catalogItems || []).map((item: any) => [
        String(item.codigo_efisco || "").trim(),
        item,
      ]),
    );

    const results: Array<{
      slug: string;
      kitId: string;
      insertedItems: number;
      unmatched: string[];
    }> = [];

    for (const template of UNIVERSITY_CUSTEIO_KIT_TEMPLATES) {
      const kitPayload = {
        nome: template.nome,
        descricao: buildCusteioKitDescription(template),
        categoria: template.categoria,
        created_by: user.id,
        is_active: true,
      };

      const { data: existingRows, error: existingError } = await admin
        .from("kits")
        .select("*")
        .eq("nome", template.nome)
        .limit(1);
      if (existingError) throw existingError;

      let kit = existingRows?.[0] || null;
      if (kit) {
        const { data, error } = await admin
          .from("kits")
          .update(kitPayload)
          .eq("id", kit.id)
          .select("*")
          .single();
        if (error) throw error;
        kit = data;
      } else {
        const { data, error } = await admin
          .from("kits")
          .insert(kitPayload)
          .select("*")
          .single();
        if (error) throw error;
        kit = data;
      }

      const kitRows = template.itens
        .map((item) => {
          const catalogItem = catalogByCode.get(item.codigoEfisco);
          if (!catalogItem) return null;
          return {
            kit_id: kit.id,
            item_id: catalogItem.id,
            quantidade: item.quantidade,
          };
        })
        .filter(Boolean) as Array<{
          kit_id: string;
          item_id: number | string;
          quantidade: number;
        }>;

      const { error: deleteItemsError } = await admin
        .from("kit_items")
        .delete()
        .eq("kit_id", kit.id);
      if (deleteItemsError) throw deleteItemsError;

      if (kitRows.length > 0) {
        const { error: insertItemsError } = await admin
          .from("kit_items")
          .insert(kitRows);
        if (insertItemsError) throw insertItemsError;
      }

      results.push({
        slug: template.slug,
        kitId: kit.id,
        insertedItems: kitRows.length,
        unmatched: template.itens
          .filter((item) => !catalogByCode.has(item.codigoEfisco))
          .map((item) => item.codigoEfisco),
      });
    }

    return NextResponse.json({ ok: true, results });
  },
  { requireAdminClient: true },
);
