import { NextRequest, NextResponse } from "next/server";
import {
  actorHasUnit,
  actorIsChefiaForUnit,
  apiError,
  assertCanSeeRoom,
  buildRoomDetail,
  createNotifications,
  createSupabaseAdminClient,
  insertRoomEvent,
  loadUnitRecipientUserIds,
  requireCollectiveRoomActor,
  sanitizeLongText,
  sanitizeText,
  sanitizeUuid,
} from "@/lib/collective-room-api";
import { toPublicSiteUrl } from "@/lib/site-url";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireCollectiveRoomActor();
    if (!actor) return apiError("Usuario nao autenticado.", 401);

    const admin = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const status = sanitizeText(searchParams.get("status"), 40);
    const term = sanitizeText(searchParams.get("q"), 120).toLowerCase();

    let query = admin
      .from("dfd_collective_rooms")
      .select("*")
      .order("updated_at", { ascending: false });
    if (status && status !== "todas") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    const visibleRooms = (data || []).filter((room: any) => {
      if (!assertCanSeeRoom(actor, room)) {
        return false;
      }
      if (!term) return true;
      return `${room.title || ""} ${room.description || ""} ${room.scope || ""}`
        .toLowerCase()
        .includes(term);
    });

    const details = await Promise.all(
      visibleRooms.map((room: any) => buildRoomDetail(admin, actor, room)),
    );

    return NextResponse.json({
      rooms: details.map((detail) => ({
        ...detail.room,
        summary: detail.summary,
      })),
    });
  } catch (error: any) {
    return apiError(error?.message || "Erro ao listar DFDs coletivas.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireCollectiveRoomActor();
    if (!actor) return apiError("Usuario nao autenticado.", 401);

    const body = await request.json().catch(() => ({}));
    const title = sanitizeText(body?.title, 160);
    const description = sanitizeLongText(body?.description, 4000);
    const scope = sanitizeLongText(body?.scope, 4000);
    const unitId = sanitizeUuid(body?.unit_id);
    const unitType = body?.unit_type === "laboratorio" ? "laboratorio" : "departamento";
    const cycleYear = Math.max(2000, Math.min(2100, Number(body?.cycle_year || new Date().getFullYear())));

    if (!title) return apiError("Informe o titulo da DFD coletiva.", 400);
    if (!unitId) return apiError("Informe a unidade da DFD coletiva.", 400);
    if (!actorHasUnit(actor, unitId, unitType)) {
      return apiError("Voce nao possui vinculo com esta unidade.", 403);
    }
    const isChefia = actorIsChefiaForUnit(actor, unitId);
    const status = isChefia ? "aberta" : "proposta";

    const admin = createSupabaseAdminClient();
    const { data: room, error } = await admin
      .from("dfd_collective_rooms")
      .insert({
        title,
        description,
        scope,
        status,
        unit_id: unitId,
        unit_type: unitType,
        campus_id: actor.campus_id,
        created_by: actor.id,
        published_at: isChefia ? new Date().toISOString() : null,
        published_by: isChefia ? actor.id : null,
        cycle_year: cycleYear,
      })
      .select("*")
      .single();
    if (error) throw error;

    await insertRoomEvent(admin, {
      roomId: room.id,
      actorId: actor.id,
      eventType: isChefia ? "room_published" : "room_proposed",
      message: isChefia
        ? "DFD coletiva aberta pela chefia."
        : "Proposta de DFD coletiva enviada para publicacao da chefia.",
    });

    const roomUrl = toPublicSiteUrl(`/dfds-coletivas/${room.id}`, request.nextUrl.origin).toString();
    const coauthorshipOpenedImage = toPublicSiteUrl(
      "/email/events/coauthorship-opened.png",
      request.nextUrl.origin,
    ).toString();
    if (isChefia) {
      const unitMemberIds = await loadUnitRecipientUserIds(admin, {
        unitId,
        unitType,
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
              heading: `Sala coletiva publicada: ${title}`,
              context_label: "DFD coletiva",
              status_label: "Aberta para contribuição",
              status_tone: "info",
              body: `A sala coletiva "${title}" foi publicada para contribuições do setor.`,
              cta_label: "Abrir sala coletiva",
              cta_url: roomUrl,
              image_url: coauthorshipOpenedImage,
              facts: [
                { label: "Sala", value: title },
                { label: "Status", value: "Aberta" },
              ],
            }),
            type: "info" as const,
          })),
      );
    } else {
      const chefiaIds = await loadUnitRecipientUserIds(admin, {
        unitId,
        unitType,
        roleInUnit: "chefia",
      });
      await createNotifications(
        admin,
        chefiaIds
          .filter((userId) => userId !== actor.id)
          .map((userId) => ({
            user_id: userId,
            title: "Nova proposta de DFD coletiva",
            message: JSON.stringify({
              kind: "rich_notification",
              template_key: "generic",
              heading: `Nova proposta de sala: ${title}`,
              context_label: "DFD coletiva",
              status_label: "Aguardando publicação",
              status_tone: "info",
              body: `${actor.full_name || "Um membro da unidade"} propôs a sala "${title}" e aguarda publicação da chefia.`,
              cta_label: "Revisar proposta",
              cta_url: roomUrl,
              facts: [
                { label: "Sala", value: title },
                { label: "Proponente", value: actor.full_name || actor.email || "Usuário" },
              ],
            }),
            type: "info" as const,
          })),
      );
    }

    return NextResponse.json({ room }, { status: 201 });
  } catch (error: any) {
    return apiError(error?.message || "Erro ao criar DFD coletiva.", 500);
  }
}
