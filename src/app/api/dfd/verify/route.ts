import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  buildDfdSignaturePayload,
  canAcceptLegacyDfdSignature,
  computeLegacyDfdSignature,
  computeDfdSignature,
  isValidDfdSignature,
} from "@/lib/dfd-signature";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    // Rota pública (verificação por QR). Rate limit alto mas presente —
    // sem isso, atacante pode brute-force assinaturas HMAC.
    // 60/min por IP é generoso para uso humano.
    const limited = await enforceRateLimit(request, {
      bucket: "dfd-verify",
      limit: 60,
      windowSec: 60,
    });
    if (limited) return limited;

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
    const legacySignature = canAcceptLegacyDfdSignature(dfd.created_at)
      ? computeLegacyDfdSignature(payload)
      : null;
    const providedSignature = sig.toLowerCase();
    const valid =
      expectedSignature === providedSignature || legacySignature === providedSignature;

    return NextResponse.json({
      valid,
      id,
      numeroProtocolo: dfd.numero_protocolo || null,
      status: dfd.status || null,
      updatedAt: dfd.created_at || null,
      signatureVersion:
        valid && legacySignature === providedSignature ? "legacy-sha256" : "hmac-sha256",
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { valid: false, error: error?.message || "Erro ao verificar assinatura." },
      { status: 500 },
    );
  }
}
