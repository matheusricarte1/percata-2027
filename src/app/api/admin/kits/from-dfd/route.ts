import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";

type DfdRecord = {
  id: string;
  numero_protocolo: string | null;
  objeto_contratacao: string | null;
  justificativa_contratacao: string | null;
};

type DfdItemRecord = {
  id: string;
  codigo_tce: string | null;
  codigo_item_efisco?: string | null;
  descricao: string | null;
  quantidade: number | null;
};

function isSchemaCacheError(error: any, columns: string[]) {
  const message = String(error?.message || "").toLowerCase();
  return (
    columns.some((column) => message.includes(column.toLowerCase())) ||
    message.includes("no unique or exclusion constraint")
  );
}

function getItemCode(item: DfdItemRecord) {
  return String(item.codigo_item_efisco || item.codigo_tce || "").trim();
}

export const POST = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ request, supabaseAdmin, user }) => {
    const admin = supabaseAdmin!;
    const body = await request.json().catch(() => ({}));
    const dfdId = String(body?.dfdId || "").trim();
    const category = String(body?.category || "DFD").trim() || "DFD";

    if (!dfdId) {
      return NextResponse.json(
        { error: "Parâmetro dfdId é obrigatório." },
        { status: 400 },
      );
    }

    const { data: dfd, error: dfdError } = await admin
      .from("dfds")
      .select("id,numero_protocolo,objeto_contratacao,justificativa_contratacao")
      .eq("id", dfdId)
      .maybeSingle();
    if (dfdError) throw dfdError;
    if (!dfd) {
      return NextResponse.json({ error: "DFD não encontrada." }, { status: 404 });
    }

    const { data: dfdItems, error: dfdItemsError } = await admin
      .from("dfd_items")
      .select("id,codigo_tce,codigo_item_efisco,descricao,quantidade")
      .eq("dfd_id", dfdId);
    if (dfdItemsError) throw dfdItemsError;

    const items = ((dfdItems || []) as DfdItemRecord[]).filter((item) =>
      getItemCode(item),
    );
    if (items.length === 0) {
      return NextResponse.json(
        {
          error:
            "Esta DFD não possui itens com código e-Fisco para virar kit.",
        },
        { status: 422 },
      );
    }

    const codes = Array.from(new Set(items.map(getItemCode)));
    const { data: catalogItems, error: catalogError } = await admin
      .from("catalogo")
      .select("id,codigo_efisco")
      .in("codigo_efisco", codes);
    if (catalogError) throw catalogError;

    const catalogByCode = new Map(
      (catalogItems || []).map((item: any) => [
        String(item.codigo_efisco || "").trim(),
        item,
      ]),
    );
    const kitRows = items
      .map((item) => {
        const catalogItem = catalogByCode.get(getItemCode(item));
        if (!catalogItem) return null;
        return {
          item_id: catalogItem.id,
          quantidade: Math.max(1, Math.floor(Number(item.quantidade || 1))),
        };
      })
      .filter(Boolean) as Array<{ item_id: number | string; quantidade: number }>;

    const unmatched = codes.filter((code) => !catalogByCode.has(code));
    if (kitRows.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhum item da DFD foi encontrado no catálogo ativo. Revise os códigos antes de marcar como kit.",
          unmatched,
        },
        { status: 422 },
      );
    }

    const dfdRecord = dfd as DfdRecord;
    const kitPayload = {
      nome:
        String(dfdRecord.objeto_contratacao || "").trim() ||
        `Modelo ${dfdRecord.numero_protocolo || dfdRecord.id.slice(0, 8)}`,
      descricao: String(dfdRecord.justificativa_contratacao || "").trim() || null,
      categoria: category,
      created_by: user.id,
      source_dfd_id: dfdRecord.id,
      source_protocol: dfdRecord.numero_protocolo,
      is_active: true,
    };

    let kit: any = null;
    const upsertResult = await admin
      .from("kits")
      .upsert(kitPayload, { onConflict: "source_dfd_id" })
      .select("*")
      .single();

    if (
      upsertResult.error &&
      isSchemaCacheError(upsertResult.error, [
        "source_dfd_id",
        "source_protocol",
        "is_active",
      ])
    ) {
      const fallbackPayload = {
        nome: kitPayload.nome,
        descricao: kitPayload.descricao,
        categoria: kitPayload.categoria,
        created_by: kitPayload.created_by,
      };
      const fallbackResult = await admin
        .from("kits")
        .insert(fallbackPayload)
        .select("*")
        .single();
      if (fallbackResult.error) throw fallbackResult.error;
      kit = fallbackResult.data;
    } else if (upsertResult.error) {
      throw upsertResult.error;
    } else {
      kit = upsertResult.data;
    }

    const { error: deleteItemsError } = await admin
      .from("kit_items")
      .delete()
      .eq("kit_id", kit.id);
    if (deleteItemsError) throw deleteItemsError;

    const { error: insertItemsError } = await admin.from("kit_items").insert(
      kitRows.map((row) => ({
        kit_id: kit.id,
        item_id: row.item_id,
        quantidade: row.quantidade,
      })),
    );
    if (insertItemsError) throw insertItemsError;

    return NextResponse.json({
      ok: true,
      kit,
      insertedItems: kitRows.length,
      unmatched,
    });
  },
  { requireAdminClient: true },
);
