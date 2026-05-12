import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/utils/supabase/server";
import { normalizeRole } from "@/lib/access";
import {
  buildDfdSignaturePayload,
  buildDfdVerificationUrl,
  computeDfdSignature,
} from "@/lib/dfd-signature";

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Informe o parâmetro id." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role,campus_id")
      .eq("id", user.id)
      .maybeSingle();
    const role = normalizeRole(profile?.role, user.email);

    const supabaseAdmin = createSupabaseAdminClient();

    const [{ data: dfd, error: dfdError }, { data: items, error: itemsError }] =
      await Promise.all([
        supabaseAdmin
          .from("dfds")
          .select(
            "id,numero_protocolo,solicitante_id,campus_id,status,valor_total_estimado,previsao_recebimento",
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
        { error: "DFD não encontrada para assinatura." },
        { status: 404 },
      );
    }

    const sameCampus =
      profile?.campus_id && dfd.campus_id && String(profile.campus_id) === String(dfd.campus_id);
    const canReadDfd =
      dfd.solicitante_id === user.id ||
      role === "admin" ||
      role === "superadmin" ||
      (role === "chefia" && sameCampus);

    if (!canReadDfd) {
      return NextResponse.json({ error: "Acesso negado à DFD." }, { status: 403 });
    }

    const payload = buildDfdSignaturePayload(dfd, items || []);
    const signature = computeDfdSignature(payload);
    const verificationUrl = buildDfdVerificationUrl({
      origin: request.nextUrl.origin,
      id,
      signature,
    });

    return NextResponse.json({ id, signature, verificationUrl });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao gerar assinatura da DFD." },
      { status: 500 },
    );
  }
}
