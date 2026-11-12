import nodemailer from "nodemailer";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  imageUrl?: string;
  /** Data URL opcional para clientes que bloqueiam imagens remotas. */
  inlineImageDataUrl?: string;
  templateKey?: EmailTemplateKey;
  heading?: string;
  contextLabel?: string;
  previewText?: string;
  actionLabel?: string;
  actionUrl?: string;
  statusLabel?: string;
  statusTone?: EmailTone;
  audience?: "chefia" | "solicitante";
  facts?: EmailFact[];
  details?: string[];
  /**
   * Chave única para deduplicação. Quando presente:
   *   - SMTP/Nodemailer: usado como `Message-Id` determinístico — não evita
   *     reenvio por si só, mas permite que o destinatário/MTA detecte duplicata.
   *   - Recomendado: derivar de `email_alert_queue.id`, ou
   *     `hash(to + subject + dfd_id + status)`.
   */
  idempotencyKey?: string;
};

type SendEmailResult = {
  ok: boolean;
  provider: "smtp" | "none";
  to?: string;
  originalTo?: string;
  redirected?: boolean;
  error?: string;
};

export type EmailProviderStatus = {
  configured: boolean;
  provider: "smtp" | "none";
  fromAddress: string;
  redirectTo?: string | null;
  reason?: string;
};

let smtpTransport: nodemailer.Transporter | null = null;
const PRODUCT_NAME = "PERCATA";

type EmailTone = "info" | "success" | "warning" | "danger" | "neutral";

const HEADER_STATUS_COLORS: Record<EmailTone, string> = {
  info: "#DCEAF0",
  success: "#BDE5C7",
  warning: "#FFD7A1",
  danger: "#FFD0D4",
  neutral: "#D7E0E8",
};

export type EmailTemplateKey =
  | "welcome"
  | "dfd_submitted"
  | "dfd_approved"
  | "dfd_returned"
  | "dfd_pending"
  | "admin_summary"
  | "dfd_sent_to_chefia"
  | "dfd_consolidated"
  | "coauthorship_opened"
  | "coauthorship_closed"
  | "contribution_submitted"
  | "contribution_locked"
  | "dfd_rejected_or_archived"
  | "dfd_rejected"
  | "dfd_archived"
  | "triage_conflict"
  | "sla_reminder"
  | "broadcast_announcement"
  | "test"
  | "generic";

type EmailImageSlot =
  | "welcome"
  | "dfd-submitted"
  | "dfd-approved"
  | "dfd-returned"
  | "dfd-status"
  | "admin-summary"
  | "dfd-sent-to-chefia"
  | "dfd-consolidated"
  | "coauthorship-opened"
  | "coauthorship-closed"
  | "contribution-submitted"
  | "contribution-locked"
  | "dfd-rejected-or-archived"
  | "triage-conflict"
  | "sla-reminder"
  | "broadcast-announcement"
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
  imageSlot?: EmailImageSlot;
  actionLabel: string;
};

export type EmailTemplateCategory = "transacional" | "prazo" | "coletivo" | "administrativo" | "campanha" | "teste";
export type EmailTemplateAudience = "solicitante" | "chefia" | "administrador" | "colaborador" | "institucional";
export type EmailTemplateCatalogEntry = {
  category: EmailTemplateCategory;
  audience: readonly EmailTemplateAudience[];
  trigger: string;
  imageSlot: EmailImageSlot;
  cta: string;
  requiredFields: readonly string[];
  frequency: string;
};

