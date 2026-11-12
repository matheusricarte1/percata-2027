import { NextRequest, NextResponse } from "next/server";
import {
  actorHasUnit,
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
import { sanitizePlanningSubsidies } from "@/lib/dfd-planning";
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
    const planningSubsidies = sanitizePlanningSubsidies(body?.planning_subsidies);
    const unitId = sanitizeUuid(body?.unit_id);
    const unitType = body?.unit_type === "laboratorio" ? "laboratorio" : "departamento";
    const cycleYear = Math.max(2000, Math.min(2100, Number(body?.cycle_year || new Date().getFullYear())));

    if (!title) return apiError("Informe o titulo da DFD coletiva.", 400);
    if (!description) return apiError("Explique por que esta sala existe.", 400);
    if (!scope) return apiError("Informe o que entra, o que fica fora e como contribuir.", 400);
    if (!unitId) return apiError("Informe a unidade da DFD coletiva.", 400);
    if (!actorHasUnit(actor, unitId, unitType)) {
      return apiError("Voce nao possui vinculo com esta unidade.", 403);
    }
    const status = "aberta";

    const admin = createSupabaseAdminClient();
    const { data: room, error } = await admin
      .from("dfd_collective_rooms")
      .insert({
        title,
        description,
        scope,
        planning_subsidies: planningSubsidies,
        status,
        unit_id: unitId,
        unit_type: unitType,
        campus_id: actor.campus_id,
        created_by: actor.id,
        published_at: new Date().toISOString(),
        published_by: actor.id,
        cycle_year: cycleYear,
      })
      .select("*")
      .single();
    if (error) throw error;

    await insertRoomEvent(admin, {
      roomId: room.id,
      actorId: actor.id,
      eventType: "room_opened",
      message: "DFD coletiva aberta para contribuicoes pela unidade.",
    });

    const roomUrl = toPublicSiteUrl(`/dfds-coletivas/${room.id}`, request.nextUrl.origin).toString();
    const coauthorshipOpenedImage = toPublicSiteUrl(
      "/email/events/coauthorship-opened.png",
      request.nextUrl.origin,
    ).toString();
    const unitMemberIds = await loadUnitRecipientUserIds(admin, { unitId, unitType });
    await createNotifications(
      admin,
      unitMemberIds
        .filter((userId) => userId !== actor.id)
        .map((userId) => ({
          user_id: userId,
          title: "Nova DFD coletiva aberta",
          message: JSON.stringify({
            kind: "rich_notification",
            template_key: "coauthorship_opened",
            heading: `Sala coletiva aberta: ${title}`,
            context_label: "DFD coletiva",
            status_label: "Aberta para contribuição",
            status_tone: "info",
            body: `${actor.full_name || "Um membro da unidade"} abriu esta sala para contribuições da unidade.`,
            cta_label: "Abrir sala coletiva",
            cta_url: roomUrl,
            image_url: coauthorshipOpenedImage,
            facts: [{ label: "Sala", value: title }, { label: "Status", value: "Aberta" }],
          }),
          type: "info" as const,
        })),
    );

    return NextResponse.json({ room }, { status: 201 });
  } catch (error: any) {
    return apiError(error?.message || "Erro ao criar DFD coletiva.", 500);
  }
}
