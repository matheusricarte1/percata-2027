import { NextRequest, NextResponse } from "next/server";
import { getEmailProviderStatus, sendSystemEmail } from "@/lib/email";
import { createClient } from "@/utils/supabase/server";
import { normalizeRole } from "@/lib/access";
import { sanitizeEmail } from "@/lib/settings-sanitize";
import { toPublicSiteUrl } from "@/lib/site-url";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
    }

    // 5 testes de e-mail por minuto por usuário. Mais do que isso é abuso ou bug.
    const limited = await enforceRateLimit(
      request,
      { bucket: "notif-test", limit: 5, windowSec: 60 },
      user.id,
    );
    if (limited) return limited;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = normalizeRole(profile?.role, user.email);
    const canSendToCustomAddress = role === "admin" || role === "superadmin";

    const providerStatus = getEmailProviderStatus();
    if (!providerStatus.configured) {
      return NextResponse.json(
        {
          ok: false,
          provider: providerStatus.provider,
          reason: providerStatus.reason,
        },
        { status: 409 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { to?: string };
    const targetEmail = sanitizeEmail(body?.to || user.email || "");
    if (!targetEmail) {
      return NextResponse.json({ error: "E-mail de destino inválido." }, { status: 400 });
    }
    if (!canSendToCustomAddress && targetEmail !== String(user.email).toLowerCase()) {
      return NextResponse.json(
        { error: "Envio de teste para outro destinatário é restrito à administração." },
        { status: 403 },
      );
    }

    const now = new Date();
    const timestamp = now.toLocaleString("pt-BR", { timeZone: "America/Bahia" });
    // Idempotência: clicks duplos no botão "Enviar teste" não devem gerar
    // 2 emails. Janela de 60s é suficiente — testes intencionais subsequentes
    // produzem timestamps diferentes e portanto keys diferentes.
    const minuteBucket = Math.floor(now.getTime() / 60_000);
    const idempotencyKey = `notif-test:${user.id}:${targetEmail}:${minuteBucket}`;
    const result = await sendSystemEmail({
      to: targetEmail,
      subject: "PERCATA • Teste de e-mail",
      templateKey: "test",
      idempotencyKey,
      text:
        `Olá.\n\n` +
        `Este é um teste do canal de e-mail do PERCATA.\n` +
        `Usuário: ${user.email}\n` +
        `Horário: ${timestamp}\n\n` +
        `Se você recebeu esta mensagem, o envio por e-mail está ativo.`,
      facts: [
        { label: "Usuário", value: user.email },
        { label: "Horário", value: timestamp },
        { label: "Destino efetivo", value: providerStatus.redirectTo || targetEmail },
        { label: "Provedor", value: providerStatus.provider.toUpperCase() },
      ],
      details: [
        "O canal SMTP/Resend respondeu ao disparo do sistema.",
        providerStatus.redirectTo
          ? "O redirecionamento de homologação está ativo; o destinatário original fica registrado no corpo do e-mail."
          : "Nenhum redirecionamento de homologação está ativo; a mensagem foi enviada para o e-mail solicitado.",
      ],
      contextLabel: "Teste de infraestrutura",
      actionLabel: "Acessar PERCATA",
      actionUrl: toPublicSiteUrl("/dashboard", request.nextUrl.origin).toString(),
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          provider: result.provider,
          error: result.error || "Falha no envio.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      to: result.to || targetEmail,
      originalTo: result.originalTo || targetEmail,
      redirected: Boolean(result.redirected),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao enviar e-mail de teste." },
      { status: 500 },
    );
  }
}
