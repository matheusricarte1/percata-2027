"use client";
import { useSubmissionPolicy } from "@/lib/use-submission-policy";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus } from "@/components/icons/phosphor/exports/Plus";
import { MagnifyingGlass } from "@/components/icons/phosphor/exports/MagnifyingGlass";
import { Files } from "@/components/icons/phosphor/exports/Files";
import { CheckCircle } from "@/components/icons/phosphor/exports/CheckCircle";
import { CaretRight } from "@/components/icons/phosphor/exports/CaretRight";
import { Buildings } from "@/components/icons/phosphor/exports/Buildings";
import { CurrencyDollar } from "@/components/icons/phosphor/exports/CurrencyDollar";
import { Archive } from "@/components/icons/phosphor/exports/Archive";
import { ArrowSquareOut } from "@/components/icons/phosphor/exports/ArrowSquareOut";
import { ClipboardText } from "@/components/icons/phosphor/exports/ClipboardText";
import { FunnelSimple } from "@/components/icons/phosphor/exports/FunnelSimple";
import { ChartLineUp } from "@/components/icons/phosphor/exports/ChartLineUp";
import { Package } from "@/components/icons/phosphor/exports/Package";
import { PaperPlaneTilt } from "@/components/icons/phosphor/exports/PaperPlaneTilt";
import { CircleNotch } from "@/components/icons/phosphor/exports/CircleNotch";
import { DotsThree } from "@/components/icons/phosphor/exports/DotsThree";
import { CaretDown } from "@/components/icons/phosphor/exports/CaretDown";
import { CaretLeft } from "@/components/icons/phosphor/exports/CaretLeft";
import { FloppyDisk } from "@/components/icons/phosphor/exports/FloppyDisk";
import { Trash } from "@/components/icons/phosphor/exports/Trash";
import Link from "next/link";
import { getSafeUser, supabase } from "@/lib/supabase";
import { DfdCardSkeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { normalizeRole, type UserRole } from "@/lib/access";
import { DFD_PROCESS_STEPS, getDfdProcessStage } from "@/lib/dfd-process-guide";
import { DfdSubmissionAnimation } from "@/components/feedback/DfdSubmissionAnimation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { withLegacyHistoryViewFallback } from "@/lib/legacy-history";
import { useDfdDraft } from "@/lib/use-dfd-draft";
import { restoreDfdDraftCartItems } from "@/lib/dfd-draft-cart";
import {
  OperationalAccordion,
  OperationalChip,
  OperationalEmptyState,
  OperationalKpiCard,
  OperationalStepper,
  OperationalTimeline,
  SkeuoDocumentCard,
  SkeuoPaperStack,
  SkeuoProgressRail,
} from "@/components/ui/operational";

type DfdStatus =
  | "rascunho"
  | "triagem"
  | "aprovada"
  | "devolvida"
  | "pactuando"
  | "concluida";

type DfdRow = {
  id: string;
  numero_protocolo?: string | null;
  status: DfdStatus;
  created_at: string;
  campus_id?: string | null;
  campus?: string | null;
  unidade_id?: string | null;
  tipo_unidade?: "departamento" | "laboratorio" | null;
  objeto_contratacao?: string | null;
  valor_total_estimado?: number | null;
};

type DraftActionModalState =
  | { mode: "review"; dfd: DfdRow }
  | { mode: "submit"; dfd: DfdRow }
  | null;

type LegacyDemandSummary = {
  legacy_year: number;
  demand_code: string;
  campus: string | null;
  status: string | null;
  object: string | null;
  total_estimated: number | null;
  items_count: number | null;
};

type StatusVisual = {
  label: string;
  badgeClassName: string;
  iconClassName: string;
  borderClassName: string;
};

const FILTERS = ["Todas", "Rascunhos", "Em Análise", "Concluídas", "Legadas"] as const;
type FilterOption = (typeof FILTERS)[number];
type SortOption = "recentes" | "antigas" | "maior_valor" | "menor_valor";
const PAGE_SIZE = 8;

const STATUS_VISUALS: Record<DfdStatus, StatusVisual> = {
  rascunho: {
    label: "Rascunho",
    badgeClassName: "bg-[var(--p-color-surface-subtle)] text-[var(--p-color-fg-muted)]",
    iconClassName: "bg-[var(--p-color-surface-subtle)] text-[var(--p-color-fg-muted)]",
    borderClassName: "bg-[var(--p-color-border-strong)]",
  },
  triagem: {
    label: "Em análise",
    badgeClassName: "bg-[var(--p-color-info-border)] text-[var(--p-color-collab)]",
    iconClassName: "bg-[var(--p-color-info-border)] text-[var(--p-color-collab)]",
    borderClassName: "bg-[var(--p-color-collab)]",
  },
  aprovada: {
    label: "Homologada",
    badgeClassName: "bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]",
    iconClassName: "bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]",
    borderClassName: "bg-[var(--p-color-success)]",
  },
  devolvida: {
    label: "Devolvida",
    badgeClassName: "bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]",
    iconClassName: "bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]",
    borderClassName: "bg-[var(--p-color-warning)]",
  },
  pactuando: {
    label: "Pactuação",
    badgeClassName: "bg-[var(--p-color-surface-muted)] text-[var(--p-color-brand-400)]",
    iconClassName: "bg-[var(--p-color-surface-muted)] text-[var(--p-color-brand-400)]",
    borderClassName: "bg-[var(--p-color-brand-400)]",
  },
  concluida: {
    label: "Concluída",
    badgeClassName: "bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]",
    iconClassName: "bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]",
    borderClassName: "bg-[var(--p-color-success)]",
  },
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDraftUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data de atualização indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function MinhasDFDsPage() {
  const router = useRouter();
  const currentDraft = useDfdDraft();
  const [dfds, setDfds] = useState<DfdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterOption>("Todas");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recentes");
  const [page, setPage] = useState(1);
  const [legacyLoading, setLegacyLoading] = useState(true);
  const [legacyRecords, setLegacyRecords] = useState<LegacyDemandSummary[]>([]);
  const [campusMap, setCampusMap] = useState<Record<string, string>>({});
  const [unitNameMap, setUnitNameMap] = useState<Record<string, string>>({});
  const [currentRole, setCurrentRole] = useState<UserRole>("solicitante");
  const [sendingDfdId, setSendingDfdId] = useState<string | null>(null);
  const [submittedDfd, setSubmittedDfd] = useState<{ id: string; protocol?: string | null } | null>(null);
  const [markingKitId, setMarkingKitId] = useState<string | null>(null);
  const [finalizingPcaId, setFinalizingPcaId] = useState<string | null>(null);
  const [movingToHistoryId, setMovingToHistoryId] = useState<string | null>(null);
  const [draftActionModal, setDraftActionModal] = useState<DraftActionModalState>(null);
  const [discardingCurrentDraft, setDiscardingCurrentDraft] = useState(false);
  const [discardCurrentDraftDialogOpen, setDiscardCurrentDraftDialogOpen] = useState(false);

  const currentDraftItems = useMemo(
    () => restoreDfdDraftCartItems(currentDraft.draft?.payload.cartItems),
    [currentDraft.draft],
  );
  const currentDraftTotal = useMemo(
    () => currentDraftItems.reduce(
      (total, item) => total + Number(item.quantidade || 0) * Number(item.valor_unitario || 0),
      0,
    ),
    [currentDraftItems],
  );

  const handleDiscardCurrentDraft = async () => {
    setDiscardingCurrentDraft(true);
    const discarded = await currentDraft.clear();
    setDiscardingCurrentDraft(false);
    if (!discarded) {
      toast.error(currentDraft.lastError || "Não foi possível descartar o rascunho.");
      return;
    }
    setDiscardCurrentDraftDialogOpen(false);
    toast.success("Rascunho descartado.");
  };

  const fetchActiveDfds = useCallback(async () => {
    setLoading(true);
    try {
      const user = await getSafeUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name,email,avatar_url,role")
        .eq("id", user.id)
        .maybeSingle();

      setCurrentRole(normalizeRole(profileData?.role, user.email));

      const { data, error } = await supabase
        .from("dfds")
        .select("*")
        .eq("solicitante_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data || []) as DfdRow[];
      const requesterEmail = String(profileData?.email || user.email || "")
        .trim()
        .toLowerCase();

      let visibleRows = rows;
      if (requesterEmail) {
        const protocolToDfdId = new Map<string, string>();
        rows.forEach((row) => {
          const protocol =
            String(row.numero_protocolo || "").trim() ||
            `DFD-${row.id.slice(0, 8).toUpperCase()}`;
          protocolToDfdId.set(protocol, row.id);
        });

        const { data: movedRows, error: movedError } = await supabase
          .from("legacy_pa_demandas")
          .select("demand_code,raw_payload")
          .eq("requester_email", requesterEmail)
          .limit(2000);

        if (movedError) {
          const code = String(movedError.code || "").toUpperCase();
          const message = String(movedError.message || "").toLowerCase();
          const isMissingRelation =
            code === "42P01" ||
            (message.includes("legacy_pa_demandas") && message.includes("does not exist"));
          if (!isMissingRelation) {
            throw movedError;
          }
        } else {
          const movedIds = new Set<string>();
          (movedRows || []).forEach((row: any) => {
            const sourceDfdId = String(row?.raw_payload?.source_dfd_id || "").trim();
            if (sourceDfdId) movedIds.add(sourceDfdId);

            const movedCode = String(row?.demand_code || "").trim();
            const byCode = protocolToDfdId.get(movedCode);
            if (byCode) movedIds.add(byCode);
          });

          visibleRows = rows.filter((row) => !movedIds.has(row.id));
        }
      }

      setDfds(visibleRows);

      const uniqueCampusIds = Array.from(
        new Set(
          visibleRows.map((row) => row.campus_id).filter((id): id is string => Boolean(id)),
        ),
      );
      if (uniqueCampusIds.length > 0) {
        const { data: campusRows, error: campusError } = await supabase
          .from("campi")
          .select("id,nome,sigla")
          .in("id", uniqueCampusIds);
        if (campusError) throw campusError;

        const map: Record<string, string> = {};
        (campusRows || []).forEach((campus) => {
          map[campus.id] = String(campus.nome || campus.sigla || "").trim();
        });
        setCampusMap(map);
      } else {
        setCampusMap({});
      }

      const deptIds = Array.from(
        new Set(
          visibleRows
            .filter((row) => row.tipo_unidade === "departamento" && row.unidade_id)
            .map((row) => String(row.unidade_id)),
        ),
      );
      const labIds = Array.from(
        new Set(
          visibleRows
            .filter((row) => row.tipo_unidade === "laboratorio" && row.unidade_id)
            .map((row) => String(row.unidade_id)),
        ),
      );

      const [deptRes, labRes] = await Promise.all([
        deptIds.length > 0
          ? supabase.from("departamentos").select("id,nome").in("id", deptIds)
          : Promise.resolve({ data: [] as Array<{ id: string; nome: string }> }),
        labIds.length > 0
          ? supabase.from("laboratorios").select("id,nome").in("id", labIds)
          : Promise.resolve({ data: [] as Array<{ id: string; nome: string }> }),
      ]);

      const nextUnitMap: Record<string, string> = {};
      (deptRes.data || []).forEach((row) => {
        nextUnitMap[`departamento:${row.id}`] = String(row.nome || "");
      });
      (labRes.data || []).forEach((row) => {
        nextUnitMap[`laboratorio:${row.id}`] = String(row.nome || "");
      });
      setUnitNameMap(nextUnitMap);
    } catch (error: any) {
      toast.error("Erro ao buscar suas DFDs: " + (error?.message || "erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLegacyDfds = useCallback(async () => {
    setLegacyLoading(true);
    try {
      const { data, error } = await withLegacyHistoryViewFallback<LegacyDemandSummary>(
        async (viewName) =>
          await supabase
            .from(viewName)
            .select(
              "legacy_year,demand_code,campus,status,object,total_estimated,items_count",
            )
            .order("legacy_year", { ascending: false })
            .order("demand_code", { ascending: false }),
      );

      if (error) throw error;
      setLegacyRecords((data || []) as LegacyDemandSummary[]);
    } catch (error: any) {
      toast.error("Erro ao carregar demandas legadas: " + (error?.message || "erro desconhecido"));
      setLegacyRecords([]);
    } finally {
      setLegacyLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveDfds();
  }, [fetchActiveDfds]);

  useEffect(() => {
    fetchLegacyDfds();
  }, [fetchLegacyDfds]);

  const handleSendToChefia = async (dfdId: string) => {
    setSendingDfdId(dfdId);
    try {
      const targetDfd = dfds.find((dfd) => dfd.id === dfdId) || null;
      const response = await fetch("/api/dfd/send-to-triagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dfdId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao enviar DFD para chefia.");
      }

      setDfds((prev) =>
        prev.map((dfd) => (dfd.id === dfdId ? { ...dfd, status: "triagem" } : dfd)),
      );
      setSubmittedDfd({
        id: dfdId,
        protocol: targetDfd?.numero_protocolo || `DFD-${dfdId.slice(0, 8).toUpperCase()}`,
      });
      toast.success("DFD enviada para análise da chefia.");
    } catch (error: any) {
      toast.error("Erro ao enviar DFD: " + (error?.message || "erro desconhecido"));
    } finally {
      setSendingDfdId(null);
    }
  };

  const handleFinalizePca = async (dfdId: string) => {
    setFinalizingPcaId(dfdId);
    try {
      const response = await fetch("/api/dfd/finalize-pca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dfdId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao finalizar PCA.");
      }

      setDfds((prev) =>
        prev.map((dfd) => (dfd.id === dfdId ? { ...dfd, status: "concluida" } : dfd)),
      );
      toast.success(
        payload?.alreadyFinalized
          ? "Esta DFD já estava finalizada no PCA."
          : "DFD finalizada no PCA.",
      );
    } catch (error: any) {
      toast.error("Erro ao finalizar PCA: " + (error?.message || "erro desconhecido"));
    } finally {
      setFinalizingPcaId(null);
    }
  };

  const handleMoveToHistory = async (dfdId: string) => {
    setMovingToHistoryId(dfdId);
    try {
      const response = await fetch("/api/dfd/move-to-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dfdId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao mover para histórico.");
      }

      setDfds((prev) => prev.filter((dfd) => dfd.id !== dfdId));
      await fetchLegacyDfds();
      toast.success(
        `DFD movida para histórico (${payload?.legacyYear || new Date().getFullYear()}).`,
      );
    } catch (error: any) {
      toast.error("Erro ao mover para histórico: " + (error?.message || "erro desconhecido"));
    } finally {
      setMovingToHistoryId(null);
    }
  };

  const handleMarkAsKit = async (dfdId: string) => {
    setMarkingKitId(dfdId);
    try {
      const response = await fetch("/api/admin/kits/from-dfd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dfdId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao transformar DFD em kit.");
      }

      const ignoredItems = Array.isArray(payload?.unmatched) ? payload.unmatched.length : 0;
      toast.success(
        ignoredItems > 0
          ? `DFD transformada em kit. ${ignoredItems} item(ns) sem catálogo foram ignorados.`
          : "DFD transformada em kit.",
      );
    } catch (error: any) {
      toast.error("Erro ao transformar em kit: " + (error?.message || "erro desconhecido"));
    } finally {
      setMarkingKitId(null);
    }
  };

  const handleConfirmDraftAction = async () => {
    if (!draftActionModal) return;
    if (draftActionModal.mode === "review") {
      const targetId = draftActionModal.dfd.id;
      setDraftActionModal(null);
      router.push(`/dfd/${targetId}`);
      return;
    }

    const targetId = draftActionModal.dfd.id;
    setDraftActionModal(null);
    await handleSendToChefia(targetId);
  };

  const activeBySearch = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return dfds;

    return dfds.filter((dfd) => {
      const protocol = String(dfd.numero_protocolo || dfd.id).toLowerCase();
      const objectText = String(dfd.objeto_contratacao || "").toLowerCase();
      const campusText = String(
        dfd.campus_id ? campusMap[dfd.campus_id] || dfd.campus || "" : dfd.campus || "",
      ).toLowerCase();
      return (
        protocol.includes(term) ||
        objectText.includes(term) ||
        campusText.includes(term)
      );
    });
  }, [dfds, search, campusMap]);

  const filteredActiveDfds = useMemo(() => {
    if (filter === "Todas") return activeBySearch;
    if (filter === "Rascunhos") return activeBySearch.filter((d) => d.status === "rascunho");
    if (filter === "Concluídas") {
      return activeBySearch.filter(
        (d) => d.status === "aprovada" || d.status === "concluida",
      );
    }
    if (filter === "Legadas") return [];
    return activeBySearch.filter(
      (d) => d.status === "triagem" || d.status === "devolvida" || d.status === "pactuando",
    );
  }, [activeBySearch, filter]);

  const filteredLegacy = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return legacyRecords;
    return legacyRecords.filter((row) => {
      const text =
        `${row.demand_code} ${row.object || ""} ${row.campus || ""} ${row.legacy_year}`.toLowerCase();
      return text.includes(term);
    });
  }, [legacyRecords, search]);

  const activeKpis = useMemo(() => {
    const drafts = dfds.filter((d) => d.status === "rascunho").length;
    const inReview = dfds.filter(
      (d) => d.status === "triagem" || d.status === "devolvida" || d.status === "pactuando",
    ).length;
    const done = dfds.filter((d) => d.status === "aprovada" || d.status === "concluida").length;
    const totalValue = dfds.reduce((acc, d) => acc + Number(d.valor_total_estimado || 0), 0);
    return {
      total: dfds.length,
      drafts,
      inReview,
      done,
      totalValue,
      legacy: legacyRecords.length,
    };
  }, [dfds, legacyRecords.length]);
  const submissionPolicy = useSubmissionPolicy();
  const canCreateKits = currentRole === "admin" || currentRole === "superadmin";

  const sortedActiveDfds = useMemo(() => {
    const rows = [...filteredActiveDfds];
    rows.sort((a, b) => {
      if (sortBy === "maior_valor") {
        return Number(b.valor_total_estimado || 0) - Number(a.valor_total_estimado || 0);
      }
      if (sortBy === "menor_valor") {
        return Number(a.valor_total_estimado || 0) - Number(b.valor_total_estimado || 0);
      }
      const left = new Date(a.created_at).getTime();
      const right = new Date(b.created_at).getTime();
      return sortBy === "antigas" ? left - right : right - left;
    });
    return rows;
  }, [filteredActiveDfds, sortBy]);

  const sortedLegacy = useMemo(() => {
    const rows = [...filteredLegacy];
    rows.sort((a, b) => {
      if (sortBy === "maior_valor") {
        return Number(b.total_estimated || 0) - Number(a.total_estimated || 0);
      }
      if (sortBy === "menor_valor") {
        return Number(a.total_estimated || 0) - Number(b.total_estimated || 0);
      }
      const left = new Date(`${a.legacy_year}-01-01`).getTime();
      const right = new Date(`${b.legacy_year}-01-01`).getTime();
      return sortBy === "antigas" ? left - right : right - left;
    });
    return rows;
  }, [filteredLegacy, sortBy]);

  const isLegacyMode = filter === "Legadas";
  const totalPages = Math.max(
    1,
    Math.ceil((isLegacyMode ? sortedLegacy.length : sortedActiveDfds.length) / PAGE_SIZE),
  );
  const paginatedActiveDfds = useMemo(
    () => sortedActiveDfds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [page, sortedActiveDfds],
  );
  const paginatedLegacy = useMemo(
    () => sortedLegacy.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [page, sortedLegacy],
  );

  useEffect(() => {
    setPage(1);
  }, [filter, search, sortBy]);
  return (
    <div className="space-y-5 bg-[var(--semantic-neutral-soft)] px-4 py-6 md:px-6">
      <section className="ux-panel-soft relative overflow-hidden rounded-[20px] p-6">
        <div className="ux-accent-rule absolute inset-x-0 top-0 h-1" />
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="ux-kicker">
              Acompanhamento do solicitante
            </p>
            <h1 className="ux-title mt-1 text-3xl font-semibold">
              Suas DFDs em um fluxo mais claro
            </h1>
            <p className="ux-muted mt-1 max-w-3xl text-sm">
              Veja o que ainda está sob sua responsabilidade, o que já seguiu para análise e o que voltou para ajuste.
            </p>
          </div>

          <SkeuoPaperStack
            title="Pasta de demandas"
            subtitle={`${activeKpis.total} DFDs ativas, ${activeKpis.legacy} registros históricos e ${activeKpis.inReview} em análise.`}
            stamp={activeKpis.inReview > 0 ? "Em fluxo" : "Organizado"}
            tone={activeKpis.inReview > 0 ? "collab" : "success"}
            className="xl:mx-2"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/catalogo"
              className="ux-btn-secondary inline-flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold uppercase tracking-[0.12em]"
            >
              <Files size={16} weight="bold" />
              Catálogo
            </Link>
            {submissionPolicy.canCreate && <Link
              href="/catalogo"
              className="ux-btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-5 text-xs font-semibold uppercase tracking-[0.12em]"
            >
              <Plus size={16} weight="bold" />
              Nova Demanda
            </Link>}
          </div>
        </div>
      </section>

      {!currentDraft.loading && currentDraft.draft && (
        <section
          aria-label="Rascunho em andamento"
          className="rounded-[20px] border border-[var(--p-color-info-border)] bg-[var(--p-color-bg-elevated)] p-4 shadow-sm"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--p-color-info-border)] text-[var(--semantic-collab)]">
                <FloppyDisk size={21} weight="duotone" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="ux-title text-lg font-semibold">Rascunho em andamento</h2>
                  <OperationalChip tone={currentDraft.location === "local" ? "warning" : "collab"}>
                    {currentDraft.location === "local" ? "Neste navegador" : "Salvo no PERCATA"}
                  </OperationalChip>
                </div>
                <p className="ux-muted mt-1 text-sm">
                  Ainda não é uma DFD protocolada e não possui destino definido. Atualizado em {formatDraftUpdatedAt(currentDraft.draft.updated_at)}.
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-[var(--p-color-fg-muted)]">
                  <span>{currentDraftItems.length} {currentDraftItems.length === 1 ? "item selecionado" : "itens selecionados"}</span>
                  <span>Total estimado: {formatCurrency(currentDraftTotal)}</span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/nova-dfd")}
                disabled={!submissionPolicy.canCreate}
                className="ux-btn-primary inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold uppercase tracking-[0.1em]"
              >
                {submissionPolicy.canCreate ? "Continuar preenchimento" : "Rascunho preservado"}
                <CaretRight size={16} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => setDiscardCurrentDraftDialogOpen(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--p-color-danger-border)] bg-white px-4 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--p-color-danger)] transition hover:bg-[var(--p-color-danger-bg)]"
              >
                <Trash size={16} weight="bold" />
                Descartar
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <OperationalKpiCard label="Total de DFDs" value={String(activeKpis.total)} icon={<Files size={17} weight="duotone" />} tone="action" badge="Carteira" />
        <OperationalKpiCard label="Rascunhos" value={String(activeKpis.drafts)} icon={<ClipboardText size={17} weight="duotone" />} tone="neutral" helper="Editáveis" />
        <OperationalKpiCard label="Em análise" value={String(activeKpis.inReview)} icon={<FunnelSimple size={17} weight="duotone" />} tone="warning" helper="Com chefia" />
        <OperationalKpiCard label="Concluídas" value={String(activeKpis.done)} icon={<CheckCircle size={17} weight="duotone" />} tone="success" helper="Homologadas/PCA" />
        <OperationalKpiCard
          label="Valor estimado"
          value={formatCurrency(activeKpis.totalValue)}
          icon={<ChartLineUp size={17} weight="duotone" />}
          tone="collab"
          helper="Somatório ativo"
        />
        <OperationalKpiCard label="Legadas" value={String(activeKpis.legacy)} icon={<Archive size={17} weight="duotone" />} tone="insight" helper="Histórico" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="ux-panel rounded-[20px] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="ux-title text-lg font-semibold">Fluxo da DFD</h2>
              <p className="ux-muted text-sm">Use os chips e etapas para identificar a próxima ação.</p>
            </div>
          </div>
          <OperationalStepper
            currentStep={Math.min(4, Math.max(1, activeKpis.done > 0 ? 4 : activeKpis.inReview > 0 ? 3 : activeKpis.drafts > 0 ? 1 : 2))}
            steps={DFD_PROCESS_STEPS.map((step) => ({
              label: step.label,
              helper: step.description,
            }))}
          />
        </div>
        <OperationalAccordion
          items={[
            {
              title: "Como interpretar status",
              badge: <OperationalChip tone="action">Legenda</OperationalChip>,
              defaultOpen: true,
              content: (
                <div className="flex flex-wrap gap-2">
                  <OperationalChip tone="neutral">Rascunho</OperationalChip>
                  <OperationalChip tone="warning">Devolvida</OperationalChip>
                  <OperationalChip tone="collab">Em análise</OperationalChip>
                  <OperationalChip tone="success">Concluída</OperationalChip>
                </div>
              ),
            },
            {
              title: "Linha do tempo resumida",
              badge: <OperationalChip tone="insight">3 etapas</OperationalChip>,
              content: (
                <OperationalTimeline
                  items={[
                    { title: "Montagem", description: "Servidor seleciona itens no catálogo.", tone: "neutral" },
                    { title: "Envio", description: "Demanda segue para análise da chefia.", tone: "collab" },
                    { title: "Consolidação", description: "Itens homologados alimentam o PCA.", tone: "success" },
                  ]}
                />
              ),
            },
          ]}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <SkeuoDocumentCard
          title="Mapa visual da carteira"
          meta="Distribuição das DFDs ativas por etapa do fluxo."
          stamp="Resumo"
          tone="insight"
        >
          <SkeuoProgressRail
            items={[
              {
                label: "Rascunhos",
                value: activeKpis.total ? (activeKpis.drafts / activeKpis.total) * 100 : 0,
                tone: "neutral",
              },
              {
                label: "Em análise",
                value: activeKpis.total ? (activeKpis.inReview / activeKpis.total) * 100 : 0,
                tone: "warning",
              },
              {
                label: "Concluídas",
                value: activeKpis.total ? (activeKpis.done / activeKpis.total) * 100 : 0,
                tone: "success",
              },
            ]}
            className="border-0 p-0 shadow-none"
          />
        </SkeuoDocumentCard>
        <SkeuoDocumentCard
          title="Próxima ação sugerida"
          meta={
            currentDraft.draft
              ? "Há uma seleção salva em andamento. Use Continuar preenchimento para revisar os itens e preparar o envio à chefia."
              : activeKpis.drafts > 0
              ? "Revise rascunhos e encaminhe à chefia quando objeto, justificativa e itens estiverem fechados."
              : activeKpis.inReview > 0
                ? "Acompanhe os retornos da chefia e mantenha os ajustes prontos."
                : "A carteira está sem pendência direta de rascunho."
          }
          stamp={currentDraft.draft || activeKpis.drafts > 0 ? "Agir" : "Acompanhar"}
          tone={currentDraft.draft || activeKpis.drafts > 0 ? "warning" : "collab"}
        />
      </section>

      <section className="ux-panel rounded-[20px] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--p-color-fg-subtle)]"
            />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                isLegacyMode
                  ? "Buscar por ano, código legado ou objeto"
                  : "Buscar por protocolo, objeto ou campus"
              }
              className="h-11 w-full rounded-xl border border-[var(--semantic-neutral-border)] bg-[var(--p-color-bg-elevated)] pl-10 pr-3 text-sm text-[var(--p-color-fg-default)] outline-none transition focus:border-[var(--semantic-collab)] focus:bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="request-sort" className="text-sm font-medium text-[var(--p-color-fg-muted)]">Ordenar por:</label>
            <div className="relative">
              <select
                id="request-sort"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className="h-11 min-w-[220px] appearance-none rounded-xl border border-[var(--semantic-neutral-border)] bg-[var(--p-color-bg-elevated)] px-4 pr-10 text-sm font-semibold text-[var(--semantic-action)] outline-none transition focus:border-[var(--semantic-collab)] focus:bg-white"
              >
                <option value="recentes">Mais recentes</option>
                <option value="antigas">Mais antigas</option>
                <option value="maior_valor">Maior valor</option>
                <option value="menor_valor">Menor valor</option>
              </select>
              <CaretDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--p-color-fg-muted)]" />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((option) => {
            const count =
              option === "Todas"
                ? dfds.length
                : option === "Rascunhos"
                  ? activeKpis.drafts
                  : option === "Em Análise"
                    ? activeKpis.inReview
                    : option === "Concluídas"
                      ? activeKpis.done
                      : activeKpis.legacy;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`h-11 rounded-xl px-4 text-sm font-semibold transition ${
                  filter === option
                    ? "bg-[var(--semantic-action)] text-white"
                    : "border border-[var(--semantic-neutral-border)] bg-[var(--semantic-neutral-soft)] text-[var(--p-color-fg-muted)] hover:bg-[var(--p-color-surface-subtle)]"
                }`}
              >
                {option} ({count})
              </button>
            );
          })}
        </div>
      </section>

      {!isLegacyMode && (
        <section className="space-y-4">
          <h2 className="ux-title text-[30px] font-semibold">Demandas recentes</h2>
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <DfdCardSkeleton key={i} />
              ))}
            </div>
          )}

          {!loading &&
            paginatedActiveDfds.map((dfd) => {
              const visual = STATUS_VISUALS[dfd.status] || STATUS_VISUALS.rascunho;
              const campusName = dfd.campus_id
                ? campusMap[dfd.campus_id] || dfd.campus || "Campus UPE"
                : dfd.campus || "Campus UPE";
              const protocol = String(dfd.numero_protocolo || `DFD-${dfd.id.slice(0, 8)}`);
              const localUso =
                dfd.unidade_id && dfd.tipo_unidade
                  ? unitNameMap[`${dfd.tipo_unidade}:${dfd.unidade_id}`] || "Unidade não encontrada"
                  : "Setor não vinculado";
              const stage = getDfdProcessStage(dfd.status);

              return (
                <motion.article
                  key={dfd.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16 }}
                  className="ux-panel relative overflow-hidden rounded-[24px]"
                >
                  <div className={`absolute left-0 top-0 h-full w-1.5 ${visual.borderClassName}`} />
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-6">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${visual.badgeClassName}`}>{visual.label}</span>
                          <OperationalChip tone="neutral" className="px-4 py-1.5 text-sm">
                            Etapa {stage.stepIndex}/4
                          </OperationalChip>
                          {(dfd.status === "rascunho" || dfd.status === "devolvida") && (
                            <OperationalChip tone="warning" className="px-4 py-1.5 text-sm">
                              Requer sua ação
                            </OperationalChip>
                          )}
                        </div>
                        <h3 className="ux-title mt-4 line-clamp-2 text-[26px] font-semibold">
                          {dfd.objeto_contratacao || "Demanda sem objeto informado"}
                        </h3>
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--p-color-fg-muted)]">
                          <span>{campusName}</span>
                          <span className="text-[var(--p-color-border-strong)]">•</span>
                          <span>{localUso}</span>
                          <span className="text-[var(--p-color-border-strong)]">•</span>
                          <span>{new Date(dfd.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--p-color-fg-subtle)]">
                          <span>{protocol}</span>
                          <OperationalChip tone="action">{stage.label}</OperationalChip>
                        </div>
                        <OperationalStepper
                          currentStep={stage.stepIndex}
                          className="mt-4 xl:grid-cols-4"
                          steps={DFD_PROCESS_STEPS.map((step) => ({
                            label: step.label,
                          }))}
                        />
                      </div>
                      <div className="flex min-w-[180px] flex-col items-end gap-6">
                        <button
                          type="button"
                          aria-label="Mais ações"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--p-color-fg-muted)] hover:bg-[var(--p-color-surface-muted)]"
                        >
                          <DotsThree size={20} weight="bold" />
                        </button>
                        <p className="ux-title text-[26px] font-semibold">
                          {formatCurrency(Number(dfd.valor_total_estimado || 0))}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--p-color-surface-subtle)] pt-4">
                      <div className="flex flex-wrap items-center gap-3">
                        {dfd.status === "devolvida" && <Link href={`/dfd/${dfd.id}`} className="ux-btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold">Corrigir DFD</Link>}
                        {dfd.status === "rascunho" && submissionPolicy.canCreate && (
                          <>
                            <button
                              type="button"
                              onClick={() => setDraftActionModal({ mode: "review", dfd })}
                              className="ux-btn-secondary inline-flex h-11 items-center gap-2 rounded-xl px-5 text-base font-semibold"
                            >
                              <ClipboardText size={14} weight="bold" />
                              Fiscalizar rascunho
                            </button>
                            <button
                              type="button"
                              onClick={() => setDraftActionModal({ mode: "submit", dfd })}
                              disabled={sendingDfdId === dfd.id}
                              className="ux-btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {sendingDfdId === dfd.id ? (
                                <CircleNotch size={14} className="animate-spin" />
                              ) : (
                                <PaperPlaneTilt size={14} weight="bold" />
                              )}
                              {sendingDfdId === dfd.id ? "Encaminhando..." : "Encaminhar à chefia"}
                            </button>
                          </>
                        )}
                        {currentRole === "superadmin" &&
                          (dfd.status === "triagem" ||
                            dfd.status === "aprovada" ||
                            dfd.status === "pactuando") && (
                          <button
                            type="button"
                            onClick={() => {
                              void handleFinalizePca(dfd.id);
                            }}
                            disabled={finalizingPcaId === dfd.id}
                            className="ux-btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {finalizingPcaId === dfd.id ? (
                              <CircleNotch size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle size={14} weight="bold" />
                            )}
                            {finalizingPcaId === dfd.id ? "Finalizando..." : "Finalizar PCA"}
                          </button>
                        )}
                        {currentRole === "superadmin" && dfd.status === "concluida" && (
                          <button
                            type="button"
                            onClick={() => {
                              void handleMoveToHistory(dfd.id);
                            }}
                            disabled={movingToHistoryId === dfd.id}
                            className="ux-btn-secondary inline-flex h-11 items-center gap-2 rounded-xl px-5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {movingToHistoryId === dfd.id ? (
                              <CircleNotch size={14} className="animate-spin" />
                            ) : (
                              <Archive size={14} weight="bold" />
                            )}
                            {movingToHistoryId === dfd.id
                              ? "Movendo..."
                              : "Mover para histórico"}
                          </button>
                        )}
                        {canCreateKits ? (
                          <button
                            type="button"
                            onClick={() => handleMarkAsKit(dfd.id)}
                            disabled={markingKitId === dfd.id}
                            className="ux-btn-secondary inline-flex h-11 items-center gap-2 rounded-xl px-5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Package size={14} weight="bold" />
                            {markingKitId === dfd.id ? "Gerando..." : "Transformar em kit"}
                          </button>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push(`/dfd/${dfd.id}`)}
                        className="inline-flex h-11 items-center gap-2 rounded-xl px-2 text-base font-semibold text-[var(--semantic-action)] hover:text-[var(--semantic-action-strong)]"
                      >
                        Ver detalhes
                        <CaretRight size={16} weight="bold" />
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })}

          {!loading && sortedActiveDfds.length === 0 && (
            <OperationalEmptyState
              icon={<Files size={30} weight="fill" />}
              title="Nenhum pedido encontrado"
              description="Ajuste os filtros ou inicie uma nova demanda no catálogo."
              action={
                <Link
                  href="/catalogo"
                  className="mt-6 inline-flex h-10 items-center rounded-xl border border-[var(--p-color-info-border)] bg-[var(--p-color-surface-subtle)] px-4 text-sm font-semibold text-[var(--p-color-brand-500)] transition hover:bg-[var(--p-color-info-border)]"
                >
                  Ir para catálogo
                </Link>
              }
            />
          )}
          {!loading && sortedActiveDfds.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              itemLabel={`${sortedActiveDfds.length} demandas`}
            />
          )}
        </section>
      )}

      {isLegacyMode && (
        <section className="space-y-4">
          <h2 className="text-[34px] font-semibold tracking-tight text-[var(--p-color-brand-600)]">Demandas legadas</h2>
          {legacyLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <DfdCardSkeleton key={`legacy-skeleton-${i}`} />
              ))}
            </div>
          )}

          {!legacyLoading &&
            paginatedLegacy.map((legacy) => (
              <motion.article
                key={`${legacy.legacy_year}-${legacy.demand_code}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="rounded-[24px] border border-black/5 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--p-color-surface-subtle)] text-[var(--p-color-fg-muted)]">
                      <Archive size={20} weight="fill" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[var(--p-color-surface-muted)] px-3 py-1 type-kicker font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-muted)]">
                          {legacy.status || "Em pactuação"}
                        </span>
                        <span className="rounded-full bg-[var(--p-color-surface-subtle)] px-3 py-1 type-kicker font-semibold uppercase tracking-[0.12em] text-[var(--p-color-brand-500)]">
                          {legacy.legacy_year}
                        </span>
                        <span className="type-kicker font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">
                          {legacy.demand_code}
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--p-color-brand-500)]">
                        {legacy.object || "Demanda legada sem descrição"}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--p-color-fg-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <Buildings size={14} />
                          {legacy.campus || "Campus não informado"}
                        </span>
                        <span className="text-[var(--p-color-border-strong)]">•</span>
                        <span className="inline-flex items-center gap-1">
                          <Files size={14} />
                          {legacy.items_count || 0} itens
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-left xl:text-right">
                      <p className="inline-flex items-center gap-1 type-kicker font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">
                        <CurrencyDollar size={13} />
                        Valor legado
                      </p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--p-color-brand-500)]">
                        {formatCurrency(Number(legacy.total_estimated || 0))}
                      </p>
                    </div>
                    <Link
                      href={`/historico/${encodeURIComponent(String(legacy.legacy_year))}/${encodeURIComponent(legacy.demand_code)}`}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--p-color-info-border)] bg-[var(--p-color-surface-subtle)] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-info-border)]"
                    >
                      Ver detalhe
                      <ArrowSquareOut size={15} weight="bold" />
                    </Link>
                  </div>
                </div>
              </motion.article>
            ))}

          {!legacyLoading && sortedLegacy.length === 0 && (
            <OperationalEmptyState
              icon={<Archive size={30} weight="fill" />}
              title="Nenhuma demanda legada encontrada"
              description="Ajuste o termo de busca para localizar registros de anos anteriores."
            />
          )}
          {!legacyLoading && sortedLegacy.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              itemLabel={`${sortedLegacy.length} demandas legadas`}
            />
          )}
        </section>
      )}
      <Dialog open={discardCurrentDraftDialogOpen} onOpenChange={setDiscardCurrentDraftDialogOpen}>
        <DialogContent className="max-w-[480px] rounded-2xl border border-[var(--p-color-border)] bg-white p-0 text-[var(--p-color-fg-default)]">
          <DialogHeader className="border-b border-[var(--p-color-surface-subtle)] p-5">
            <DialogTitle className="text-xl font-semibold text-[var(--p-color-brand-500)]">
              Descartar este rascunho?
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-[var(--p-color-fg-muted)]">
              Os itens e os dados preenchidos serão removidos. Esta ação não cria, altera nem cancela uma DFD formal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t border-[var(--p-color-surface-subtle)] bg-[var(--p-color-bg-elevated)] p-4">
            <button
              type="button"
              disabled={discardingCurrentDraft}
              onClick={() => setDiscardCurrentDraftDialogOpen(false)}
              className="ux-btn-secondary h-10 rounded-xl px-4 text-xs font-semibold uppercase tracking-[0.1em] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Manter rascunho
            </button>
            <button
              type="button"
              disabled={discardingCurrentDraft}
              onClick={handleDiscardCurrentDraft}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--p-color-danger)] px-4 text-xs font-semibold uppercase tracking-[0.1em] text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {discardingCurrentDraft ? <CircleNotch className="animate-spin" size={16} /> : <Trash size={16} weight="bold" />}
              Descartar rascunho
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(draftActionModal)} onOpenChange={(open) => !open && setDraftActionModal(null)}>
        <DialogContent className="max-w-[560px] rounded-2xl border border-[var(--p-color-border)] bg-white p-0 text-[var(--p-color-fg-default)]">
          <DialogHeader className="border-b border-[var(--p-color-surface-subtle)] p-5">
            <DialogTitle className="text-xl font-semibold text-[var(--p-color-brand-500)]">
              {draftActionModal?.mode === "review" ? "Fiscalizar rascunho" : "Encaminhar à chefia"}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-[var(--p-color-fg-muted)]">
              {draftActionModal?.mode === "review"
                ? "Você vai abrir os detalhes da DFD para revisar itens, justificativas e valores."
                : "A DFD será enviada para análise da chefia e passará para o status Em análise."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 px-5 pb-5 pt-3 text-sm text-[var(--p-color-fg-muted)]">
            <p>
              <b>Protocolo:</b>{" "}
              {draftActionModal?.dfd.numero_protocolo ||
                (draftActionModal?.dfd.id ? `DFD-${draftActionModal.dfd.id.slice(0, 8).toUpperCase()}` : "-")}
            </p>
            <p>
              <b>Objeto:</b> {draftActionModal?.dfd.objeto_contratacao || "Demanda sem objeto informado"}
            </p>
            <p className="rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] px-3 py-2 text-xs leading-5">
              {draftActionModal?.mode === "review"
                ? "Depois de revisar, você pode encaminhar para chefia com mais segurança."
                : "Após o encaminhamento, você acompanha o andamento por aqui em Minhas DFDs."}
            </p>
          </div>

          <DialogFooter className="border-t border-[var(--p-color-surface-subtle)] bg-[var(--p-color-bg-elevated)] p-4">
            <button
              type="button"
              onClick={() => setDraftActionModal(null)}
              className="h-10 rounded-lg border border-[var(--p-color-border)] px-4 text-[var(--p-color-fg-muted)] hover:bg-[var(--p-color-surface-muted)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                void handleConfirmDraftAction();
              }}
              className="h-10 rounded-lg bg-[var(--p-color-brand-500)] px-5 text-white hover:bg-[var(--p-color-brand-600)]"
            >
              {draftActionModal?.mode === "review" ? "Abrir rascunho" : "Confirmar encaminhamento"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DfdSubmissionAnimation
        open={Boolean(submittedDfd)}
        protocol={submittedDfd?.protocol}
        onClose={() => setSubmittedDfd(null)}
      />
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
  itemLabel,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemLabel: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-[var(--p-color-border)] bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[var(--p-color-fg-muted)]">
        {itemLabel} · página {page} de {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-muted)] px-4 text-sm font-semibold text-[var(--p-color-brand-500)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CaretLeft size={14} weight="bold" />
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-muted)] px-4 text-sm font-semibold text-[var(--p-color-brand-500)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Próxima
          <CaretRight size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}

