import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import {
  sanitizeLongText,
  sanitizePlainText,
  sanitizeUuid,
} from "@/lib/settings-sanitize";

type TargetScope = "all" | "campus" | "role" | "user";
type NotificationType = "info" | "success" | "warning" | "error";
type RoleTarget = "solicitante" | "chefia" | "admin" | "superadmin";

type BroadcastPayload = {
  title?: string;
  body?: string;
  type?: NotificationType;
  targetScope?: TargetScope;
  targetCampusId?: string | null;
  targetRole?: RoleTarget | null;
  targetUserId?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
};

function sanitizeHttpUrl(value: unknown) {
  const text = sanitizePlainText(value, 600);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeType(value: unknown): NotificationType {
  const text = String(value || "").trim().toLowerCase();
  if (text === "success" || text === "warning" || text === "error") return text;
  return "info";
}

function normalizeTargetScope(value: unknown): TargetScope {
  const text = String(value || "").trim().toLowerCase();
  if (text === "campus" || text === "role" || text === "user") return text;
  return "all";
}

function normalizeRoleTarget(value: unknown): RoleTarget | null {
  const text = String(value || "").trim().toLowerCase();
  if (text === "solicitante" || text === "chefia" || text === "admin" || text === "superadmin") {
    return text;
  }
  return null;
}

export const POST = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ supabaseAdmin, role, user, request }) => {
    const admin = supabaseAdmin!;
    const body = (await request.json().catch(() => ({}))) as BroadcastPayload;

    const title = sanitizePlainText(body.title, 120);
    const messageBody = sanitizeLongText(body.body, 1200);
    const type = normalizeType(body.type);
    const targetScope = normalizeTargetScope(body.targetScope);
    const targetCampusId = sanitizeUuid(body.targetCampusId);
    const targetUserId = sanitizeUuid(body.targetUserId);
    const targetRole = normalizeRoleTarget(body.targetRole);
    const imageUrl = sanitizeHttpUrl(body.imageUrl);
    const ctaLabel = sanitizePlainText(body.ctaLabel, 60);
    const ctaUrl = sanitizeHttpUrl(body.ctaUrl);

    if (!title || !messageBody) {
      return NextResponse.json(
        { error: "Título e mensagem são obrigatórios." },
        { status: 400 },
      );
    }

    if ((ctaLabel && !ctaUrl) || (!ctaLabel && ctaUrl)) {
      return NextResponse.json(
        { error: "Informe rótulo e URL juntos para o botão opcional." },
        { status: 400 },
      );
    }

    if (targetScope === "campus" && !targetCampusId) {
      return NextResponse.json(
        { error: "Selecione um campus para esse alvo." },
        { status: 400 },
      );
    }
    if (targetScope === "role" && !targetRole) {
      return NextResponse.json(
        { error: "Selecione um papel para esse alvo." },
        { status: 400 },
      );
    }
    if (targetScope === "user" && !targetUserId) {
      return NextResponse.json(
        { error: "Selecione um usuário para esse alvo." },
        { status: 400 },
      );
    }
    if (targetScope !== "user" && role !== "superadmin") {
      return NextResponse.json(
        { error: "Somente superadmin pode enviar para múltiplos usuários." },
        { status: 403 },
      );
    }

    let query = admin.from("profiles").select("id");
    if (targetScope === "campus") {
      query = query.eq("campus_id", targetCampusId);
    } else if (targetScope === "role") {
      query = query.eq("role", targetRole);
    } else if (targetScope === "user") {
      query = query.eq("id", targetUserId);
    }

    const { data: targetProfiles, error: targetsError } = await query.limit(1000);
    if (targetsError) throw targetsError;

    const recipientIds = Array.from(
      new Set((targetProfiles || []).map((row: any) => String(row.id || "").trim()).filter(Boolean)),
    );

    if (recipientIds.length === 0) {
      return NextResponse.json(
        { error: "Nenhum destinatário encontrado para o filtro escolhido." },
        { status: 404 },
      );
    }

    const richMessage = JSON.stringify({
      kind: "rich_notification",
      body: messageBody,
      image_url: imageUrl || undefined,
      cta_label: ctaLabel || undefined,
      cta_url: ctaUrl || undefined,
      sender_name: sanitizePlainText(
        String((user.user_metadata as any)?.full_name || user.email || "Administração"),
        120,
      ),
    });

    const nowIso = new Date().toISOString();
    const rows = recipientIds.map((profileId) => ({
      user_id: profileId,
      title,
      message: richMessage,
      type,
      read: false,
      created_at: nowIso,
    }));

    const { error: insertError } = await admin.from("notifications").insert(rows);
    if (insertError) throw insertError;

    return NextResponse.json({
      ok: true,
      recipients: recipientIds.length,
    });
  },
  { requireAdminClient: true },
);