const TEMPLATE_PRESETS: Record<EmailTemplateKey, EmailTemplatePreset> = {
  welcome: {
    heading: "Acesso ao PERCATA liberado",
    contextLabel: "Acesso institucional",
    statusLabel: "Conta ativa",
    statusTone: "success",
    intro: "O PERCATA passa a ser o seu ponto de partida para transformar necessidades da sua unidade em planejamento institucional.",
    imageSlot: "welcome",
    actionLabel: "Acessar o PERCATA",
  },
  dfd_submitted: {
    heading: "DFD enviada para análise",
    contextLabel: "Fluxo de DFD",
    statusLabel: "Em análise",
    statusTone: "info",
    intro: "Sua demanda entrou no planejamento e agora segue para a análise da chefia. Você pode acompanhar cada avanço por aqui.",
    imageSlot: "dfd-submitted",
    actionLabel: "Acompanhar DFD",
  },
  dfd_approved: {
    heading: "DFD aprovada",
    contextLabel: "Homologação",
    statusLabel: "Homologada",
    statusTone: "success",
    intro: "Sua demanda foi validada e ganhou lugar nas próximas etapas do planejamento. Um passo importante para que ela avance com segurança.",
    imageSlot: "dfd-approved",
    actionLabel: "Ver DFD aprovada",
  },
  dfd_returned: {
    heading: "DFD devolvida para ajustes",
    contextLabel: "Revisão necessária",
    statusLabel: "Ajuste solicitado",
    statusTone: "warning",
    intro: "Sua demanda pode seguir. Antes, confira o que precisa ser ajustado para que a chefia possa avaliá-la com clareza e segurança.",
    imageSlot: "dfd-returned",
    actionLabel: "Corrigir DFD",
  },
  dfd_pending: {
    heading: "Pendência em DFD",
    contextLabel: "Atenção necessária",
    statusLabel: "Pendente",
    statusTone: "warning",
    intro: "Há um próximo passo esperando por você. Resolver essa pendência mantém a demanda ativa e evita que ela fique para trás no planejamento.",
    imageSlot: "dfd-status",
    actionLabel: "Ver pendência",
  },
  admin_summary: {
    heading: "Resumo administrativo",
    contextLabel: "Governança PERCATA",
    statusLabel: "Resumo",
    statusTone: "neutral",
    intro: "Uma visão objetiva do que precisa de decisão agora — para que nenhuma demanda importante se perca entre filas, prazos e encaminhamentos.",
    imageSlot: "admin-summary",
    actionLabel: "Abrir resumo administrativo",
  },
  dfd_sent_to_chefia: {
    heading: "DFD encaminhada para chefia",
    contextLabel: "Triagem da chefia",
    statusLabel: "Encaminhada",
    statusTone: "info",
    intro: "Uma nova necessidade da unidade chegou à sua fila. Sua análise ajuda a transformar a solicitação em uma decisão de planejamento bem fundamentada.",
    imageSlot: "dfd-sent-to-chefia",
    actionLabel: "Abrir fila de avaliação",
  },
  dfd_consolidated: {
    heading: "DFD coletiva consolidada",
    contextLabel: "Consolidação coletiva",
    statusLabel: "Consolidada",
    statusTone: "success",
    intro: "As contribuições da sala coletiva viraram uma DFD oficial. O trabalho construído em conjunto agora segue pelo fluxo institucional.",
    imageSlot: "dfd-consolidated",
    actionLabel: "Ver DFD consolidada",
  },
  coauthorship_opened: {
    heading: "Coautoria aberta",
    contextLabel: "Sala coletiva",
    statusLabel: "Aberta",
    statusTone: "info",
    intro: "Uma necessidade compartilhada pode ganhar mais força quando é construída em conjunto. A sala está aberta para sua unidade contribuir.",
    imageSlot: "coauthorship-opened",
    actionLabel: "Participar da sala coletiva",
  },
  coauthorship_closed: {
    heading: "Coautoria encerrada",
    contextLabel: "Sala coletiva",
    statusLabel: "Em consolidação",
    statusTone: "warning",
    intro: "A etapa de contribuições foi concluída. Agora a chefia organiza o que foi construído coletivamente para dar continuidade ao planejamento.",
    imageSlot: "coauthorship-closed",
    actionLabel: "Abrir consolidação",
  },
  contribution_submitted: {
    heading: "Contribuição registrada",
    contextLabel: "Sala coletiva",
    statusLabel: "Contribuição salva",
    statusTone: "success",
    intro: "Sua contribuição foi registrada e passa a compor a construção coletiva da demanda. É assim que necessidades semelhantes ganham escala e visibilidade.",
    imageSlot: "contribution-submitted",
    actionLabel: "Ver contribuição",
  },
  contribution_locked: {
    heading: "Item bloqueado",
    contextLabel: "Sala coletiva",
    statusLabel: "Bloqueado",
    statusTone: "warning",
    intro: "Este item foi protegido para preservar a consistência da construção coletiva. Consulte a sala para entender o encaminhamento e os próximos passos.",
    imageSlot: "contribution-locked",
    actionLabel: "Ver item bloqueado",
  },
  dfd_rejected_or_archived: {
    heading: "DFD arquivada/devolvida",
    contextLabel: "Fluxo de DFD",
    statusLabel: "Ação necessária",
    statusTone: "danger",
    intro: "Este fluxo foi interrompido para revisão. Consulte a decisão e o histórico para entender o melhor encaminhamento para a demanda.",
    imageSlot: "dfd-rejected-or-archived",
    actionLabel: "Revisar DFD",
  },
  dfd_rejected: {
    heading: "DFD não aprovada",
    contextLabel: "Decisão da chefia",
    statusLabel: "Não aprovada",
    statusTone: "danger",
    intro: "A demanda não foi aprovada nesta etapa. A justificativa registrada mostra o caminho mais adequado para ajustar, rediscutir ou encaminhar a necessidade.",
    imageSlot: "dfd-rejected-or-archived",
    actionLabel: "Consultar decisão",
  },
  dfd_archived: {
    heading: "DFD arquivada",
    contextLabel: "Encerramento do fluxo",
    statusLabel: "Arquivada",
    statusTone: "neutral",
    intro: "O fluxo desta demanda foi encerrado e ficou registrado para consulta. O histórico preserva a decisão e apoia novos planejamentos quando necessário.",
    imageSlot: "dfd-rejected-or-archived",
    actionLabel: "Consultar DFD arquivada",
  },
  triage_conflict: {
    heading: "Conflito de triagem",
    contextLabel: "Concorrência de aprovação",
    statusLabel: "Conflito detectado",
    statusTone: "warning",
    intro: "A DFD recebeu uma decisão enquanto você a analisava. Atualize a fila para trabalhar sempre com a informação mais recente e evitar retrabalho.",
    imageSlot: "triage-conflict",
    actionLabel: "Atualizar fila de triagem",
  },
  sla_reminder: {
    heading: "Lembrete de prazo",
    contextLabel: "Prazo institucional de tramitação",
    statusLabel: "Prazo em atenção",
    statusTone: "warning",
    intro: "O prazo está próximo. Uma ação agora ajuda a manter a demanda no ciclo de planejamento e evita urgências desnecessárias depois.",
    imageSlot: "sla-reminder",
    actionLabel: "Ver prazo no PERCATA",
  },
  broadcast_announcement: {
    heading: "Comunicado institucional",
    contextLabel: "Comunicados",
    statusLabel: "Informe",
    statusTone: "info",
    intro: "O que sua unidade precisa para funcionar, ensinar, pesquisar ou atender melhor começa com planejamento institucional. Confira este informe e veja como o PERCATA pode apoiar essa construção.",
    imageSlot: "broadcast-announcement",
    actionLabel: "Ler comunicado",
  },
  test: {
    heading: "Teste de e-mail",
    contextLabel: "Teste de infraestrutura",
    statusLabel: "Canal ativo",
    statusTone: "success",
    intro: "Este envio confirma que o PERCATA consegue avisar as pessoas certas no momento certo, mantendo o planejamento mais acompanhado e transparente.",
    imageSlot: "test",
    actionLabel: "Abrir o PERCATA",
  },
  generic: {
    heading: "Notificação do PERCATA",
    contextLabel: "Notificação institucional",
    statusLabel: "Informativo",
    statusTone: "info",
    intro: "Há uma atualização importante para o seu trabalho no PERCATA. Consulte os detalhes para entender o contexto e seguir com segurança.",
    imageSlot: "generic",
    actionLabel: "Abrir notificação",
  },
};

