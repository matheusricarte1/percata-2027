"use client";
import Link from "next/link";
import { CalendarClock } from "@/components/icons/lucide/exports/CalendarClock";
import { CircleCheck } from "@/components/icons/lucide/exports/CircleCheck";
import { LockKeyhole } from "@/components/icons/lucide/exports/LockKeyhole";
import { useSubmissionPolicy } from "@/lib/use-submission-policy";
import { formatBahiaDate, formatSubmissionDeadline } from "@/lib/submission-policy";

export function SubmissionDeadlineNotice({ role }: { role: string }) {
  const { state, error, open, exceptionActive } = useSubmissionPolicy();
  if (error) return <div role="status" className="mb-4 rounded-xl border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] px-4 py-3 text-sm text-[var(--p-color-warning)]">{error}</div>;
  if (!state?.cycle) return null;
  if (state.superadminAccess && state.canCreate) return <aside aria-label="Prazo de submissão" className="mb-4 rounded-2xl border border-[var(--p-color-success-border)] bg-[var(--p-color-bg-elevated)] px-4 py-3"><p className="text-sm font-semibold text-[var(--p-color-fg)]">Acesso permanente de superadmin</p><p className="mt-1 text-sm text-[var(--p-color-fg-muted)]">Você pode criar e enviar DFDs no ciclo atual a qualquer momento. Os envios seguem para análise e ficam registrados no histórico.</p></aside>;
  const reviewRole = role === "chefia" || role === "superadmin";
  const Icon = open ? CalendarClock : exceptionActive ? CircleCheck : LockKeyhole;
  const title = open ? `Submissões até ${formatSubmissionDeadline(state.cycle.closesAt)}` : exceptionActive ? "Você tem uma liberação fora do prazo" : "Prazo de novas solicitações encerrado";
  const tone = exceptionActive && !open ? "border-[var(--p-color-success-border)]" : open ? "border-[var(--p-color-warning-border)]" : "border-[var(--p-color-border-muted)]";
  const iconTone = exceptionActive && !open ? "bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]" : open ? "bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]" : "bg-[var(--p-color-bg-elevated)] text-[var(--p-color-fg-muted)]";
  return <aside data-motion-static aria-label="Prazo de submissão" className={`mb-4 flex flex-col gap-3 rounded-2xl border ${tone} bg-[var(--p-color-bg-elevated)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between`}>
    <div className="flex min-w-0 gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconTone}`}><Icon size={20} aria-hidden="true" /></div>
      <div className="min-w-0"><p className="text-sm font-semibold text-[var(--p-color-fg)]">{title}</p><p className="mt-0.5 text-xs font-medium text-[var(--p-color-fg-muted)]">Horário da Bahia</p>
        <p className="mt-1 text-sm text-[var(--p-color-fg-muted)]">{open ? "Envie a DFD para análise antes do prazo. Rascunho não é envio." : exceptionActive ? `Válida até ${formatBahiaDate(state.exception!.expires_at)}. Sujeita à análise da chefia.` : "Consultas, devoluções e correções autorizadas continuam disponíveis."}</p>
        {reviewRole && <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">A chefia pode ajustar, devolver e homologar{state.cycle.chefiaClosesAt ? ` até ${formatSubmissionDeadline(state.cycle.chefiaClosesAt)}` : " durante sua janela de análise"}.</p>}
      </div>
    </div>
    <Link href={role === "admin" ? "/admin/consolidacao" : "/minhas-dfds"} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-[var(--p-color-border-muted)] px-4 text-sm font-semibold text-[var(--p-color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-action)]">{role === "admin" ? "Consultar DFDs" : "Acompanhar DFDs"}</Link>
  </aside>;
}
