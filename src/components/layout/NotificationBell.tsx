"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell } from "@/components/icons/phosphor/exports/Bell";
import { Check } from "@/components/icons/phosphor/exports/Check";
import { Clock } from "@/components/icons/phosphor/exports/Clock";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { notificationActionHref } from "@/lib/notification-action-href";
import { getSafeUser, supabase } from "@/lib/supabase";

type NotificationBellProps = {
  showUnreadCount?: boolean;
  className?: string;
};

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | null;
  read: boolean;
  created_at: string;
};

type ParsedNotificationMessage = {
  body: string;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  senderName: string | null;
};

const TYPE_STYLE_MAP: Record<string, string> = {
  info: "border-[var(--p-color-info-border)] bg-[var(--p-color-surface-muted)] text-[var(--p-color-collab)]",
  success: "border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]",
  warning: "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]",
  error: "border-[var(--p-color-danger-border)] bg-[var(--p-color-danger-bg)] text-[var(--p-color-danger)]",
};

function sanitizeUrl(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseNotificationMessage(raw: string): ParsedNotificationMessage {
  const fallback: ParsedNotificationMessage = {
    body: String(raw || "").trim(),
    imageUrl: null,
    ctaLabel: null,
    ctaUrl: null,
    senderName: null,
  };
  const value = String(raw || "").trim();
  if (!value.startsWith("{")) return fallback;

  try {
    const payload = JSON.parse(value);
    if (!payload || payload.kind !== "rich_notification") return fallback;
    return {
      body: String(payload.body || payload.message || "").trim() || fallback.body,
      imageUrl: sanitizeUrl(payload.image_url || payload.imageUrl),
      ctaLabel: String(payload.cta_label || payload.ctaLabel || "").trim() || null,
      ctaUrl: notificationActionHref(payload.cta_url || payload.ctaUrl),
      senderName: String(payload.sender_name || payload.senderName || "").trim() || null,
    };
  } catch {
    return fallback;
  }
}

export function NotificationBell({
  showUnreadCount = false,
  className,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function loadNotifications() {
      try {
      const user = await getSafeUser();
      if (!active) return;
      if (!user) { setLoadError(true); setLoading(false); return; }
      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,message,type,read,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!active) return;
      if (error) throw error;
      setLoadError(false);
      setNotifications((data || []) as NotificationRow[]);
      setLoading(false);
      } catch { if (active) { setLoadError(true); setLoading(false); } }
    }

    loadNotifications();
    timer = setInterval(loadNotifications, 30000);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [retryKey]);

  async function markAsRead(id: string) {
    const previous = notifications;
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    );
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);
    if (error) {
      setNotifications(previous);
    }
  }

  async function markAllAsRead() {
    if (!currentUserId) return;
    const previous = notifications;
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", currentUserId)
      .eq("read", false);
    if (error) {
      setNotifications(previous);
    }
  }

  function formatTimeLabel(isoDate: string) {
    const date = new Date(isoDate);
    return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Abrir notificações"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--p-color-fg-default)] transition hover:bg-[var(--p-color-info-bg)]",
          className,
        )}
      >
        <Bell size={20} />
        {showUnreadCount && unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 inline-flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[var(--p-color-danger)] px-1 type-micro font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Fechar painel de notificações"
              className="fixed inset-0 z-40 cursor-default"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={reduceMotion ? undefined : { opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.14 }}
              onClick={() => setOpen(false)}
            />

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[var(--p-color-border)] bg-white shadow-[var(--elevation-4)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--p-color-surface-subtle)] px-4 py-3">
              <div>
                <p className="type-caption font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">
                  Alertas do Usuário
                </p>
                <h3 className="text-sm font-semibold text-[var(--p-color-brand-500)]">Notificações</h3>
              </div>
              <button
                type="button"
                disabled={loading || loadError || unreadCount === 0}
                onClick={markAllAsRead}
                className="rounded-lg border border-[var(--p-color-border)] px-2.5 py-1 type-kicker font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-muted)] transition hover:bg-[var(--p-color-surface-muted)]"
              >
                Marcar todas
              </button>
            </div>

            <div className="max-h-[380px] overflow-y-auto">
              {loading ? (
                <div className="space-y-3 px-4 py-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={`notif-skeleton-${index}`}
                      className="rounded-xl border border-[var(--p-color-surface-subtle)] bg-white px-3 py-3"
                    >
                      <div className="h-2.5 w-24 rounded-full bg-[var(--p-color-surface-subtle)] skeleton-shimmer" />
                      <div className="mt-2 h-3 w-4/5 rounded-full bg-[var(--p-color-surface-subtle)] skeleton-shimmer" />
                      <div className="mt-1.5 h-2.5 w-2/3 rounded-full bg-[var(--p-color-surface-subtle)] skeleton-shimmer" />
                    </div>
                  ))}
                </div>
              ) : loadError ? (
                <div role="status" className="px-5 py-6 text-sm"><p className="font-semibold">Não foi possível atualizar as notificações.</p><button type="button" onClick={() => { setLoading(true); setRetryKey(key => key + 1); }} className="mt-3 min-h-11 rounded-xl border px-3 font-semibold">Tentar novamente</button></div>
              ) : notifications.length === 0 ? (
                <div className="px-5 py-6 text-center text-xs text-[var(--p-color-fg-subtle)]">
                  <img
                    src="/guidance/notifications-empty.png"
                    alt=""
                    className="mx-auto mb-3 aspect-[16/9] w-full max-w-[220px] object-contain"
                  />
                  <p className="font-semibold text-[var(--p-color-brand-500)]">Nenhuma notificação até o momento.</p>
                  <p className="mt-1 leading-5">Quando houver movimentações nas suas DFDs, elas aparecerão aqui.</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--p-color-surface-subtle)]">
                  {notifications.map((notification) => {
                    const parsedMessage = parseNotificationMessage(notification.message);
                    return (
                    <motion.div
                      key={notification.id}
                      layout
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      whileHover={reduceMotion ? undefined : { y: -1 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className={cn(
                        "px-4 py-3 transition",
                        !notification.read && "bg-[var(--md-surface)]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 type-micro font-semibold uppercase tracking-[0.12em]",
                                TYPE_STYLE_MAP[notification.type || "info"] || TYPE_STYLE_MAP.info,
                              )}
                            >
                              {({ info: "Informação", success: "Concluído", warning: "Atenção", error: "Erro" })[notification.type || "info"]}
                            </span>
                            {!notification.read && (
                              <span className="h-2 w-2 rounded-full bg-[var(--p-color-danger)]" />
                            )}
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[var(--p-color-brand-500)]">
                            {notification.title}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-[var(--p-color-fg-muted)]">
                            {parsedMessage.body || "Você recebeu uma atualização no sistema."}
                          </p>
                          {parsedMessage.imageUrl ? (
                            <motion.img
                              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                              src={parsedMessage.imageUrl}
                              alt={notification.title}
                              className="mt-2 max-h-40 w-full rounded-lg border border-[var(--p-color-border)] object-cover"
                              loading="lazy"
                            />
                          ) : null}
                          {parsedMessage.senderName ? (
                            <p className="mt-1 type-kicker font-semibold uppercase tracking-[0.1em] text-[var(--p-color-fg-subtle)]">
                              Enviado por {parsedMessage.senderName}
                            </p>
                          ) : null}
                          {parsedMessage.ctaLabel && parsedMessage.ctaUrl ? (
                            <a
                              href={parsedMessage.ctaUrl}
                              target={parsedMessage.ctaUrl.startsWith("/") ? undefined : "_blank"}
                              rel="noreferrer"
                              className="mt-2 inline-flex h-8 items-center rounded-lg border border-[var(--p-color-info-border)] bg-white px-2.5 type-kicker font-semibold uppercase tracking-[0.1em] text-[var(--p-color-brand-500)] transition hover:-translate-y-0.5 hover:bg-[var(--p-color-surface-muted)]"
                            >
                              {parsedMessage.ctaLabel}
                            </a>
                          ) : null}
                          <p className="mt-2 inline-flex items-center gap-1 type-kicker font-medium uppercase tracking-[0.1em] text-[var(--p-color-border-strong)]">
                            <Clock size={12} />
                            {formatTimeLabel(notification.created_at)}
                          </p>
                        </div>

                        {!notification.read && (
                          <button
                            type="button"
                            onClick={() => markAsRead(notification.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--p-color-border)] text-[var(--p-color-brand-400)] transition hover:bg-[var(--p-color-info-bg)]"
                            aria-label="Marcar notificação como lida"
                          >
                            <Check size={14} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )})}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </div>
  );
}

