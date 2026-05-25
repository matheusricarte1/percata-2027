"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Check, Clock } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
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
  info: "border-[#DCEAF0] bg-[#F4F7FA] text-[#1C5A6B]",
  success: "border-[#CFE6DE] bg-[#E7F0EA] text-[#5F735C]",
  warning: "border-[#F3D0BE] bg-[#FFF3E6] text-[#B9895A]",
  error: "border-[#F5A3A3] bg-[#FEEFF0] text-[#A91520]",
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
      ctaUrl: sanitizeUrl(payload.cta_url || payload.ctaUrl),
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
      const user = await getSafeUser();
      if (!user || !active) return;
      setCurrentUserId(user.id);

      const { data } = await supabase
        .from("notifications")
        .select("id,title,message,type,read,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!active) return;
      setNotifications((data || []) as NotificationRow[]);
      setLoading(false);
    }

    loadNotifications();
    timer = setInterval(loadNotifications, 30000);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, []);

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
          "relative flex h-10 w-10 items-center justify-center rounded-full text-[#2E3A4A] transition hover:bg-[var(--upe-accent-washed-blue)]",
          className,
        )}
      >
        <Bell size={20} />
        {showUnreadCount && unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 inline-flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[var(--upe-red-upe)] px-1 text-[9px] font-semibold text-white">
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
            className="absolute right-0 z-50 mt-2 w-[360px] overflow-hidden rounded-2xl border border-[#D9E0E8] bg-white shadow-[var(--elevation-4)]"
          >
            <div className="flex items-center justify-between border-b border-[#E8EDF2] px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7D98B8]">
                  Alertas do Usuário
                </p>
                <h3 className="text-sm font-semibold text-[var(--upe-blue-upe)]">Notificações</h3>
              </div>
              <button
                type="button"
                onClick={markAllAsRead}
                className="rounded-lg border border-[#D9E0E8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3E4C5F] transition hover:bg-[#F4F7FA]"
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
                      className="rounded-xl border border-[#E8EDF2] bg-white px-3 py-3"
                    >
                      <div className="h-2.5 w-24 rounded-full bg-[#E8EDF2] skeleton-shimmer" />
                      <div className="mt-2 h-3 w-4/5 rounded-full bg-[#E8EDF2] skeleton-shimmer" />
                      <div className="mt-1.5 h-2.5 w-2/3 rounded-full bg-[#E8EDF2] skeleton-shimmer" />
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-5 py-6 text-center text-xs text-[#7D98B8]">
                  <img
                    src="/guidance/notifications-empty.png"
                    alt=""
                    className="mx-auto mb-3 aspect-[16/9] w-full max-w-[220px] object-contain"
                  />
                  <p className="font-semibold text-[#164073]">Nenhuma notificação até o momento.</p>
                  <p className="mt-1 leading-5">Quando houver movimentações nas suas DFDs, elas aparecerão aqui.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E8EDF2]">
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
                                "rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]",
                                TYPE_STYLE_MAP[notification.type || "info"] || TYPE_STYLE_MAP.info,
                              )}
                            >
                              {notification.type || "info"}
                            </span>
                            {!notification.read && (
                              <span className="h-2 w-2 rounded-full bg-[var(--upe-red-upe)]" />
                            )}
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[var(--upe-blue-upe)]">
                            {notification.title}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-[#5B6675]">
                            {parsedMessage.body || "Você recebeu uma atualização no sistema."}
                          </p>
                          {parsedMessage.imageUrl ? (
                            <motion.img
                              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                              src={parsedMessage.imageUrl}
                              alt={notification.title}
                              className="mt-2 max-h-40 w-full rounded-lg border border-[#D9E0E8] object-cover"
                              loading="lazy"
                            />
                          ) : null}
                          {parsedMessage.senderName ? (
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7D98B8]">
                              Enviado por {parsedMessage.senderName}
                            </p>
                          ) : null}
                          {parsedMessage.ctaLabel && parsedMessage.ctaUrl ? (
                            <a
                              href={parsedMessage.ctaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex h-8 items-center rounded-lg border border-[#C7D7EA] bg-white px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#164073] transition hover:-translate-y-0.5 hover:bg-[#F4F7FA]"
                            >
                              {parsedMessage.ctaLabel}
                            </a>
                          ) : null}
                          <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[#A7B1BD]">
                            <Clock size={12} />
                            {formatTimeLabel(notification.created_at)}
                          </p>
                        </div>

                        {!notification.read && (
                          <button
                            type="button"
                            onClick={() => markAsRead(notification.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#D9E0E8] text-[var(--upe-blue-medium)] transition hover:bg-[var(--upe-accent-washed-blue)]"
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
