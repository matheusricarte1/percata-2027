import { NextRequest, NextResponse } from "next/server";
import { dispatchEmailAlertQueue } from "@/lib/email-alert-queue";
import { createSupabaseAdminClient, hasSupabaseAdminCredentials } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!hasSupabaseAdminCredentials()) {
    return NextResponse.json(
      { error: "Credenciais administrativas do Supabase não configuradas." },
      { status: 503 },
    );
  }

  try {
    const summary = await dispatchEmailAlertQueue({
      admin: createSupabaseAdminClient(),
      batchSize: 100,
      origin: request.nextUrl.origin,
    });
    return NextResponse.json(summary, { status: summary.configured ? 200 : 409 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Falha ao processar a fila de e-mails." },
      { status: 500 },
    );
  }
}
