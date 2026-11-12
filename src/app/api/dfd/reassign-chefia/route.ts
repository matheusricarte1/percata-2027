import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import { canSuperadminReassignDfd } from "@/lib/dfd-reassignment";
import { enforceRateLimit } from "@/lib/rate-limit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNIT_TYPES = new Set(["departamento", "laboratorio"]);

export const POST = withAuthorizedRole(
  ["superadmin"],
  async ({ request, user, supabaseAdmin }) => {
    const limited = await enforceRateLimit(
      request,
      { bucket: "dfd-reassign-chefia", limit: 20, windowSec: 60 },
      user.id,
    );
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const dfdId = String(body?.id || "").trim();
    const targetUnitId = String(body?.analysis_unidade_id || "").trim();
    const targetUnitType = String(body?.analysis_tipo_unidade || "").trim();
    if (!UUID.test(dfdId) || !UUID.test(targetUnitId) || !UNIT_TYPES.has(targetUnitType)) {
      return NextResponse.json({ error: "Dados de reencaminhamento inválidos." }, { status: 400 });
    }

    const admin = supabaseAdmin!;
    const { data: dfd, error: dfdError } = await admin
      .from("dfds")
      .select("id,numero_protocolo,status,campus_id,analysis_unidade_id,analysis_tipo_unidade")
      .eq("id", dfdId)
      .maybeSingle();
    if (dfdError) throw dfdError;
    if (!dfd) return NextResponse.json({ error: "DFD não encontrada." }, { status: 404 });
    if (!canSuperadminReassignDfd(dfd.status)) {
      return NextResponse.json(
        { error: "A chefia não pode mais ser alterada porque esta DFD já foi avaliada." },
        { status: 409 },
      );
    }

    const targetTable = targetUnitType === "departamento" ? "departamentos" : "laboratorios";
    const { data: targetUnit, error: targetUnitError } = await admin
      .from(targetTable)
      .select("id,nome,campus_id,ativo")
      .eq("id", targetUnitId)
      .maybeSingle();
    if (targetUnitError) throw targetUnitError;
    if (!targetUnit || !targetUnit.ativo || targetUnit.campus_id !== dfd.campus_id) {
      return NextResponse.json(
        { error: "Escolha uma unidade ativa do mesmo campus da DFD." },
        { status: 409 },
      );
    }

    const { data: targetChefia, error: targetChefiaError } = await admin
      .from("user_units")
      .select("user_id")
      .eq("unit_id", targetUnitId)
      .eq("unit_type", targetUnitType)
      .eq("role_in_unit", "chefia")
      .limit(1)
      .maybeSingle();
    if (targetChefiaError) throw targetChefiaError;
    if (!targetChefia?.user_id) {
      return NextResponse.json(
        { error: "A unidade escolhida ainda não possui uma chefia responsável." },
        { status: 409 },
      );
    }

    const { data: updated, error: updateError } = await admin
      .from("dfds")
      .update({
        analysis_unidade_id: targetUnitId,
        analysis_tipo_unidade: targetUnitType,
        analysis_routing_reason: "Reencaminhamento administrativo pelo superadmin antes da avaliação da chefia.",
      })
      .eq("id", dfd.id)
      .in("status", ["rascunho", "triagem"])
      .select("id");
    if (updateError) throw updateError;
    if (!updated?.length) {
      return NextResponse.json(
        { error: "A DFD foi avaliada enquanto o reencaminhamento era processado. Recarregue a página." },
        { status: 409 },
      );
    }

    const protocol = dfd.numero_protocolo || `DFD-${dfd.id.slice(0, 8).toUpperCase()}`;
    await admin.from("dfd_logs").insert({
      dfd_id: dfd.id,
      user_id: user.id,
      action: "chefia_reencaminhada",
      details: `${protocol} reencaminhada pelo superadmin para ${targetUnit.nome} (${targetUnitType}) antes da avaliação da chefia.`,
    });

    return NextResponse.json({
      ok: true,
      id: dfd.id,
      analysis_unidade_id: targetUnitId,
      analysis_tipo_unidade: targetUnitType,
      analysis_unidade_nome: targetUnit.nome,
    });
  },
  { requireAdminClient: true, forbiddenMessage: "Somente o superadmin pode alterar a chefia de uma DFD." },
);