/** Catálogo operacional: a fila e as rotinas podem consultar este contrato
 * sem depender do texto visual do e-mail. Mantemos as chaves antigas para
 * compatibilidade com eventos já persistidos. */
export const EMAIL_TEMPLATE_CATALOG = {
  welcome: { category: "transacional", audience: ["solicitante"], trigger: "conta criada ou acesso liberado", imageSlot: "welcome", cta: "Acessar o PERCATA", requiredFields: ["to"], frequency: "uma vez" },
  dfd_submitted: { category: "transacional", audience: ["solicitante", "chefia"], trigger: "DFD enviada para análise", imageSlot: "dfd-submitted", cta: "Acompanhar DFD", requiredFields: ["to", "protocolo"], frequency: "por evento" },
  dfd_approved: { category: "transacional", audience: ["solicitante"], trigger: "DFD aprovada", imageSlot: "dfd-approved", cta: "Ver DFD aprovada", requiredFields: ["to", "protocolo"], frequency: "por evento" },
  dfd_returned: { category: "transacional", audience: ["solicitante"], trigger: "DFD devolvida para ajustes", imageSlot: "dfd-returned", cta: "Corrigir DFD", requiredFields: ["to", "protocolo", "motivo"], frequency: "por evento" },
  dfd_pending: { category: "transacional", audience: ["solicitante", "chefia"], trigger: "pendência criada", imageSlot: "dfd-status", cta: "Ver pendência", requiredFields: ["to", "protocolo", "responsável", "unidade"], frequency: "por evento" },
  admin_summary: { category: "administrativo", audience: ["administrador"], trigger: "resumo institucional gerado", imageSlot: "admin-summary", cta: "Abrir resumo administrativo", requiredFields: ["to"], frequency: "diária ou sob demanda" },
  dfd_sent_to_chefia: { category: "transacional", audience: ["chefia"], trigger: "DFD encaminhada à chefia", imageSlot: "dfd-sent-to-chefia", cta: "Abrir fila de avaliação", requiredFields: ["to", "protocolo", "unidade"], frequency: "por evento" },
  dfd_consolidated: { category: "coletivo", audience: ["solicitante", "chefia", "colaborador"], trigger: "sala coletiva consolidada", imageSlot: "dfd-consolidated", cta: "Ver DFD consolidada", requiredFields: ["to"], frequency: "por evento" },
  coauthorship_opened: { category: "coletivo", audience: ["colaborador", "chefia"], trigger: "sala coletiva aberta", imageSlot: "coauthorship-opened", cta: "Participar da sala coletiva", requiredFields: ["to"], frequency: "por evento" },
  coauthorship_closed: { category: "coletivo", audience: ["colaborador", "chefia"], trigger: "coautoria encerrada", imageSlot: "coauthorship-closed", cta: "Abrir consolidação", requiredFields: ["to"], frequency: "por evento" },
  contribution_submitted: { category: "coletivo", audience: ["colaborador", "chefia"], trigger: "contribuição registrada", imageSlot: "contribution-submitted", cta: "Ver contribuição", requiredFields: ["to"], frequency: "por evento" },
  contribution_locked: { category: "coletivo", audience: ["colaborador"], trigger: "item bloqueado", imageSlot: "contribution-locked", cta: "Ver item bloqueado", requiredFields: ["to"], frequency: "por evento" },
  dfd_rejected_or_archived: { category: "transacional", audience: ["solicitante"], trigger: "DFD rejeitada ou arquivada", imageSlot: "dfd-rejected-or-archived", cta: "Revisar DFD", requiredFields: ["to", "protocolo"], frequency: "por evento" },
  dfd_rejected: { category: "transacional", audience: ["solicitante"], trigger: "DFD não aprovada", imageSlot: "dfd-rejected-or-archived", cta: "Consultar decisão", requiredFields: ["to", "protocolo", "motivo"], frequency: "por evento" },
  dfd_archived: { category: "transacional", audience: ["solicitante"], trigger: "DFD arquivada", imageSlot: "dfd-rejected-or-archived", cta: "Consultar DFD arquivada", requiredFields: ["to", "protocolo"], frequency: "por evento" },
  triage_conflict: { category: "administrativo", audience: ["chefia", "administrador"], trigger: "conflito de triagem detectado", imageSlot: "triage-conflict", cta: "Atualizar fila de triagem", requiredFields: ["to", "protocolo"], frequency: "por evento" },
  sla_reminder: { category: "prazo", audience: ["solicitante", "chefia"], trigger: "prazo próximo do vencimento", imageSlot: "sla-reminder", cta: "Ver prazo no PERCATA", requiredFields: ["to", "protocolo", "prazo", "dias restantes"], frequency: "diária, com deduplicação" },
  broadcast_announcement: { category: "campanha", audience: ["institucional"], trigger: "comunicado publicado", imageSlot: "broadcast-announcement", cta: "Ler comunicado", requiredFields: ["to"], frequency: "sob demanda" },
  test: { category: "teste", audience: ["administrador"], trigger: "teste solicitado", imageSlot: "test", cta: "Abrir o PERCATA", requiredFields: ["to"], frequency: "sob demanda" },
  generic: { category: "administrativo", audience: ["institucional"], trigger: "evento sem classificação específica", imageSlot: "generic", cta: "Abrir notificação", requiredFields: ["to"], frequency: "por evento" },
} satisfies Record<EmailTemplateKey, EmailTemplateCatalogEntry>;

