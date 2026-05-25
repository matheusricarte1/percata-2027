import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normalizeRole } from "@/lib/access";

type DfdRow = {
  id: string;
  numero_protocolo: string | null;
  solicitante_id: string | null;
  status: string | null;
  created_at: string | null;
  objeto_contratacao: string | null;
  justificativa_contratacao: string | null;
  justificativa_quantidade: string | null;
  campus: string | null;
  campus_id: string | null;
  previsao_recebimento: string | null;
  valor_total_estimado: number | null;
};

type DfdItemRow = {
  id: string;
  codigo_tce: string | null;
  codigo_item_efisco: string | null;
  descricao: string | null;
  quantidade: number | null;
  unidade_medida: string | null;
  valor_unitario_estimado: number | null;
  justificativa_item: string | null;
  link_referencia: string | null;
  local_uso: string | null;
  gnd: string | null;
};

function sanitizeUuid(value: unknown) {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    text,
  )
    ? text
    : "";
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeProtocol(record: DfdRow) {
  return String(record.numero_protocolo || "").trim() || `DFD-${record.id.slice(0, 8).toUpperCase()}`;
}

function normalizeLegacyYear(record: DfdRow) {
  const baseDate = record.previsao_recebimento || record.created_at || new Date().toISOString();
  const year = new Date(baseDate).getFullYear();
  if (Number.isFinite(year) && year >= 2000 && year <= 2100) return year;
  return new Date().getFullYear();
}

function toLegacyStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "concluida") return "Concluída";
  if (normalized === "aprovada") return "Aprovada";
  if (normalized === "pactuando") return "Em pactuação";
  if (normalized === "devolvida") return "Devolvida";
  if (normalized === "triagem") return "Em análise";
  return "Rascunho";
}

