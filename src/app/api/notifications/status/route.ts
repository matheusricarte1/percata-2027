import { NextResponse } from "next/server";
import { getEmailProviderStatus } from "@/lib/email";
import { createSupabaseAdminClient, hasSupabaseAdminCredentials } from "@/lib/supabase-admin";
import { createClient } from "@/utils/supabase/server";
import { normalizeRole } from "@/lib/access";

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

async function getQueueCount(status: "pending" | "processing" | "failed" | "sent") {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("email_alert_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", status);

  if (error) throw error;
  return Number(count || 0);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
    }

    const providerStatus = getEmailProviderStatus();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = normalizeRole(profile?.role, user.email);
    const canInspectQueue = role === "admin" || role === "superadmin";

    if (!canInspectQueue) {
      return NextResponse.json({
        provider: providerStatus.provider,
        configured: providerStatus.configured,
        fromAddress: providerStatus.fromAddress,
        redirectTo: providerStatus.redirectTo || null,
        reason: providerStatus.reason || null,
        queueAvailable: false,
        queue: null,
      });
    }

    if (!hasSupabaseAdminCredentials()) {
      return NextResponse.json({
        provider: providerStatus.provider,
        configured: providerStatus.configured,
        fromAddress: providerStatus.fromAddress,
        redirectTo: providerStatus.redirectTo || null,
        reason: providerStatus.reason || "Credenciais administrativas do Supabase não configuradas neste ambiente.",
        queueAvailable: false,
        queue: null,
      });
    }

    try {
      const [pending, processing, failed, sent] = await Promise.all([
        getQueueCount("pending"),
        getQueueCount("processing"),
        getQueueCount("failed"),
        getQueueCount("sent"),
      ]);

      return NextResponse.json({
        provider: providerStatus.provider,
        configured: providerStatus.configured,
        fromAddress: providerStatus.fromAddress,
        redirectTo: providerStatus.redirectTo || null,
        reason: providerStatus.reason || null,
        queueAvailable: true,
        queue: {
          pending,
          processing,
          failed,
          sent,
        },
      });
    } catch (error: any) {
      if (isMissingEmailQueueError(error)) {
        return NextResponse.json({
          provider: providerStatus.provider,
          configured: providerStatus.configured,
          fromAddress: providerStatus.fromAddress,
          redirectTo: providerStatus.redirectTo || null,
          reason: providerStatus.reason || null,
          queueAvailable: false,
          queue: null,
        });
      }
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar status de e-mail." },
      { status: 500 },
    );
  }
}