export function validateEmailTemplateCatalog(): string[] {
  return (Object.keys(TEMPLATE_PRESETS) as EmailTemplateKey[]).flatMap((key) => {
    const entry = EMAIL_TEMPLATE_CATALOG[key];
    const errors: string[] = [];
    if (!entry) errors.push(`${key}: sem entrada no catálogo`);
    if (!entry?.trigger || !entry?.cta || !entry?.imageSlot) errors.push(`${key}: metadados incompletos`);
    return errors;
  });
}

/**
 * Cria a primeira comunicação após a conclusão efetiva do onboarding. O
 * disparo é persistido como notificação para entrar na mesma fila auditável
 * das demais comunicações; não é enviado diretamente pelo navegador.
 */
export function buildOnboardingWelcomeNotification(input: {
  userId: string;
  fullName?: string | null;
  campusName?: string | null;
  actionUrl: string;
}) {
  const name = String(input.fullName || "").trim();
  const campus = String(input.campusName || "").trim() || "Campus não informado";
  return {
    user_id: input.userId,
    title: "Seu acesso institucional está pronto",
    type: "success",
    message: JSON.stringify({
      kind: "rich_notification",
      template_key: "welcome",
      heading: "Seu acesso ao PERCATA está pronto",
      context_label: "Acesso institucional",
      status_label: "Perfil configurado",
      status_tone: "success",
      body: name
        ? `Olá, ${name}. Seu acesso está pronto. No PERCATA, as necessidades da sua unidade ganham forma, acompanhamento e espaço no planejamento institucional.`
        : "Seu acesso está pronto. No PERCATA, as necessidades da sua unidade ganham forma, acompanhamento e espaço no planejamento institucional.",
      cta_label: "Acessar meu painel",
      cta_url: input.actionUrl,
      facts: [
        { label: "Campus", value: campus },
        { label: "Perfil", value: "Acesso institucional liberado" },
      ],
      details: [
        "Comece pelo painel: registre uma necessidade, acompanhe suas DFDs e veja como cada demanda avança até se tornar planejamento.",
      ],
    }),
  };
}

