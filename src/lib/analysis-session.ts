import {
  getReviewBlocker,
  type AnalysisDfd,
  type AnalysisItem,
} from "./dfd-analysis";

export type AnalysisWorking = { items: AnalysisItem[]; reason: string };
export type AnalysisOperationResult = {
  ok: boolean;
  error?: string;
  code?: string;
  requestId?: string;
  draft?: AnalysisDfd["draft"];
  revision?: string;
  items?: AnalysisItem[];
  total?: number;
  status?: string;
  autoSubmitted?: boolean;
};
export type AnalysisSessionTransport = (
  body: Record<string, unknown>,
) => Promise<AnalysisOperationResult>;
type Action = "apply" | "approve" | "return";
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Attempt = { body: Record<string, unknown>; serialized: string };
export type AnalysisSessionSnapshot = {
  working: AnalysisWorking;
  saveState: string;
  error: string;
  conflict: boolean;
  pendingFormal: boolean;
  busy: boolean;
  ready: boolean;
  compared: boolean;
  dirty: boolean;
};
type Options = {
  dfd: AnalysisDfd;
  actorId: string;
  send: AnalysisSessionTransport;
  storage?: StorageLike;
  onApplied?: (result: AnalysisOperationResult) => void;
  onDraftSaved?: (draft: NonNullable<AnalysisDfd["draft"]>) => void;
  debounceMs?: number;
};

/** Owned by the workspace, never by the currently visible editor. */
export class AnalysisSession {
  private dfd: AnalysisDfd;
  private snapshot: AnalysisSessionSnapshot;
  private saved: string;
  private baseRevision: string;
  private draftRevision: number;
  private attempt: Attempt | null = null;
  private formal: { action: Action; body: Record<string, unknown> } | null =
    null;
  private flight: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private storage?: StorageLike;
  private disposed = false;
  private readonly key: string;

