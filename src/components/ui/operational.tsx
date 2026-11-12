"use client";

import type { ReactNode } from "react";
import { CheckCircle2 } from "@/components/icons/lucide/exports/CheckCircle2";
import { ChevronDown } from "@/components/icons/lucide/exports/ChevronDown";
import { Circle } from "@/components/icons/lucide/exports/Circle";
import { Inbox } from "@/components/icons/lucide/exports/Inbox";
import { motion } from "framer-motion";
import { MechanicalValue } from "@/components/ui/MechanicalValue";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export type OperationalTone =
  | "action"
  | "collab"
  | "success"
  | "warning"
  | "danger"
  | "insight"
  | "neutral";

const toneMap: Record<
  OperationalTone,
  {
    chip: string;
    chipActive: string;
    icon: string;
    value: string;
    rail: string;
    surface: string;
  }
> = {
  action: {
    chip: "border-[var(--semantic-action-border)] bg-[var(--semantic-action-soft)] text-[var(--semantic-action)]",
    chipActive: "border-[var(--semantic-action)] bg-[var(--semantic-action)] text-white",
    icon: "ux-icon-action",
    value: "text-[var(--semantic-action)]",
    rail: "bg-[var(--semantic-action)]",
    surface: "border-[var(--semantic-action-border)] bg-[var(--semantic-action-soft)]",
  },
  collab: {
    chip: "border-[var(--semantic-collab-border)] bg-[var(--semantic-collab-soft)] text-[var(--semantic-collab)]",
    chipActive: "border-[var(--semantic-collab)] bg-[var(--semantic-collab)] text-white",
    icon: "ux-icon-collab",
    value: "text-[var(--semantic-collab)]",
    rail: "bg-[var(--semantic-collab)]",
    surface: "border-[var(--semantic-collab-border)] bg-[var(--semantic-collab-soft)]",
  },
  success: {
    chip: "border-[var(--semantic-success-border)] bg-[var(--semantic-success-soft)] text-[var(--semantic-success)]",
    chipActive: "border-[var(--semantic-success)] bg-[var(--semantic-success)] text-white",
    icon: "ux-icon-success",
    value: "text-[var(--semantic-success)]",
    rail: "bg-[var(--semantic-success)]",
    surface: "border-[var(--semantic-success-border)] bg-[var(--semantic-success-soft)]",
  },
  warning: {
    chip: "border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-soft)] text-[var(--p-color-warning)]",
    chipActive: "border-[var(--semantic-warning)] bg-[var(--semantic-warning)] text-white",
    icon: "ux-icon-warning",
    value: "text-[var(--p-color-warning)]",
    rail: "bg-[var(--semantic-warning)]",
    surface: "border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-soft)]",
  },
  danger: {
    chip: "border-[var(--semantic-danger-border)] bg-[var(--semantic-danger-soft)] text-[var(--semantic-danger)]",
    chipActive: "border-[var(--semantic-danger)] bg-[var(--semantic-danger)] text-white",
    icon: "ux-icon-danger",
    value: "text-[var(--semantic-danger)]",
    rail: "bg-[var(--semantic-danger)]",
    surface: "border-[var(--semantic-danger-border)] bg-[var(--semantic-danger-soft)]",
  },
  insight: {
    chip: "border-[var(--semantic-insight-border)] bg-[var(--semantic-insight-soft)] text-[var(--semantic-insight)]",
    chipActive: "border-[var(--semantic-insight)] bg-[var(--semantic-insight)] text-white",
    icon: "ux-icon-insight",
    value: "text-[var(--semantic-insight)]",
    rail: "bg-[var(--semantic-insight)]",
    surface: "border-[var(--semantic-insight-border)] bg-[var(--semantic-insight-soft)]",
  },
  neutral: {
    chip: "border-[var(--semantic-neutral-border)] bg-[var(--semantic-neutral-soft)] text-[var(--p-color-fg-muted)]",
    chipActive: "border-[var(--p-color-fg-muted)] bg-[var(--p-color-fg-muted)] text-white",
    icon: "bg-[var(--semantic-neutral-soft)] text-[var(--p-color-fg-muted)]",
    value: "text-[var(--p-color-fg-muted)]",
    rail: "bg-[var(--p-color-border-strong)]",
    surface: "border-[var(--semantic-neutral-border)] bg-[var(--semantic-neutral-soft)]",
  },
};

export function OperationalChip({
  children,
  tone = "neutral",
  active = false,
  icon,
  className,
}: {
  children: ReactNode;
  tone?: OperationalTone;
  active?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 w-fit shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold leading-none",
        active ? toneMap[tone].chipActive : toneMap[tone].chip,
        className,
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {children}
    </span>
  );
}

