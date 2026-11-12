"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { canCreateWithSubmissionState, isSubmissionWindowOpen, type SubmissionState } from "./submission-policy";

export function useSubmissionPolicy(dfdId?: string, enabled = true) {
  const [state, setState] = useState<SubmissionState | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const anchor = useRef({ receivedAt: 0, serverAt: 0 });
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/submission-policy${dfdId ? `?dfdId=${encodeURIComponent(dfdId)}` : ""}`, { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível verificar o prazo.");
      if (signal?.aborted) return;
      anchor.current = { receivedAt: performance.now(), serverAt: Date.parse(data.serverNow) };
      setNow(anchor.current.serverAt);
      setState(data); setError("");
    } catch (err) {
      if (signal?.aborted) return;
      setState(null); setError(err instanceof Error ? err.message : "Não foi possível verificar o prazo.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [dfdId]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const load = () => void refresh(controller.signal);
    load();
    const interval = window.setInterval(load, 30_000);
    window.addEventListener("focus", load);
    window.addEventListener("submission-policy-refresh", load);
    const tick = window.setInterval(() => setNow(anchor.current.serverAt + performance.now() - anchor.current.receivedAt), 1000);
    return () => { controller.abort(); window.clearInterval(interval); window.clearInterval(tick); window.removeEventListener("focus", load); window.removeEventListener("submission-policy-refresh", load); };
  }, [refresh, enabled]);
  const open = Boolean(state?.open && state.cycle && isSubmissionWindowOpen(state.cycle.startsAt, state.cycle.closesAt, now));
  const exceptionActive = Boolean(state?.exception && now < Date.parse(state.exception.expires_at));
  const correctionActive = Boolean(state?.correction && now < Date.parse(state.correction.expires_at));
  return { state: enabled ? state : null, error: enabled ? error : "", loading: enabled && loading, open, exceptionActive, correctionActive,
    canCreate: enabled && canCreateWithSubmissionState(state, now),
    canEditDfd: Boolean(state?.canEditDfd && (!state.correction || correctionActive)), refresh,
  };
}
