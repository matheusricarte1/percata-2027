import { NextRequest, NextResponse } from "next/server";
import {
  actorHasUnit,
  apiError,
  buildRoomDetail,
  createSupabaseAdminClient,
  insertRoomEvent,
  isAdminActor,
  requireCollectiveRoomActor,
  sanitizeLongText,
  sanitizeText,
  sanitizeUuid,
} from "@/lib/collective-room-api";

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
      if (!isAdminActor(actor) && !actorHasUnit(actor, room.unit_id, room.unit_type)) {
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
    return apiError(error?.message || "Erro ao listar salas coletivas.", 500);
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

    if (!title) return apiError("Informe o titulo da sala.", 400);
    if (!unitId) return apiError("Informe a unidade da sala.", 400);
    if (!actorHasUnit(actor, unitId, unitType)) {
      return apiError("Voce nao possui vinculo com esta unidade.", 403);
    }

    const admin = createSupabaseAdminClient();
    const { data: room, error } = await admin
      .from("dfd_collective_rooms")
      .insert({
        title,
        description,
        scope,
        status: "aberta",
        unit_id: unitId,
        unit_type: unitType,
        campus_id: actor.campus_id,
        created_by: actor.id,
        cycle_year: cycleYear,
      })
      .select("*")
      .single();
    if (error) throw error;

    await insertRoomEvent(admin, {
      roomId: room.id,
      actorId: actor.id,
      eventType: "room_created",
      message: "Sala coletiva criada.",
    });

    return NextResponse.json({ room }, { status: 201 });
  } catch (error: any) {
    return apiError(error?.message || "Erro ao criar sala coletiva.", 500);
  }
}
