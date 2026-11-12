"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { AlertTriangle } from "@/components/icons/lucide/exports/AlertTriangle";
import { CheckCircle2 } from "@/components/icons/lucide/exports/CheckCircle2";
import { Inbox } from "@/components/icons/lucide/exports/Inbox";
import { Loader2 } from "@/components/icons/lucide/exports/Loader2";
import { RefreshCw } from "@/components/icons/lucide/exports/RefreshCw";
import { cn } from "@/lib/utils";

type FeedbackTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClasses: Record<FeedbackTone, string> = {
  neutral: "border-[var(--p-color-border)] bg-white text-[var(--p-color-fg-default)]",
  info: "border-[var(--p-color-info-border)] bg-[var(--p-color-surface-muted)] text-[var(--p-color-brand-500)]",
  success: "border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]",
  warning: "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]",
  danger: "border-[var(--p-color-danger-border)] bg-[var(--p-color-danger-bg)] text-[var(--p-color-danger)]",
};

export function LoadingPanel({
  title = "Carregando dados",
  description = "Estamos buscando as informações mais recentes.",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      role="status"
      aria-live="polite"
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--p-color-border)] bg-white p-6 shadow-sm",
        className,
      )}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-[var(--p-color-surface-subtle)]">
        <motion.div
          className="h-full w-1/3 rounded-r-full bg-gradient-to-r from-[var(--p-color-brand-500)] via-[var(--p-color-collab)] to-[var(--p-color-danger)]"
          animate={reduceMotion ? { x: 0 } : { x: ["-120%", "340%"] }}
          transition={reduceMotion ? { duration: 0.01 } : { duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--p-color-surface-subtle)] text-[var(--p-color-brand-500)]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </span>
        <div>
          <p className="font-display text-lg font-semibold text-[var(--p-color-brand-500)]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--p-color-fg-muted)]">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function EmptyState({
  title,
  description,
  tone = "neutral",
  icon = "empty",
  imageSrc,
  imageAlt,
  action,
  className,
}: {
  title: string;
  description?: string;
  tone?: FeedbackTone;
  icon?: "empty" | "success" | "warning" | "refresh";
  imageSrc?: string;
  imageAlt?: string;
  action?: ReactNode;
  className?: string;
}) {
  const Icon =
    icon === "success"
      ? CheckCircle2
      : icon === "warning"
        ? AlertTriangle
        : icon === "refresh"
          ? RefreshCw
          : Inbox;

  return (
    <motion.div
      className={cn(
        "rounded-2xl border p-7 text-center shadow-sm",
        toneClasses[tone],
        className,
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={imageAlt || ""}
          className="mx-auto mb-5 aspect-[16/9] w-full max-w-[280px] rounded-2xl object-contain"
        />
      ) : (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/75 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="font-display text-lg font-semibold">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-xl text-sm leading-6 opacity-80">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </motion.div>
  );
}

export function InlineBusy({
  label = "Processando",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-2 text-sm font-semibold text-[var(--p-color-brand-500)]", className)}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </span>
  );
}