  constructor(private options: Options) {
    this.dfd = options.dfd;
    this.key = `percata-analysis:${options.actorId}:${this.dfd.id}`;
    this.storage = options.storage;
    const working = this.initial(this.dfd);
    this.saved = JSON.stringify(working);
    this.baseRevision = this.dfd.draft?.base_revision || this.dfd.revision;
    this.draftRevision = this.dfd.draft?.revision || 0;
    this.snapshot = {
      working,
      saveState: this.dfd.draft
        ? "Rascunho salvo"
        : "Nenhuma alteração pendente",
      error: "",
      conflict: this.baseRevision !== this.dfd.revision,
      pendingFormal: false,
      busy: false,
      ready: false,
      compared: false,
      dirty: false,
    };
  }
  private initial(dfd: AnalysisDfd): AnalysisWorking {
    return {
      items: dfd.draft?.payload.items || dfd.items,
      reason: dfd.draft?.payload.reason || "",
    };
  }
  getSnapshot = () => this.snapshot;
  getDfd = () => this.dfd;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(patch: Partial<AnalysisSessionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.snapshot.dirty =
      !!this.attempt ||
      !!this.formal ||
      JSON.stringify(this.snapshot.working) !== this.saved;
    this.listeners.forEach((listener) => listener());
  }
  setError = (error: string) => this.emit({ error });
  setCompared = (compared: boolean) => this.emit({ compared });
  start = () => {
    if (this.snapshot.ready) return;
    this.disposed = false;
    try {
      this.storage ||=
        typeof window !== "undefined" ? window.localStorage : undefined;
      const decision = this.storage?.getItem(`${this.key}:decision`);
      if (decision) {
        const parsed = JSON.parse(decision);
        if (
          !["apply", "approve", "return"].includes(parsed.action) ||
          parsed.body?.dfdId !== this.dfd.id
        )
          throw new Error("Invalid decision backup");
        this.formal = parsed;
      }
      const raw = this.storage?.getItem(this.key);
      if (raw) {
        const pending = JSON.parse(raw);
        if (
          !Array.isArray(pending.items) ||
          typeof pending.baseRevision !== "string" ||
          !Number.isInteger(pending.draftRevision)
        )
          throw new Error("Invalid draft backup");
        this.baseRevision = pending.baseRevision;
        this.draftRevision = pending.draftRevision;
        this.attempt = pending.attempt || null;
        this.emit({
          working: { items: pending.items, reason: pending.reason || "" },
          conflict:
            this.baseRevision !== this.dfd.revision ||
            (this.draftRevision < (this.dfd.draft?.revision || 0) &&
              !this.attempt),
          saveState: "Alterações recuperadas deste navegador",
        });
      }
    } catch {
      this.emit({
        error:
          "Não foi possível recuperar a cópia local. O rascunho salvo no sistema continua disponível.",
      });
    }
    this.emit({ ready: true, pendingFormal: !!this.formal });
    this.schedule();
  };
  private backup() {
    try {
      this.storage?.setItem(
        this.key,
        JSON.stringify({
          ...this.snapshot.working,
          baseRevision: this.baseRevision,
          draftRevision: this.draftRevision,
          attempt: this.attempt,
        }),
      );
    } catch {
      this.emit({
        error:
          "Este navegador não conseguiu guardar a cópia local. Mantenha a página aberta até aparecer Rascunho salvo.",
      });
    }
  }
  private interacting = false;
  beginInteraction = () => { this.interacting = true; this.clearTimer(); };
  endInteraction = () => { this.interacting = false; this.schedule(); };
  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  private schedule() {
    this.clearTimer();
    const s = this.snapshot;
    if (
      this.disposed ||
      this.interacting ||
      !s.ready ||
      !s.dirty ||
      s.conflict ||
      s.pendingFormal ||
      s.busy ||
      s.error ||
      this.dfd.status !== "triagem"
    )
      return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.save().catch(() => {});
    }, this.options.debounceMs ?? 1000);
  }
  edit = (working: AnalysisWorking) => {
    if (
      this.snapshot.busy ||
      this.snapshot.pendingFormal ||
      this.snapshot.conflict ||
      !this.snapshot.ready ||
      this.dfd.status !== "triagem"
    )
      return;
    this.emit({ working, saveState: "Alterações ainda não salvas", error: "" });
    this.backup();
    this.schedule();
  };
  updateItem = (id: string, patch: Partial<AnalysisItem>) =>
    this.edit({
      ...this.snapshot.working,
      items: this.snapshot.working.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  save = (automaticForwarding = true): Promise<void> => {
    if (this.flight) return this.flight;
    this.clearTimer();
    if (this.snapshot.conflict || this.dfd.status !== "triagem")
      return Promise.reject(
        new Error("Compare o rascunho com a DFD atual antes de salvar."),
      );
    const task = async () => {
      while (
        this.attempt ||
        JSON.stringify(this.snapshot.working) !== this.saved
      ) {
        if (!this.attempt) {
          if (
            this.snapshot.working.items.some(
              (i) =>
                !i.remove &&
                (!Number.isInteger(i.quantidade) || i.quantidade < 1),
            )
          ) {
            this.emit({
              error:
                "Informe uma quantidade inteira maior que zero em cada item.",
              saveState: "Alterações ainda não salvas",
            });
            throw new Error(this.snapshot.error);
          }
          this.attempt = {
            serialized: JSON.stringify(this.snapshot.working),
            body: {
              action: "save_draft",
              dfdId: this.dfd.id,
              requestId: crypto.randomUUID(),
              baseRevision: this.baseRevision,
              draftRevision: this.draftRevision,
              automaticForwarding,
              ...this.snapshot.working,
            },
          };
        }
        this.backup();
        this.emit({ saveState: "Salvando rascunho…" });
        try {
          const result = await this.options.send(this.attempt.body);
          if (!result.ok)
            throw new Error(
              result.error || "O servidor não confirmou o rascunho.",
            );
          if (result.autoSubmitted && result.status === "aprovada") {
            this.attempt = null;
            this.formal = null;
            this.storage?.removeItem(this.key);
            this.storage?.removeItem(`${this.key}:decision`);
            this.dfd = { ...this.dfd, status: "aprovada", revision: result.revision || this.dfd.revision, items: result.items || this.snapshot.working.items.filter((item) => !item.remove), valor_total_estimado: result.total ?? this.dfd.valor_total_estimado, draft: null, evaluations: [] };
            this.baseRevision = this.dfd.revision;
            this.draftRevision = 0;
            const working = this.initial(this.dfd);
            this.saved = JSON.stringify(working);
            this.emit({ working, pendingFormal: false, conflict: false, error: "", saveState: "Avaliação concluída — encaminhada à consolidação" });
            this.options.onApplied?.(result);
            return;
          }
          if (!result.draft)
            throw new Error("O servidor não confirmou o rascunho.");
          this.draftRevision = result.draft.revision;
          this.saved = this.attempt.serialized;
          this.attempt = null;
          this.dfd = { ...this.dfd, draft: result.draft };
          if (JSON.stringify(this.snapshot.working) === this.saved)
            this.storage?.removeItem(this.key);
          else this.backup();
          this.emit({
            saveState: `Rascunho salvo às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
            error: "",
          });
          this.options.onDraftSaved?.(result.draft);
        } catch (e) {
          const err = e as Error & { code?: string; uncertain?: boolean };
          if (err.code && !err.uncertain) this.attempt = null;
          this.backup();
          this.emit({
            conflict:
              this.snapshot.conflict ||
              err.code === "DRAFT_CONFLICT" ||
              err.code === "REVISION_CONFLICT",
            saveState:
              "Não salvo no sistema — cópia preservada neste navegador",
            error: err.message,
          });
          throw err;
        }
      }
    };
    this.flight = task().finally(() => {
      this.flight = null;
    });
    return this.flight;
  };
  perform = async (action: Action, calendarOpen: boolean) => {
    if (this.snapshot.busy) throw new Error("Aguarde a operação em andamento.");
    if (!this.formal && !calendarOpen)
      throw new Error(
        "O período de conclusão da Análise da Chefia está fechado. O rascunho pode ser salvo.",
      );
    const returnReason = [
      this.snapshot.working.reason.trim(),
      ...this.snapshot.working.items
        .filter((i) => i.correctionNote?.trim())
        .map(
          (i) =>
            `${i.descricao} [${i.codigo_tce || i.id}]: ${i.correctionNote?.trim()}`,
        ),
    ]
      .filter(Boolean)
      .join("\n");
    const blocker =
      action === "return"
        ? returnReason.length < 3
          ? "Informe o motivo da devolução."
          : null
        : getReviewBlocker(this.snapshot.working.items, action);
    if (!this.formal && blocker) throw new Error(blocker);
    this.clearTimer();
    this.emit({ busy: true });
    try {
      if (!this.formal) {
        await this.save(action === "approve");
        if (this.dfd.status === "aprovada") {
          if (action === "approve") return;
          throw new Error("A avaliação completa já foi encaminhada à consolidação. Atualize a fila.");
        }
        this.formal = {
          action,
          body: {
            action,
            dfdId: this.dfd.id,
            requestId: crypto.randomUUID(),
            baseRevision: this.baseRevision,
            ...this.snapshot.working,
            ...(action === "return" ? { reason: returnReason } : {}),
          },
        };
        this.storage?.setItem(
          `${this.key}:decision`,
          JSON.stringify(this.formal),
        );
      }
      this.emit({ pendingFormal: true });
      const result = await this.options.send(this.formal.body);
      if (!result.ok)
        throw new Error(result.error || "O servidor não confirmou a decisão.");
      this.storage?.removeItem(this.key);
      this.storage?.removeItem(`${this.key}:decision`);
      this.formal = null;
      this.attempt = null;
      this.dfd = {
        ...this.dfd,
        revision: result.revision || this.dfd.revision,
        items: result.items || this.dfd.items,
        status: result.status || this.dfd.status,
        valor_total_estimado: result.total ?? this.dfd.valor_total_estimado,
        draft: null,
      };
      this.baseRevision = this.dfd.revision;
      this.draftRevision = 0;
      const working = this.initial(this.dfd);
      this.saved = JSON.stringify(working);
      this.emit({
        working,
        pendingFormal: false,
        conflict: false,
        compared: false,
        error: "",
        saveState: "Alterações registradas",
      });
      this.options.onApplied?.(result);
    } catch (e) {
      const err = e as Error & { code?: string; uncertain?: boolean };
      if (err.code && !err.uncertain) {
        this.formal = null;
        this.storage?.removeItem(`${this.key}:decision`);
      }
      this.emit({
        pendingFormal: !!this.formal,
        error: err.message,
        conflict:
          this.snapshot.conflict ||
          err.code === "DRAFT_CONFLICT" ||
          err.code === "REVISION_CONFLICT",
      });
      throw err;
    } finally {
      this.emit({ busy: false });
    }
  };
  retry = () => {
    this.emit({ error: "" });
    return this.formal ? this.perform(this.formal.action, false) : this.save();
  };
  reapply = () => {
    if (
      !this.snapshot.compared ||
      this.snapshot.pendingFormal ||
      this.snapshot.busy
    )
      return;
    const items = this.dfd.items.map(
      (original) =>
        this.snapshot.working.items.find((item) => item.id === original.id) ||
        original,
    );
    this.baseRevision = this.dfd.revision;
    this.draftRevision = this.dfd.draft?.revision || 0;
    this.attempt = null;
    this.emit({ conflict: false, compared: false, error: "" });
    this.edit({ ...this.snapshot.working, items });
  };
  replaceDfd = (dfd: AnalysisDfd) => {
    if (dfd.id !== this.dfd.id)
      throw new Error("A sessão pertence a outra DFD.");
    if (dfd === this.dfd) return;
    const revisionChanged =
      dfd.revision !== this.dfd.revision ||
      (dfd.draft?.revision || 0) !== (this.dfd.draft?.revision || 0);
    this.dfd = dfd;
    if (!revisionChanged) return;
    if (this.snapshot.dirty || this.flight || this.snapshot.busy) {
      this.clearTimer();
      this.emit({ conflict: true, compared: false });
      return;
    }
    const working = this.initial(dfd);
    this.saved = JSON.stringify(working);
    this.baseRevision = dfd.draft?.base_revision || dfd.revision;
    this.draftRevision = dfd.draft?.revision || 0;
    this.emit({
      working,
      conflict: this.baseRevision !== dfd.revision,
      compared: false,
    });
  };
  dispose = () => {
    this.disposed = true;
    this.clearTimer();
    this.listeners.clear();
  };
}
