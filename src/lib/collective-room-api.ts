import { NextResponse } from "next/server";
import { normalizeRole, type UserRole } from "@/lib/access";
import {
  aggregateCollectiveContributions,
  buildCollectiveContributionKey,
  canConvertCollectiveRoom,
  canEditCollectiveContribution,
  canEditCollectiveRoom,
  formatContributorDistribution,
  splitCollectiveItemsByExpenseClass,
  stripCollectiveContributionProfileFields,
  summarizeCollectiveRoom,
  type CollectiveRoomRole,
  type CollectiveContribution,
  type CollectiveRoomStatus,
  type CollectiveUnitType,
} from "@/lib/collective-dfd";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/utils/supabase/server";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

type ActorUnit = {
  unit_id: string;
  unit_type: CollectiveUnitType;
  role_in_unit: string | null;
  nome: string;
};

export type CollectiveRoomActor = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  campus_id: string | null;
  units: ActorUnit[];
};

export type CollectiveRoomRow = {
  id: string;
  title: string;
  description: string | null;
  scope: string | null;
  status: CollectiveRoomStatus;
  unit_id: string;
  unit_type: CollectiveUnitType;
  campus_id: string | null;
  created_by: string;
  cycle_year: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  published_by: string | null;
  converted_at: string | null;
};

type CollectiveAuthorInsertRow = {
  dfd_id: string;
  room_id: string;
  contribution_user_id: string;
  author_name_snapshot: string | null;
  author_email_snapshot: string | null;
  item_count: number;
  quantidade_total: number;
  valor_total_estimado: number;
  contribution_ids: string[];
};

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function sanitizeText(value: unknown, max = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function sanitizeLongText(value: unknown, max = 12000) {
  return String(value || "").trim().slice(0, max);
}

export function sanitizeUuid(value: unknown) {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    text,
  )
    ? text
    : "";
}