/** Aceita somente chaves que possuem preset, catálogo e imagem conhecidos. */
export function parseEmailTemplateKey(value: unknown): EmailTemplateKey | undefined {
  const key = String(value || "").trim() as EmailTemplateKey;
  return Object.prototype.hasOwnProperty.call(TEMPLATE_PRESETS, key) ? key : undefined;
}

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
  if (haystack.includes("arquivada") || haystack.includes("arquivado")) return "dfd_archived";
  if (haystack.includes("rejeitada") || haystack.includes("reprovada") || haystack.includes("não aprovada")) return "dfd_rejected";
  if (haystack.includes("aprovada") || haystack.includes("homologada")) return "dfd_approved";
  if (haystack.includes("enviada") || haystack.includes("análise") || haystack.includes("analise")) {
    return "dfd_submitted";
  }
  if (haystack.includes("pendência") || haystack.includes("pendencia")) return "dfd_pending";
  if (haystack.includes("coautoria") && haystack.includes("encerr")) return "coauthorship_closed";
  if (haystack.includes("coautoria") || haystack.includes("publicada")) return "coauthorship_opened";
  if (haystack.includes("consolid")) return "dfd_consolidated";
  if (haystack.includes("encaminhad") && haystack.includes("chefia")) return "dfd_sent_to_chefia";
  if (haystack.includes("conflito") || haystack.includes("já foi processada")) return "triage_conflict";
  if (haystack.includes("sla") || haystack.includes("prazo")) return "sla_reminder";
  if (haystack.includes("comunicado") || haystack.includes("informe")) return "broadcast_announcement";
  if (haystack.includes("resumo")) return "admin_summary";
  return "generic";
}

function getAssetBaseUrl() {
  const configured =
    process.env.EMAIL_ASSET_BASE_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "https://percata.vercel.app";
  const normalized = configured.trim();
  if (!normalized) return "";
  return normalized.startsWith("http") ? normalized.replace(/\/$/, "") : `https://${normalized.replace(/\/$/, "")}`;
}

function renderBrandMark() {
  return `
    <p style="margin:0;color:#FFFFFF;font-size:15px;line-height:1;font-weight:800;letter-spacing:0.12em;">
      ${PRODUCT_NAME}
    </p>`;
}

