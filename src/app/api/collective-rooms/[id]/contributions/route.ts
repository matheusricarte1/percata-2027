import { NextRequest, NextResponse } from "next/server";
import {
  actorHasUnit,
  apiError,
  contributionFromPayload,
  createSupabaseAdminClient,
  insertRoomEvent,
  loadRoomOrNull,
  requireCollectiveRoomActor,
  upsertContribution,
} from "@/lib/collective-room-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCollectiveRoomActor();
    if (!actor) return apiError("Usuario nao autenticado.", 401);
    const { id } = await context.params;
    const admin = createSupabaseAdminClient();
    const room = await loadRoomOrNull(admin, id);
    if (!room) return apiError("DFD coletiva nao encontrada.", 404);
    if (!actorHasUnit(actor, room.unit_id, room.unit_type)) return apiError("Acesso negado.", 403);
    if (room.status !== "aberta") {
      return apiError("A DFD coletiva precisa estar aberta para receber contribuicoes.", 409);
    }

    const body = await request.json().catch(() => ({}));
    const contribution = contributionFromPayload({ body, actor, room });
    const saved = await upsertContribution(admin, contribution);

    await insertRoomEvent(admin, {
      roomId: room.id,
      actorId: actor.id,
      eventType: "contribution_added",
      message: `Item adicionado: ${contribution.descricao}.`,
      metadata: { contribution_id: saved.id },
    });

    return NextResponse.json({ contribution: saved }, { status: 201 });
  } catch (error: any) {
    return apiError(error?.message || "Erro ao adicionar contribuicao.", 500);
  }
}
