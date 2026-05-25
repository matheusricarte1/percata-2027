import nodemailer from "nodemailer";
import { Resend } from "resend";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  templateKey?: EmailTemplateKey;
  heading?: string;
  contextLabel?: string;
  previewText?: string;
  actionLabel?: string;
  actionUrl?: string;
  statusLabel?: string;
  statusTone?: EmailTone;
  facts?: EmailFact[];
  details?: string[];
  /**
   * Chave única para deduplicação. Quando presente:
   *   - Resend: enviado como header `Idempotency-Key` (preservado pelo provider
   *     por 24h; chamadas com mesma key não disparam segundo envio).
   *   - SMTP/Nodemailer: usado como `Message-Id` determinístico — não evita
   *     reenvio, mas permite que o destinatário/MTA detecte duplicata.
   *   - Recomendado: derivar de `email_alert_queue.id`, ou
   *     `hash(to + subject + dfd_id + status)`.
   */
  idempotencyKey?: string;
};

type SendEmailResult = {
  ok: boolean;
  provider: "resend" | "smtp" | "none";
  to?: string;
  originalTo?: string;
  redirected?: boolean;
  error?: string;
};

export type EmailProviderStatus = {
  configured: boolean;
  provider: "resend" | "smtp" | "none";
  fromAddress: string;
  redirectTo?: string | null;
  reason?: string;
};

let smtpTransport: nodemailer.Transporter | null = null;
const PRODUCT_NAME = "PERCATA";

type EmailTone = "info" | "success" | "warning" | "danger" | "neutral";

type EmailTemplateKey =
  | "welcome"
  | "dfd_submitted"
  | "dfd_approved"
  | "dfd_returned"
  | "dfd_pending"
  | "admin_summary"
  | "test"
  | "generic";

type EmailFact = {
  label: string;
  value: string | number | null | undefined;
};

type EmailTemplatePreset = {
  heading: string;
  contextLabel: string;
  statusLabel: string;
  statusTone: EmailTone;
  intro: string;
  imageSlot?:
    | "welcome"
    | "dfd-submitted"
    | "dfd-approved"
    | "dfd-returned"
    | "dfd-status"
    | "admin-summary"
    | "test"
    | "generic";
};

const TEMPLATE_PRESETS: Record<EmailTemplateKey, EmailTemplatePreset> = {
  welcome: {
    heading: "Acesso ao PERCATA liberado",
    contextLabel: "Acesso institucional",
    statusLabel: "Conta ativa",
    statusTone: "success",
    intro: "Seu acesso ao ambiente de planejamento institucional está disponível.",
    imageSlot: "welcome",
  },
  dfd_submitted: {
    heading: "DFD enviada para análise",
    contextLabel: "Fluxo de DFD",
    statusLabel: "Em análise",
    statusTone: "info",
    intro: "A demanda foi encaminhada para a chefia responsável pela análise técnica.",
    imageSlot: "dfd-submitted",
  },
  dfd_approved: {
    heading: "DFD aprovada",
    contextLabel: "Homologação",
    statusLabel: "Homologada",
    statusTone: "success",
    intro: "A demanda foi aprovada e segue para as próximas etapas de planejamento.",
    imageSlot: "dfd-approved",
  },
  dfd_returned: {
    heading: "DFD devolvida para ajustes",
    contextLabel: "Revisão necessária",
    statusLabel: "Ajuste solicitado",
    statusTone: "warning",
    intro: "A chefia solicitou complementos antes de continuar a análise.",
    imageSlot: "dfd-returned",
  },
  dfd_pending: {
    heading: "Pendência em DFD",
    contextLabel: "Atenção necessária",
    statusLabel: "Pendente",
    statusTone: "warning",
    intro: "Existe uma ação pendente para manter o fluxo da demanda em andamento.",
    imageSlot: "dfd-status",
  },
  admin_summary: {
    heading: "Resumo administrativo",
    contextLabel: "Governança PERCATA",
    statusLabel: "Resumo",
    statusTone: "neutral",
    intro: "Resumo consolidado para acompanhamento de filas, pendências e decisões.",
    imageSlot: "admin-summary",
  },
  test: {
    heading: "Teste de e-mail",
    contextLabel: "Teste de infraestrutura",
    statusLabel: "Canal ativo",
    statusTone: "success",
    intro: "Este e-mail confirma que o canal de envio do PERCATA está operacional.",
    imageSlot: "test",
  },
  generic: {
    heading: "Notificação do PERCATA",
    contextLabel: "Notificação institucional",
    statusLabel: "Informativo",
    statusTone: "info",
    intro: "Você recebeu uma atualização do sistema PERCATA.",
    imageSlot: "generic",
  },
};

