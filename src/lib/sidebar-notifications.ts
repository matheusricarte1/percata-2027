export type SidebarNotificationTone = "info" | "success" | "warning" | "error";

export type SidebarNotificationRow = {
  id: string;
  title?: string | null;
  message?: string | null;
  type?: SidebarNotificationTone | string | null;
  read?: boolean | null;
};

export type SidebarNotificationBadge = {
  value: string;
  count: number;
  tone: SidebarNotificationTone;
  title: string;
  shake: boolean;
};

const TONE_PRIORITY: SidebarNotificationTone[] = ["error", "warning", "info", "success"];

export function formatSidebarBadgeCount(count: number) {
  const normalized = Math.max(0, Math.trunc(Number(count) || 0));
  if (normalized <= 0) return null;
  return normalized > 99 ? "99+" : String(normalized);
}

export function mapUnreadNotificationsToSidebarBadges(
  notifications: SidebarNotificationRow[],
  sidebarHrefs: string[],
): Record<string, SidebarNotificationBadge> {
  const normalizedHrefs = Array.from(
    new Set(sidebarHrefs.map(normalizeHref).filter((href): href is string => Boolean(href))),
  );
  const grouped = new Map<string, { count: number; tone: SidebarNotificationTone }>();

  notifications.forEach((notification) => {
    if (notification.read) return;

    const route = findBestSidebarRoute(
      extractNotificationPath(notification) || inferWorkflowPath(notification),
      normalizedHrefs,
    );
    if (!route) return;

    const tone = normalizeTone(notification.type);
    const existing = grouped.get(route);
    if (!existing) {
      grouped.set(route, { count: 1, tone });
      return;
    }

    grouped.set(route, {
      count: existing.count + 1,
      tone: pickHigherPriorityTone(existing.tone, tone),
    });
  });

  return Array.from(grouped.entries()).reduce<Record<string, SidebarNotificationBadge>>(
    (acc, [href, value]) => {
      const label = formatSidebarBadgeCount(value.count);
      if (!label) return acc;
      acc[href] = {
        value: label,
        count: value.count,
        tone: value.tone,
        title: `${value.count} notificação${value.count === 1 ? "" : "es"} não lida${value.count === 1 ? "" : "s"}`,
        shake: true,
      };
      return acc;
    },
    {},
  );
}

function extractNotificationPath(notification: SidebarNotificationRow) {
  const rawMessage = String(notification.message || "").trim();
  if (!rawMessage.startsWith("{")) return null;

  try {
    const payload = JSON.parse(rawMessage);
    if (!payload || payload.kind !== "rich_notification") return null;
    return normalizeHref(payload.cta_url || payload.ctaUrl || payload.url || payload.href);
  } catch {
    return null;
  }
}

function inferWorkflowPath(notification: SidebarNotificationRow) {
  const text = `${notification.title || ""} ${notification.message || ""}`.toLocaleLowerCase("pt-BR");
  if (text.includes("coletiv") || text.includes("sala")) return "/dfds-coletivas";
  if (text.includes("orçamento") || text.includes("orcamento")) return "/triagem/orcamento";
  if (text.includes("triagem") || text.includes("análise") || text.includes("analise")) {
    return "/triagem";
  }
  if (text.includes("catálogo") || text.includes("catalogo") || text.includes("e-fisco")) {
    return "/catalogo";
  }
  if (text.includes("dfd") || text.includes("solicitação") || text.includes("solicitacao")) {
    return "/minhas-dfds";
  }
  return null;
}

function findBestSidebarRoute(path: string | null, sidebarHrefs: string[]) {
  if (!path) return null;
  const normalizedPath = normalizeHref(path);
  if (!normalizedPath) return null;

  return sidebarHrefs
    .filter((href) => normalizedPath === href || normalizedPath.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0] || null;
}

function normalizeHref(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;

  try {
    const parsed = new URL(text, "https://percata.local");
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return pathname;
  } catch {
    const pathname = text.split(/[?#]/)[0]?.replace(/\/+$/, "") || "";
    return pathname.startsWith("/") ? pathname || "/" : null;
  }
}

function normalizeTone(value: unknown): SidebarNotificationTone {
  const tone = String(value || "info").toLowerCase();
  if (tone === "success" || tone === "warning" || tone === "error") return tone;
  return "info";
}

function pickHigherPriorityTone(
  current: SidebarNotificationTone,
  next: SidebarNotificationTone,
) {
  return TONE_PRIORITY.indexOf(next) < TONE_PRIORITY.indexOf(current) ? next : current;
}
