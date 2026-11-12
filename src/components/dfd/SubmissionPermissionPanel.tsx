"use client";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock } from "@/components/icons/lucide/exports/CalendarClock";
import { CircleCheck } from "@/components/icons/lucide/exports/CircleCheck";
import { ShieldCheck } from "@/components/icons/lucide/exports/ShieldCheck";
import { toast } from "sonner";
import { formatBahiaDate, formatSubmissionDeadline, parseBahiaDateTime, type SubmissionState } from "@/lib/submission-policy";

const field = "w-full rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] px-3 py-3 text-sm text-[var(--p-color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-action)]";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-action)] disabled:cursor-not-allowed disabled:opacity-50";

export function SubmissionPermissionPanel({ userId, dfdId, disabled = false, onChanged, onActiveChange }: {
  userId?: string; dfdId?: string; disabled?: boolean; onChanged?: () => void; onActiveChange?: (active: boolean) => void;
}) {
  const [state, setState] = useState<SubmissionState | null>(null);
  const [events, setEvents] = useState<Array<{ id: string; action: string; actorName?: string; details: { reason?: string }; created_at: string }>>([]);
  const [reason, setReason] = useState("");
  const [expires, setExpires] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const url = dfdId ? `/api/submission-policy?dfdId=${encodeURIComponent(dfdId)}` : `/api/superadmin/submission-exceptions?userId=${encodeURIComponent(userId || "")}`;
      const response = await fetch(url, { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível consultar a autorização.");
      if (signal?.aborted) return;
      const next = dfdId ? data : data.state;
      setState(next); setEvents(data.events || []); setError("");
      const permission = dfdId ? next.correction : next.exception;
      onActiveChange?.(Boolean(permission));
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : "Falha ao consultar a autorização.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [dfdId, userId, onActiveChange]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const interval = window.setInterval(() => void load(controller.signal), 30_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [load]);
  const permission = dfdId ? state?.correction : state?.exception;
  async function save(revoke: boolean) {
    const expiresAt = parseBahiaDateTime(expires);
    if (!revoke && !expiresAt) { setError("Informe a validade no horário da Bahia."); return; }
    if (reason.trim().length < 3) { setError("Registre o motivo desta ação."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(dfdId ? "/api/dfd/correction-permission" : "/api/superadmin/submission-exceptions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, dfdId, reason: reason.trim(), expiresAt, revoke }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar a autorização.");
      toast.success(revoke ? "Autorização encerrada e registrada." : "Autorização concedida e registrada.");
      setReason(""); await load(); onChanged?.(); window.dispatchEvent(new Event("submission-policy-refresh"));
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  const blocked = loading || busy || disabled || Boolean(error && !state) || !state?.cycle;
  const pending = reason.trim().length < 3 ? "Informe o motivo, com pelo menos 3 caracteres." : !parseBahiaDateTime(expires) ? "Informe a data e o horário de validade para conceder ou atualizar." : "";
  return <section data-motion-static aria-label={dfdId ? "Correção em diálogo com a chefia" : "Solicitações fora do prazo"} className="rounded-2xl border border-[var(--p-color-info-border)] bg-[var(--p-color-bg-elevated)] p-4">
    <div className="flex items-start gap-3"><ShieldCheck className="mt-1 shrink-0 text-[var(--semantic-collab)]" size={20} aria-hidden="true" /><div>
      <h3 className="text-base font-semibold text-[var(--p-color-fg)]">{dfdId ? "Correção em diálogo com a chefia" : "Solicitações fora do prazo"}</h3>
      <p className="mt-1 text-sm text-[var(--p-color-fg-muted)]">{dfdId ? "Autorize o solicitante a editar e adicionar itens nesta DFD. A decisão da chefia fica pausada até o reenvio ou o encerramento da autorização." : "Libere este usuário no ciclo atual, com motivo e validade. As solicitações continuam sujeitas à análise da chefia."}</p>
    </div></div>
    {loading ? <p role="status" className="mt-4 text-sm">Consultando autorização…</p> : permission ? <div className={`mt-4 rounded-xl border p-3 text-sm text-[var(--p-color-fg)] ${dfdId ? "border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)]" : "border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)]"}`}><p className="flex items-start gap-2 font-semibold"><CircleCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0" />Autorização ativa até {formatBahiaDate(permission.expires_at)}</p><p className="mt-1 whitespace-pre-wrap">{permission.reason}</p></div> : <p className="mt-4 text-sm text-[var(--p-color-fg-muted)]">Nenhuma autorização ativa{state?.cycle ? ` · ${state.cycle.name}` : ""}.</p>}
    <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_240px]">
      <label className="space-y-2 text-sm font-medium text-[var(--p-color-fg)]"><span>Motivo da autorização ou do encerramento</span><textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} rows={3} disabled={blocked} className={field} /></label>
      <label className="space-y-2 text-sm font-medium text-[var(--p-color-fg)]"><span className="flex items-center gap-2"><CalendarClock size={16} />Validade · horário da Bahia</span><input type="datetime-local" value={expires} onChange={event => setExpires(event.target.value)} disabled={blocked} className={field} /><span className="block text-xs text-[var(--p-color-fg-muted)]">{state?.cycle?.chefiaClosesAt ? `Limite do ciclo: ${formatSubmissionDeadline(state.cycle.chefiaClosesAt)}.` : "Dentro do ciclo de análise."}</span></label>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-[var(--semantic-danger)]">{error}</p>}
    {!blocked && pending && <p role="status" className="mt-3 text-sm text-[var(--p-color-fg-muted)]">{pending}</p>}
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <button type="button" onClick={() => void save(false)} disabled={blocked || Boolean(pending)} className={`${button} bg-[var(--semantic-action)] text-[var(--p-color-action-fg)]`}>{busy ? "Registrando…" : permission ? "Atualizar autorização" : dfdId ? "Autorizar correção" : "Liberar fora do prazo"}</button>
      {permission && <button type="button" onClick={() => void save(true)} disabled={blocked || reason.trim().length < 3} className={`${button} border border-[var(--semantic-danger-border)] text-[var(--semantic-danger)]`}>Encerrar autorização</button>}
    </div>
    {disabled && <p className="mt-3 text-sm text-[var(--p-color-fg-muted)]">Salve as alterações pendentes antes de autorizar uma correção.</p>}
    {events.length > 0 && <details className="mt-4 border-t border-[var(--p-color-border-muted)] pt-3"><summary className="cursor-pointer text-sm font-semibold">Histórico das liberações</summary><ol className="mt-3 space-y-3">{events.map(event => <li key={event.id} className="text-sm text-[var(--p-color-fg-muted)]"><p className="font-medium">{event.action === "exception_granted" ? "Liberação concedida" : "Liberação encerrada"} · {formatBahiaDate(event.created_at)}</p><p>{event.actorName} · {event.details?.reason}</p></li>)}</ol></details>}
  </section>;
}
