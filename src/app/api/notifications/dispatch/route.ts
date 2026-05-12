import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, hasSupabaseAdminCredentials } from "@/lib/supabase-admin";
import { getEmailProviderStatus, sendSystemEmail } from "@/lib/email";
import { createClient } from "@/utils/supabase/server";
import { normalizeRole } from "@/lib/access";

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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = normalizeRole(profile?.role, user.email);
    if (role !== "admin" && role !== "superadmin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

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

    if (!hasSupabaseAdminCredentials()) {
      return NextResponse.json(
        {
          processed: 0,
          sent: 0,
          failed: 0,
          provider: providerStatus.provider,
          configured: providerStatus.configured,
          redirectTo: providerStatus.redirectTo || null,
          reason: "Credenciais administrativas do Supabase não configuradas neste ambiente.",
        },
        { status: 503 },
      );
    }

    const batchParam = Number(request.nextUrl.searchParams.get("batch") || DEFAULT_BATCH_SIZE);
    const batchSize = Number.isFinite(batchParam)
      ? Math.max(1, Math.min(batchParam, 100))
      : DEFAULT_BATCH_SIZE;

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: queued, error: queueError } = await supabaseAdmin
      .from("email_alert_queue")
      .select("id,email_to,subject,body,attempts,status")
      .in("status", ["pending", "failed"])
      .lt("attempts", 5)
      .order("created_at", { ascending: true })
      .limit(batchSize);

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
      await supabaseAdmin
        .from("email_alert_queue")
        .update({ status: "processing", attempts: Number(item.attempts || 0) + 1 })
        .eq("id", item.id);

      const result = await sendSystemEmail({
        to: item.email_to,
        subject: item.subject,
        text: item.body,
        contextLabel: "Notificação institucional",
        actionLabel: "Abrir PERCATA",
        actionUrl: `${request.nextUrl.origin}/dashboard`,
      });

      if (result.ok) {
        sent += 1;
        await supabaseAdmin
          .from("email_alert_queue")
          .update({
            status: "sent",
            last_error: null,
            sent_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      } else {
        failed += 1;
        await supabaseAdmin
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao processar fila de e-mails." },
      { status: 500 },
    );
  }
}