function buildSourceHash(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
    }

    const { data: actorProfile, error: actorProfileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (actorProfileError) throw actorProfileError;

    const role = normalizeRole(actorProfile?.role, user.email);
    if (role !== "superadmin") {
      return NextResponse.json(
        { error: "Apenas superadmin pode mover DFD para histórico." },
        { status: 403 },
      );
    }

    const limited = await enforceRateLimit(
      request,
      { bucket: "dfd-move-to-history", limit: 20, windowSec: 60 },
      user.id,
    );
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const dfdId = sanitizeUuid(body?.id);
    if (!dfdId) {
      return NextResponse.json({ error: "ID da DFD inválido." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: dfd, error: dfdError } = await admin
      .from("dfds")
      .select(
        "id,numero_protocolo,solicitante_id,status,created_at,objeto_contratacao,justificativa_contratacao,justificativa_quantidade,campus,campus_id,previsao_recebimento,valor_total_estimado",
      )
      .eq("id", dfdId)
      .maybeSingle();
    if (dfdError) throw dfdError;
    if (!dfd) {
      return NextResponse.json({ error: "DFD não encontrada." }, { status: 404 });
    }

    const record = dfd as DfdRow;
    const currentStatus = String(record.status || "").toLowerCase();
    if (currentStatus !== "concluida") {
      return NextResponse.json(
        { error: "Finalize o PCA antes de mover a DFD para o histórico." },
        { status: 409 },
      );
    }

    const protocol = normalizeProtocol(record);
    const legacyYear = normalizeLegacyYear(record);

    const { data: requesterProfile, error: requesterProfileError } =
      record.solicitante_id
        ? await admin
            .from("profiles")
            .select("full_name,email")
            .eq("id", record.solicitante_id)
            .maybeSingle()
        : { data: null, error: null };
    if (requesterProfileError) throw requesterProfileError;

    const requesterEmail = normalizeEmail(requesterProfile?.email || user.email);
    if (!requesterEmail) {
      return NextResponse.json(
        { error: "Não foi possível identificar o e-mail do solicitante." },
        { status: 409 },
      );
    }

    const requesterName = String(requesterProfile?.full_name || "").trim() || requesterEmail;

    let campusName = String(record.campus || "").trim();
    if (!campusName && record.campus_id) {
      const { data: campusRow, error: campusError } = await admin
        .from("campi")
        .select("nome,sigla")
        .eq("id", record.campus_id)
        .maybeSingle();
      if (campusError) throw campusError;
      campusName = String(campusRow?.nome || campusRow?.sigla || "").trim();
    }

    const { data: existingDemand, error: existingDemandError } = await admin
      .from("legacy_pa_demandas")
      .select("id,raw_payload")
      .eq("legacy_year", legacyYear)
      .eq("demand_code", protocol)
      .maybeSingle();
    if (existingDemandError) throw existingDemandError;

    if (existingDemand) {
      const existingSourceId = String(
        (existingDemand as any)?.raw_payload?.source_dfd_id || "",
      ).trim();
      if (existingSourceId && existingSourceId !== record.id) {
        return NextResponse.json(
          {
            error:
              "Já existe uma demanda histórica com este protocolo e ano para outra DFD.",
          },
          { status: 409 },
        );
      }
    }

    const firstItemResult = await admin
      .from("dfd_items")
      .select(
        "id,codigo_tce,codigo_item_efisco,descricao,quantidade,unidade_medida,valor_unitario_estimado,justificativa_item,link_referencia,local_uso,gnd",
      )
      .eq("dfd_id", record.id);

    let finalItemResult: any = firstItemResult;
    if (firstItemResult.error) {
      const errorText = String(firstItemResult.error.message || "").toLowerCase();
      const needsFallback =
        errorText.includes("codigo_item_efisco") ||
        errorText.includes("unidade_medida");
      if (needsFallback) {
        finalItemResult = await admin
          .from("dfd_items")
          .select(
            "id,codigo_tce,descricao,quantidade,valor_unitario_estimado,justificativa_item,link_referencia,local_uso,gnd",
          )
          .eq("dfd_id", record.id);
      }
    }

    if (finalItemResult.error) throw finalItemResult.error;
    const items = (finalItemResult.data || []) as DfdItemRow[];
    const computedTotal = items.reduce(
      (acc, item) =>
        acc + Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0),
      0,
    );
    const totalEstimated =
      Number(record.valor_total_estimado || 0) > 0
        ? Number(record.valor_total_estimado || 0)
        : computedTotal;

    const dfdSnapshot = {
      source_dfd_id: record.id,
      source_protocol: protocol,
      moved_by_user_id: user.id,
      moved_at: new Date().toISOString(),
      source_status: currentStatus,
      source_created_at: record.created_at,
    };

    const demandPayload = {
      legacy_year: legacyYear,
      demand_code: protocol,
      record_origin: "demandas_sheet",
      submission_at: record.created_at,
      request_area: campusName || null,
      requester_name: requesterName,
      requester_email: requesterEmail,
      object: String(record.objeto_contratacao || "").trim() || null,
      justification_acquisition:
        String(record.justificativa_contratacao || "").trim() || null,
      justification_quantity:
        String(record.justificativa_quantidade || "").trim() || null,
      total_estimated: totalEstimated,
      delivery_forecast: record.previsao_recebimento || null,
      status: toLegacyStatus(currentStatus),
      campus: campusName || null,
      workflow_status: "historico_manual",
      delivery_status: "concluida",
      raw_payload: dfdSnapshot,
    };

    const { error: demandUpsertError } = await admin
      .from("legacy_pa_demandas")
      .upsert(demandPayload, { onConflict: "legacy_year,demand_code" });
    if (demandUpsertError) throw demandUpsertError;

    const legacyItemsPayload = items.map((item, index) => {
      const sourceHash = buildSourceHash(`${record.id}:${item.id || index}`);
      const quantity = Number(item.quantidade || 0);
      const unitPrice = Number(item.valor_unitario_estimado || 0);
      return {
        legacy_year: legacyYear,
        source_row_hash: sourceHash,
        pedido_codigo: protocol,
        demand_code: protocol,
        efisco_code: String(item.codigo_item_efisco || item.codigo_tce || "").trim() || null,
        efisco_description: String(item.descricao || "").trim() || null,
        quantity_text: quantity ? String(quantity) : null,
        quantity_numeric: quantity || null,
        unit: String(item.unidade_medida || "UN").trim() || "UN",
        item_justification: String(item.justificativa_item || "").trim() || null,
        local_uso: String(item.local_uso || "").trim() || null,
        ref_link_1: String(item.link_referencia || "").trim() || null,
        fiscal_name: requesterName,
        fiscal_email: requesterEmail,
        item_price: unitPrice || null,
        natureza_despesa: String(item.gnd || "").trim() || null,
        raw_payload: {
          ...dfdSnapshot,
          source_item_id: item.id,
          source_item_index: index,
        },
      };
    });

    if (legacyItemsPayload.length > 0) {
      const { error: itemsUpsertError } = await admin
        .from("legacy_pa_itens")
        .upsert(legacyItemsPayload, { onConflict: "source_row_hash" });
      if (itemsUpsertError) throw itemsUpsertError;
    }

    const linkRows = [
      {
        legacy_year: legacyYear,
        demand_code: protocol,
        user_email: requesterEmail,
        link_role: "requester",
        source: "percata_move_to_history",
      },
      {
        legacy_year: legacyYear,
        demand_code: protocol,
        user_email: requesterEmail,
        link_role: "fiscal",
        source: "percata_move_to_history",
      },
    ];
    const { error: linkError } = await admin
      .from("legacy_demand_user_links")
      .upsert(linkRows, {
        onConflict: "legacy_year,demand_code,user_email,link_role",
      });
    if (linkError) throw linkError;

    const { data: existingHistorical, error: existingHistoricalError } = await admin
      .from("historico_demandas")
      .select("id")
      .eq("ano_referencia", legacyYear)
      .eq("codigo_dfd", protocol)
      .eq("solicitante_email", requesterEmail)
      .limit(1);
    if (existingHistoricalError) throw existingHistoricalError;

    if (!existingHistorical || existingHistorical.length === 0) {
      const itensJson = items.map((item) => ({
        id: item.id,
        codigo: String(item.codigo_item_efisco || item.codigo_tce || "").trim() || null,
        descricao: item.descricao || null,
        quantidade: Number(item.quantidade || 0),
        unidade: String(item.unidade_medida || "UN").trim() || "UN",
        valor_unitario: Number(item.valor_unitario_estimado || 0),
        subtotal:
          Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0),
        gnd: String(item.gnd || "").trim() || null,
        local_uso: String(item.local_uso || "").trim() || null,
        justificativa_item: String(item.justificativa_item || "").trim() || null,
      }));

      const { error: historicalInsertError } = await admin.from("historico_demandas").insert({
        ano_referencia: legacyYear,
        codigo_dfd: protocol,
        objeto: String(record.objeto_contratacao || "").trim() || "DFD sem objeto",
        campus: campusName || null,
        solicitante_email: requesterEmail,
        valor_total: totalEstimated,
        itens_json: itensJson,
        status_final: "concluida",
      });
      if (historicalInsertError) throw historicalInsertError;
    }

    const { error: logError } = await admin.from("dfd_logs").insert({
      dfd_id: record.id,
      user_id: user.id,
      action: "moved_to_history",
      details: `DFD ${protocol} movida para histórico (${legacyYear}).`,
    });
    if (logError) throw logError;

    return NextResponse.json({
      ok: true,
      id: record.id,
      protocol,
      legacyYear,
      alreadyMoved: Boolean(existingDemand),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao mover DFD para histórico." },
      { status: 500 },
    );
  }
}
