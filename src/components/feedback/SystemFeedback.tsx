"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Inbox, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type FeedbackTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClasses: Record<FeedbackTone, string> = {
  neutral: "border-[#D9E0E8] bg-white text-[#2E3A4A]",
  info: "border-[#C7D7EA] bg-[#F4F7FA] text-[#164073]",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
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
        "relative overflow-hidden rounded-2xl border border-[#D9E0E8] bg-white p-6 shadow-sm",
        className,
      )}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-[#E8EDF2]">
        <motion.div
          className="h-full w-1/3 rounded-r-full bg-gradient-to-r from-[#164073] via-[#2A7C8C] to-[#EC2029]"
          animate={reduceMotion ? { x: 0 } : { x: ["-120%", "340%"] }}
          transition={reduceMotion ? { duration: 0.01 } : { duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E8EDF2] text-[#164073]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </span>
        <div>
          <p className="font-display text-lg font-semibold text-[#164073]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[#5B6675]">{description}</p>
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
      className={cn("inline-flex items-center gap-2 text-sm font-semibold text-[#164073]", className)}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </span>
  );
}
