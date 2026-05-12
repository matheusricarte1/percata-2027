import { NextRequest, NextResponse } from "next/server";
import {
  actorIsChefiaForUnit,
  apiError,
  assertCanSeeRoom,
  buildRoomDetail,
  createSupabaseAdminClient,
  insertRoomEvent,
  loadRoomOrNull,
  normalizeRoomStatus,
  requireCollectiveRoomActor,
  sanitizeLongText,
  sanitizeText,
} from "@/lib/collective-room-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCollectiveRoomActor();
    if (!actor) return apiError("Usuario nao autenticado.", 401);
    const { id } = await context.params;
    const admin = createSupabaseAdminClient();
    const room = await loadRoomOrNull(admin, id);
    if (!room) return apiError("Sala coletiva nao encontrada.", 404);
    if (!assertCanSeeRoom(actor, room)) return apiError("Acesso negado.", 403);

    return NextResponse.json(await buildRoomDetail(admin, actor, room));
  } catch (error: any) {
    return apiError(error?.message || "Erro ao carregar sala coletiva.", 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCollectiveRoomActor();
    if (!actor) return apiError("Usuario nao autenticado.", 401);
    const { id } = await context.params;
    const admin = createSupabaseAdminClient();
    const room = await loadRoomOrNull(admin, id);
    if (!room) return apiError("Sala coletiva nao encontrada.", 404);
    if (!actorIsChefiaForUnit(actor, room.unit_id)) return apiError("Acesso negado.", 403);
    if (room.status === "convertida") {
      return apiError("Sala convertida nao pode ser editada.", 409);
    }

    const body = await request.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};
    if ("title" in body) {
      const title = sanitizeText(body.title, 160);
      if (!title) return apiError("Informe o titulo da sala.", 400);
      patch.title = title;
    }
    if ("description" in body) patch.description = sanitizeLongText(body.description, 4000);
    if ("scope" in body) patch.scope = sanitizeLongText(body.scope, 4000);
    if ("status" in body) {
      const status = normalizeRoomStatus(body.status);
      if (!status || status === "convertida") return apiError("Status invalido.", 400);
      patch.status = status;
    }

    if (Object.keys(patch).length === 0) {
      return apiError("Nenhuma alteracao informada.", 400);
    }

    const { data: updated, error } = await admin
      .from("dfd_collective_rooms")
      .update(patch)
      .eq("id", room.id)
      .select("*")
      .single();
    if (error) throw error;

    await insertRoomEvent(admin, {
      roomId: room.id,
      actorId: actor.id,
      eventType: "room_updated",
      message: "Dados da sala atualizados.",
      metadata: patch,
    });

    return NextResponse.json({ room: updated });
  } catch (error: any) {
    return apiError(error?.message || "Erro ao atualizar sala coletiva.", 500);
  }
}
