import { NextResponse } from "next/server";
import { getEmailProviderStatus, sendSystemEmail } from "@/lib/email";
import { toPublicSiteUrl } from "@/lib/site-url";
import { withAuthorizedRole } from "@/lib/api-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

const DEFAULT_BATCH_SIZE = 20;

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

      const result = await sendSystemEmail({
        to: item.email_to,
        subject: item.subject,
        text: item.body,
        contextLabel: "Notificação institucional",
        actionLabel: "Abrir PERCATA",
        actionUrl: toPublicSiteUrl(
          "/dashboard",
          request.nextUrl.origin,
        ).toString(),
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