function getFlatImageUrl(slot: EmailTemplatePreset["imageSlot"]): string | null {
  if (!slot) return null;
  const envKey = `EMAIL_FLAT_${slot.toUpperCase().replace(/-/g, "_")}_URL`;
  const configured = process.env[envKey]?.trim();
  if (configured) return configured;
  const assetBase = getAssetBaseUrl();
  if (!assetBase) return null;
  const eventSlots = new Set<EmailImageSlot>([
    "dfd-sent-to-chefia",
    "dfd-consolidated",
    "coauthorship-opened",
    "coauthorship-closed",
    "contribution-submitted",
    "contribution-locked",
    "dfd-rejected-or-archived",
    "triage-conflict",
    "sla-reminder",
    "broadcast-announcement",
  ]);
  const eventAssetNames: Partial<Record<EmailImageSlot, string>> = {
    // Downscaled for dependable loading in Outlook/Gmail while retaining the
    // 16:9 composition used by the master e-mail renderer.
    "dfd-sent-to-chefia": "dfd-sent-to-chefia-optimized.png",
  };
  const path = eventSlots.has(slot)
    ? `/email/events/${eventAssetNames[slot] || `${slot}.png`}`
    : `/email/${slot}.png`;
  return `${assetBase}${path}`;
}

function getDefaultInlineImageDataUrl(slot: EmailTemplatePreset["imageSlot"]): string | undefined {
  // Gmail carrega as imagens públicas do PERCATA por proxy. Embutir uma PNG de
  // aproximadamente 1 MB em cada notificação torna a mensagem lenta e pesada;
  // só usamos CID quando o ambiente o pede explicitamente (por exemplo, uma
  // campanha que precisa funcionar sem imagens remotas).
  if (String(process.env.EMAIL_INLINE_IMAGES || "").toLowerCase() !== "true") {
    return undefined;
  }
  if (!slot) return undefined;
  const eventSlots = new Set<EmailImageSlot>([
    "dfd-sent-to-chefia", "dfd-consolidated", "coauthorship-opened", "coauthorship-closed",
    "contribution-submitted", "contribution-locked", "dfd-rejected-or-archived",
    "triage-conflict", "sla-reminder", "broadcast-announcement",
  ]);
  const filename = slot === "dfd-sent-to-chefia" ? "dfd-sent-to-chefia-optimized.png" : `${slot}.png`;
  const filePath = path.join(process.cwd(), "public", eventSlots.has(slot) ? "email" : "email", eventSlots.has(slot) ? "events" : "", filename);
  if (!existsSync(filePath)) return undefined;
  return `data:image/png;base64,${readFileSync(filePath).toString("base64")}`;
}

