import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function sanitizeText(value: string | null, max = 80) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const efiscoItemId = Number(searchParams.get("efisco_item_id"));
  const codigoEfisco = sanitizeText(searchParams.get("codigo_efisco"));

  if (!Number.isFinite(efiscoItemId) && !codigoEfisco) {
    return NextResponse.json(
      { error: "Informe efisco_item_id ou codigo_efisco." },
      { status: 400 },
    );
  }

  try {
    let query = supabase
      .from("catalogo_item_naturezas_v2")
      .select(
        "efisco_item_id,codigo_efisco,efisco_item_natureza_id,codigo_natureza_despesa,natureza_key,gnd,classe_despesa",
      )
      .order("codigo_natureza_despesa", { ascending: true });

    if (Number.isFinite(efiscoItemId) && efiscoItemId > 0) {
      query = query.eq("efisco_item_id", efiscoItemId);
    } else {
      query = query.eq("codigo_efisco", codigoEfisco);
    }

    const { data, error } = await query.limit(500);
    if (error) throw error;

    return NextResponse.json({ items: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Nao foi possivel carregar as naturezas do item e-Fisco.",
      },
      { status: 500 },
    );
  }
}
