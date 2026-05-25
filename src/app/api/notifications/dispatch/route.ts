import { NextResponse } from "next/server";
import { getEmailProviderStatus, sendSystemEmail } from "@/lib/email";
import { toPublicSiteUrl } from "@/lib/site-url";
import { withAuthorizedRole } from "@/lib/api-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

const DEFAULT_BATCH_SIZE = 20;

type NotificationEnvelope = {
  kind?: string;
  body?: string;
  cta_label?: string;
  cta_url?: string;
  template_key?:
    | "welcome"
    | "dfd_submitted"
    | "dfd_approved"
    | "dfd_returned"
    | "dfd_pending"
    | "admin_summary"
    | "test"
    | "generic";
  heading?: string;
  context_label?: string;
  status_label?: string;
  status_tone?: "info" | "success" | "warning" | "danger" | "neutral";
  facts?: Array<{ label: string; value: string | number | null }>;
  details?: string[];
};

function parseNotificationEnvelope(raw: string): NotificationEnvelope | null {
  const text = String(raw || "").trim();
  if (!text.startsWith("{")) return null;
  try {
    const payload = JSON.parse(text) as NotificationEnvelope;
    if (!payload || (payload.kind !== "rich_notification" && payload.kind !== "email_payload")) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function isMissingEmailQueueError(error: any): boolean {
  const text = String(error?.message || error || "").toLowerCase();
  return (
    text.includes("email_alert_queue") &&
    (text.includes("schema cache") ||
      text.includes("could not find the table") ||
      text.includes("does not exist") ||
      text.includes("42p01"))
  );
}

export const POST = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ request, supabaseAdmin, user }) => {
    // Rate limit defensivo: o dispatch pode ser disparado por cron, mas se
    // for chamado manualmente em loop, evita esgotar quota do Resend.
    const limited = await enforceRateLimit(
      request,
      { bucket: "notif-dispatch", limit: 30, windowSec: 60 },
      user.id,
    );
    if (limited) return limited;

    const providerStatus = getEmailProviderStatus();
    if (!providerStatus.configured) {
      return NextResponse.json(
        {
          processed: 0,
          sent: 0,
          failed: 0,
          provider: providerStatus.provider,
          configured: false,
          redirectTo: providerStatus.redirectTo || null,
          reason: providerStatus.reason,
        },
        { status: 409 },
      );
    }

    const batchParam = Number(
      request.nextUrl.searchParams.get("batch") || DEFAULT_BATCH_SIZE,
    );
    const batchSize = Number.isFinite(batchParam)
      ? Math.max(1, Math.min(batchParam, 100))
      : DEFAULT_BATCH_SIZE;

    // supabaseAdmin é garantido !== null pelo requireAdminClient: true.
    const admin = supabaseAdmin!;
    const { data: queued, error: queueError } = await admin.rpc(
      "claim_email_alert_queue",
      { batch_size: batchSize },
    );

    if (queueError) {
      if (isMissingEmailQueueError(queueError)) {
        return NextResponse.json(
          {
            error:
              "Fila de e-mail indisponível. Aplique a migration 20260421183010_security_reporting_alerts.sql.",
          },
          { status: 503 },
        );
      }
      throw queueError;
    }

    if (!queued || queued.length === 0) {
      return NextResponse.json({
        processed: 0,
        sent: 0,
        failed: 0,
        provider: providerStatus.provider,
        configured: true,
        redirectTo: providerStatus.redirectTo || null,
      });
    }

    let sent = 0;
    let failed = 0;

    for (const item of queued) {
      // Idempotência: chave derivada do id da fila. Se o dispatch crashar
      // após o envio mas antes do UPDATE status=sent, a próxima execução
      // do worker reenvia com mesma key — Resend deduplica server-side.
      const idempotencyKey = `email-queue:${item.id}`;

      const envelope = parseNotificationEnvelope(String(item.body || ""));
      const textBody = String(envelope?.body || item.body || "").trim();
      const result = await sendSystemEmail({
        to: item.email_to,
        subject: item.subject,
        text: textBody || "Você recebeu uma atualização no PERCATA.",
        templateKey: envelope?.template_key || undefined,
        heading: String(envelope?.heading || "").trim() || undefined,
        contextLabel:
          String(envelope?.context_label || "").trim() ||
          "Notificação institucional",
        statusLabel: String(envelope?.status_label || "").trim() || undefined,
        statusTone: envelope?.status_tone || undefined,
        facts: Array.isArray(envelope?.facts)
          ? envelope!.facts
              .filter((fact) => fact && String(fact.label || "").trim())
              .slice(0, 10)
              .map((fact) => ({
                label: String(fact.label).trim(),
                value: fact.value,
              }))
          : undefined,
        details: Array.isArray(envelope?.details)
          ? envelope!.details
              .map((detail) => String(detail || "").trim())
              .filter(Boolean)
              .slice(0, 8)
          : undefined,
        actionLabel:
          String(envelope?.cta_label || "").trim() || "Abrir PERCATA",
        actionUrl:
          String(envelope?.cta_url || "").trim() ||
          toPublicSiteUrl("/dashboard", request.nextUrl.origin).toString(),
        idempotencyKey,
      });

      if (result.ok) {
        sent += 1;
        await admin
          .from("email_alert_queue")
          .update({
            status: "sent",
            last_error: null,
            sent_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      } else {
        failed += 1;
        await admin
          .from("email_alert_queue")
          .update({
            status: "failed",
            last_error: result.error || "Falha no envio.",
          })
          .eq("id", item.id);
      }
    }

    return NextResponse.json({
      processed: queued.length,
      sent,
      failed,
      provider: providerStatus.provider,
      configured: true,
      redirectTo: providerStatus.redirectTo || null,
    });
  },
  { requireAdminClient: true },
);