function sanitizeOptionalEmail(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function buildProtocol(seed = 0) {
  const now = new Date();
  const year = now.getFullYear();
  const chunk =
    `${now.getMonth() + 1}`.padStart(2, "0") +
    `${now.getDate()}`.padStart(2, "0") +
    `${now.getHours()}`.padStart(2, "0") +
    `${now.getMinutes()}`.padStart(2, "0") +
    `${now.getSeconds()}`.padStart(2, "0");
  const random = Math.floor(Math.random() * 9000 + 1000) + seed;
  return `DFD-${year}-${chunk}-${String(random).padStart(4, "0")}`;
}

function normalizeUnitType(value: unknown): CollectiveUnitType | null {
  return value === "departamento" || value === "laboratorio" ? value : null;
}

function normalizeRoomStatus(value: unknown): CollectiveRoomStatus | null {
  if (
    value === "proposta" ||
    value === "aberta" ||
    value === "em_consolidacao_chefia" ||
    value === "pronta_para_conversao" ||
    value === "convertida" ||
    value === "arquivada"
  ) {
    return value;
  }
  return null;
}

async function loadUnitNames(admin: SupabaseAdmin, units: Array<{ unit_id: string; unit_type: string }>) {
  const deptIds = units
    .filter((unit) => unit.unit_type === "departamento")
    .map((unit) => unit.unit_id);
  const labIds = units
    .filter((unit) => unit.unit_type === "laboratorio")
    .map((unit) => unit.unit_id);
  const [deptResult, labResult] = await Promise.all([
    deptIds.length
      ? admin.from("departamentos").select("id,nome").in("id", deptIds)
      : Promise.resolve({ data: [], error: null }),
    labIds.length
      ? admin.from("laboratorios").select("id,nome").in("id", labIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (deptResult.error) throw deptResult.error;
  if (labResult.error) throw labResult.error;

  const names = new Map<string, string>();
  for (const row of deptResult.data || []) {
    names.set(`departamento:${row.id}`, String(row.nome || ""));
  }
  for (const row of labResult.data || []) {
    names.set(`laboratorio:${row.id}`, String(row.nome || ""));
  }
  return names;
}

export async function requireCollectiveRoomActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,email,full_name,avatar_url,role,campus_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  const { data: unitRows, error: unitError } = await admin
    .from("user_units")
    .select("unit_id,unit_type,role_in_unit")
    .eq("user_id", user.id);
  if (unitError) throw unitError;

  const validUnits = (unitRows || [])
    .map((unit: any) => ({
      unit_id: String(unit.unit_id || ""),
      unit_type: normalizeUnitType(unit.unit_type),
      role_in_unit: unit.role_in_unit ? String(unit.role_in_unit) : null,
    }))
    .filter(
      (unit): unit is { unit_id: string; unit_type: CollectiveUnitType; role_in_unit: string | null } =>
        Boolean(unit.unit_id && unit.unit_type),
    );
  const unitNames = await loadUnitNames(admin, validUnits);

  return {
    id: user.id,
    email: profile?.email || user.email || null,
    full_name: profile?.full_name || user.user_metadata?.full_name || null,
    avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || null,
    role: normalizeRole(profile?.role, user.email),
    campus_id: profile?.campus_id || null,
    units: validUnits.map((unit) => ({
      ...unit,
      nome: unitNames.get(`${unit.unit_type}:${unit.unit_id}`) || "Unidade vinculada",
    })),
  } satisfies CollectiveRoomActor;
}

export function isAdminActor(actor: CollectiveRoomActor) {
  return actor.role === "admin" || actor.role === "superadmin";
}

export function actorHasUnit(actor: CollectiveRoomActor, unitId: string, unitType: string) {
  if (isAdminActor(actor)) return true;
  return actor.units.some(
    (unit) => unit.unit_id === unitId && unit.unit_type === unitType,
  );
}

export function actorIsChefiaForUnit(actor: CollectiveRoomActor, unitId: string) {
  if (isAdminActor(actor)) return true;
  return actor.units.some(
    (unit) => unit.unit_id === unitId && unit.role_in_unit === "chefia",
  );
}

export function resolveCollectiveRoomRole(
  actor: CollectiveRoomActor,
  room: Pick<CollectiveRoomRow, "unit_id">,
): CollectiveRoomRole {
  if (actor.role === "admin" || actor.role === "superadmin") return actor.role;
  if (actorIsChefiaForUnit(actor, room.unit_id)) return "chefia";
  return "membro";
}

export async function loadRoomOrNull(admin: SupabaseAdmin, roomId: string) {
  const { data, error } = await admin
    .from("dfd_collective_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as CollectiveRoomRow | null;
}

export function assertCanSeeRoom(actor: CollectiveRoomActor, room: CollectiveRoomRow) {
  if (room.status === "proposta") {
    return (
      isAdminActor(actor) ||
      actorIsChefiaForUnit(actor, room.unit_id) ||
      room.created_by === actor.id
    );
  }
  return actorHasUnit(actor, room.unit_id, room.unit_type);
}

export async function insertRoomEvent(
  admin: SupabaseAdmin,
  params: {
    roomId: string;
    actorId: string;
    eventType: string;
    message: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await admin.from("dfd_collective_room_events").insert({
    room_id: params.roomId,
    actor_id: params.actorId,
    event_type: params.eventType,
    message: params.message,
    metadata: params.metadata || null,
  });
  if (error) throw error;
}

export async function loadUnitRecipientUserIds(
  admin: SupabaseAdmin,
  params: {
    unitId: string;
    unitType: CollectiveUnitType;
    roleInUnit?: string | null;
  },
) {
  let query = admin
    .from("user_units")
    .select("user_id")
    .eq("unit_id", params.unitId)
    .eq("unit_type", params.unitType);
  if (params.roleInUnit) query = query.eq("role_in_unit", params.roleInUnit);
  const { data, error } = await query;
  if (error) throw error;
  return Array.from(
    new Set(
      (data || [])
        .map((row: any) => String(row.user_id || "").trim())
        .filter(Boolean),
    ),
  );
}

export async function loadRoomParticipantUserIds(admin: SupabaseAdmin, roomId: string) {
  const { data, error } = await admin
    .from("dfd_collective_contributions")
    .select("user_id")
    .eq("room_id", roomId);
  if (error) throw error;
  return Array.from(
    new Set(
      (data || [])
        .map((row: any) => String(row.user_id || "").trim())
        .filter(Boolean),
    ),
  );
}

export async function createNotifications(
  admin: SupabaseAdmin,
  notifications: Array<{
    user_id: string;
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
  }>,
) {
  const rows = notifications.filter((row) => row.user_id && row.title && row.message);
  if (rows.length === 0) return 0;
  const { error } = await admin.from("notifications").insert(rows);
  if (error) throw error;
  return rows.length;
}

export async function buildRoomDetail(
  admin: SupabaseAdmin,
  actor: CollectiveRoomActor,
  room: CollectiveRoomRow,
) {
  const [{ data: contributionRows, error: contributionError }, { data: events, error: eventsError }, { data: links, error: linksError }] =
    await Promise.all([
      admin
        .from("dfd_collective_contributions")
        .select("*")
        .eq("room_id", room.id)
        .neq("status", "arquivada")
        .order("created_at", { ascending: true }),
      admin
        .from("dfd_collective_room_events")
        .select("id,room_id,actor_id,event_type,message,metadata,created_at")
        .eq("room_id", room.id)
        .order("created_at", { ascending: false })
        .limit(40),
      admin
        .from("dfd_collective_room_dfds")
        .select("room_id,dfd_id,expense_class,created_at")
        .eq("room_id", room.id),
    ]);
  if (contributionError) throw contributionError;
  if (eventsError) throw eventsError;
  if (linksError) throw linksError;

  const rawContributions = (contributionRows || []) as any[];
  const profileIds = Array.from(
    new Set(rawContributions.map((row) => row.user_id).filter(Boolean)),
  );
  const { data: profiles, error: profilesError } = profileIds.length
    ? await admin
        .from("profiles")
        .select("id,full_name,email,avatar_url")
        .in("id", profileIds)
    : { data: [], error: null };
  if (profilesError) throw profilesError;
  const profileById = new Map((profiles || []).map((profile: any) => [profile.id, profile]));

  const activeContributions = rawContributions
    .filter((row) => row.status !== "arquivada")
    .map((row) => {
      const profile = profileById.get(row.user_id);
      return {
        ...row,
        user_name: profile?.full_name || null,
        user_email: profile?.email || null,
        user_avatar_url: profile?.avatar_url || row.user_avatar_url || null,
      } satisfies CollectiveContribution;
    });
  const aggregatedItems = aggregateCollectiveContributions(activeContributions);
  const summary = summarizeCollectiveRoom(activeContributions, actor.id);

  const unitNames = await loadUnitNames(admin, [
    { unit_id: room.unit_id, unit_type: room.unit_type },
  ]);
  const actorRoomRole = resolveCollectiveRoomRole(actor, room);
  const isProposalOwner = room.created_by === actor.id;

  return {
    room: {
      ...room,
      unit_name:
        unitNames.get(`${room.unit_type}:${room.unit_id}`) ||
        "Unidade vinculada",
      can_edit_metadata: canEditCollectiveRoom(room.status, actorRoomRole, {
        isProposalOwner,
      }),
      can_publish:
        (actorRoomRole === "chefia" ||
          actorRoomRole === "admin" ||
          actorRoomRole === "superadmin") &&
        room.status === "proposta",
      can_reopen:
        (actorRoomRole === "chefia" ||
          actorRoomRole === "admin" ||
          actorRoomRole === "superadmin") &&
        (room.status === "em_consolidacao_chefia" ||
          room.status === "pronta_para_conversao"),
      can_contribute: room.status === "aberta",
      can_convert: canConvertCollectiveRoom(room.status, actorRoomRole),
      actor_role: actorRoomRole,
      is_proposal_owner: isProposalOwner,
    },
    summary,
    participants: summary.participants,
    contributions: rawContributions.map((row) => {
      const profile = profileById.get(row.user_id);
      return {
        ...row,
        user_name: profile?.full_name || null,
        user_email: profile?.email || null,
        user_avatar_url: profile?.avatar_url || row.user_avatar_url || null,
        can_edit: canEditCollectiveContribution({
          roomStatus: room.status,
          actorRole: actorRoomRole,
          actorId: actor.id,
          ownerId: row.user_id,
        }),
      };
    }),
    items: aggregatedItems,
    expenseGroups: splitCollectiveItemsByExpenseClass(aggregatedItems),
    events: events || [],
    linkedDfds: links || [],
  };
}

export function contributionFromPayload(params: {
  body: any;
  actor: CollectiveRoomActor;
  room: CollectiveRoomRow;
}) {
  const item = params.body?.item || params.body || {};
  const quantity = Math.max(0, Number(item.quantidade || item.quantity || 0));
  const value = Math.max(
    0,
    Number(item.valor_unitario_estimado || item.valor_unitario || item.unitValue || 0),
  );
  const contribution: CollectiveContribution = {
    unit_id: params.room.unit_id,
    unit_type: params.room.unit_type,
    user_id: params.actor.id,
    user_name: params.actor.full_name,
    user_email: params.actor.email,
    user_avatar_url: params.actor.avatar_url,
    codigo_item_efisco: sanitizeText(
      item.codigo_item_efisco || item.codigo_efisco || item.codigo_tce || item.siad,
      80,
    ),
    codigo_tce: sanitizeText(item.codigo_tce || item.codigo_efisco || item.siad, 80),
    descricao: sanitizeText(item.descricao || item.name, 800),
    unidade_medida: sanitizeText(item.unidade_medida || "UN", 40),
    quantidade: quantity,
    valor_unitario_estimado: value,
    justificativa_item: sanitizeLongText(
      item.justificativa_item || item.justificativa_quantidade || item.justificativa,
      4000,
    ),
    link_referencia: sanitizeText(item.link_referencia || item.link, 1000),
    gnd: sanitizeText(item.gnd || item.gnd_derivado || item.gnd_preferencial, 80),
    gnd_derivado: sanitizeText(item.gnd_derivado || item.gnd || item.gnd_preferencial, 80),
    codigo_natureza_despesa: sanitizeText(
      item.codigo_natureza_despesa || item.codigo_natureza_preferencial,
      80,
    ),
    tipo_objeto: sanitizeText(item.tipo_objeto, 80),
    codigo_grupo: sanitizeText(item.codigo_grupo, 80),
    nome_grupo: sanitizeText(item.nome_grupo || item.grupo, 260),
    codigo_classe: sanitizeText(item.codigo_classe, 80),
    nome_classe: sanitizeText(item.nome_classe || item.classe, 260),
  };

  if (!contribution.codigo_item_efisco && !contribution.codigo_tce) {
    throw new Error("Informe o codigo e-Fisco/TCE do item.");
  }
  if (!contribution.descricao) throw new Error("Informe a descricao do item.");
  if (!quantity) throw new Error("Informe quantidade maior que zero.");
  if (!value) throw new Error("Informe valor unitario estimado maior que zero.");

  return {
    ...contribution,
    room_id: params.room.id,
    status: "aberta",
    collective_key: buildCollectiveContributionKey(contribution),
  };
}

export function toCollectiveContributionDbRow(
  contribution: ReturnType<typeof contributionFromPayload>,
) {
  return stripCollectiveContributionProfileFields(contribution);
}

export async function upsertContribution(
  admin: SupabaseAdmin,
  contribution: ReturnType<typeof contributionFromPayload>,
) {
  const { data: existing, error: existingError } = await admin
    .from("dfd_collective_contributions")
    .select("id,quantidade")
    .eq("room_id", contribution.room_id)
    .eq("user_id", contribution.user_id)
    .eq("collective_key", contribution.collective_key)
    .eq("status", "aberta")
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.id) {
    const { data, error } = await admin
      .from("dfd_collective_contributions")
      .update({
        quantidade:
          Number(existing.quantidade || 0) + Number(contribution.quantidade || 0),
        valor_unitario_estimado: contribution.valor_unitario_estimado,
        justificativa_item: contribution.justificativa_item,
        link_referencia: contribution.link_referencia,
        user_avatar_url: contribution.user_avatar_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await admin
    .from("dfd_collective_contributions")
    .insert(toCollectiveContributionDbRow(contribution))
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function getCampusLegacy(admin: SupabaseAdmin, campusId: string | null) {
  if (!campusId) return "SEM_CAMPUS";
  const { data } = await admin
    .from("campi")
    .select("sigla,nome")
    .eq("id", campusId)
    .maybeSingle();
  return String(data?.sigla || data?.nome || campusId).trim() || "SEM_CAMPUS";
}

function buildCollectiveAuthorRows(params: {
  dfdId: string;
  roomId: string;
  contributions: any[];
}) {
  const { dfdId, roomId, contributions } = params;
  const authorMap = new Map<
    string,
    Omit<CollectiveAuthorInsertRow, "item_count"> & { item_keys: Set<string> }
  >();

  for (const contribution of contributions) {
    const userId = String(contribution.user_id || "").trim();
    if (!userId) continue;

    const current =
      authorMap.get(userId) ||
      ({
        dfd_id: dfdId,
        room_id: roomId,
        contribution_user_id: userId,
        author_name_snapshot: sanitizeText(contribution.user_name, 200) || null,
        author_email_snapshot: sanitizeOptionalEmail(contribution.user_email),
        item_keys: new Set<string>(),
        quantidade_total: 0,
        valor_total_estimado: 0,
        contribution_ids: [],
      } satisfies Omit<CollectiveAuthorInsertRow, "item_count"> & { item_keys: Set<string> });

    current.author_name_snapshot =
      current.author_name_snapshot || sanitizeText(contribution.user_name, 200) || null;
    current.author_email_snapshot =
      current.author_email_snapshot || sanitizeOptionalEmail(contribution.user_email);
    current.item_keys.add(String(contribution.collective_key || contribution.id || ""));
    current.quantidade_total += Number(contribution.quantidade || 0);
    current.valor_total_estimado +=
      Number(contribution.quantidade || 0) * Number(contribution.valor_unitario_estimado || 0);
    if (contribution.id) current.contribution_ids.push(String(contribution.id));
    authorMap.set(userId, current);
  }

  return Array.from(authorMap.values()).map(
    ({ item_keys, valor_total_estimado, contribution_ids, ...entry }) =>
      ({
        ...entry,
        item_count: item_keys.size,
        valor_total_estimado: Number(valor_total_estimado.toFixed(2)),
        contribution_ids: Array.from(new Set(contribution_ids)),
      }) satisfies CollectiveAuthorInsertRow,
  );
}

export async function convertRoomToOfficialDfds(params: {
  admin: SupabaseAdmin;
  actor: CollectiveRoomActor;
  room: CollectiveRoomRow;
}) {
  const { admin, actor, room } = params;
  const actorRoomRole = resolveCollectiveRoomRole(actor, room);
  if (actorRoomRole !== "chefia" && actorRoomRole !== "admin" && actorRoomRole !== "superadmin") {
    throw new Error("Somente a chefia da unidade pode converter a sala em DFD.");
  }
  if (room.status === "convertida" || room.status === "arquivada") {
    throw new Error("Esta sala nao pode mais ser convertida.");
  }
  if (room.status !== "pronta_para_conversao") {
    throw new Error("Leve a sala ate a previa de conversao antes de gerar a DFD oficial.");
  }

  const detail = await buildRoomDetail(admin, actor, room);
  const groups = splitCollectiveItemsByExpenseClass(detail.items);
  if (groups.length === 0) throw new Error("A sala nao possui contribuicoes ativas.");
  if (groups.some((group) => group.expenseClass === "sem-gnd")) {
    throw new Error("Revise itens sem GND antes de converter a sala.");
  }

  const campusLegacy = await getCampusLegacy(admin, room.campus_id || actor.campus_id);
  const createdDfds = [];

  for (const [index, group] of groups.entries()) {
    const valorTotalEstimado = group.items.reduce(
      (acc, item) =>
        acc +
        Number(item.quantidade || 0) *
          Number(item.valor_unitario_estimado || 0),
      0,
    );
    const { data: dfd, error: dfdError } = await admin
      .from("dfds")
      .insert({
        numero_protocolo: buildProtocol(index),
        objeto_contratacao: `${room.title} - ${group.label}`,
        justificativa_contratacao:
          [room.description, room.scope]
            .map((value) => String(value || "").trim())
            .filter(Boolean)
            .join("\n\n") || "DFD coletiva gerada a partir de demanda setorial.",
        solicitante_id: actor.id,
        campus: campusLegacy,
        campus_id: room.campus_id || actor.campus_id || null,
        unidade_id: room.unit_id,
        tipo_unidade: room.unit_type,
        origin_type: "collective",
        collective_origin_room_id: room.id,
        collective_origin_room_title: room.title,
        collective_origin_expense_class: group.expenseClass,
        previsao_recebimento: null,
        valor_total_estimado: valorTotalEstimado,
        status: "rascunho",
      })
      .select("id,numero_protocolo")
      .single();
    if (dfdError) throw dfdError;

    const itemsToInsert = group.items.map((item) => ({
      dfd_id: dfd.id,
      codigo_tce: String(item.codigo_tce || item.codigo_item_efisco || "").trim(),
      codigo_item_efisco: String(item.codigo_item_efisco || item.codigo_tce || "").trim(),
      descricao: String(item.descricao || "").trim(),
      quantidade: Number(item.quantidade || 0),
      valor_unitario_estimado: Number(item.valor_unitario_estimado || 0),
      justificativa_item: [
        String(item.justificativa_item || "").trim(),
        `Distribuicao por usuario: ${formatContributorDistribution(item.contributors)}`,
      ]
        .filter(Boolean)
        .join("\n"),
      justificativa_quantidade: null,
      local_uso: detail.room.unit_name,
      link_referencia: String(item.link_referencia || ""),
      gnd: String(item.gnd || item.gnd_derivado || "3.3.90.30"),
      gnd_derivado: String(item.gnd_derivado || item.gnd || "") || null,
      tipo_objeto: item.tipo_objeto || null,
      codigo_grupo: item.codigo_grupo || null,
      nome_grupo: item.nome_grupo || null,
      codigo_classe: item.codigo_classe || null,
      nome_classe: item.nome_classe || null,
      codigo_material_servico: null,
      nome_material_servico: null,
      codigo_natureza_despesa: item.codigo_natureza_despesa || null,
    }));

    const { error: itemsError } = await admin.from("dfd_items").insert(itemsToInsert);
    if (itemsError) {
      await admin.from("dfds").delete().eq("id", dfd.id);
      throw itemsError;
    }

    const { error: linkError } = await admin.from("dfd_collective_room_dfds").insert({
      room_id: room.id,
      dfd_id: dfd.id,
      expense_class: group.expenseClass,
    });
    if (linkError) throw linkError;

    const groupKeys = new Set(group.items.map((item) => buildCollectiveContributionKey(item)));
    const groupContributions = detail.contributions.filter((contribution: any) =>
      groupKeys.has(String(contribution.collective_key || "")),
    );
    const contributionIds = groupContributions
      .map((contribution: any) => contribution.id)
      .filter(Boolean);
    const authorRows = buildCollectiveAuthorRows({
      dfdId: dfd.id,
      roomId: room.id,
      contributions: groupContributions,
    });
    if (authorRows.length > 0) {
      const { error: authorsError } = await admin
        .from("dfd_collective_dfd_authors")
        .insert(authorRows);
      if (authorsError) throw authorsError;
    }
    if (contributionIds.length > 0) {
      const { error: closeError } = await admin
        .from("dfd_collective_contributions")
        .update({ status: "consolidada", consolidated_dfd_id: dfd.id })
        .in("id", contributionIds);
      if (closeError) throw closeError;
    }

    createdDfds.push({
      id: dfd.id,
      numero_protocolo: dfd.numero_protocolo,
      expense_class: group.expenseClass,
      label: group.label,
    });
  }

  const { error: roomError } = await admin
    .from("dfd_collective_rooms")
    .update({ status: "convertida", converted_at: new Date().toISOString() })
    .eq("id", room.id);
  if (roomError) throw roomError;

  await insertRoomEvent(admin, {
    roomId: room.id,
    actorId: actor.id,
    eventType: "room_converted",
    message: `${createdDfds.length} DFD(s) oficial(is) gerada(s).`,
    metadata: { dfds: createdDfds },
  });

  return createdDfds;
}

export { createSupabaseAdminClient, normalizeRoomStatus, normalizeUnitType };
