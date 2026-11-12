import { deleteCollectiveRoom, RoomDeletionError } from "@/lib/collective-room-deletion";
import { NextRequest, NextResponse } from "next/server";
import {
  actorIsChefiaForUnit,
  apiError,
  assertCanSeeRoom,
  buildRoomDetail,
  createNotifications,
  createSupabaseAdminClient,
  insertRoomEvent,
  loadRoomParticipantUserIds,
  loadUnitRecipientUserIds,
  loadRoomOrNull,
  normalizeRoomStatus,
  requireCollectiveRoomActor,
  sanitizeLongText,
  sanitizeText,
} from "@/lib/collective-room-api";
import { canEditCollectiveRoom, type CollectiveRoomStatus } from "@/lib/collective-dfd";
import { sanitizePlanningSubsidies } from "@/lib/dfd-planning";
import { toPublicSiteUrl } from "@/lib/site-url";

type RouteContext = { params: Promise<{ id: string }> };

function isAllowedStatusTransition(
  from: CollectiveRoomStatus,
  to: CollectiveRoomStatus,
) {
  const allowed: Record<CollectiveRoomStatus, CollectiveRoomStatus[]> = {
    proposta: ["proposta", "aberta", "arquivada"],
    aberta: ["aberta", "em_consolidacao_chefia", "arquivada"],
    em_consolidacao_chefia: ["aberta", "em_consolidacao_chefia", "pronta_para_conversao", "arquivada"],
    pronta_para_conversao: ["aberta", "em_consolidacao_chefia", "pronta_para_conversao", "arquivada"],
    convertida: ["convertida"],
    arquivada: ["arquivada"],
  };
  return allowed[from]?.includes(to) ?? false;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCollectiveRoomActor();
    if (!actor) return apiError("Usuario nao autenticado.", 401);
    const { id } = await context.params;
    const admin = createSupabaseAdminClient();
    const room = await loadRoomOrNull(admin, id);
    if (!room) return apiError("DFD coletiva nao encontrada.", 404);
    if (!assertCanSeeRoom(actor, room)) return apiError("Acesso negado.", 403);

    return NextResponse.json(await buildRoomDetail(admin, actor, room));
  } catch (error: any) {
    return apiError(error?.message || "Erro ao carregar DFD coletiva.", 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCollectiveRoomActor();
    if (!actor) return apiError("Usuario nao autenticado.", 401);
    const { id } = await context.params;
    const admin = createSupabaseAdminClient();
    const room = await loadRoomOrNull(admin, id);
    if (!room) return apiError("DFD coletiva nao encontrada.", 404);
    const isChefia = actorIsChefiaForUnit(actor, room.unit_id);
    const isProposalOwner = room.created_by === actor.id;
    const canEditMetadata = canEditCollectiveRoom(
      room.status,
      isChefia ? "chefia" : "membro",
      { isProposalOwner },
    );
    if (!canEditMetadata) return apiError("Acesso negado.", 403);
    if (room.status === "convertida") {
      return apiError("DFD coletiva convertida nao pode ser editada.", 409);
    }

    const body = await request.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};
    if ("title" in body) {
      const title = sanitizeText(body.title, 160);
      if (!title) return apiError("Informe o titulo da DFD coletiva.", 400);
      patch.title = title;
    }
    if ("description" in body) {
      const description = sanitizeLongText(body.description, 4000);
      if (!description) return apiError("Explique por que esta sala existe.", 400);
      patch.description = description;
    }
    if ("scope" in body) {
      const scope = sanitizeLongText(body.scope, 4000);
      if (!scope) return apiError("Informe o que entra, o que fica fora e como contribuir.", 400);
      patch.scope = scope;
    }
    if ("planning_subsidies" in body) {
      const planningSubsidies = sanitizePlanningSubsidies(body.planning_subsidies);
      patch.planning_subsidies = planningSubsidies;
    }
    if ("status" in body) {
      if (!isChefia) return apiError("Somente a chefia pode alterar o estado da sala.", 403);
      const status = normalizeRoomStatus(body.status);
      if (!status || status === "convertida") return apiError("Status invalido.", 400);
      if (!isAllowedStatusTransition(room.status, status)) {
        return apiError("Transicao de status invalida para esta sala.", 409);
      }
      if (status === "pronta_para_conversao") {
        const { count: returnedCount, error: returnedError } = await admin
          .from("dfd_collective_contributions")
          .select("id", { count: "exact", head: true })
          .eq("room_id", room.id)
          .eq("status", "devolvida");
        if (returnedError) throw returnedError;
        if (Number(returnedCount || 0) > 0) {
          return apiError(
            "Corrija ou confirme os itens devolvidos antes de abrir a prévia.",
            409,
          );
        }
      }
      patch.status = status;
      if (room.status === "proposta" && status === "aberta") {
        patch.published_at = new Date().toISOString();
        patch.published_by = actor.id;
      }
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
      eventType:
        patch.status === "aberta" && room.status === "proposta"
          ? "room_published"
          : patch.status === "aberta" &&
              (room.status === "em_consolidacao_chefia" || room.status === "pronta_para_conversao")
            ? "room_reopened"
            : patch.status === "em_consolidacao_chefia"
              ? "room_locked_for_consolidation"
              : patch.status === "pronta_para_conversao"
                ? "room_ready_for_conversion"
                : "room_updated",
      message:
        patch.status === "aberta" && room.status === "proposta"
          ? "A chefia publicou a sala para coautoria do setor."
          : patch.status === "aberta" &&
              (room.status === "em_consolidacao_chefia" || room.status === "pronta_para_conversao")
            ? "A chefia reabriu a sala para novas contribuicoes."
            : patch.status === "em_consolidacao_chefia"
              ? "A chefia encerrou a coautoria e assumiu a consolidacao."
              : patch.status === "pronta_para_conversao"
                ? "A sala foi marcada como pronta para conversao."
                : "Dados da DFD coletiva atualizados.",
      metadata: patch,
    });

    if (typeof patch.status === "string") {
      const roomTitle = String(updated.title || room.title || "DFD coletiva").trim();
      const roomUrl = toPublicSiteUrl(`/dfds-coletivas/${room.id}`, request.nextUrl.origin).toString();
      const coauthorshipOpenedImage = toPublicSiteUrl(
        "/email/events/coauthorship-opened.png",
        request.nextUrl.origin,
      ).toString();
      const coauthorshipClosedImage = toPublicSiteUrl(
        "/email/events/coauthorship-closed.png",
        request.nextUrl.origin,
      ).toString();

      if (room.status === "proposta" && patch.status === "aberta") {
        const unitMemberIds = await loadUnitRecipientUserIds(admin, {
          unitId: room.unit_id,
          unitType: room.unit_type,
        });
        await createNotifications(
          admin,
          unitMemberIds
            .filter((userId) => userId !== actor.id)
            .map((userId) => ({
              user_id: userId,
              title: "DFD coletiva publicada",
              message: JSON.stringify({
                kind: "rich_notification",
                template_key: "coauthorship_opened",
                heading: `Sala coletiva publicada: ${roomTitle}`,
                context_label: "DFD coletiva",
                status_label: "Aberta para contribuição",
                status_tone: "info",
                body: `A chefia publicou a sala "${roomTitle}" para contribuições do setor.`,
                cta_label: "Abrir sala coletiva",
                cta_url: roomUrl,
                image_url: coauthorshipOpenedImage,
                facts: [{ label: "Sala", value: roomTitle }],
              }),
              type: "info" as const,
            })),
        );
      }

      if (patch.status === "em_consolidacao_chefia" && room.status === "aberta") {
        const participantIds = await loadRoomParticipantUserIds(admin, room.id);
        await createNotifications(
          admin,
          participantIds
            .filter((userId) => userId !== actor.id)
            .map((userId) => ({
              user_id: userId,
              title: "Coautoria encerrada pela chefia",
              message: JSON.stringify({
                kind: "rich_notification",
                template_key: "coauthorship_closed",
                heading: `Coautoria encerrada: ${roomTitle}`,
                context_label: "DFD coletiva",
                status_label: "Em consolidação",
                status_tone: "warning",
                body: `A chefia encerrou a fase colaborativa da sala "${roomTitle}" e assumiu a consolidação.`,
                cta_label: "Acompanhar sala",
                cta_url: roomUrl,
                image_url: coauthorshipClosedImage,
                facts: [{ label: "Sala", value: roomTitle }],
              }),
              type: "warning" as const,
            })),
        );
      }
    }

    return NextResponse.json({ room: updated });
  } catch (error: any) {
    return apiError(error?.message || "Erro ao atualizar DFD coletiva.", 500);
  }
}


export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCollectiveRoomActor();
    if (!actor) return apiError("Usuário não autenticado.", 401);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const admin = createSupabaseAdminClient();
    const result = await deleteCollectiveRoom({
      role: actor.role, confirmation: String(body.confirmation || ""),
      findRoom: () => loadRoomOrNull(admin, id),
      hasLinkedDfds: async () => {
        const { count, error } = await admin.from("dfd_collective_room_dfds").select("dfd_id", { head: true, count: "exact" }).eq("room_id", id);
        if (error) throw error;
        return Number(count || 0) > 0;
      },
      removeRoom: async (room) => {
        const { data, error } = await admin.from("dfd_collective_rooms").delete().eq("id", room.id).eq("status", room.status).eq("title", room.title).select("id");
        if (error) throw error;
        return data?.length === 1;
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Erro ao excluir sala coletiva.", error instanceof RoomDeletionError ? error.status : 500);
  }
}