const TONE_STYLES: Record<EmailTone, { bg: string; text: string; border: string }> = {
  info: { bg: "#EAF2FF", text: "#164073", border: "#C7D7EA" },
  success: { bg: "#E7F0EA", text: "#2F6B3F", border: "#BFD8C6" },
  warning: { bg: "#FFF3E6", text: "#9A5B12", border: "#F0D1A8" },
  danger: { bg: "#FFE8EA", text: "#A91520", border: "#F3B8BE" },
  neutral: { bg: "#F4F7FA", text: "#3E4C5F", border: "#D9E0E8" },
};

function getSmtpTransport() {
  if (smtpTransport) return smtpTransport;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  if (!host || !user || !pass) return null;

  smtpTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return smtpTransport;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildHtmlBodyFromText(text: string): string {
  const normalized = String(text || "").trim();
  if (!normalized) return "<p>Mensagem sem conteúdo.</p>";

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 12px 0;">${escapeHtml(paragraph).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function detectTemplateKey(input: SendEmailInput): EmailTemplateKey {
  if (input.templateKey) return input.templateKey;

  const haystack = `${input.subject} ${input.heading || ""} ${input.contextLabel || ""}`.toLowerCase();
  if (haystack.includes("teste")) return "test";
  if (haystack.includes("boas-vindas") || haystack.includes("acesso")) return "welcome";
  if (haystack.includes("devolvida") || haystack.includes("ajuste")) return "dfd_returned";
  if (haystack.includes("aprovada") || haystack.includes("homologada")) return "dfd_approved";
  if (haystack.includes("enviada") || haystack.includes("análise") || haystack.includes("analise")) {
    return "dfd_submitted";
  }
  if (haystack.includes("pendência") || haystack.includes("pendencia")) return "dfd_pending";
  if (haystack.includes("resumo")) return "admin_summary";
  return "generic";
}

function getAssetBaseUrl() {
  const configured =
    process.env.EMAIL_ASSET_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "";
  const normalized = configured.trim();
  if (!normalized) return "";
  return normalized.startsWith("http") ? normalized.replace(/\/$/, "") : `https://${normalized.replace(/\/$/, "")}`;
}

function getBrandLogoUrl(): string | null {
  const configured = process.env.EMAIL_BRAND_LOGO_URL?.trim();
  if (configured) return configured;
  const assetBase = getAssetBaseUrl();
  if (!assetBase) return null;
  return `${assetBase}/brands/percata-logo.png`;
}

function renderBrandMark() {
  const logoUrl = getBrandLogoUrl();
  if (!logoUrl) {
    return `
      <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#DCEAF0;font-weight:800;">
        ${PRODUCT_NAME}
      </p>`;
  }

  return `
    <div style="display:inline-block;border-radius:10px;background:#FFFFFF;padding:8px 10px;">
      <img src="${escapeHtml(logoUrl)}" alt="${PRODUCT_NAME}" width="132" style="display:block;width:132px;max-width:132px;height:auto;border:0;" />
    </div>`;
}

function getFlatImageUrl(slot: EmailTemplatePreset["imageSlot"]): string | null {
  if (!slot) return null;
  const envKey = `EMAIL_FLAT_${slot.toUpperCase().replace(/-/g, "_")}_URL`;
  const configured = process.env[envKey]?.trim();
  if (configured) return configured;
  const assetBase = getAssetBaseUrl();
  if (!assetBase) return null;
  return `${assetBase}/email/${slot}.png`;
}

function renderFlatImageSlot(slot: EmailTemplatePreset["imageSlot"]) {
  if (!slot) return "";
  const imageUrl = getFlatImageUrl(slot);
  const labelBySlot: Record<string, string> = {
    welcome: "Ilustração institucional de boas-vindas",
    "dfd-submitted": "Ilustração de documento encaminhado",
    "dfd-approved": "Ilustração de aprovação e conclusão",
    "dfd-returned": "Ilustração de DFD devolvida para ajustes",
    "dfd-status": "Ilustração de atualização de status da DFD",
    "admin-summary": "Ilustração de resumo administrativo",
    test: "Ilustração de teste de e-mail",
    generic: "Ilustração de notificação institucional",
  };
  const label = labelBySlot[slot] || "Ilustração institucional";

  if (imageUrl) {
    return `
      <tr>
        <td style="padding:0 22px 16px 22px;">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}" width="576" style="display:block;width:100%;max-width:576px;border:0;border-radius:14px;background:#F7FBFF;" />
        </td>
      </tr>`;
  }

  return `
    <tr>
      <td style="padding:0 22px 16px 22px;">
        <div style="height:132px;border:1px dashed #C7D7EA;border-radius:14px;background:#F7FBFF;text-align:center;color:#47739F;font-size:12px;line-height:132px;font-weight:700;">
          Espaço reservado para PNG: ${escapeHtml(label)}
        </div>
      </td>
    </tr>`;
}

function extractFactsFromText(text: string): EmailFact[] {
  const facts: EmailFact[] = [];
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) continue;
    const label = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!label || !value || label.length > 36 || value.length > 180) continue;
    facts.push({ label, value });
  }
  return facts;
}

