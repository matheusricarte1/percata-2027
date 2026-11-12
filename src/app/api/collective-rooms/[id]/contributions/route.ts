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
import { enforceRateLimit } from "@/lib/rate-limit";
import { submissionOperationError } from "@/lib/submission-policy-server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCollectiveRoomActor();
    if (!actor) return apiError("Usuario nao autenticado.", 401);

    // 60 contribuições por minuto por usuário: cobre bulk paste razoável,
    // bloqueia bombing de sala (que polui agregação de duplicidade).
    const limited = await enforceRateLimit(
      request,
      { bucket: "collective-contribute", limit: 60, windowSec: 60 },
      actor.id,
    );
    if (limited) return limited;

    const { id } = await context.params;
    const admin = createSupabaseAdminClient();
    const room = await loadRoomOrNull(admin, id);
    if (!room) return apiError("DFD coletiva nao encontrada.", 404);
    if (!actorHasUnit(actor, room.unit_id, room.unit_type)) return apiError("Acesso negado.", 403);
    // The database RPC locks the room and rechecks status and deadline at write time.
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
    if (/SUBMISSION_CLOSED|STATUS_CHANGED|FORBIDDEN/.test(String(error?.message))) { const mapped = submissionOperationError(error.message); return apiError(mapped.error, mapped.status); }
    return apiError(error?.message || "Erro ao adicionar contribuicao.", 500);
  }
}
