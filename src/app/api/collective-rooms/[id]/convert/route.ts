import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  convertRoomToOfficialDfds,
  createNotifications,
  createSupabaseAdminClient,
  loadRoomParticipantUserIds,
  loadRoomOrNull,
  requireCollectiveRoomActor,
} from "@/lib/collective-room-api";
import { toPublicSiteUrl } from "@/lib/site-url";
import { enforceRateLimit } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCollectiveRoomActor();
    if (!actor) return apiError("Usuario nao autenticado.", 401);

    // Conversão sala→DFDs oficiais é evento caro e irreversível. 3/min basta.
    const limited = await enforceRateLimit(
      _request,
      { bucket: "collective-convert", limit: 3, windowSec: 60 },
      actor.id,
    );
    if (limited) return limited;

    const { id } = await context.params;
    const admin = createSupabaseAdminClient();
    const room = await loadRoomOrNull(admin, id);
    if (!room) return apiError("DFD coletiva nao encontrada.", 404);

    const dfds = await convertRoomToOfficialDfds({ admin, actor, room });
    const participantIds = await loadRoomParticipantUserIds(admin, room.id);
    const dfdLinks = dfds
      .map((dfd) => {
        const url = toPublicSiteUrl(`/dfd/${dfd.id}`, _request.nextUrl.origin).toString();
        return `${dfd.numero_protocolo || dfd.id}: ${url}`;
      })
      .join("\n");

    await createNotifications(
      admin,
      participantIds
        .filter((userId) => userId !== actor.id)
        .map((userId) => ({
          user_id: userId,
          title: "DFDs oficiais geradas a partir da sala coletiva",
          message: `A sala "${room.title}" foi convertida em ${dfds.length} DFD(s) oficial(is).\n${dfdLinks}`,
          type: "success" as const,
        })),
    );

    return NextResponse.json({ dfds });
  } catch (error: any) {
    return apiError(error?.message || "Erro ao converter DFD coletiva.", 500);
  }
}
