"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearDfdDraftAction,
  loadDfdDraftAction,
  saveDfdDraftAction,
} from "@/app/actions/dfdDraftActions";
import {
  readLocalJson,
  removeLocalJson,
  writeLocalJson,
} from "@/lib/browser-storage";
import {
  DFD_DRAFT_SCHEMA_VERSION,
  type DfdDraftPayload,
  type DfdDraftSnapshot,
} from "@/lib/dfd-draft-schema";

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
type DraftSaveLocation = "server" | "local";
type DraftSaveResult = { ok: true; location: DraftSaveLocation } | { ok: false };

const DEBOUNCE_MS = 1500;
const LOCAL_DRAFT_KEY = "percata:dfd-draft:v1";

function isMissingDraftTableError(error: unknown) {
  const message = String((error as any)?.message || error || "").toLowerCase();
  return message.includes("dfd_drafts") && message.includes("schema cache");
}

function isExpiredSnapshot(snapshot: DfdDraftSnapshot | null) {
  if (!snapshot) return true;
  return snapshot.expires_at ? new Date(snapshot.expires_at).getTime() < Date.now() : false;
}

function buildLocalSnapshot(payload: DfdDraftPayload, step: string | null): DfdDraftSnapshot {
  const now = new Date();
  return {
    payload,
    schema_version: DFD_DRAFT_SCHEMA_VERSION,
    current_step: step,
    updated_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

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
  const [location, setLocation] = useState<DraftSaveLocation | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastError, setLastError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{
    payload: DfdDraftPayload;
    step: string | null;
  } | null>(null);
  const lastHashRef = useRef<number | null>(null);
  const inFlightRef = useRef<Promise<DraftSaveResult> | null>(null);
  const lastSaveLocationRef = useRef<DraftSaveLocation>("server");

  // Carrega ao montar.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await loadDfdDraftAction();
        if (cancelled) return;
        if (snap) {
          setDraft(snap);
          setLocation("server");
          writeLocalJson(LOCAL_DRAFT_KEY, snap);
          lastHashRef.current = hashPayload(snap.payload);
          lastSaveLocationRef.current = "server";
          return;
        }
        const localSnap = readLocalJson<DfdDraftSnapshot>(LOCAL_DRAFT_KEY);
        if (localSnap && !isExpiredSnapshot(localSnap)) {
          setDraft(localSnap);
          setLocation("local");
          lastHashRef.current = hashPayload(localSnap.payload);
          lastSaveLocationRef.current = "local";
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const performSave = useCallback(async (): Promise<DraftSaveResult> => {
    const pending = pendingRef.current;
    if (!pending) return { ok: true, location: lastSaveLocationRef.current };
    pendingRef.current = null;

    const hash = hashPayload(pending.payload);
    if (lastHashRef.current === hash) {
      // Nada mudou — não bate no servidor.
      setStatus("saved");
      return { ok: true, location: lastSaveLocationRef.current };
    }

    setStatus("saving");
    setLastError(null);
    const inFlight: Promise<DraftSaveResult> = saveDfdDraftAction({
      payload: pending.payload,
      currentStep: pending.step,
    })
      .then((res): DraftSaveResult => {
        if (res.ok) {
          lastHashRef.current = hash;
          writeLocalJson(LOCAL_DRAFT_KEY, buildLocalSnapshot(pending.payload, pending.step));
          setStatus("saved");
          lastSaveLocationRef.current = "server";
          setLocation("server");
          return { ok: true, location: "server" };
        } else {
          if (isMissingDraftTableError(res.error)) {
            lastHashRef.current = hash;
            writeLocalJson(LOCAL_DRAFT_KEY, buildLocalSnapshot(pending.payload, pending.step));
            setStatus("saved");
            setLastError(null);
            lastSaveLocationRef.current = "local";
            setLocation("local");
            return { ok: true, location: "local" };
          }
          setStatus("error");
          setLastError(res.error || "Falha ao salvar rascunho.");
          return { ok: false };
        }
      })
      .catch((err): DraftSaveResult => {
        setStatus("error");
        setLastError(err?.message || "Falha ao salvar rascunho.");
        return { ok: false };
      });
    inFlightRef.current = inFlight;
    const saved = await inFlight;
    if (inFlightRef.current === inFlight) inFlightRef.current = null;
    return saved;
  }, []);

  const save = useCallback(
    (payload: DfdDraftPayload, step?: string | null) => {
      setStatus("saving");
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
      return performSave();
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
    if (location !== "local") {
      const result = await clearDfdDraftAction();
      if (!result.ok) {
        setStatus("error");
        setLastError(result.error || "Não foi possível descartar o rascunho no PERCATA.");
        return false;
      }
    }
    lastHashRef.current = null;
    removeLocalJson(LOCAL_DRAFT_KEY);
    setDraft(null);
    setLocation(null);
    setStatus("idle");
    setLastError(null);
    return true;
  }, [location]);

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
    location,
    status,
    lastError,
    save,
    saveImmediate,
    flush,
    clear,
  } as const;
}
