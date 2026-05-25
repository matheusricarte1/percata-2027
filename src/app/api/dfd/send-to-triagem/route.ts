import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { canSendDfdToChefia } from "@/lib/dfd-send-permissions";
import { createClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { toPublicSiteUrl } from "@/lib/site-url";

type DfdForTriagem = {
  id: string;
  numero_protocolo: string | null;
  solicitante_id: string | null;
  campus_id: string | null;
  status: string | null;
  unidade_id?: string | null;
  analysis_unidade_id?: string | null;
};

const ALLOWED_SOURCE_STATUSES = new Set(["rascunho", "devolvida", "triagem"]);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
    }

    // 30 envios para triagem por minuto por solicitante: suficiente para
    // refile after correções, bloqueia loop acidental.
    const limited = await enforceRateLimit(
      request,
      { bucket: "dfd-send-to-triagem", limit: 30, windowSec: 60 },
      user.id,
    );
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Informe o id da DFD." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    let dfdResult = await admin
      .from("dfds")
      .select("id,numero_protocolo,solicitante_id,campus_id,status,unidade_id,analysis_unidade_id")
      .eq("id", id)
      .maybeSingle();

    if (
      dfdResult.error &&
      /analysis_unidade_id/i.test(String(dfdResult.error.message || ""))
    ) {
      dfdResult = await admin
        .from("dfds")
        .select("id,numero_protocolo,solicitante_id,campus_id,status,unidade_id")
        .eq("id", id)
        .maybeSingle();
    }

    if (dfdResult.error) throw dfdResult.error;
    const dfd = dfdResult.data;
    if (!dfd) {
      return NextResponse.json({ error: "DFD não encontrada." }, { status: 404 });
    }

    const target = dfd as DfdForTriagem;
    if (
      !canSendDfdToChefia({
        currentUserId: user.id,
        solicitanteId: target.solicitante_id,
      })
    ) {
      return NextResponse.json(
        { error: "Somente a pessoa que criou a DFD pode enviá-la para análise da chefia." },
        { status: 403 },
      );
    }

    const currentStatus = String(target.status || "").toLowerCase();
    if (!ALLOWED_SOURCE_STATUSES.has(currentStatus)) {
      return NextResponse.json(
        { error: "Somente DFDs em rascunho, devolvidas ou já em triagem podem ser enviadas para análise." },
        { status: 409 },
      );
    }

    if (currentStatus !== "triagem") {
      const { error: updateError } = await admin
        .from("dfds")
        .update({ status: "triagem" })
        .eq("id", target.id);
      if (updateError) throw updateError;
    }

    let notificationsCreated = 0;
    const reviewerIds = new Set<string>();
    const analysisUnitId = target.analysis_unidade_id || target.unidade_id || null;
    if (analysisUnitId) {
      const { data: unitReviewers, error: unitReviewersError } = await admin
        .from("user_units")
        .select("user_id")
        .eq("unit_id", analysisUnitId)
        .eq("role_in_unit", "chefia");
      if (unitReviewersError) throw unitReviewersError;
      (unitReviewers || []).forEach((reviewer) => {
        if (reviewer.user_id) reviewerIds.add(String(reviewer.user_id));
      });
    }

    if (target.campus_id) {
      const { data: reviewers, error: reviewersError } = await admin
        .from("profiles")
        .select("id")
        .eq("campus_id", target.campus_id)
        .in("role", ["chefia", "admin", "superadmin"]);
      if (reviewersError) throw reviewersError;
      (reviewers || []).forEach((reviewer) => {
        if (reviewer.id) reviewerIds.add(String(reviewer.id));
      });
    }

    const protocolLabel =
      target.numero_protocolo || `DFD-${String(target.id || "").slice(0, 8).toUpperCase()}`;
    const dfdUrl = toPublicSiteUrl(`/dfd/${target.id}`, request.nextUrl.origin).toString();
    const sentImageUrl = toPublicSiteUrl(
      "/email/events/dfd-sent-to-chefia.png",
      request.nextUrl.origin,
    ).toString();
    const notifications = Array.from(reviewerIds)
      .filter((reviewerId) => reviewerId !== target.solicitante_id)
      .map((reviewerId) => ({
        user_id: reviewerId,
        title: "Nova DFD na fila de análise",
        message: JSON.stringify({
          kind: "rich_notification",
          template_key: "dfd_sent_to_chefia",
          heading: `DFD ${protocolLabel} encaminhada para análise`,
          context_label: "Triagem da chefia",
          status_label: "Encaminhada",
          status_tone: "info",
          body: `${protocolLabel} foi enviada para análise da chefia.`,
          cta_label: "Abrir DFD",
          cta_url: dfdUrl,
          image_url: sentImageUrl,
          facts: [{ label: "Protocolo", value: protocolLabel }],
        }),
        type: "info",
      }));

    if (notifications.length > 0) {
      const { error: notificationError } = await admin
        .from("notifications")
        .insert(notifications);
      if (notificationError) throw notificationError;
      notificationsCreated = notifications.length;
    }

    return NextResponse.json({
      ok: true,
      status: "triagem",
      notificationsCreated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao enviar DFD para triagem." },
      { status: 500 },
    );
  }
}
