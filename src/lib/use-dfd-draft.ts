"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearDfdDraftAction,
  loadDfdDraftAction,
  saveDfdDraftAction,
  type DfdDraftPayload,
  type DfdDraftSnapshot,
} from "@/app/actions/dfdDraftActions";

/**
 * Hook de rascunho do wizard DFD com autosave debounced.
 *
 * Comportamento:
 *   - `loading`: true até primeira tentativa de carregar do servidor.
 *   - `draft`: snapshot carregado (ou null se não havia ou é incompatível).
 *   - `status`: estado do último save ("idle" | "saving" | "saved" | "error").
 *   - `save(payload, step)`: agenda save com debounce de 1500ms; chamadas
 *     subsequentes resetam o timer.
 *   - `saveImmediate(...)`: força save sem debounce (útil em onBlur de campo
 *     pesado, ou antes de navegação).
 *   - `clear()`: apaga o rascunho server-side e zera estado local.
 *   - `flush()`: se houver save pendente, executa imediatamente. Use no
 *     evento `beforeunload` para garantir gravação.
 *
 * Estratégia anti-thrash: payload é serializado e comparado por hash
 * curto (FNV-1a 32-bit) — saves redundantes (mesmo payload) são suprimidos.
 */

type SaveStatus = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 1500;

function hashPayload(payload: DfdDraftPayload): number {
  // FNV-1a 32-bit. Suficiente para detectar mudança.
  const str = JSON.stringify(payload);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function useDfdDraft() {
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DfdDraftSnapshot | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastError, setLastError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{
    payload: DfdDraftPayload;
    step: string | null;
  } | null>(null);
  const lastHashRef = useRef<number | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  // Carrega ao montar.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await loadDfdDraftAction();
        if (!cancelled) setDraft(snap);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const performSave = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;

    const hash = hashPayload(pending.payload);
    if (lastHashRef.current === hash) {
      // Nada mudou — não bate no servidor.
      setStatus("saved");
      return;
    }

    setStatus("saving");
    setLastError(null);
    const inFlight = saveDfdDraftAction({
      payload: pending.payload,
      currentStep: pending.step,
    })
      .then((res) => {
        if (res.ok) {
          lastHashRef.current = hash;
          setStatus("saved");
        } else {
          setStatus("error");
          setLastError(res.error || "Falha ao salvar rascunho.");
        }
      })
      .catch((err) => {
        setStatus("error");
        setLastError(err?.message || "Falha ao salvar rascunho.");
      });
    inFlightRef.current = inFlight;
    await inFlight;
    if (inFlightRef.current === inFlight) inFlightRef.current = null;
  }, []);

  const save = useCallback(
    (payload: DfdDraftPayload, step?: string | null) => {
      pendingRef.current = { payload, step: step ?? null };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void performSave();
      }, DEBOUNCE_MS);
    },
    [performSave],
  );

  const saveImmediate = useCallback(
    async (payload: DfdDraftPayload, step?: string | null) => {
      pendingRef.current = { payload, step: step ?? null };
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      await performSave();
    },
    [performSave],
  );

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current) await performSave();
    if (inFlightRef.current) await inFlightRef.current;
  }, [performSave]);

  const clear = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    lastHashRef.current = null;
    await clearDfdDraftAction();
    setDraft(null);
    setStatus("idle");
  }, []);

  // beforeunload: tenta flushar (best effort — browsers cortam após ~1s).
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (pendingRef.current || inFlightRef.current) {
        void flush();
        // Mostra "tem certeza?" para o usuário, dando tempo do save terminar.
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [flush]);

  return {
    loading,
    draft,
    status,
    lastError,
    save,
    saveImmediate,
    flush,
    clear,
  } as const;
}
