import { NextRequest, NextResponse } from "next/server";
import {
  actorHasUnit,
  apiError,
  createSupabaseAdminClient,
  requireCollectiveRoomActor,
  sanitizeUuid,
} from "@/lib/collective-room-api";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireCollectiveRoomActor();
    if (!actor) return apiError("Usuario nao autenticado.", 401);

    const limited = await enforceRateLimit(
      request,
      { bucket: "collective-contribution-consolidate", limit: 20, windowSec: 60 },
      actor.id,
    );
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const unitId = sanitizeUuid(body?.unit_id);
    const dfdId = sanitizeUuid(body?.dfd_id);
    const unitType = body?.unit_type === "laboratorio" ? "laboratorio" :
      body?.unit_type === "departamento" ? "departamento" : null;
    const rawContributionIds = Array.isArray(body?.contribution_ids)
      ? body.contribution_ids
      : [];
    const contributionIds = Array.from(new Set(rawContributionIds.map(sanitizeUuid)));

    if (
      !unitId ||
      !dfdId ||
      !unitType ||
      contributionIds.length === 0 ||
      contributionIds.length > 500 ||
      contributionIds.some((id) => !id)
    ) {
      return apiError("Os dados para concluir a DFD coletiva são inválidos.", 400);
    }
    if (!actorHasUnit(actor, unitId, unitType)) return apiError("Acesso negado.", 403);

    const admin = createSupabaseAdminClient();
    const { data: dfd, error: dfdError } = await admin
      .from("dfds")
      .select("id,solicitante_id,unidade_id,tipo_unidade,status")
      .eq("id", dfdId)
      .maybeSingle();
    if (dfdError) throw dfdError;
    if (
      !dfd ||
      dfd.solicitante_id !== actor.id ||
      dfd.unidade_id !== unitId ||
      dfd.tipo_unidade !== unitType ||
      dfd.status !== "rascunho"
    ) {
      return apiError("A DFD não pertence a esta pessoa ou unidade.", 403);
    }

    const { data: eligibleRows, error: eligibleError } = await admin
      .from("dfd_collective_contributions")
      .select("id")
      .in("id", contributionIds)
      .eq("unit_id", unitId)
      .eq("unit_type", unitType)
      .eq("status", "aberta")
      .is("room_id", null);
    if (eligibleError) throw eligibleError;
    if ((eligibleRows || []).length !== contributionIds.length) {
      return apiError("Alguns itens já foram concluídos ou não pertencem a esta unidade. Atualize a tela antes de continuar.", 409);
    }

    const { data: updatedRows, error: updateError } = await admin
      .from("dfd_collective_contributions")
      .update({ status: "consolidada", consolidated_dfd_id: dfdId })
      .in("id", contributionIds)
      .eq("unit_id", unitId)
      .eq("unit_type", unitType)
      .eq("status", "aberta")
      .is("room_id", null)
      .select("id");
    if (updateError) throw updateError;
    if ((updatedRows || []).length !== contributionIds.length) {
      return apiError("Nem todos os itens puderam ser concluídos. Atualize a tela antes de continuar.", 409);
    }

    return NextResponse.json({ consolidated_count: updatedRows.length });
  } catch (error: any) {
    return apiError(error?.message || "Erro ao concluir as contribuições.", 500);
  }
}