function renderFlatImageSlot(
  slot: EmailTemplatePreset["imageSlot"],
  imageUrlOverride?: string,
  inlineImageCid?: string,
) {
  if (!slot && !imageUrlOverride) return "";
  const imageUrl = inlineImageCid ? `cid:${inlineImageCid}` : imageUrlOverride?.trim() || getFlatImageUrl(slot);
  const labelBySlot: Record<string, string> = {
    welcome: "Ilustração institucional de boas-vindas",
    "dfd-submitted": "Ilustração de documento encaminhado",
    "dfd-approved": "Ilustração de aprovação e conclusão",
    "dfd-returned": "Ilustração de DFD devolvida para ajustes",
    "dfd-status": "Ilustração de atualização de status da DFD",
    "admin-summary": "Ilustração de resumo administrativo",
    "dfd-sent-to-chefia": "Ilustração de DFD encaminhada para chefia",
    "dfd-consolidated": "Ilustração de DFD coletiva consolidada",
    "coauthorship-opened": "Ilustração de coautoria aberta",
    "coauthorship-closed": "Ilustração de coautoria encerrada",
    "contribution-submitted": "Ilustração de contribuição registrada",
    "contribution-locked": "Ilustração de item bloqueado",
    "dfd-rejected-or-archived": "Ilustração de DFD arquivada ou devolvida",
    "triage-conflict": "Ilustração de conflito de triagem",
    "sla-reminder": "Ilustração de lembrete de SLA",
    "broadcast-announcement": "Ilustração de comunicado institucional",
    test: "Ilustração de teste de e-mail",
    generic: "Ilustração de notificação institucional",
  };
  const label = (slot ? labelBySlot[slot] : null) || "Ilustração institucional";

  if (imageUrl) {
    return `
      <tr>
        <td class="email-pad" style="padding:0 26px 18px 26px;">
          <img class="email-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}" width="576" style="display:block;width:100%;max-width:576px;border:0;border-radius:14px;background:#F7FBFF;" />
        </td>
      </tr>`;
  }

  return `
    <tr>
      <td style="padding:0 26px 18px 26px;">
        <div style="height:104px;border-radius:16px;background:linear-gradient(135deg,#EAF3FB 0%,#F8FBFD 100%);border:1px solid #D6E2EE;text-align:left;color:#164073;font-size:13px;line-height:1.45;font-weight:800;padding:22px;box-sizing:border-box;">
          <span style="display:inline-block;margin-bottom:7px;padding:5px 8px;border-radius:999px;background:#D71920;color:#FFFFFF;font-size:10px;letter-spacing:.08em;text-transform:uppercase;">PERCATA</span><br/>
          ${escapeHtml(label)}
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
          <td class="email-fact-label" style="width:42%;padding:10px 12px;border-bottom:1px solid #E8EDF2;color:#7D98B8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">
            ${escapeHtml(fact.label)}
          </td>
          <td class="email-fact-value" style="padding:10px 12px;border-bottom:1px solid #E8EDF2;color:#17233C;font-size:13px;font-weight:700;">
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

function buildMasterEmail(input: SendEmailInput): { html: string; text: string; inlineImageDataUrl?: string; inlineAttachment?: { filename: string; content: Buffer; cid: string; contentType: string } } {
  const textBody = String(input.text || "").trim();
  const templateKey = detectTemplateKey(input);
  const preset = TEMPLATE_PRESETS[templateKey] || TEMPLATE_PRESETS.generic;
  const heading = String(input.heading || preset.heading || input.subject || "Notificação").trim();
  const contextLabel = String(input.contextLabel || preset.contextLabel || "Notificação institucional").trim();
  const statusLabel = String(input.statusLabel || preset.statusLabel).trim();
  const statusTone = input.statusTone || preset.statusTone;
  const statusColor = HEADER_STATUS_COLORS[statusTone] || HEADER_STATUS_COLORS.info;
  const previewText = String(input.previewText || textBody || heading).slice(0, 140);
  const extractedFacts = extractFactsFromText(textBody);
  const facts = input.facts?.length ? input.facts : extractedFacts;
  const details = input.details || [];
  const htmlBody = input.html?.trim() ? input.html : buildHtmlBodyFromText(textBody);
  const actionLabel = input.actionLabel?.trim() || preset.actionLabel;
  const actionUrl = input.actionUrl?.trim();
  const showAction = Boolean(actionLabel && actionUrl);
  const isChefia = input.audience === "chefia" || /chefia|triagem|avaliação|avaliacao/i.test(`${contextLabel} ${input.subject}`);
  const editorialIntro =
    templateKey === "dfd_pending" && isChefia
      ? "Há uma DFD aguardando sua avaliação na fila de chefia. Confira o responsável, a unidade e o prazo antes de decidir."
      : templateKey === "dfd_pending" && !isChefia
        ? "Há uma pendência na sua DFD. Consulte o responsável, a unidade e o prazo para concluir a próxima ação."
        : templateKey === "sla_reminder" && isChefia
          ? "A fila de chefia possui uma DFD próxima do prazo. Priorize a avaliação para manter o ciclo em dia."
          : templateKey === "sla_reminder" && !isChefia
            ? "Sua DFD está próxima do prazo de tramitação. Acesse o PERCATA para acompanhar o próximo passo."
            : preset.intro;

  const inlineImageDataUrl = input.inlineImageDataUrl || getDefaultInlineImageDataUrl(preset.imageSlot);
  const inlineData = inlineImageDataUrl?.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  const inlineImageCid = inlineData ? "percata-hero-image" : undefined;
  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.subject)}</title>
    <style>
      /* Critical styles remain inline; Gmail applies these refinements on mobile. */
      @media screen and (max-width: 600px) {
        .email-outer { padding:14px 0 !important; }
        .email-shell { border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
        .email-pad { padding-left:18px !important; padding-right:18px !important; }
        .email-title { font-size:24px !important; line-height:1.22 !important; }
        .email-copy { font-size:15px !important; line-height:1.62 !important; }
        .email-image { border-radius:10px !important; }
        .email-button { display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; }
        .email-fact-label { width:38% !important; padding-left:10px !important; padding-right:8px !important; }
        .email-fact-value { padding-left:8px !important; padding-right:10px !important; overflow-wrap:anywhere !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#F3F2F1;font-family:Segoe UI, Arial, Helvetica, sans-serif;color:#1E2430;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${escapeHtml(previewText)}
    </div>
    <table class="email-outer" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF4F9;padding:28px 12px;">
      <tr>
        <td align="center">
          <table class="email-shell" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;background:#ffffff;border:1px solid #D6E2EE;border-radius:20px;overflow:hidden;box-shadow:0 12px 36px rgba(22,64,115,.10);">
            <tr>
              <td class="email-pad" style="background:#102F55;padding:25px 30px 28px 30px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:top;">
                      ${renderBrandMark()}
                      <p style="margin:8px 0 0 0;color:#BFD2E3;font-size:10px;line-height:1.3;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">
                        Comunicação institucional
                      </p>
                    </td>
                    <td align="right" style="vertical-align:top;padding-left:18px;">
                      <p style="margin:1px 0 0 0;color:${statusColor};font-size:10px;line-height:1.3;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;">
                        ${escapeHtml(statusLabel)}
                      </p>
                    </td>
                  </tr>
                </table>
                <div style="height:1px;margin:22px 0 18px 0;background:#426383;"></div>
                <p class="email-title" style="margin:0;max-width:540px;font-size:29px;line-height:1.16;color:#FFFFFF;font-weight:750;letter-spacing:-0.025em;">
                  ${escapeHtml(heading)}
                </p>
              </td>
            </tr>
            <tr><td><div style="height:4px;background:#D71920;"></div></td></tr>
            ${renderFlatImageSlot(preset.imageSlot, input.imageUrl, inlineImageCid)}
            <tr>
              <td class="email-pad" style="padding:24px 26px 8px 26px;">
                <p style="margin:0 0 14px 0;display:inline-block;padding:6px 10px;border-radius:999px;background:#E8EDF2;color:#164073;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">
                  ${escapeHtml(contextLabel)}
                </p>
                <p style="margin:0 0 16px 0;color:#17233C;font-size:16px;line-height:1.55;font-weight:750;">
                  ${escapeHtml(editorialIntro)}
                </p>
                <div class="email-copy" style="font-size:14px;line-height:1.65;color:#2E3A4A;">
                  ${htmlBody}
                </div>
                ${renderFacts(facts)}
                ${renderDetails(details)}
                ${showAction ? `
                <div style="margin:20px 0 6px 0;">
                  <a class="email-button" href="${escapeHtml(String(actionUrl))}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#D71920;color:#FFFFFF;text-decoration:none;font-size:12px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;box-shadow:0 5px 12px rgba(215,25,32,.22);">
                    ${escapeHtml(String(actionLabel))}
                  </a>
                </div>` : ""}
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:18px 26px 22px 26px;border-top:1px solid #E8EDF2;background:#F8FBFD;">
                <p style="margin:0 0 8px 0;font-size:11px;line-height:1.5;color:#164073;font-weight:800;letter-spacing:.04em;">
                  PERCATA · SISTEMA DE PLANEJAMENTO E ADMINISTRAÇÃO
                </p>
                <p style="margin:0;font-size:11px;line-height:1.55;color:#5B6675;">
                  Universidade de Pernambuco — UPE. Este e-mail foi enviado automaticamente. Se você não reconhece esta mensagem, contate a equipe de governança.
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

  return {
    html,
    text,
    inlineImageDataUrl: inlineData ? `data:${inlineData[1]};base64,${inlineData[2].replace(/\s/g, "")}` : undefined,
    inlineAttachment: inlineData
      ? {
          filename: "percata-hero.png",
          content: Buffer.from(inlineData[2].replace(/\s/g, ""), "base64"),
          cid: inlineImageCid!,
          contentType: inlineData[1],
        }
      : undefined,
  };
}

/** Renderização sem envio, usada por testes e pela prévia administrativa. */
export function renderSystemEmailForPreview(input: SendEmailInput): string {
  return buildMasterEmail(input).html;
}

function normalizeEmailAddress(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function isValidEmailAddress(value: string): boolean {
  // Intentionally conservative: profile e-mails come from authentication, but
  // legacy/imported rows can be malformed and must not poison the delivery queue.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
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
  if (!isValidEmailAddress(originalTo)) {
    return {
      ok: false,
      provider: providerStatus.provider,
      error: "E-mail de destino inválido.",
    };
  }
  const effectiveTo = redirectTo || originalTo;
  const redirected = Boolean(redirectTo && redirectTo !== originalTo);
  const messageInput = redirected
    ? withRedirectNotice(input, originalTo, effectiveTo)
    : input;
  const content = buildMasterEmail(messageInput);

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
        ...(content.inlineAttachment ? { attachments: [content.inlineAttachment] } : {}),
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
      "Canal SMTP do Gmail não configurado. Defina SMTP_HOST, SMTP_USER e SMTP_PASS.",
  };
}
