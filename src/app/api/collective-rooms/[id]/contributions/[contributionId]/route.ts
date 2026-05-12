import { NextRequest, NextResponse } from "next/server";
import {
  actorIsChefiaForUnit,
  apiError,
  createSupabaseAdminClient,
  insertRoomEvent,
  loadRoomOrNull,
  requireCollectiveRoomActor,
  sanitizeLongText,
  sanitizeText,
} from "@/lib/collective-room-api";

type RouteContext = { params: Promise<{ id: string; contributionId: string }> };

async function loadContribution(admin: ReturnType<typeof createSupabaseAdminClient>, id: string) {
  const { data, error } = await admin
    .from("dfd_collective_contributions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function canMutateContribution(params: {
  actorId: string;
  isChefia: boolean;
  roomStatus: string;
  contribution: any;
}) {
  if (params.roomStatus === "convertida" || params.roomStatus === "arquivada") return false;
  if (params.isChefia) return true;
  return params.roomStatus === "aberta" && params.contribution.user_id === params.actorId;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCollectiveRoomActor();
    if (!actor) return apiError("Usuario nao autenticado.", 401);
    const { id, contributionId } = await context.params;
    const admin = createSupabaseAdminClient();
    const room = await loadRoomOrNull(admin, id);
    if (!room) return apiError("Sala coletiva nao encontrada.", 404);
    const contribution = await loadContribution(admin, contributionId);
    if (!contribution || contribution.room_id !== room.id) {
      return apiError("Contribuicao nao encontrada.", 404);
    }

    const isChefia = actorIsChefiaForUnit(actor, room.unit_id);
    if (
      !canMutateContribution({
        actorId: actor.id,
        isChefia,
        roomStatus: room.status,
        contribution,
      })
    ) {
      return apiError("Acesso negado.", 403);
    }

    const body = await request.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};
    if ("quantidade" in body) {
      const quantidade = Math.max(0, Number(body.quantidade || 0));
      if (!quantidade) return apiError("Quantidade deve ser maior que zero.", 400);
      patch.quantidade = quantidade;
    }
    if ("valor_unitario_estimado" in body) {
      const value = Math.max(0, Number(body.valor_unitario_estimado || 0));
      if (!value) return apiError("Valor unitario deve ser maior que zero.", 400);
      patch.valor_unitario_estimado = value;
    }
    if ("justificativa_item" in body) {
      patch.justificativa_item = sanitizeLongText(body.justificativa_item, 4000);
    }
    if ("link_referencia" in body) {
      patch.link_referencia = sanitizeText(body.link_referencia, 1000);
    }
    patch.updated_at = new Date().toISOString();

    const { data: updated, error } = await admin
      .from("dfd_collective_contributions")
      .update(patch)
      .eq("id", contribution.id)
      .select("*")
      .single();
    if (error) throw error;

    await insertRoomEvent(admin, {
      roomId: room.id,
      actorId: actor.id,
      eventType: "contribution_updated",
      message: `Contribuicao atualizada: ${contribution.descricao}.`,
      metadata: { contribution_id: contribution.id },
    });

    return NextResponse.json({ contribution: updated });
  } catch (error: any) {
    return apiError(error?.message || "Erro ao atualizar contribuicao.", 500);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCollectiveRoomActor();
    if (!actor) return apiError("Usuario nao autenticado.", 401);
    const { id, contributionId } = await context.params;
    const admin = createSupabaseAdminClient();
    const room = await loadRoomOrNull(admin, id);
    if (!room) return apiError("Sala coletiva nao encontrada.", 404);
    const contribution = await loadContribution(admin, contributionId);
    if (!contribution || contribution.room_id !== room.id) {
      return apiError("Contribuicao nao encontrada.", 404);
    }

    const isChefia = actorIsChefiaForUnit(actor, room.unit_id);
    if (
      !canMutateContribution({
        actorId: actor.id,
        isChefia,
        roomStatus: room.status,
        contribution,
      })
    ) {
      return apiError("Acesso negado.", 403);
    }

    const { error } = await admin
      .from("dfd_collective_contributions")
      .update({ status: "arquivada", updated_at: new Date().toISOString() })
      .eq("id", contribution.id);
    if (error) throw error;

    await insertRoomEvent(admin, {
      roomId: room.id,
      actorId: actor.id,
      eventType: "contribution_removed",
      message: `Contribuicao removida: ${contribution.descricao}.`,
      metadata: { contribution_id: contribution.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return apiError(error?.message || "Erro ao remover contribuicao.", 500);
  }
}
