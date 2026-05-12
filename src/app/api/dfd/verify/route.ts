import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  buildDfdSignaturePayload,
  computeDfdSignature,
  isValidDfdSignature,
} from "@/lib/dfd-signature";

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    const sig = request.nextUrl.searchParams.get("sig");

    if (!id || !sig) {
      return NextResponse.json(
        { error: "Parâmetros obrigatórios: id e sig." },
        { status: 400 },
      );
    }

    if (!isValidDfdSignature(sig)) {
      return NextResponse.json(
        { valid: false, error: "Assinatura em formato inválido." },
        { status: 400 },
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();

    const [{ data: dfd, error: dfdError }, { data: items, error: itemsError }] =
      await Promise.all([
        supabaseAdmin
          .from("dfds")
          .select(
            "id,numero_protocolo,solicitante_id,status,valor_total_estimado,previsao_recebimento,created_at",
          )
          .eq("id", id)
          .maybeSingle(),
        supabaseAdmin
          .from("dfd_items")
          .select("id,codigo_tce,descricao,quantidade,valor_unitario_estimado,gnd")
          .eq("dfd_id", id),
      ]);

    if (dfdError) throw dfdError;
    if (itemsError) throw itemsError;
    if (!dfd) {
      return NextResponse.json(
        { valid: false, error: "DFD não encontrada." },
        { status: 404 },
      );
    }

    const payload = buildDfdSignaturePayload(dfd, items || []);
    const expectedSignature = computeDfdSignature(payload);
    const valid = expectedSignature === sig.toLowerCase();

    return NextResponse.json({
      valid,
      id,
      numeroProtocolo: dfd.numero_protocolo || null,
      status: dfd.status || null,
      updatedAt: dfd.created_at || null,
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { valid: false, error: error?.message || "Erro ao verificar assinatura." },
      { status: 500 },
    );
  }
}
