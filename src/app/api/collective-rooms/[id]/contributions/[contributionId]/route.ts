import { NextRequest, NextResponse } from "next/server";
import {
  actorIsChefiaForUnit,
  apiError,
  createSupabaseAdminClient,
  isAdminActor,
  insertRoomEvent,
  loadRoomOrNull,
  requireCollectiveRoomActor,
  sanitizeLongText,
  sanitizeText,
} from "@/lib/collective-room-api";
import { toPublicSiteUrl } from "@/lib/site-url";
import { sendQueuedNotificationEmail } from "@/lib/email-alert-queue";
import { buildCollectiveContributionKey } from "@/lib/collective-dfd";
import { submissionOperationError } from "@/lib/submission-policy-server";

type RouteContext = { params: Promise<{ id: string; contributionId: string }> };
type ReturnFieldKey = "quantidade" | "valor_unitario_estimado" | "justificativa_item" | "link_referencia";
type ContributionSnapshot = {
  quantidade: number;
  valor_unitario_estimado: number;
  justificativa_item: string;
  link_referencia: string;
  updated_at: string | null;
};

const RETURN_FIELD_LABELS: Record<ReturnFieldKey, string> = {
  quantidade: "Quantidade",
  valor_unitario_estimado: "Valor unitario",
  justificativa_item: "Justificativa",
  link_referencia: "Link de referencia",
};

async function loadContribution(admin: ReturnType<typeof createSupabaseAdminClient>, id: string) {
  const { data, error } = await admin
    .from("dfd_collective_contributions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function canMutateContribution(params: {
  actorId: string;
  isChefia: boolean;
  roomStatus: string;
  contribution: any;
}) {
  if (
    params.roomStatus === "proposta" ||
    params.roomStatus === "convertida" ||
    params.roomStatus === "arquivada"
  ) {
    return false;
  }
  if (params.isChefia) {
    return (
      params.roomStatus === "aberta" ||
      params.roomStatus === "em_consolidacao_chefia" ||
      params.roomStatus === "pronta_para_conversao"
    );
  }
  if (
    params.roomStatus === "em_consolidacao_chefia" &&
    params.contribution.user_id === params.actorId &&
    params.contribution.status === "devolvida"
  ) {
    return true;
  }
  return params.roomStatus === "aberta" && params.contribution.user_id === params.actorId;
}

function sanitizeReturnFields(value: unknown): ReturnFieldKey[] {
  const values = Array.isArray(value) ? value : [value];
  const allowed = new Set(Object.keys(RETURN_FIELD_LABELS));
  const fields: ReturnFieldKey[] = [];
  for (const raw of values) {
    const field = String(raw || "").trim();
    if (!allowed.has(field) || fields.includes(field as ReturnFieldKey)) continue;
    fields.push(field as ReturnFieldKey);
  }
  return fields;
}

function buildContributionSnapshot(contribution: any): ContributionSnapshot {
  return {
    quantidade: Number(contribution?.quantidade || 0),
    valor_unitario_estimado: Number(contribution?.valor_unitario_estimado || 0),
    justificativa_item: String(contribution?.justificativa_item || ""),
    link_referencia: String(contribution?.link_referencia || ""),
    updated_at: typeof contribution?.updated_at === "string" ? contribution.updated_at : null,
  };
}

