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

const TYPE_STYLE_MAP: Record<string, string> = {
  info: "border-[#DCEAF0] bg-[#F4F7FA] text-[#1C5A6B]",
  success: "border-[#CFE6DE] bg-[#E7F0EA] text-[#5F735C]",
  warning: "border-[#F3D0BE] bg-[#FFF3E6] text-[#B9895A]",
  error: "border-[#F5A3A3] bg-[#FEEFF0] text-[#A91520]",
};

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
                <div className="px-4 py-6 text-xs text-[#7D98B8]">Carregando notificações...</div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-6 text-xs text-[#7D98B8]">
                  Nenhuma notificação até o momento.
                </div>
              ) : (
                <div className="divide-y divide-[#E8EDF2]">
                  {notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      layout
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
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
                            {notification.message}
                          </p>
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
                  ))}
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
