"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3 } from "@/components/icons/lucide/exports/BarChart3";
import { Building2 } from "@/components/icons/lucide/exports/Building2";
import { CalendarDays } from "@/components/icons/lucide/exports/CalendarDays";
import { CheckCircle2 } from "@/components/icons/lucide/exports/CheckCircle2";
import { CircleDollarSign } from "@/components/icons/lucide/exports/CircleDollarSign";
import { Clock3 } from "@/components/icons/lucide/exports/Clock3";
import { ChevronDown } from "@/components/icons/lucide/exports/ChevronDown";
import { ChevronLeft } from "@/components/icons/lucide/exports/ChevronLeft";
import { ChevronRight } from "@/components/icons/lucide/exports/ChevronRight";
import { ClipboardCheck } from "@/components/icons/lucide/exports/ClipboardCheck";
import { History } from "@/components/icons/lucide/exports/History";
import { Layers } from "@/components/icons/lucide/exports/Layers";
import { ListChecks } from "@/components/icons/lucide/exports/ListChecks";
import { RefreshCw } from "@/components/icons/lucide/exports/RefreshCw";
import { Save } from "@/components/icons/lucide/exports/Save";
import { Search } from "@/components/icons/lucide/exports/Search";
import { SlidersHorizontal } from "@/components/icons/lucide/exports/SlidersHorizontal";
import { Star } from "@/components/icons/lucide/exports/Star";
import { Users } from "@/components/icons/lucide/exports/Users";
import { toast } from "sonner";
import {
  AnalysisSession,
  type AnalysisSessionTransport,
} from "@/lib/analysis-session";
import {
  analysisTotal,
  getReviewBlocker,
  type AnalysisDfd,
  type AnalysisItem,
  type AnalysisWorkspaceData,
} from "@/lib/dfd-analysis";
import {
  queueFromWorkspace,
  summarizeDfd,
  type AnalysisQueueData,
  type AnalysisQueueFilter,
  type AnalysisDfdSummary,
  type AnalysisDetailData,
  type AnalysisQueuePerson,
  type AnalysisGroupProgress,
} from "@/lib/dfd-analysis-queue";
import { QuickItemDrawer } from "./QuickItemDrawer";
import { AnalysisHistory } from "./AnalysisHistory";
import { InlineItemRow } from "./InlineItemRow";
import { s } from "./analysis-styles";
import { canCelebrateSector } from "@/lib/analysis-sector-completion";
import { SectorCelebration, type SectorCelebrationData } from "./SectorCelebration";
import { EvaluationAuthor } from "./SavedItemEvaluations";
import { AnalysisGroupStatus } from "./AnalysisGroupStatus";
import { analysisDisplayItem } from "@/lib/analysis-reference";
export type AnalysisTransport = AnalysisSessionTransport;
const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function RequesterAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [avatarUrl]);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span className={s.avatar}>
      {avatarUrl && !broken ? (
        <img
          src={avatarUrl}
          alt={`Foto de ${name}`}
          onError={() => setBroken(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}

function MiniRequesterAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [avatarUrl]);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span className="aw-user-avatar-mini" aria-hidden="true">
      {avatarUrl && !broken ? (
        <img src={avatarUrl} alt="" onError={() => setBroken(true)} />
      ) : (
        initials || "?"
      )}
    </span>
  );
}
const transport: AnalysisTransport = async (body) => {
  const response = await fetch("/api/dfd/analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({
    ok: false,
    error: "O servidor não respondeu. Tente novamente.",
  }));
  if (!response.ok || !result.ok) {
    const err = new Error(
      `${result.error || "Não foi possível salvar."}${result.requestId ? ` Código: ${result.requestId}` : ""}`,
    );
    Object.assign(err, {
      code: result.code,
      uncertain: response.status >= 500 && !result.recorded,
    });
    throw err;
  }
  return result;
};
type SelectionReview = {
  id: string;
  protocol: string;
  person: string;
  total: number;
  serialized: string;
}[];
export function AnalysisWorkspace({
  initialData,
  send = transport,
}: {
  initialData?: AnalysisWorkspaceData;
  send?: AnalysisTransport;
}) {
  const fixture = useRef(initialData);
  const [queue, setQueue] = useState<AnalysisQueueData | null>(() =>
    initialData ? queueFromWorkspace(initialData) : null,
  );
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState<AnalysisQueueFilter>("all"),
    [all, setAll] = useState(false);
  const [refresh, setRefresh] = useState(0),
    [, rerender] = useState(0);
  const [loading, setLoading] = useState(!initialData),
    [detailLoading, setDetailLoading] = useState(false),
    [error, setError] = useState("");
  const [notice, setNotice] = useState(""),
    [history, setHistory] = useState(false),
    [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [matchItemId, setMatchItemId] = useState<string | undefined>();
  const [showEditor, setShowEditor] = useState(false);
  const [queueView, setQueueView] = useState<"setor" | "solicitante" | "dfd">("setor");
  const [compactItems, setCompactItems] = useState(false);
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(() => new Set());
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(() => new Set());
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(() => new Set());
  const [loadingPersonDfds, setLoadingPersonDfds] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<string[]>([]),
    [batchReview, setBatchReview] = useState<SelectionReview | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnalysisDfd | null>(null),
    [protocol, setProtocol] = useState(""),
    [deleteReason, setDeleteReason] = useState("");
  const deleteAttempt = useRef<Record<string, unknown> | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);
  const [sessions] = useState(() => new Map<string, AnalysisSession>());
  const subscriptions = useRef(new Map<string, () => void>());
  const [activeItems] = useState(() => new Map<string, string>());
  const openSequence = useRef(0);
  const mounted = useRef(false);
  const filterSelectRef = useRef<HTMLSelectElement>(null);
  const [celebration, setCelebration] = useState<SectorCelebrationData | null>(null);
  const completionCohorts = useRef(new Map<string, { name: string; campus: string; dfds: AnalysisDfdSummary[] }>());
  const celebratedSectors = useRef(new Set<string>());
  const closeCelebration = useCallback(() => setCelebration(null), []);
  const reload = () => setRefresh((v) => v + 1);
  const ensureSession = useCallback(
    (dfd: AnalysisDfd, actorId: string) => {
      let session = sessions.get(dfd.id);
      if (!session) {
        session = new AnalysisSession({
          dfd,
          actorId,
          send: (body) => sendRef.current(body),
          onDraftSaved: (draft) => {
            if (fixture.current)
              fixture.current = {
                ...fixture.current,
                dfds: fixture.current.dfds.map((d) =>
                  d.id === dfd.id ? { ...d, draft } : d,
                ),
              };
            if (mounted.current) setRefresh((v) => v + 1);

          },
          onApplied: (result) => {
            if (fixture.current)
              fixture.current = {
                ...fixture.current,
                dfds: fixture.current.dfds.map((d) =>
                  d.id === dfd.id
                    ? {
                        ...d,
                        items: result.items || d.items,
                        revision: result.revision || d.revision,
                        status: result.status || d.status,
                        draft: null,
                      }
                    : d,
                ),
              };
            if (mounted.current) {
              setSelected((v) => v.filter((id) => id !== dfd.id));
              setNotice(
                `${dfd.numero_protocolo}: ${result.autoSubmitted ? "encaminhamento automático à consolidação confirmado" : result.status === "aprovada" ? "homologação confirmada" : result.status === "devolvida" ? "devolução confirmada" : "ajustes registrados"}. Código: ${result.requestId || "confirmado"}`,
              );
              setRefresh((v) => v + 1);
            }
          },
        });
        sessions.set(dfd.id, session);
      }
      return session;
    },
    [sessions],
  );
  const watch = useCallback((session: AnalysisSession) => {
    const id = session.getDfd().id;
    if (!subscriptions.current.has(id))
      subscriptions.current.set(
        id,
        session.subscribe(() => {
          if (mounted.current) rerender((v) => v + 1);
        }),
      );
    session.start();
  }, []);
  const fetchDetail = useCallback(
    async (id: string): Promise<AnalysisDetailData> => {
      if (fixture.current) {
        const dfd = fixture.current.dfds.find((d) => d.id === id);
        if (!dfd) throw new Error("DFD não disponível na fila.");
        return {
          actorId: fixture.current.actorId,
          role: fixture.current.role,
          calendar: fixture.current.calendar,
          dfd,
        };
      }
      const response = await fetch(`/api/dfd/analysis/${id}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Não foi possível carregar a DFD.");
      return result;
    },
    [],
  );
  const openDfd = useCallback(
    async (id: string, matched?: string, force = false) => {
      const seq = ++openSequence.current;
      setDetailLoading(true);
      setError("");
      try {
        let session = sessions.get(id);
        if (!session || force || !session.getSnapshot().dirty) {
          const result = await fetchDetail(id);
          if (seq !== openSequence.current) return;
          session = ensureSession(result.dfd, result.actorId);
          session.replaceDfd(result.dfd);
        }
        if (seq !== openSequence.current) return;
        watch(session);
        setActiveId(id);
        setMatchItemId(matched);
        setShowEditor(true);
        try {
          localStorage.setItem(
            `percata-analysis-position:${queue?.actorId || ""}`,
            JSON.stringify({
              dfdId: id,
              itemId: matched || activeItems.get(id),
            }),
          );
        } catch {}
      } catch (e) {
        if (seq === openSequence.current) setError((e as Error).message);
      } finally {
        if (seq === openSequence.current) setDetailLoading(false);
      }
    },
    [fetchDetail, ensureSession, watch, queue, activeItems, sessions],
  );
  const removalAttempts = useRef(new Map<string, Record<string, unknown>>());
  const requestRemoval = useCallback(
    (dfdId: string, item: AnalysisItem, reason: string) => {
      if (queue?.role === "superadmin") {
        void (async () => {
          setBusy(true); setError("");
          try {
            const detail = await fetchDetail(dfdId);
            if (detail.dfd.items.length === 1) {
              setDeleteTarget(detail.dfd);
              setNotice("Este é o último item. Para excluir a DFD inteira, confira e confirme o protocolo.");
              return;
            }
            const key = `${dfdId}:${item.id}`;
            const body = removalAttempts.current.get(key) || { action: "remove_admin_item", dfdId, itemId: item.id, reason, baseRevision: detail.dfd.revision, requestId: crypto.randomUUID() };
            removalAttempts.current.set(key, body);
            const result = await sendRef.current(body);
            if (!result.ok) throw new Error(result.error || "A retirada não foi confirmada.");
            removalAttempts.current.delete(key);
            sessions.get(dfdId)?.dispose(); sessions.delete(dfdId);
            subscriptions.current.get(dfdId)?.(); subscriptions.current.delete(dfdId);
            try { localStorage.removeItem(`percata-analysis:${detail.actorId}:${dfdId}`); } catch {}
            setNotice(`${detail.dfd.numero_protocolo}: item retirado. As avaliações dos demais itens foram preservadas.`);
            await openDfd(dfdId, undefined, true);
            setRefresh((value) => value + 1);
          } catch (failure) {
            const code = (failure as Error & { code?: string; uncertain?: boolean }).code;
            if (code && !(failure as Error & { uncertain?: boolean }).uncertain) removalAttempts.current.delete(`${dfdId}:${item.id}`);
            setError((failure as Error).message);
          } finally { setBusy(false); }
        })();
        return;
      }
      void openDfd(dfdId, item.id).then(() => {
        sessions.get(dfdId)?.updateItem(item.id, {
          remove: true,
          removalReason: reason,
        });
      });
    },
    [openDfd, sessions, queue?.role, fetchDetail],
  );

  const loadPersonDfds = useCallback(
    async (person: AnalysisQueuePerson) => {
      if (fixture.current) {
        for (const d of person.dfds) {
          const found = fixture.current.dfds.find((f) => f.id === d.id);
          if (found && !sessions.has(d.id)) {
            const s = ensureSession(found, fixture.current.actorId);
            watch(s);
          }
        }
        rerender((v) => v + 1);
        return;
      }

      const missing = person.dfds.filter((d) => !sessions.has(d.id));
      if (missing.length === 0) return;

      setLoadingPersonDfds((prev) => new Set([...prev, person.id]));
      try {
        await Promise.all(
          missing.map(async (d) => {
            try {
              const detail = await fetchDetail(d.id);
              const s = ensureSession(detail.dfd, detail.actorId);
              watch(s);
            } catch (e) {
              setError((e as Error).message || "Não foi possível carregar os itens. Reabra o grupo para tentar novamente.");
            }
          }),
        );
      } finally {
        setLoadingPersonDfds((prev) => {
          const next = new Set(prev);
          next.delete(person.id);
          return next;
        });
        rerender((v) => v + 1);
      }
    },
    [ensureSession, fetchDetail, sessions, watch],
  );

  const togglePerson = useCallback(
    (person: AnalysisQueuePerson) => {
      setExpandedPeople((prev) => {
        const next = new Set(prev);
        if (next.has(person.id)) {
          next.delete(person.id);
        } else {
          next.add(person.id);
          void loadPersonDfds(person);
        }
        return next;
      });
    },
    [loadPersonDfds],
  );

  const toggleSector = useCallback(
    (sectorKey: string, users: { person: AnalysisQueuePerson }[]) => {
      setExpandedSectors((prev) => {
        const next = new Set(prev);
        if (next.has(sectorKey)) {
          next.delete(sectorKey);
        } else {
          next.add(sectorKey);
          users.forEach((u) => void loadPersonDfds(u.person));
        }
        return next;
      });
    },
    [loadPersonDfds],
  );

  const toggleUserInSector = useCallback(
    (userKey: string, person: AnalysisQueuePerson) => {
      setExpandedUsers((prev) => {
        const next = new Set(prev);
        if (next.has(userKey)) {
          next.delete(userKey);
        } else {
          next.add(userKey);
          void loadPersonDfds(person);
        }
        return next;
      });
    },
    [loadPersonDfds],
  );

  useEffect(() => {
    if (fixture.current) {
      for (const d of fixture.current.dfds) {
        if (!sessions.has(d.id)) {
          const s = ensureSession(d, fixture.current.actorId);
          watch(s);
        }
      }
    }
  }, [ensureSession, watch, sessions]);

  const autoExpanded = useRef(false);
  useEffect(() => {
    if (
      !autoExpanded.current &&
      queue?.people &&
      queue.people.length > 0 &&
      expandedPeople.size === 0 &&
      search === ""
    ) {
      autoExpanded.current = true;
      const firstTwo = queue.people.slice(0, 2);
      setExpandedPeople(new Set(firstTwo.map((p) => p.id)));
      firstTwo.forEach((p) => void loadPersonDfds(p));
    }
  }, [queue, loadPersonDfds, search, expandedPeople.size]);

  const getPersonItems = useCallback(
    (person: AnalysisQueuePerson) => {
      const result: {
        item: AnalysisItem;
        dfdSummary: AnalysisDfdSummary;
        session?: AnalysisSession;
      }[] = [];

      for (const d of person.dfds) {
        const session = sessions.get(d.id);
        if (session) {
          const items = session.getSnapshot().working.items.map((item) => analysisDisplayItem(session.getDfd(), item));
          for (const item of items) {
            result.push({ item, dfdSummary: d, session });
          }
        } else if (d.items && d.items.length > 0) {
          for (const item of d.items) {
            result.push({ item, dfdSummary: d, session: undefined });
          }
        }
      }
      return result;
    },
    [sessions],
  );
  useEffect(() => {
    const listeners = subscriptions.current;
    mounted.current = true;
    for (const session of sessions.values()) watch(session);
    const warn = (e: BeforeUnloadEvent) => {
      if ([...sessions.values()].some((x) => x.getSnapshot().dirty)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      mounted.current = false;
      window.removeEventListener("beforeunload", warn);
      for (const off of listeners.values()) off();
      listeners.clear();
    };
  }, [watch, sessions]);
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    const timer = setTimeout(
      async () => {
        setLoading(true);
        try {
          let result: AnalysisQueueData;
          if (fixture.current)
            result = queueFromWorkspace(fixture.current, {
              page,
              search,
              filter,
              all,
            });
          else {
            const params = new URLSearchParams({
              page: String(page),
              search,
              filter,
              all: String(all),
            });
            const response = await fetch(`/api/dfd/analysis/queue?${params}`, {
              cache: "no-store",
              signal: controller.signal,
            });
            result = await response.json();
            if (!response.ok)
              throw new Error(
                (result as unknown as { error: string }).error ||
                  "Não foi possível carregar a fila.",
              );
          }
          if (alive) {
            setQueue(result);
            setError("");
          }
        } catch (e) {
          if (alive && (e as Error).name !== "AbortError")
            setError((e as Error).message);
        } finally {
          if (alive) setLoading(false);
        }
      },
      search ? 250 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, search, filter, all, refresh]);
  const active = sessions.get(activeId);
  const overlay = (d: AnalysisDfdSummary) => {
    const session = sessions.get(d.id);
    if (!session) return d;
    const base = session.getDfd(),
      snap = session.getSnapshot();
    if (d.evaluationProgress && (!snap.dirty || (queue?.role === "superadmin" && base.referenceEvaluation))) return d;
    return {
      ...d,
      ...summarizeDfd(
        {
          ...base,
          draft: {
            revision: base.draft?.revision || 0,
            base_revision: base.revision,
            updated_at: base.draft?.updated_at || "",
            payload: snap.working,
          },
        },
        search,
      ),
      requesterId: d.requesterId,
    };
  };

  const sectorGroups = (() => {
    if (!queue?.people) return [];
    type SectorUser = {
      person: AnalysisQueuePerson;
      dfds: AnalysisDfdSummary[];
      totalValue: number;
      itemCount: number;
      missingFields: number;
    };
    type SectorData = {
      sectorName: string;
      campus: string;
      chefiaName: string;
      chefiaAvatarUrl: string | null;
      dfdCount: number;
      itemCount: number;
      totalValue: number;
      missingFields: number;
      users: SectorUser[];
    };

    const map = new Map<string, SectorData>();

    for (const person of queue.people) {
      for (const d of person.dfds) {
        const sectorName = d.sector || person.sectors[0] || "Setor Geral";
        const campus = d.campus || person.campus || "Campus não informado";
        const key = `${sectorName}___${campus}`;

        if (!map.has(key)) {
          map.set(key, {
            sectorName,
            campus,
            chefiaName: d.chefiaName || "Chefia não identificada",
            chefiaAvatarUrl: d.chefiaAvatarUrl || null,
            dfdCount: 0,
            itemCount: 0,
            totalValue: 0,
            missingFields: 0,
            users: [],
          });
        }

        const sec = map.get(key)!;
        sec.dfdCount += 1;
        sec.itemCount += overlay(d).retainedCount;
        sec.totalValue += overlay(d).proposedTotal;
        sec.missingFields +=
          overlay(d).missingImpact + overlay(d).missingPriority;

        let userEntry = sec.users.find((u) => u.person.id === person.id);
        if (!userEntry) {
          userEntry = {
            person,
            dfds: [],
            totalValue: 0,
            itemCount: 0,
            missingFields: 0,
          };
          sec.users.push(userEntry);
        }
        userEntry.dfds.push(d);
        userEntry.totalValue += overlay(d).proposedTotal;
        userEntry.itemCount += overlay(d).retainedCount;
        userEntry.missingFields +=
          overlay(d).missingImpact + overlay(d).missingPriority;
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.sectorName.localeCompare(b.sectorName, "pt-BR"),
    );
  })();

  useEffect(() => {
    // A filtered or paginated queue cannot prove completion of a whole sector.
    if (!queue || loading || search || filter !== "all" || queue.totalPeople > queue.people.length || page !== 1) return;
    for (const sec of sectorGroups) {
      const key = `${sec.sectorName}___${sec.campus}`;
      if (sec.missingFields > 0 && !celebratedSectors.current.has(key)) {
        completionCohorts.current.set(key, { name: sec.sectorName, campus: sec.campus, dfds: sec.users.flatMap((user) => user.dfds) });
      }
    }
    for (const [key, cohort] of completionCohorts.current) {
      if (celebratedSectors.current.has(key)) continue;
      const progress = cohort.dfds.map((summary) => {
        const session = sessions.get(summary.id);
        const snapshot = session?.getSnapshot();
        const dfd = session?.getDfd();
        const retained = snapshot?.working.items.filter((item) => !item.remove);
        return {
          id: summary.id,
          itemCount: retained?.length ?? summary.retainedCount,
          missingDecisions: retained ? retained.reduce((total, item) => total + Number(!item.criticidade) + Number(!item.moscow_categoria), 0) : summary.missingImpact + summary.missingPriority,
          confirmed: !snapshot || (snapshot.ready && !snapshot.dirty && !snapshot.error && !snapshot.conflict && !snapshot.pendingFormal && !snapshot.busy && !snapshot.saveState.startsWith("Salvando")),
          eligible: ["triagem", "aprovada"].includes(dfd?.status || summary.status),
          changedInSession: Boolean(snapshot && (snapshot.saveState.startsWith("Rascunho salvo") || snapshot.saveState.startsWith("Avaliação concluída") || snapshot.saveState === "Alterações registradas")),
        };
      });
      if (canCelebrateSector(true, progress)) {
        celebratedSectors.current.add(key);
        setCelebration({ key, name: cohort.name, campus: cohort.campus, homologated: cohort.dfds.every((dfd) => (sessions.get(dfd.id)?.getDfd().status || dfd.status) === "aprovada") });
      }
    }
  }, [queue, loading, search, filter, page, sectorGroups, sessions]);

  const autoExpandedSector = useRef(false);
  useEffect(() => {
    if (
      !autoExpandedSector.current &&
      queue?.people &&
      queue.people.length > 0 &&
      expandedSectors.size === 0 &&
      search === ""
    ) {
      if (sectorGroups.length > 0) {
        autoExpandedSector.current = true;
        const firstSec = sectorGroups[0];
        const secKey = `${firstSec.sectorName}___${firstSec.campus}`;
        const firstUser = firstSec.users[0];
        setExpandedSectors(new Set([secKey]));
        setExpandedUsers(
          firstUser ? new Set([`${secKey}___${firstUser.person.id}`]) : new Set(),
        );
        if (firstUser) void loadPersonDfds(firstUser.person);
      }
    }
  }, [queue, sectorGroups, loadPersonDfds, search, expandedSectors.size]);
  const pendingSessions = [...sessions.values()].filter(
    (x) => x.getSnapshot().dirty || x.getSnapshot().error,
  );
  const getSelected = () =>
    selected
      .map((id) => sessions.get(id))
      .filter((x): x is AnalysisSession => Boolean(x));
  const prepareBatch = async () => {
    setBusy(true);
    setError("");
    try {
      const list: SelectionReview = [];
      for (const session of getSelected()) {
        await session.save();
        const fresh = await fetchDetail(session.getDfd().id);
        session.replaceDfd(fresh.dfd);
        const snap = session.getSnapshot();
        if (snap.conflict || snap.pendingFormal)
          throw new Error(
            `${fresh.dfd.numero_protocolo}: resolva a pendência de salvamento antes de continuar.`,
          );
        const blocker = getReviewBlocker(snap.working.items, "approve");
        if (blocker)
          throw new Error(`${fresh.dfd.numero_protocolo}: ${blocker}`);
        list.push({
          id: fresh.dfd.id,
          protocol: fresh.dfd.numero_protocolo,
          person: fresh.dfd.requester,
          total: analysisTotal(snap.working.items),
          serialized: JSON.stringify(snap.working),
        });
      }
      setBatchReview(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const prepareAll = async (sectorIds?: string[]) => {
    setBusy(true);
    setError("");
    try {
      // Save edits first; sending is a separate, explicit confirmation.
      for (const session of sessions.values()) await session.save();
      const ids = new Set<string>(sectorIds);
      let nextPage = 1;
      while (!sectorIds) {
        let data: AnalysisQueueData;
        if (fixture.current) data = queueFromWorkspace(fixture.current, { page: nextPage, search: "", filter: "all", all: false });
        else {
          const response = await fetch(`/api/dfd/analysis/queue?page=${nextPage}&filter=all&all=false`, { cache: "no-store" });
          data = await response.json();
          if (!response.ok) throw new Error("Não foi possível conferir todas as DFDs. Tente novamente.");
        }
        for (const person of data.people) for (const dfd of person.dfds) if (dfd.status === "triagem") ids.add(dfd.id);
        if (nextPage * data.pageSize >= data.totalPeople) break;
        nextPage++;
      }
      const review: SelectionReview = [];
      for (const id of ids) {
        const detail = await fetchDetail(id);
        if (detail.dfd.status !== "triagem") continue;
        const session = ensureSession(detail.dfd, detail.actorId);
        watch(session);
        session.replaceDfd(detail.dfd);
        const snap = session.getSnapshot();
        if (snap.dirty || snap.conflict || snap.pendingFormal || snap.error) throw new Error(`${detail.dfd.numero_protocolo}: confira o salvamento antes de enviar.`);
        if (getReviewBlocker(snap.working.items, "approve")) continue;
        review.push({ id, protocol: detail.dfd.numero_protocolo, person: detail.dfd.requester, total: analysisTotal(snap.working.items), serialized: JSON.stringify(snap.working) });
      }
      if (!review.length) throw new Error("Nenhuma DFD completa para enviar. Preencha o impacto e quando atender de todos os itens da DFD.");
      setSelected(review.map((entry) => entry.id));
      setBatchReview(review);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const readySendAttempts = useRef(new Map<string, string>());
  const sendReady = async (groups: AnalysisGroupProgress[], median = false) => {
    setBusy(true);
    setError("");
    const outcomes: string[] = [];
    try {
      const ids = [...new Set(groups.flatMap((group) => median ? group.dfds.filter((dfd) => dfd.status === "triagem").map((dfd) => dfd.id) : group.readyIds))];
      for (const id of ids) {
        const session = sessions.get(id);
        if (session?.getSnapshot().dirty && !(queue?.role === "superadmin" && session.getDfd().referenceEvaluation)) await session.save();
      }
      if (!ids.length) { setNotice("As avaliações completas são encaminhadas automaticamente. Confira o andamento na caixa azul de cada grupo."); return; }
      for (const id of ids) {
        const requestId = readySendAttempts.current.get(`${median}:${id}`) || crypto.randomUUID();
        readySendAttempts.current.set(`${median}:${id}`, requestId);
        const protocol = groups.flatMap((group) => group.dfds).find((dfd) => dfd.id === id)?.protocol || id;
        try {
          const result = await sendRef.current({ action: median || queue?.role === "superadmin" ? "send_median" : "send_ready", dfdId: id, requestId });
          if (!result.ok) throw new Error(result.error || "O envio não foi confirmado.");
          readySendAttempts.current.delete(`${median}:${id}`);
          sessions.get(id)?.dispose();
          sessions.delete(id);
          subscriptions.current.get(id)?.();
          subscriptions.current.delete(id);
          outcomes.push(`${protocol}: encaminhada à consolidação.`);
        } catch (failure) {
          if ((failure as Error & { code?: string; uncertain?: boolean }).code && !(failure as Error & { uncertain?: boolean }).uncertain) readySendAttempts.current.delete(`${median}:${id}`);
          outcomes.push(`${protocol}: ${(failure as Error).message}`);
          setError("Algumas DFDs precisam de conferência. Veja os resultados do envio.");
        }
      }
      setNotice(outcomes.join("\n"));
      setActiveId("");
      setShowEditor(false);
    } catch (failure) { setError((failure as Error).message); }
    finally { closeCelebration(); setBusy(false); reload(); }
  };
  useEffect(() => {
    if (batchReview) {
      closeCelebration();
      const review = document.getElementById("analysis-send-review");
      review?.focus();
      review?.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, [batchReview, closeCelebration]);
  const runBatch = async () => {
    if (!batchReview?.length) return;
    setBusy(true);
    setError("");
    const outcomes: string[] = [];
    const failed: SelectionReview = [];
    for (const entry of batchReview) {
      const session = sessions.get(entry.id)!;
      try {
        if (JSON.stringify(session.getSnapshot().working) !== entry.serialized)
          throw new Error("O rascunho mudou; revise novamente.");
        await session.perform("approve", Boolean(queue?.calendar?.open));
        outcomes.push(`${entry.protocol}: homologada.`);
      } catch (e) {
        outcomes.push(`${entry.protocol}: ${(e as Error).message}`);
        failed.push(entry);
      }
      setNotice(outcomes.join("\n"));
    }
    setBatchReview(failed.length ? failed : null);
    setSelected(failed.map((entry) => entry.id));
    if (failed.length) setError(`${failed.length} DFD(s) não enviada(s). Confira os resultados abaixo e tente novamente.`);
    else { closeCelebration(); reload(); }
    setBusy(false);
  };
  const deleteDfd = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setError("");
    try {
      deleteAttempt.current ||= {
        action: "delete",
        dfdId: deleteTarget.id,
        requestId: crypto.randomUUID(),
        confirmProtocol: protocol,
        reason: deleteReason || "Exclusão pelo Superadmin",
      };
      setDeletePending(true);
      await sendRef.current(deleteAttempt.current);
      sessions.get(deleteTarget.id)?.dispose();
      sessions.delete(deleteTarget.id);
      subscriptions.current.get(deleteTarget.id)?.();
      subscriptions.current.delete(deleteTarget.id);
      if (fixture.current)
        fixture.current = {
          ...fixture.current,
          dfds: fixture.current.dfds.filter((d) => d.id !== deleteTarget.id),
        };
      setNotice(
        `${deleteTarget.numero_protocolo}: exclusão confirmada. Registro preservado no histórico.`,
      );
      setSelected((v) => v.filter((id) => id !== deleteTarget.id));
      setActiveId("");
      setShowEditor(false);
      setDeleteTarget(null);
      deleteAttempt.current = null;
      setDeletePending(false);
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const savePendingDrafts = async () => {
    const dirty = pendingSessions.filter((session) => session.getSnapshot().dirty);
    if (!dirty.length) {
      toast.info("Não há alterações pendentes para salvar.");
      return;
    }
    setBusy(true);
    setError("");
    let saved = 0;
    try {
      for (const session of dirty) {
        await session.save();
        saved += 1;
      }
      toast.success(`${saved} rascunho${saved === 1 ? "" : "s"} confirmado${saved === 1 ? "" : "s"} no sistema.`);
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      toast.error(`Não foi possível salvar todas as alterações. ${message}`);
    } finally {
      setBusy(false);
    }
  };
  const totalPages = Math.max(1, Math.ceil((queue?.totalPeople || 0) / 25));
  const pendingCount =
    (queue?.totals.missingImpact || 0) + (queue?.totals.missingPriority || 0);
  const classificationTotal = (queue?.totals.retainedItems ?? queue?.totals.items ?? 0) * 2;
  const classifiedCount = Math.max(0, classificationTotal - pendingCount);
  const completionPercent = classificationTotal
    ? Math.round((classifiedCount / classificationTotal) * 100)
    : 0;
  const readyOnPage = queue?.people.flatMap((person) => person.dfds).filter((summary) => {
    const dfd = overlay(summary);
    return dfd.status === "triagem" && dfd.retainedCount > 0 && dfd.missingImpact + dfd.missingPriority === 0;
  }).length || 0;
  return (
    <main className={s.workspace} onKeyDownCapture={(event) => { event.currentTarget.dataset.input = "keyboard"; }} onPointerDownCapture={(event) => { event.currentTarget.dataset.input = "pointer"; }}>
      {celebration && <SectorCelebration key={celebration.key} sector={celebration} onClose={closeCelebration} onContinue={() => {
        if (!celebration.homologated) {
          const group = queue?.groups?.find((entry) => entry.name === celebration.name && entry.campus === celebration.campus);
          if (group) void sendReady([group]);
          else { const cohort = completionCohorts.current.get(celebration.key); void prepareAll(cohort?.dfds.map((dfd) => dfd.id)); }
          return;
        }
        closeCelebration();
        const next = sectorGroups.find((sector) => sector.missingFields > 0);
        if (!next) return;
        const key = `${next.sectorName}___${next.campus}`;
        setQueueView("setor");
        setExpandedSectors((current) => new Set([...current, key]));
        window.requestAnimationFrame(() => {
          const header = document.querySelector<HTMLElement>(`[data-sector-key="${CSS.escape(key)}"] .aw-sector-header`);
          header?.focus();
          header?.scrollIntoView({ block: "center", behavior: "auto" });
        });
      }} />}
      {/* Top Header Card (Mockup Style) */}
      <div className="aw-header-card">
        <div className="aw-header-top-row">
          <div className="aw-header-title-box">
            <div className="aw-header-icon-box">
              <Building2 size={24} />
            </div>
            <div className="aw-header-text">
              <h1>Solicitações em análise</h1>
              <p>
                Avalie o impacto e quando atender cada item. As DFDs completas seguem automaticamente para a consolidação.
              </p>
              <span className="aw-save-guidance">
                <Save size={13} aria-hidden="true" />
                As avaliações são salvas automaticamente. A caixa azul mostra o andamento real do grupo e confirma o encaminhamento.
              </span>
            </div>
          </div>

          <div className="aw-header-actions">
            <button type="button" className={`${s.button} ${s.primary}`} disabled={busy || loading || !!batchReview || !queue?.calendar?.open} onClick={() => queue?.groups ? void sendReady(queue.groups) : void prepareAll()}>
              <ClipboardCheck size={17} aria-hidden="true" /> {busy ? "Conferindo…" : "Finalizar priorização"}
            </button>
            {!queue?.calendar?.open && queue && <p role="status">O período de envio está fechado. Suas avaliações permanecem salvas.</p>}
            {/* View Mode Toggle: POR SOLICITANTE / POR DFD */}
            <div
              className="aw-view-toggle"
              role="group"
              aria-label="Modo de visualização"
            >
              <button
                type="button"
                className={queueView === "setor" ? "aw-toggle-active" : ""}
                aria-pressed={queueView === "setor"}
                onClick={() => setQueueView("setor")}
              >
                POR SETOR / LAB
              </button>
              <button
                type="button"
                className={queueView === "solicitante" ? "aw-toggle-active" : ""}
                aria-pressed={queueView === "solicitante"}
                onClick={() => setQueueView("solicitante")}
              >
                POR SOLICITANTE
              </button>
              <button
                type="button"
                className={queueView === "dfd" ? "aw-toggle-active" : ""}
                aria-pressed={queueView === "dfd"}
                onClick={() => setQueueView("dfd")}
              >
                POR DFD
              </button>
            </div>

            {/* A classificação em lote é uma visão de leitura/decisão compacta.
                A homologação de DFDs selecionadas continua no bloco de revisão
                abaixo, pois exige uma seleção explícita. */}
            <button
              type="button"
              className={`aw-btn-batch ${compactItems ? "aw-btn-batch-active" : ""}`}
              disabled={busy}
              aria-pressed={compactItems}
              onClick={() => setCompactItems((current) => !current)}
              title="Alternar entre avaliação detalhada e classificação compacta por item"
            >
              <SlidersHorizontal size={14} />
              {compactItems ? "Visão compacta ativa" : "Visão compacta"}
            </button>

            <button
              className={s.button}
              disabled={busy || loading}
              onClick={reload}
              title="Atualizar fila"
              aria-label="Atualizar fila"
              aria-busy={loading}
            >
              <RefreshCw size={15} className={loading ? "aw-refresh-spinning" : ""} aria-hidden="true" />
            </button>

            {queue?.role === "superadmin" && (
              <button
                className={s.button}
                onClick={() => setHistory((v) => !v)}
                title="Histórico de operações"
                aria-expanded={history}
              >
                <History size={15} />
                Histórico de operações
              </button>
            )}
          </div>
        </div>

        {queue && (
          <div className="aw-kpi-grid" aria-label="Resumo da fila">
            <div className="aw-kpi-card aw-kpi-blue">
              <span className="aw-kpi-icon"><ListChecks size={18} aria-hidden="true" /></span>
              <span className="aw-kpi-copy"><small>Total de solicitações</small><strong>{queue.totalDfds}</strong></span>
            </div>
            <div className="aw-kpi-card aw-kpi-amber">
              <span className="aw-kpi-icon"><Clock3 size={18} aria-hidden="true" /></span>
              <span className="aw-kpi-copy"><small>Decisões pendentes</small><strong>{pendingCount.toLocaleString("pt-BR")}</strong></span>
            </div>
            <div className="aw-kpi-card aw-kpi-red">
              <span className="aw-kpi-icon"><CircleDollarSign size={18} aria-hidden="true" /></span>
              <span className="aw-kpi-copy"><small>Itens no recorte</small><strong>{queue.totals.items}</strong></span>
            </div>
            <div className="aw-kpi-card aw-kpi-green">
              <span className="aw-kpi-icon"><CircleDollarSign size={18} aria-hidden="true" /></span>
              <span className="aw-kpi-copy"><small>Valor total estimado</small><strong>{money(queue.totals.proposedTotal)}</strong></span>
            </div>
            <div className="aw-kpi-card aw-kpi-progress">
              <span className="aw-kpi-ring" aria-hidden="true"><strong>{completionPercent}%</strong></span>
              <span className="aw-kpi-copy"><small>Decisões preenchidas</small><strong>{classifiedCount} de {classificationTotal || 0}</strong><em>impacto e quando atender</em></span>
            </div>
          </div>
        )}

        <p className="mt-3 text-sm text-[var(--p-color-fg-muted)]">Cada item precisa de duas decisões: impacto se não atendido e quando atender. O total de decisões pendentes pode ser maior que o número de itens.</p>
        {readyOnPage > 0 && !batchReview && <section className={s.banner} aria-label="Avaliações aguardando envio">
          <ClipboardCheck size={20} aria-hidden="true" />
          <div><strong>{readyOnPage} DFD(s) com avaliação preenchida nesta página</strong><p>As avaliações completas seguem automaticamente à consolidação ao salvar. A caixa azul confirma o envio e permite encaminhar avaliações que já estavam prontas.</p></div>
          <button type="button" className={`${s.button} ${s.primary}`} disabled={busy || loading || !queue?.calendar?.open} onClick={() => queue?.groups ? void sendReady(queue.groups) : void prepareAll()}>Finalizar priorização</button>
        </section>}
        {/* Search and Toolbar */}
        <div className="aw-main-toolbar">
          <div className="aw-search-wrap">
            <Search size={16} />
            <input
              type="search"
              maxLength={200}
              placeholder="Buscar por DFD, solicitante, campus ou objeto..."
              aria-label="Buscar na análise por DFD, solicitante, campus ou objeto"
              value={search}
              disabled={busy}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="aw-search-input"
            />
          </div>

          <button
            type="button"
            className="aw-filter-button"
            onClick={() => {
              filterSelectRef.current?.focus();
              (filterSelectRef.current as (HTMLSelectElement & { showPicker?: () => void }) | null)?.showPicker?.();
            }}
            aria-controls="analysis-filter"
          >
            <SlidersHorizontal size={15} />
            Filtros
          </button>

          <select
            id="analysis-filter"
            aria-label="Filtrar a fila de análise"
            ref={filterSelectRef}
            value={filter}
            disabled={busy}
            onChange={(e) => {
              setFilter(e.target.value as AnalysisQueueFilter);
              setPage(1);
            }}
            className="aw-select-queue"
          >
            <option value="all">Toda a fila</option>
            <option value="pending">Base insuficiente</option>
            <option value="changed">Alterados</option>
            <option value="removal">Retiradas</option>
            <option value="starred">Com estrela</option>
            <option value="collective">Coletivas</option>
            <option value="high_value">Alto valor</option>
          </select>
        </div>

        {/* Filter Chips */}
        <div className="aw-filter-chips-row" aria-label="Filtros rápidos">
          <button
            type="button"
            className={`aw-chip aw-chip-all ${filter === "all" ? "aw-chip-active" : ""}`}
            aria-pressed={filter === "all"}
            onClick={() => {
              setFilter("all");
              setPage(1);
            }}
          >
            Todos <span className="aw-chip-badge">{queue?.totalDfds || 0}</span>
          </button>

          <button
            type="button"
            className={`aw-chip aw-chip-starred ${filter === "starred" ? "aw-chip-active" : ""}`}
            aria-pressed={filter === "starred"}
            onClick={() => {
              setFilter("starred");
              setPage(1);
            }}
          >
            <Star
              size={13}
              fill={filter === "starred" ? "#ffffff" : "#f59e0b"}
              color={filter === "starred" ? "#ffffff" : "#f59e0b"}
            />
            Estrela{" "}
            <span className="aw-chip-badge">
              {queue?.totals.starredItems || 0}
            </span>
          </button>

          <button
            type="button"
            className={`aw-chip aw-chip-pending ${filter === "pending" ? "aw-chip-active" : ""}`}
            aria-pressed={filter === "pending"}
            onClick={() => {
              setFilter("pending");
              setPage(1);
            }}
          >
            Base insuficiente{" "}
            <span className="aw-chip-badge">{pendingCount}</span>
          </button>

          <button
            type="button"
            className={`aw-chip aw-chip-collective ${filter === "collective" ? "aw-chip-active" : ""}`}
            aria-pressed={filter === "collective"}
            onClick={() => {
              setFilter("collective");
              setPage(1);
            }}
          >
            Coletivas{" "}
            <span className="aw-chip-badge">
              {queue?.totals.collectiveDfds || 0}
            </span>
          </button>

          <button
            type="button"
            className={`aw-chip aw-chip-highval ${filter === "high_value" ? "aw-chip-active" : ""}`}
            aria-pressed={filter === "high_value"}
            onClick={() => {
              setFilter("high_value");
              setPage(1);
            }}
          >
            Alto valor{" "}
            <span className="aw-chip-badge">
              {queue?.totals.highValueItems || 0}
            </span>
          </button>
        </div>

        {queue?.role === "superadmin" && (
          <label
            className={`${s.muted} ${s.queueAll}`}
            style={{ marginTop: "12px", display: "inline-block" }}
          >
            <input
              type="checkbox"
              checked={all}
              disabled={busy}
              onChange={(e) => {
                setAll(e.target.checked);
                setPage(1);
              }}
            />{" "}
            Todas as DFDs, em qualquer estado
          </label>
        )}
      </div>
      {queue && (
        <section className={s.contextBar} aria-label="Contexto da análise">
          <div>
            <strong>
              {pendingCount
                ? `${pendingCount.toLocaleString("pt-BR")} decisões pendentes`
                : "Fila em dia"}
            </strong>
            <span>
              {queue.totalDfds} DFDs · {queue.totals.items} itens no recorte
              {queue.totals.changedItems > 0
                ? ` · ${queue.totals.changedItems} alterações propostas`
                : ""}
            </span>
          </div>
          <div>
            <CalendarDays size={16} />
            <span>
              {queue.calendar?.open
                ? "Decisão formal liberada"
                : "Rascunhos liberados"}
            </span>
            <span className={s.muted}>
              {queue.calendar
                ? `até ${new Date(new Date(queue.calendar.end).getTime() - 1).toLocaleDateString("pt-BR", { timeZone: "America/Bahia" })}`
                : "sem período configurado"}
            </span>
          </div>
        </section>
      )}
      {error && (
        <div className={s.alert} role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div
          className={s.note}
          role="status"
          style={{ whiteSpace: "pre-wrap" }}
        >
          {notice}
        </div>
      )}
      {pendingSessions.some((session) => { const state = session.getSnapshot(); return state.error || state.conflict || state.pendingFormal; }) && (
        <div className={s.banner} role="status">
          <strong>
            {pendingSessions.length} rascunho(s) com salvamento ou confirmação
            pendente
          </strong>
          <button
            className={`${s.button} ${s.primary}`}
            disabled={busy}
            onClick={() => void savePendingDrafts()}
          >
            <Save size={15} /> Salvar alterações agora
          </button>
          {pendingSessions.map((session) => (
            <button
              key={session.getDfd().id}
              className={s.button}
              onClick={() => void openDfd(session.getDfd().id)}
            >
              {session.getDfd().numero_protocolo}
              {session.getSnapshot().error
                ? " · Conferir falha"
                : " · Em andamento"}
            </button>
          ))}
        </div>
      )}
      {history && <AnalysisHistory />}
      {selected.length > 0 && (
        <section className={s.banner} aria-label="Revisão da seleção de DFDs">
          <ClipboardCheck size={20} />
          <strong>
            {selected.length} DFD(s) selecionada(s), incluindo outras páginas
          </strong>
          <button
            className={s.button}
            disabled={busy || !!batchReview}
            onClick={() => void prepareBatch()}
          >
            Revisar seleção
          </button>
          <button
            className={s.button}
            disabled={busy}
            onClick={() => {
              setSelected([]);
              setBatchReview(null);
            }}
          >
            Limpar seleção de DFDs
          </button>
          {batchReview && (
            <div id="analysis-send-review" tabIndex={-1} aria-label="Finalizar priorização e enviar" style={{ width: "100%", scrollMarginTop: "24px" }}>
              <h2>Finalize a priorização</h2>
              <p>
                Somente as DFDs listadas abaixo serão enviadas e homologadas. As incompletas continuam em edição. Cada uma terá resultado
                próprio.
              </p>
              {batchReview.map((d) => (
                <p key={d.id}>
                  {d.protocol} · {d.person} · {money(d.total)}
                </p>
              ))}
              <button
                className={`${s.button} ${s.primary}`}
                disabled={busy || !queue?.calendar?.open}
                onClick={() => void runBatch()}
              >
                {busy
                  ? "Registrando decisões…"
                  : `Finalizar e enviar ${batchReview.length} DFD(s)`}
              </button>
              <button
                className={s.button}
                disabled={busy}
                onClick={() => setBatchReview(null)}
              >
                Voltar à edição
              </button>
              {!queue?.calendar?.open && (
                <p>Confirmação disponível no período de conclusão.</p>
              )}
            </div>
          )}
        </section>
      )}
      {deleteTarget && (
        <section className={s.alert} aria-label="Confirmar exclusão de DFD">
          <h2>Excluir {deleteTarget.numero_protocolo}</h2>
          <p>
            Estado: {deleteTarget.status} · {deleteTarget.items.length} itens. A
            DFD será excluída; o histórico e uma cópia dos dados serão
            preservados.
          </p>
          <label htmlFor="delete-protocol">
            Digite o protocolo para confirmar
          </label>
          <input
            id="delete-protocol"
            className={s.field}
            disabled={busy || deletePending}
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
          />
          <label htmlFor="delete-reason">Motivo (opcional)</label>
          <input
            id="delete-reason"
            className={s.field}
            disabled={busy || deletePending}
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
          />
          <div className={s.row}>
            <button
              className={`${s.button} ${s.danger}`}
              disabled={
                busy || protocol.trim() !== deleteTarget.numero_protocolo
              }
              onClick={() => void deleteDfd()}
            >
              Confirmar exclusão definitiva
            </button>
            <button
              className={s.button}
              disabled={busy || deletePending}
              onClick={() => setDeleteTarget(null)}
            >
              Cancelar
            </button>
          </div>
          {deletePending && (
            <p>
              Uma tentativa foi enviada. Use a confirmação novamente para
              conferir o mesmo pedido.
            </p>
          )}
        </section>
      )}
      <div className={`${s.layout} ${showEditor ? "" : s.layoutSingle}`}>
        <aside
          className={`${s.queue} ${showEditor ? s.queueHidden : ""}`}
          aria-label="Fila por solicitante"
        >
          {loading && (
            <p className={s.note} role="status">
              Atualizando fila…
            </p>
          )}
          {queueView === "setor" ? (
            <div className="aw-sector-list">
              {(queue?.groups || []).filter((group) => group.total > 0 && group.sent === group.total && (!search || `${group.name} ${group.campus} ${group.dfds.map((dfd) => dfd.protocol).join(" ")}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")))).length > 0 && <details open={Boolean(search)}>
                <summary>Grupos com a etapa da chefia concluída</summary>
                {(queue?.groups || []).filter((group) => group.total > 0 && group.sent === group.total && (!search || `${group.name} ${group.campus} ${group.dfds.map((dfd) => dfd.protocol).join(" ")}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")))).map((group) => <section className="aw-sent-group" key={group.key}>
                  <h3>{group.name}</h3><small>{group.campus} · {group.total} DFD(s)</small>
                  <AnalysisGroupStatus group={group} busy={busy} calendarOpen={Boolean(queue?.calendar?.open)} onSend={(value) => void sendReady([value])} onSendMedian={queue?.role === "superadmin" ? (value) => { if (window.confirm(`Enviar o grupo ${value.name}? ${value.total - value.sent} DFD(s) serão encaminhadas. Avaliações e quantidades já definidas serão preservadas. Nota 10 somente em ${value.pendingItems ?? "itens"} pendente(s).`)) void sendReady([value], true); } : undefined} />
                  <details><summary>Ver DFDs encaminhadas</summary>{group.dfds.map((dfd) => <a key={dfd.id} href={`/dfd/${dfd.id}`} target="_blank" rel="noopener noreferrer">{dfd.protocol}</a>)}</details>
                </section>)}
              </details>}
              {sectorGroups.map((sec) => {
                const secKey = `${sec.sectorName}___${sec.campus}`;
                const groupProgress = queue?.groups?.find((group) => group.dfds.some((dfd) => sec.users.some((user) => user.dfds.some((summary) => summary.id === dfd.id))));
                const isSecExpanded = expandedSectors.has(secKey);
                const isSecReady =
                  groupProgress ? groupProgress.pending === 0 : sec.itemCount > 0 && sec.missingFields === 0;
                const secProgress = groupProgress?.percent ?? (sec.itemCount > 0
                  ? Math.round(
                    ((sec.itemCount * 2 - sec.missingFields) /
                      (sec.itemCount * 2)) *
                      100,
                  )
                  : 0);
                const requesterNames = sec.users
                  .map((user) => user.person.name)
                  .filter(Boolean)
                  .join(", ");

                return (
                  <section
                    key={secKey}
                    className="aw-sector-card"
                    data-sector-key={secKey}
                    data-complete={isSecReady}
                    data-open={isSecExpanded}
                  >
                    <div
                      className="aw-sector-header"
                      onClick={() => toggleSector(secKey, sec.users)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isSecExpanded}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSector(secKey, sec.users);
                        }
                      }}
                    >
                      <div className="aw-sector-identity">
                        <div className="aw-sector-icon-badge" aria-hidden="true">
                          <Building2 size={22} />
                        </div>
                        <div className="aw-sector-name-box">
                          <div className="aw-sector-sub-tag">
                            {sec.campus}
                          </div>
                          <h3>{sec.sectorName}</h3>
                          <div className="aw-sector-chief" aria-label={`Chefia responsável: ${sec.chefiaName}`}>
                            {sec.chefiaAvatarUrl ? (
                              <img src={sec.chefiaAvatarUrl} alt={`Foto de ${sec.chefiaName}`} />
                            ) : (
                              <span aria-hidden="true">{sec.chefiaName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?"}</span>
                            )}
                            <span><small>Chefia responsável</small>{sec.chefiaName}</span>
                          </div>
                          <div className="aw-sector-requesters">
                            <Users size={19} aria-hidden="true" />
                            <span title={requesterNames}>{requesterNames || "Sem solicitantes identificados"}</span>
                          </div>
                          <div className="aw-sector-counters" aria-label="Resumo do setor">
                            <span><ClipboardCheck size={19} aria-hidden="true" /> {sec.dfdCount} {sec.dfdCount === 1 ? "DFD" : "DFDs"}</span>
                            <span><Layers size={19} aria-hidden="true" /> {sec.itemCount} {sec.itemCount === 1 ? "item" : "itens"}</span>
                            <span style={{ display: "none" }}>
                              {sec.users
                                .flatMap((u) =>
                                  u.dfds.map((d) => d.numero_protocolo),
                                )
                                .join(" ")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="aw-sector-meta-right">
                        <div className="aw-fact-col aw-fact-progress-col">
                          <div className="aw-sector-progress-heading">
                            <span className="aw-fact-label"><BarChart3 size={18} aria-hidden="true" /> Progresso do setor</span>
                            <strong>{secProgress}%</strong>
                          </div>
                          <span className="aw-sector-pending-count">
                            {isSecReady ? <><CheckCircle2 size={17} aria-hidden="true" /> 100% classificado</> : <>{groupProgress?.missingFields ?? sec.missingFields} decisões pendentes</>}
                          </span>
                          <div
                            className="aw-progress-mini-bar"
                            aria-hidden="true"
                          >
                            <div
                              className={`aw-progress-mini-fill ${isSecReady ? "aw-progress-mini-complete" : ""}`}
                              style={{
                                width: `${secProgress}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="aw-sector-total-pill">
                          <span className="aw-sector-total-label">
                            Total do Setor
                          </span>
                          <span className="aw-sector-total-val">
                            {money(sec.totalValue)}
                          </span>
                        </div>

                        <div
                          className={`aw-solicitante-chevron ${isSecExpanded ? "aw-chevron-expanded" : ""}`}
                          style={{ color: "#ffffff" }}
                        >
                          <ChevronDown size={22} />
                        </div>
                      </div>
                    </div>

                    {groupProgress && <AnalysisGroupStatus group={groupProgress} busy={busy} calendarOpen={Boolean(queue?.calendar?.open)} onSend={(value) => void sendReady([value])} onSendMedian={queue?.role === "superadmin" ? (value) => { if (window.confirm(`Enviar o grupo ${value.name}? ${value.total - value.sent} DFD(s) serão encaminhadas. Avaliações e quantidades já definidas serão preservadas. Nota 10 somente em ${value.pendingItems ?? "itens"} pendente(s).`)) void sendReady([value], true); } : undefined} />}

                    {isSecExpanded && (
                      <div className="aw-sector-users-list">
                        {sec.users.map((u) => {
                          const userKey = `${secKey}___${u.person.id}`;
                          const isUserExpanded = expandedUsers.has(userKey);
                          const userItems = isUserExpanded
                            ? getPersonItems(u.person).filter((pi) =>
                                u.dfds.some((d) => d.id === pi.dfdSummary.id),
                              )
                            : [];
                          const isUserReady =
                            u.itemCount > 0 && u.missingFields === 0;

                          return (
                            <div
                              key={u.person.id}
                              className="aw-user-subcard"
                            >
                              <div
                                className="aw-user-subheader"
                                onClick={() =>
                                  toggleUserInSector(userKey, u.person)
                                }
                                role="button"
                                tabIndex={0}
                                aria-expanded={isUserExpanded}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    toggleUserInSector(userKey, u.person);
                                  }
                                }}
                              >
                                <div className="aw-user-identity">
                                  <MiniRequesterAvatar
                                    name={u.person.name}
                                    avatarUrl={u.person.avatarUrl}
                                  />
                                  <div className="aw-user-name-box">
                                    <strong>{u.person.name}</strong>
                                    {u.person.email && (
                                      <span>({u.person.email})</span>
                                    )}
                                    <div className="aw-solicitante-protocols">
                                      {u.dfds.map((d) => (
                                        <span
                                          key={d.id}
                                          className="aw-protocol-pill"
                                        >
                                          {d.numero_protocolo}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                <div className="aw-solicitante-facts">
                                  <div className="aw-fact-col">
                                    <span className="aw-fact-label">Itens</span>
                                    <span className="aw-fact-value">
                                      {u.itemCount}{" "}
                                      {u.itemCount === 1 ? "item" : "itens"}
                                    </span>
                                  </div>

                                  <div className="aw-fact-col">
                                    <span className="aw-fact-label">Status</span>
                                    <span className="aw-fact-value">
                                      {isUserReady ? (
                                        <span className="aw-status-complete">
                                          <CheckCircle2
                                            size={12}
                                            aria-hidden="true"
                                          />
                                          Pronto
                                        </span>
                                      ) : (
                                        <span className="aw-status-pending">
                                          {u.missingFields} pendentes
                                        </span>
                                      )}
                                    </span>
                                  </div>

                                  <div className="aw-fact-col">
                                    <span className="aw-fact-label">
                                      Subtotal
                                    </span>
                                    <strong style={{ color: "#0284c7" }}>
                                      {money(u.totalValue)}
                                    </strong>
                                  </div>

                                  <div
                                    className={`aw-solicitante-chevron ${isUserExpanded ? "aw-chevron-expanded" : ""}`}
                                  >
                                    <ChevronDown size={18} />
                                  </div>
                                </div>
                              </div>

                              {isUserExpanded && (
                                <div className="aw-user-items-container">
                                  {userItems.map(
                                    ({
                                      item,
                                      dfdSummary,
                                      session: itemSession,
                                    }) => (
                                      <InlineItemRow
                                        key={item.id}
                                        item={item}
                                        dfdSummary={dfdSummary}
                                        session={itemSession}
                                        initiallyCollapsed={compactItems || Boolean(item.criticidade && item.moscow_categoria)}
                                        compactMode={compactItems}
                              busy={busy || !!batchReview || !!deleteTarget}
                                        onOpenDfd={(dfdId, itemId) =>
                                          void openDfd(dfdId, itemId)
                                        }
                                        adminRemoval={queue?.role === "superadmin"}
                                        onRemoveRequest={requestRemoval}
                                      />
                                    ),
                                  )}
                                  {userItems.length === 0 && (
                                    <div
                                      style={{
                                        padding: "14px 20px",
                                        color: "#64748b",
                                        fontSize: "13px",
                                      }}
                                    >
                                      Carregando itens do solicitante...
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : queueView === "solicitante" ? (
            <div className="aw-solicitante-list">
              {queue?.people.map((person) => {
                const isExpanded = expandedPeople.has(person.id);
                const personItems = isExpanded ? getPersonItems(person) : [];
                const totalValue = person.dfds.reduce(
                  (total, d) => total + overlay(d).proposedTotal,
                  0,
                );
                const totalItemCount = person.dfds.reduce(
                  (n, d) => n + overlay(d).retainedCount,
                  0,
                );
                const isLoadingItems = loadingPersonDfds.has(person.id);
                const missingFields = person.dfds.reduce(
                  (n, d) =>
                    n + overlay(d).missingImpact + overlay(d).missingPriority,
                  0,
                );
                const isPersonReady =
                  totalItemCount > 0 && missingFields === 0;

                return (
                  <article
                    key={person.id}
                    className="aw-solicitante-card"
                    data-open={isExpanded}
                  >
                    <div
                      className="aw-solicitante-header"
                      onClick={() => togglePerson(person)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          togglePerson(person);
                        }
                      }}
                    >
                      <div className="aw-solicitante-identity">
                        <RequesterAvatar
                          name={person.name}
                          avatarUrl={person.avatarUrl}
                        />
                        <div className="aw-solicitante-name-box">
                          <strong>{person.name}</strong>
                          <span>
                            {totalItemCount}{" "}
                            {totalItemCount === 1 ? "item" : "itens"} em{" "}
                            {person.dfds.length}{" "}
                            {person.dfds.length === 1 ? "DFD" : "DFDs"}
                            {person.email
                              ? ` · ${person.email}`
                              : ""}
                          </span>
                          <div className="aw-solicitante-protocols">
                            {person.dfds.map((d) => (
                              <span key={d.id} className="aw-protocol-pill">
                                {d.numero_protocolo}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="aw-solicitante-facts">
                        <div className="aw-fact-col">
                          <span className="aw-fact-icon">
                            <Building2 size={14} />
                          </span>
                          <div>
                            <span className="aw-fact-label">Campus</span>
                            <span className="aw-fact-value">
                              {person.campus || "Campus não informado"}
                            </span>
                          </div>
                        </div>

                        <div className="aw-fact-col">
                          <span className="aw-fact-icon">
                            <Layers size={14} />
                          </span>
                          <div>
                            <span className="aw-fact-label">Setor</span>
                            <span className="aw-fact-value">
                              {person.sectors.length === 1
                                ? person.sectors[0]
                                : `${person.sectors.length} setores`}
                            </span>
                          </div>
                        </div>

                        <div className="aw-fact-col aw-fact-progress-col">
                          <div>
                            <span className="aw-fact-label">Status</span>
                            <span className="aw-fact-value">
                              {isPersonReady ? (
                                <span className="aw-status-complete">
                                  <CheckCircle2 size={13} aria-hidden="true" />
                                  100% classificado
                                </span>
                              ) : (
                                <span className="aw-status-pending">
                                  {missingFields}{" "}
                                  {missingFields === 1 ? "campo" : "campos"} pendentes
                                </span>
                              )}
                            </span>
                          </div>
                          <div
                            className="aw-progress-mini-bar"
                            aria-hidden="true"
                          >
                            <div
                              className={`aw-progress-mini-fill ${isPersonReady ? "aw-progress-mini-complete" : ""}`}
                              style={{
                                width: isPersonReady
                                  ? "100%"
                                  : `${Math.max(12, Math.min(92, Math.round(((totalItemCount * 2 - missingFields) / (totalItemCount * 2 || 1)) * 100)))}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="aw-fact-col aw-fact-total-box">
                          <div>
                            <span className="aw-fact-label">Valor total</span>
                            <span className="aw-fact-total">
                              {money(totalValue)}
                            </span>
                          </div>
                        </div>

                        <div
                          className={`aw-solicitante-chevron ${isExpanded ? "aw-chevron-expanded" : ""}`}
                        >
                          <ChevronDown size={20} />
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="aw-items-list">
                        {isLoadingItems && personItems.length === 0 && (
                          <div
                            style={{
                              padding: "16px 20px",
                              color: "#64748b",
                              fontSize: "13px",
                            }}
                          >
                            Carregando itens...
                          </div>
                        )}
                        {personItems.map(
                          ({ item, dfdSummary, session: itemSession }) => (
                            <InlineItemRow
                              key={item.id}
                              item={item}
                              dfdSummary={dfdSummary}
                              session={itemSession}
                              initiallyCollapsed={compactItems || Boolean(item.criticidade && item.moscow_categoria)}
                              compactMode={compactItems}
                              busy={busy || !!batchReview || !!deleteTarget}
                              onOpenDfd={(dfdId, itemId) =>
                                void openDfd(dfdId, itemId)
                              }
                              adminRemoval={queue?.role === "superadmin"}
                                        onRemoveRequest={requestRemoval}
                            />
                          ),
                        )}
                        {!isLoadingItems && personItems.length === 0 && (
                          <div
                            style={{
                              padding: "16px 20px",
                              color: "#64748b",
                              fontSize: "13px",
                            }}
                          >
                            Nenhum item encontrado nesta solicitação.
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="aw-dfd-list">
              {queue?.people.map((person) =>
                person.dfds.map((summary) => {
                  const d = overlay(summary);
                  const missing = d.missingImpact + d.missingPriority;
                  return (
                    <button
                      className={s.dfdLink}
                      key={d.id}
                      aria-current={d.id === activeId}
                      disabled={busy || !!batchReview || !!deleteTarget}
                      onClick={() => void openDfd(d.id, d.matchedItemIds[0])}
                    >
                      <span className={s.dfdMain}>
                        <span className={s.dfdMeta}>
                          <strong>{d.numero_protocolo}</strong>
                          <span
                            className={`${s.tag} ${missing ? s.warning : s.success}`}
                          >
                            {d.status !== "triagem"
                              ? d.status
                              : missing
                                ? "Base insuficiente"
                                : "Pronto para decisão"}
                          </span>
                        </span>
                        <span className={s.itemName}>
                          {d.objeto_contratacao}
                        </span>
                        {d.evaluators?.map((evaluator) => <span className="aw-evaluation-summary" key={evaluator.actorId}>Avaliação salva por <EvaluationAuthor evaluator={evaluator} /></span>)}
                        <span className={s.muted}>
                          {person.name} · {d.itemCount}{" "}
                          {d.itemCount === 1 ? "item" : "itens"} nesta DFD ·{" "}
                          {money(d.proposedTotal)}
                        </span>
                      </span>
                      <span className={s.dfdActions}>
                        <span
                          className={`${s.tag} ${missing ? s.warning : s.success}`}
                        >
                          {missing
                            ? `${missing} campos pendentes`
                            : "Classificação preenchida"}
                        </span>
                        {d.changedCount > 0 && (
                          <span className={s.tag}>
                            {d.changedCount} alterados
                          </span>
                        )}
                        {d.matchedItemIds.length > 0 && (
                          <span className={s.tag}>
                            {d.matchedItemIds.length} itens encontrados
                          </span>
                        )}
                        <span className={s.evaluate}>
                          Avaliar <ChevronRight size={16} />
                        </span>
                      </span>
                    </button>
                  );
                }),
              )}
            </div>
          )}
          {!loading && !queue?.people.length && (
            <div role="status" className={s.empty}>
              Nenhuma DFD pendente neste recorte. Confira os grupos concluídos ou ajuste a busca e o filtro.
              {(search || filter !== "all") && <div><button type="button" className={s.button} disabled={busy} onClick={() => { setSearch(""); setFilter("all"); setPage(1); }}>Limpar busca e filtro</button></div>}
            </div>
          )}
          <div className={s.footer}>
            <button
              className={s.button}
              aria-label="Página anterior de pessoas"
              disabled={page <= 1 || busy}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span className={s.muted}>
              {page} / {totalPages}
            </span>
            <button
              className={s.button}
              aria-label="Próxima página de pessoas"
              disabled={page >= totalPages || busy}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </aside>
        <div
          className={!showEditor ? s.editorHidden : ""}
          style={{ minWidth: 0 }}
        >
          {detailLoading && (
            <p className={s.note} role="status">
              Carregando DFD…
            </p>
          )}
          {active ? (
            <QuickItemDrawer
              key={activeId}
              session={active}
              itemId={matchItemId || activeItems.get(activeId)}
              calendarOpen={Boolean(queue?.calendar?.open)}
              superadmin={queue?.role === "superadmin"}
              selected={selected.includes(activeId)}
              onSelect={(value) =>
                setSelected((current) =>
                  value
                    ? current.includes(activeId)
                      ? current
                      : [...current, activeId]
                    : current.filter((id) => id !== activeId),
                )
              }
              onRefresh={() => openDfd(activeId, undefined, true)}
              onDelete={() => setDeleteTarget(active.getDfd())}
              onRemoveItem={queue?.role === "superadmin" ? (item, reason) => requestRemoval(activeId, item, reason) : undefined}
              onItemChange={(itemId) => {
                activeItems.set(activeId, itemId);
                setMatchItemId(undefined);
                rerender((value) => value + 1);
              }}
              onClose={() => setShowEditor(false)}
            />
          ) : (
            <div className={`${s.panel} ${s.empty}`}>
              <Users size={32} style={{ margin: "0 auto 16px" }} />
              <h2>Selecione uma DFD na fila</h2>
              <p>Os itens e os controles de análise aparecem aqui.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}





