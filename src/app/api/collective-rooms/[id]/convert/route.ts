import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  convertRoomToOfficialDfds,
  createSupabaseAdminClient,
  loadRoomOrNull,
  requireCollectiveRoomActor,
} from "@/lib/collective-room-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCollectiveRoomActor();
    if (!actor) return apiError("Usuario nao autenticado.", 401);
    const { id } = await context.params;
    const admin = createSupabaseAdminClient();
    const room = await loadRoomOrNull(admin, id);
    if (!room) return apiError("Sala coletiva nao encontrada.", 404);

    const dfds = await convertRoomToOfficialDfds({ admin, actor, room });
    return NextResponse.json({ dfds });
  } catch (error: any) {
    return apiError(error?.message || "Erro ao converter sala coletiva.", 500);
  }
}