async function loadLatestReturnSnapshot(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  roomId: string,
  contributionId: string,
) {
  const { data, error } = await admin
    .from("dfd_collective_room_events")
    .select("metadata")
    .eq("room_id", roomId)
    .eq("event_type", "contribution_returned_by_chefia")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  const row = (data || []).find((event: any) => {
    const metadata = event?.metadata || {};
    return metadata.contribution_id === contributionId && metadata.return_snapshot;
  });
  return (row as any)?.metadata?.return_snapshot || null;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCollectiveRoomActor();
    if (!actor) return apiError("Usuario nao autenticado.", 401);
    const { id, contributionId } = await context.params;
    const admin = createSupabaseAdminClient();
    const room = await loadRoomOrNull(admin, id);
    if (!room) return apiError("DFD coletiva nao encontrada.", 404);
    const contribution = await loadContribution(admin, contributionId);
    if (!contribution || contribution.room_id !== room.id) {
      return apiError("Contribuicao nao encontrada.", 404);
    }

    const isChefia = actorIsChefiaForUnit(actor, room.unit_id);
    if (
      !canMutateContribution({
        actorId: actor.id,
        isChefia,
        roomStatus: room.status,
        contribution,
      })
    ) {
      return apiError("Acesso negado.", 403);
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "edit");
    if (!["edit", "confirm", "return_for_correction"].includes(action)) {
      return apiError("Acao invalida para contribuicao.", 400);
    }
    if ((action === "confirm" || action === "return_for_correction") && !isChefia) {
      return apiError("Apenas a chefia pode confirmar ou devolver itens.", 403);
    }
    const isReturnedContributionCorrection =
      action === "edit" &&
      contribution.status === "devolvida" &&
      contribution.user_id === actor.id;
    const isChefiaGovernanceEdit = isChefia && !isReturnedContributionCorrection;
    const actorCanEditFiscal = isAdminActor(actor);

    const patch: Record<string, unknown> = {};
    if (action === "edit" && "quantidade" in body) {
      const quantidade = Math.max(0, Number(body.quantidade || 0));
      if (!quantidade) return apiError("Quantidade deve ser maior que zero.", 400);
      patch.quantidade = quantidade;
    }
    if (action === "edit" && "valor_unitario_estimado" in body) {
      const value = Math.max(0, Number(body.valor_unitario_estimado || 0));
      if (!value) return apiError("Valor unitario deve ser maior que zero.", 400);
      patch.valor_unitario_estimado = value;
    }
    if (action === "edit" && "justificativa_item" in body) {
      patch.justificativa_item = sanitizeLongText(body.justificativa_item, 4000);
    }
    if (action === "edit" && "justificativa_quantidade" in body) {
      patch.justificativa_quantidade = sanitizeLongText(body.justificativa_quantidade, 4000);
    }
    if (action === "edit" && "unidade_medida" in body) {
      const unidade = sanitizeText(body.unidade_medida, 40).toUpperCase();
      if (!['UN', 'CX', 'PCT', 'KG', 'L', 'M', 'M2', 'M3'].includes(unidade)) {
        return apiError("Unidade de medida inválida.", 400);
      }
      patch.unidade_medida = unidade;
    }
    if (action === "edit" && "link_referencia" in body) {
      patch.link_referencia = sanitizeText(body.link_referencia, 1000);
    }
    let fiscalFieldChanged = false;
    const includesFiscalPatch =
      action === "edit" &&
      ("codigo_item_efisco" in body ||
        "codigo_natureza_despesa" in body ||
        "gnd" in body ||
        "efisco_item_id" in body ||
        "efisco_item_natureza_id" in body);
    if (includesFiscalPatch && !actorCanEditFiscal) {
      return apiError("Apenas admin/superadmin pode ajustar codigo e natureza fiscal.", 403);
    }
    if (action === "edit" && "codigo_item_efisco" in body) {
      const code = sanitizeText(body.codigo_item_efisco, 80);
      if (!code) return apiError("Informe o codigo e-Fisco do item.", 400);
      patch.codigo_item_efisco = code;
      patch.codigo_tce = sanitizeText(body.codigo_tce || body.codigo_item_efisco, 80);
      fiscalFieldChanged = true;
    }
    if (action === "edit" && "codigo_natureza_despesa" in body) {
      patch.codigo_natureza_despesa = sanitizeText(body.codigo_natureza_despesa, 80);
      fiscalFieldChanged = true;
    }
    if (action === "edit" && "gnd" in body) {
      const gnd = sanitizeText(body.gnd, 80);
      patch.gnd = gnd;
      patch.gnd_derivado = sanitizeText(body.gnd_derivado || body.gnd, 80);
      fiscalFieldChanged = true;
    }
    if (action === "edit" && "efisco_item_id" in body) {
      const itemId = Number(body.efisco_item_id);
      patch.efisco_item_id = Number.isFinite(itemId) && itemId > 0 ? itemId : null;
      fiscalFieldChanged = true;
    }
    if (action === "edit" && "efisco_item_natureza_id" in body) {
      const naturezaId = Number(body.efisco_item_natureza_id);
      patch.efisco_item_natureza_id =
        Number.isFinite(naturezaId) && naturezaId > 0 ? naturezaId : null;
      fiscalFieldChanged = true;
    }
    if (action === "confirm") {
      patch.status = "consolidada";
    }
    const returnComment =
      action === "return_for_correction" ? sanitizeLongText(body.return_comment, 2000) : "";
    const returnFields =
      action === "return_for_correction" ? sanitizeReturnFields(body.return_fields) : [];
    if (action === "return_for_correction") {
      if (!returnComment) return apiError("Informe o comentario para devolucao.", 400);
      if (returnFields.length === 0) return apiError("Informe ao menos um campo para correcao.", 400);
      patch.status = "devolvida";
    }
    if (isReturnedContributionCorrection) {
      patch.status = "aberta";
    }
    if (isChefiaGovernanceEdit) {
      patch.adjusted_by_chefia = true;
      patch.adjusted_by = actor.id;
      patch.adjusted_at = new Date().toISOString();
    }
    if (fiscalFieldChanged) {
      patch.collective_key = buildCollectiveContributionKey({
        ...contribution,
        ...patch,
      });
    }
    patch.updated_at = new Date().toISOString();

    const { data: updated, error } = await admin
      .rpc("write_collective_contribution_with_deadline", {
        p_actor: actor.id, p_id: contribution.id, p_patch: patch, p_add: false,
      });
    if (error) throw error;
    const latestReturnSnapshot = isReturnedContributionCorrection
      ? await loadLatestReturnSnapshot(admin, room.id, contribution.id)
      : null;

    const eventType =
      action === "confirm"
        ? "contribution_confirmed_by_chefia"
        : action === "return_for_correction"
          ? "contribution_returned_by_chefia"
          : isReturnedContributionCorrection
            ? "contribution_corrected"
            : isChefiaGovernanceEdit
              ? "contribution_adjusted_by_chefia"
              : "contribution_updated";
    const eventMessage =
      action === "confirm"
        ? `A chefia confirmou a contribuicao: ${contribution.descricao}.`
        : action === "return_for_correction"
          ? `A chefia devolveu a contribuicao para correcao: ${contribution.descricao}.`
          : isReturnedContributionCorrection
            ? `Contribuicao corrigida pelo participante: ${contribution.descricao}.`
            : isChefiaGovernanceEdit
              ? `A chefia ajustou a contribuicao: ${contribution.descricao}.`
              : `Contribuicao atualizada: ${contribution.descricao}.`;

    await insertRoomEvent(admin, {
      roomId: room.id,
      actorId: actor.id,
      eventType,
      message: eventMessage,
      metadata: {
        contribution_id: contribution.id,
        adjusted_by_chefia: isChefiaGovernanceEdit,
        action,
        return_comment: returnComment || null,
        return_fields: returnFields,
        return_snapshot: action === "return_for_correction" ? buildContributionSnapshot(contribution) : latestReturnSnapshot,
        correction_snapshot: isReturnedContributionCorrection ? buildContributionSnapshot(updated) : null,
      },
    });

    if (action === "return_for_correction") {
      const roomUrl = toPublicSiteUrl(`/dfds-coletivas/${room.id}`, request.nextUrl.origin).toString();
      const returnFieldLabels = returnFields.map((field) => RETURN_FIELD_LABELS[field]).join(", ");
      const notificationMessage = JSON.stringify({
        kind: "rich_notification",
        template_key: "dfd_returned",
        heading: "Corrigir item da DFD coletiva",
        context_label: "DFD coletiva",
        status_label: "Correção solicitada",
        status_tone: "warning",
        body: `A chefia devolveu o item "${contribution.descricao}" para correção. Campos: ${returnFieldLabels}. ${returnComment}`,
        cta_label: "Abrir sala coletiva",
        cta_url: roomUrl,
        facts: [
          { label: "Sala", value: room.title || "DFD coletiva" },
          { label: "Item", value: contribution.descricao },
          { label: "Campos", value: returnFieldLabels },
        ],
        details: [`Campos: ${returnFieldLabels}`, returnComment],
      });
      const { data: notification, error: notificationError } = await admin
        .from("notifications")
        .insert({
          user_id: contribution.user_id,
          title: "Corrigir item da DFD coletiva",
          message: notificationMessage,
          type: "warning",
        })
        .select("id")
        .single();
      if (notificationError) throw notificationError;
      if (notification?.id) {
        await sendQueuedNotificationEmail({
          admin,
          notificationId: notification.id,
          origin: request.nextUrl.origin,
        });
      }
    }

    return NextResponse.json({ contribution: updated });
  } catch (error: any) {
    if (/SUBMISSION_CLOSED|STATUS_CHANGED|FORBIDDEN/.test(String(error?.message))) { const mapped = submissionOperationError(error.message); return apiError(mapped.error, mapped.status); }
    return apiError(error?.message || "Erro ao atualizar contribuicao.", 500);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCollectiveRoomActor();
    if (!actor) return apiError("Usuario nao autenticado.", 401);
    const { id, contributionId } = await context.params;
    const admin = createSupabaseAdminClient();
    const room = await loadRoomOrNull(admin, id);
    if (!room) return apiError("DFD coletiva nao encontrada.", 404);
    const contribution = await loadContribution(admin, contributionId);
    if (!contribution || contribution.room_id !== room.id) {
      return apiError("Contribuicao nao encontrada.", 404);
    }

    const actorIsAdmin = isAdminActor(actor);
    if (!actorIsAdmin) {
      return apiError("Solicitacao bloqueada: apenas admin/superadmin pode excluir itens ja solicitados.", 403);
    }
    if (
      room.status === "proposta" ||
      room.status === "convertida" ||
      room.status === "arquivada"
    ) {
      return apiError("A sala não permite exclusão neste estágio.", 409);
    }

    const { error } = await admin
      .from("dfd_collective_contributions")
      .update({ status: "arquivada", updated_at: new Date().toISOString() })
      .eq("id", contribution.id);
    if (error) throw error;

    await insertRoomEvent(admin, {
      roomId: room.id,
      actorId: actor.id,
      eventType: "contribution_removed_by_admin",
      message: `Contribuicao removida por administrador: ${contribution.descricao}.`,
      metadata: {
        contribution_id: contribution.id,
        discarded_by_admin: true,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return apiError(error?.message || "Erro ao remover contribuicao.", 500);
  }
}
