import { getEmailProviderStatus, parseEmailTemplateKey, sendSystemEmail } from "@/lib/email";
import type { EmailTemplateKey } from "@/lib/email";
import { toPublicSiteUrl } from "@/lib/site-url";

type SupabaseAdminLike = {
  from: (table: string) => any;
  rpc?: (functionName: string, parameters?: Record<string, unknown>) => PromiseLike<{
    data: QueuedEmailAlert[] | null;
    error: any;
  }>;
};

type QueuedEmailAlert = {
  id: string;
  email_to: string;
  subject: string;
  body: string;
  status?: string | null;
  attempts?: number | null;
};

type NotificationEnvelope = {
  kind?: string;
  body?: string;
  image_url?: string;
  cta_label?: string;
  cta_url?: string;
  template_key?: EmailTemplateKey;
  heading?: string;
  context_label?: string;
  status_label?: string;
  status_tone?: "info" | "success" | "warning" | "danger" | "neutral";
  facts?: Array<{ label: string; value: string | number | null }>;
  details?: string[];
};

type QueueDispatchResult = {
  processed: boolean;
  sent: boolean;
  provider: "smtp" | "none";
  error?: string;
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

async function markQueueItem(
  admin: SupabaseAdminLike,
  id: string,
  patch: Record<string, unknown>,
) {
  const { error } = await admin.from("email_alert_queue").update(patch).eq("id", id);
  if (error) throw error;
}

export async function sendQueuedEmailAlert({
  admin,
  queueItem,
  origin,
}: {
  admin: SupabaseAdminLike;
  queueItem: QueuedEmailAlert;
  origin: string;
}): Promise<QueueDispatchResult> {
  const providerStatus = getEmailProviderStatus();
  if (!providerStatus.configured) {
    return {
      processed: false,
      sent: false,
      provider: providerStatus.provider,
      error: providerStatus.reason,
    };
  }

  try {
    await markQueueItem(admin, queueItem.id, {
      status: "processing",
      attempts: Number(queueItem.attempts || 0) + 1,
      locked_at: new Date().toISOString(),
      last_error: null,
    });

    const envelope = parseNotificationEnvelope(String(queueItem.body || ""));
    const textBody = String(envelope?.body || queueItem.body || "").trim();
    const result = await sendSystemEmail({
      to: queueItem.email_to,
      subject: queueItem.subject,
      text: textBody || "Você recebeu uma atualização no PERCATA.",
      imageUrl: String(envelope?.image_url || "").trim() || undefined,
      templateKey: parseEmailTemplateKey(envelope?.template_key),
      heading: String(envelope?.heading || "").trim() || undefined,
      contextLabel:
        String(envelope?.context_label || "").trim() ||
        "Notificação institucional",
      statusLabel: String(envelope?.status_label || "").trim() || undefined,
      statusTone: envelope?.status_tone || undefined,
      facts: Array.isArray(envelope?.facts)
        ? envelope.facts
            .filter((fact) => fact && String(fact.label || "").trim())
            .slice(0, 10)
            .map((fact) => ({
              label: String(fact.label).trim(),
              value: fact.value,
            }))
        : undefined,
      details: Array.isArray(envelope?.details)
        ? envelope.details
            .map((detail) => String(detail || "").trim())
            .filter(Boolean)
            .slice(0, 8)
        : undefined,
      actionLabel: String(envelope?.cta_label || "").trim() || "Abrir PERCATA",
      actionUrl:
        String(envelope?.cta_url || "").trim() ||
        toPublicSiteUrl("/dashboard", origin).toString(),
      idempotencyKey: `email-queue:${queueItem.id}`,
    });

    if (result.ok) {
      await markQueueItem(admin, queueItem.id, {
        status: "sent",
        last_error: null,
        sent_at: new Date().toISOString(),
        locked_at: null,
      });
      return { processed: true, sent: true, provider: result.provider };
    }

    await markQueueItem(admin, queueItem.id, {
      status: "failed",
      last_error: result.error || "Falha no envio.",
      locked_at: null,
    });
    return {
      processed: true,
      sent: false,
      provider: result.provider,
      error: result.error || "Falha no envio.",
    };
  } catch (error: any) {
    return {
      processed: true,
      sent: false,
      provider: providerStatus.provider,
      error: error?.message || "Falha ao processar fila de e-mail.",
    };
  }
}

export type EmailQueueDispatchSummary = {
  processed: number;
  sent: number;
  failed: number;
  provider: "smtp" | "none";
  configured: boolean;
  reason?: string;
};

/**
 * Claims and delivers one bounded batch.  This is intentionally independent of
 * browser state so it can be called by an authenticated admin action or a
 * background scheduler.
 */
export async function dispatchEmailAlertQueue({
  admin,
  batchSize,
  origin,
}: {
  admin: SupabaseAdminLike;
  batchSize: number;
  origin: string;
}): Promise<EmailQueueDispatchSummary> {
  const providerStatus = getEmailProviderStatus();
  if (!providerStatus.configured) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      provider: providerStatus.provider,
      configured: false,
      reason: providerStatus.reason,
    };
  }

  if (!admin.rpc) {
    throw new Error("Cliente administrativo não suporta o processamento da fila de e-mail.");
  }

  const safeBatchSize = Math.max(1, Math.min(Math.floor(batchSize || 20), 100));
  const { data: queued, error } = await admin.rpc("claim_email_alert_queue", {
    batch_size: safeBatchSize,
  });
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  for (const item of queued || []) {
    // claim_email_alert_queue already holds the lease and increments attempts.
    // Pass a fresh attempts value so the helper does not increment a second time.
    const result = await sendQueuedEmailAlert({
      admin,
      queueItem: { ...item, attempts: Math.max(0, Number(item.attempts || 1) - 1) },
      origin,
    });
    if (result.sent) sent += 1;
    else failed += 1;
  }

  return {
    processed: (queued || []).length,
    sent,
    failed,
    provider: providerStatus.provider,
    configured: true,
  };
}

export async function sendQueuedNotificationEmail({
  admin,
  notificationId,
  origin,
}: {
  admin: SupabaseAdminLike;
  notificationId: string;
  origin: string;
}): Promise<QueueDispatchResult> {
  try {
    const { data: queueItem, error } = await admin
      .from("email_alert_queue")
      .select("*")
      .eq("notification_id", notificationId)
      .maybeSingle();
    if (error) throw error;
    if (!queueItem || String(queueItem.status || "") === "sent") {
      return { processed: false, sent: false, provider: getEmailProviderStatus().provider };
    }
    return sendQueuedEmailAlert({ admin, queueItem, origin });
  } catch (error: any) {
    return {
      processed: false,
      sent: false,
      provider: getEmailProviderStatus().provider,
      error: error?.message || "Falha ao localizar e-mail da notificação.",
    };
  }
}