export function OperationalKpiCard({
  label,
  value,
  icon,
  tone = "action",
  helper,
  badge,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: OperationalTone;
  helper?: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const shouldAnimateValue = typeof value === "string" || typeof value === "number";

  return (
    <motion.article
      className={cn("ux-panel-soft flex min-h-[124px] flex-col overflow-visible rounded-2xl p-4", className)}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={reduced ? undefined : { opacity: 1, y: 0 }}
      whileHover={reduced ? undefined : { y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="type-kicker font-semibold uppercase tracking-[0.14em] text-black/45">
          {label}
        </p>
        {icon ? (
          <div className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg", toneMap[tone].icon)}>
            {icon}
          </div>
        ) : null}
      </div>
      <p className={cn("mt-3 flex min-h-[2.4rem] min-w-0 items-center overflow-visible text-[clamp(1.08rem,1.45vw,1.5rem)] font-semibold leading-[1.18]", toneMap[tone].value)}>
        {shouldAnimateValue ? <MechanicalValue value={value} /> : value}
      </p>
      {helper || badge ? (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-xs text-[var(--p-color-fg-muted)]">
          {badge ? <OperationalChip tone={tone}>{badge}</OperationalChip> : null}
          {helper ? <span>{helper}</span> : null}
        </div>
      ) : null}
    </motion.article>
  );
}

export function OperationalStepper({
  steps,
  currentStep,
  className,
}: {
  steps: Array<{ label: string; helper?: string }>;
  currentStep: number;
  className?: string;
}) {
  return (
    <ol className={cn("grid gap-2 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {steps.map((step, index) => {
        const position = index + 1;
        const done = position < currentStep;
        const active = position === currentStep;
        return (
          <li
            key={step.label}
            className={cn(
              "skeuo-step px-3 py-3",
              active
                ? "border-[var(--semantic-action-border)] shadow-sm"
                : "border-[var(--semantic-neutral-border)]",
            )}
          >
            {active ? <span className="absolute inset-x-0 top-0 h-1 bg-[var(--semantic-action)]" /> : null}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  done && "bg-[var(--semantic-success)] text-white",
                  active && "bg-[var(--semantic-action)] text-white",
                  !done && !active && "bg-[var(--semantic-neutral-soft)] text-[var(--p-color-fg-subtle)]",
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : position}
              </span>
              <span className="text-sm font-semibold text-[var(--p-color-fg-default)]">{step.label}</span>
            </div>
            {step.helper ? <p className="mt-1 pl-9 text-xs leading-5 text-[var(--p-color-fg-muted)]">{step.helper}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function OperationalTimeline({
  items,
  emptyTitle = "Nenhum evento registrado",
  className,
}: {
  items: Array<{
    title: string;
    description?: ReactNode;
    meta?: ReactNode;
    tone?: OperationalTone;
  }>;
  emptyTitle?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (items.length === 0) {
    return <OperationalEmptyState title={emptyTitle} description="Quando houver movimentação, ela aparecerá nesta linha do tempo." />;
  }

  return (
    <ol className={cn("space-y-0", className)}>
      {items.map((item, index) => {
        const tone = item.tone || "neutral";
        const isLast = index === items.length - 1;
        return (
          <motion.li
            key={`${item.title}-${index}`}
            className="relative grid grid-cols-[28px_1fr] gap-3 pb-4 last:pb-0"
            initial={reduced ? false : { opacity: 0, x: -8 }}
            animate={reduced ? undefined : { opacity: 1, x: 0 }}
            transition={{ duration: 0.16, delay: index * 0.04, ease: "easeOut" }}
          >
            {!isLast ? <span className="absolute left-[13px] top-7 h-[calc(100%-24px)] w-px bg-[var(--skeuo-border)]" /> : null}
            <span
              className={cn(
                "relative z-10 mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full border-4 border-white",
                toneMap[tone].rail,
              )}
            >
              <Circle className="h-2 w-2 fill-white text-white" />
            </span>
            <div className="skeuo-timeline-card px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--p-color-fg-default)]">{item.title}</p>
                {item.meta ? <span className="text-xs font-semibold text-[var(--p-color-fg-subtle)]">{item.meta}</span> : null}
              </div>
              {item.description ? <div className="mt-1 text-xs leading-5 text-[var(--p-color-fg-muted)]">{item.description}</div> : null}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

export function SkeuoStamp({
  children,
  label,
  tone = "action",
  className,
}: {
  children?: ReactNode;
  label?: ReactNode;
  tone?: OperationalTone;
  className?: string;
}) {
  const content = label ?? children;

  return (
    <span
      className={cn(
        "skeuo-stamp inline-flex rotate-[-2deg] items-center justify-center rounded-lg px-3 py-1 type-kicker font-black uppercase tracking-[0.18em]",
        toneMap[tone].value,
        className,
      )}
    >
      {content}
    </span>
  );
}

export function SkeuoPaperStack({
  title,
  subtitle,
  stamp,
  tone = "action",
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  stamp?: ReactNode;
  tone?: OperationalTone;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={cn("relative min-h-[130px] w-full max-w-[320px]", className)}
      initial={reduced ? false : { opacity: 0, rotate: -1, y: 8 }}
      animate={reduced ? undefined : { opacity: 1, rotate: 0, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
    >
      <div className="skeuo-paper-back" />
      <div className="skeuo-paper-mid" />
      <div
        className={cn(
          "skeuo-paper-front border p-5",
          toneMap[tone].surface,
        )}
      >
        <div className="skeuo-paper-clip" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--p-color-fg-default)]">{title}</p>
            {subtitle ? <p className="mt-1 text-xs leading-5 text-[var(--p-color-fg-muted)]">{subtitle}</p> : null}
          </div>
          {stamp ? <SkeuoStamp tone={tone}>{stamp}</SkeuoStamp> : null}
        </div>
      </div>
    </motion.div>
  );
}

export function SkeuoDocumentCard({
  title,
  meta,
  children,
  stamp,
  tone = "action",
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  stamp?: ReactNode;
  tone?: OperationalTone;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.article
      className={cn(
        "skeuo-card p-5",
        className,
      )}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={reduced ? undefined : { opacity: 1, y: 0 }}
      whileHover={reduced ? undefined : { y: -3, rotate: -0.2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <span className={cn("absolute inset-x-0 top-0 h-1", toneMap[tone].rail)} />
      <div className="skeuo-card-tab" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--p-color-fg-default)]">{title}</p>
          {meta ? <p className="mt-1 text-xs leading-5 text-[var(--p-color-fg-muted)]">{meta}</p> : null}
        </div>
        {stamp ? <SkeuoStamp tone={tone}>{stamp}</SkeuoStamp> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </motion.article>
  );
}

export function SkeuoProgressRail({
  items,
  className,
}: {
  items: Array<{ label: string; value: number; tone?: OperationalTone }>;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <div className={cn("space-y-3 rounded-2xl border border-[var(--skeuo-border)] bg-[var(--skeuo-paper)] p-4 shadow-sm", className)}>
      {items.map((item) => {
        const tone = item.tone || "action";
        const width = `${Math.max(0, Math.min(100, item.value))}%`;
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs font-semibold text-[var(--p-color-fg-muted)]">
              <span>{item.label}</span>
              <span>{Math.round(item.value)}%</span>
            </div>
            <div className="skeuo-rail h-3 overflow-hidden rounded-full">
              <motion.div
                className={cn("skeuo-rail-fill h-full rounded-full", toneMap[tone].rail)}
                initial={reduced ? false : { width: "0%" }}
                animate={reduced ? { width } : { width }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OperationalAccordion({
  items,
  className,
}: {
  items: Array<{ title: ReactNode; badge?: ReactNode; content: ReactNode; defaultOpen?: boolean }>;
  className?: string;
}) {
  return (
    <div className={cn("divide-y divide-[var(--skeuo-border-soft)] rounded-2xl border border-[var(--skeuo-border)] bg-[var(--skeuo-paper)] shadow-sm", className)}>
      {items.map((item, index) => (
        <details key={index} open={item.defaultOpen} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[var(--p-color-fg-default)] marker:hidden">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              {item.title}
              {item.badge ? item.badge : null}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--p-color-fg-subtle)] transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 text-sm leading-6 text-[var(--p-color-fg-muted)]">{item.content}</div>
        </details>
      ))}
    </div>
  );
}

export function OperationalEmptyState({
  title,
  description,
  icon,
  iconClassName,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  iconClassName?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[24px] border border-dashed border-[var(--skeuo-border)] bg-[var(--skeuo-paper)] p-10 text-center shadow-sm", className)}>
      <div className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--skeuo-paper-muted)] text-[var(--p-color-fg-subtle)]", iconClassName)}>
        {icon || <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[var(--p-color-brand-500)]">{title}</h3>
      {description ? <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-[var(--p-color-fg-muted)]">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