function renderFacts(facts: EmailFact[]) {
  const visibleFacts = facts
    .filter((fact) => String(fact.value || "").trim())
    .slice(0, 10);
  if (visibleFacts.length === 0) return "";

  const rows = visibleFacts
    .map(
      (fact) => `
        <tr>
          <td style="width:42%;padding:10px 12px;border-bottom:1px solid #E8EDF2;color:#7D98B8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">
            ${escapeHtml(fact.label)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8EDF2;color:#17233C;font-size:13px;font-weight:700;">
            ${escapeHtml(String(fact.value))}
          </td>
        </tr>`,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border:1px solid #E8EDF2;border-radius:12px;overflow:hidden;background:#FFFFFF;">
      ${rows}
    </table>`;
}

function renderDetails(details: string[]) {
  const normalized = details.map((item) => item.trim()).filter(Boolean).slice(0, 8);
  if (normalized.length === 0) return "";

  return `
    <div style="margin:16px 0;padding:14px 16px;border:1px solid #D9E0E8;border-radius:12px;background:#FAFBFC;">
      <p style="margin:0 0 8px 0;color:#164073;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;">Pontos importantes</p>
      ${normalized
        .map(
          (item) =>
            `<p style="margin:7px 0;color:#2E3A4A;font-size:13px;line-height:1.55;">• ${escapeHtml(item)}</p>`,
        )
        .join("")}
    </div>`;
}

function buildMasterEmail(input: SendEmailInput): { html: string; text: string } {
  const textBody = String(input.text || "").trim();
  const templateKey = detectTemplateKey(input);
  const preset = TEMPLATE_PRESETS[templateKey] || TEMPLATE_PRESETS.generic;
  const heading = String(input.heading || preset.heading || input.subject || "Notificação").trim();
  const contextLabel = String(input.contextLabel || preset.contextLabel || "Notificação institucional").trim();
  const statusLabel = String(input.statusLabel || preset.statusLabel).trim();
  const statusTone = input.statusTone || preset.statusTone;
  const tone = TONE_STYLES[statusTone] || TONE_STYLES.info;
  const previewText = String(input.previewText || textBody || heading).slice(0, 140);
  const extractedFacts = extractFactsFromText(textBody);
  const facts = input.facts?.length ? input.facts : extractedFacts;
  const details = input.details || [];
  const htmlBody = input.html?.trim() ? input.html : buildHtmlBodyFromText(textBody);
  const actionLabel = input.actionLabel?.trim();
  const actionUrl = input.actionUrl?.trim();
  const showAction = Boolean(actionLabel && actionUrl);

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#F3F2F1;font-family:Segoe UI, Arial, Helvetica, sans-serif;color:#1E2430;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${escapeHtml(previewText)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F2F1;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #D9E0E8;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#164073;padding:20px 22px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td>
                      ${renderBrandMark()}
                      <p style="margin:12px 0 0 0;font-size:24px;line-height:1.18;color:#FFFFFF;font-weight:800;">
                        ${escapeHtml(heading)}
                      </p>
                    </td>
                    <td align="right" style="vertical-align:top;">
                      <span style="display:inline-block;padding:7px 10px;border-radius:999px;background:${tone.bg};border:1px solid ${tone.border};color:${tone.text};font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;">
                        ${escapeHtml(statusLabel)}
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${renderFlatImageSlot(preset.imageSlot)}
            <tr>
              <td style="padding:20px 22px 6px 22px;">
                <p style="margin:0 0 14px 0;display:inline-block;padding:6px 10px;border-radius:999px;background:#E8EDF2;color:#164073;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">
                  ${escapeHtml(contextLabel)}
                </p>
                <p style="margin:0 0 14px 0;color:#17233C;font-size:15px;line-height:1.55;font-weight:700;">
                  ${escapeHtml(preset.intro)}
                </p>
                <div style="font-size:14px;line-height:1.65;color:#2E3A4A;">
                  ${htmlBody}
                </div>
                ${renderFacts(facts)}
                ${renderDetails(details)}
                ${showAction ? `
                <div style="margin:20px 0 6px 0;">
                  <a href="${escapeHtml(String(actionUrl))}" style="display:inline-block;padding:11px 16px;border-radius:10px;background:#164073;color:#FFFFFF;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                    ${escapeHtml(String(actionLabel))}
                  </a>
                </div>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:14px 22px 18px 22px;border-top:1px solid #E8EDF2;">
                <p style="margin:0;font-size:11px;line-height:1.5;color:#5B6675;">
                  Este e-mail foi enviado automaticamente pelo ${PRODUCT_NAME}. Se você não reconhece esta mensagem, contate a equipe de governança.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    PRODUCT_NAME,
    contextLabel,
    "",
    heading,
    "",
    textBody || "Mensagem sem conteúdo.",
    "",
    showAction ? `${actionLabel}: ${actionUrl}` : null,
    "-----",
    `Este e-mail foi enviado automaticamente pelo ${PRODUCT_NAME}.`,
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

function normalizeEmailAddress(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function getEmailRedirectTo(): string | null {
  const configured = normalizeEmailAddress(process.env.EMAIL_REDIRECT_TO);
  if (configured === "off" || configured === "false" || configured === "none") {
    return null;
  }
  return configured || null;
}

function withRedirectNotice(input: SendEmailInput, originalTo: string, redirectTo: string): SendEmailInput {
  if (normalizeEmailAddress(originalTo) === normalizeEmailAddress(redirectTo)) {
    return input;
  }

  const noticeText =
    `Destinatario original do sistema: ${originalTo}\n` +
    `Redirecionado para auditoria: ${redirectTo}`;

  const noticeHtml =
    `<div style="margin:0 0 14px 0;padding:10px 12px;border:1px solid #D9E0E8;border-radius:10px;background:#F7FBFF;color:#164073;font-size:12px;line-height:1.5;">` +
    `<strong>Redirecionamento de e-mail ativo.</strong><br/>` +
    `Destinatario original do sistema: ${escapeHtml(originalTo)}<br/>` +
    `Enviado para: ${escapeHtml(redirectTo)}` +
    `</div>`;

  return {
    ...input,
    text: `${noticeText}\n\n${input.text}`,
    html: input.html?.trim()
      ? `${noticeHtml}${input.html}`
      : `${noticeHtml}${buildHtmlBodyFromText(input.text)}`,
  };
}

export async function sendSystemEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const providerStatus = getEmailProviderStatus();
  const fromAddress = providerStatus.fromAddress;
  const redirectTo = getEmailRedirectTo();
  const originalTo = normalizeEmailAddress(input.to);
  const effectiveTo = redirectTo || originalTo;
  const redirected = Boolean(redirectTo && redirectTo !== originalTo);
  const messageInput = redirected
    ? withRedirectNotice(input, originalTo, effectiveTo)
    : input;
  const content = buildMasterEmail(messageInput);

  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      // Resend honra `Idempotency-Key` por 24h. Se mesmo key chegar de novo,
      // o provider retorna o resultado do envio original em vez de duplicar.
      // Doc: https://resend.com/docs/api-reference/emails/send-email
      const resendOptions: { idempotencyKey?: string } = {};
      if (input.idempotencyKey) {
        resendOptions.idempotencyKey = String(input.idempotencyKey).slice(0, 256);
      }
      await resend.emails.send(
        {
          from: fromAddress,
          to: [effectiveTo],
          subject: input.subject,
          text: content.text,
          html: content.html,
        },
        resendOptions,
      );
      return { ok: true, provider: "resend", to: effectiveTo, originalTo, redirected };
    } catch (error: any) {
      return {
        ok: false,
        provider: "resend",
        error: error?.message || "Falha ao enviar com Resend.",
      };
    }
  }

  const transporter = getSmtpTransport();
  if (transporter) {
    try {
      // Message-Id determinístico a partir da idempotencyKey, quando presente.
      // Não impede reenvio (SMTP não tem idempotency nativa), mas permite o
      // MTA destinatário detectar duplicação e fica visível em headers.
      const fromDomain = String(fromAddress.split("@")[1] || "percata.local")
        .replace(/[<>\s]/g, "");
      const messageId = input.idempotencyKey
        ? `<${input.idempotencyKey}@${fromDomain}>`
        : undefined;
      await transporter.sendMail({
        from: fromAddress,
        to: effectiveTo,
        subject: input.subject,
        text: content.text,
        html: content.html,
        ...(messageId ? { messageId } : {}),
      });
      return { ok: true, provider: "smtp", to: effectiveTo, originalTo, redirected };
    } catch (error: any) {
      return {
        ok: false,
        provider: "smtp",
        error: error?.message || "Falha ao enviar com SMTP.",
      };
    }
  }

  return {
    ok: false,
    provider: "none",
    error: providerStatus.reason,
  };
}

export function getEmailProviderStatus(): EmailProviderStatus {
  const fromAddress =
    process.env.EMAIL_FROM || process.env.SMTP_FROM || "no-reply@percata.local";
  const redirectTo = getEmailRedirectTo();

  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    return {
      configured: true,
      provider: "resend",
      fromAddress,
      redirectTo,
    };
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (host && user && pass) {
    return {
      configured: true,
      provider: "smtp",
      fromAddress,
      redirectTo,
    };
  }

  return {
    configured: false,
    provider: "none",
    fromAddress,
    redirectTo,
    reason:
      "Nenhum provedor de e-mail configurado. Defina RESEND_API_KEY ou SMTP_HOST/SMTP_USER/SMTP_PASS.",
  };
}
