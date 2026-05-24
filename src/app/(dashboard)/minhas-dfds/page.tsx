"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  MagnifyingGlass,
  Files,
  CheckCircle,
  CaretRight,
  Buildings,
  CurrencyDollar,
  Archive,
  ArrowSquareOut,
  ClipboardText,
  FunnelSimple,
  ChartLineUp,
  Package,
  PaperPlaneTilt,
  CircleNotch,
  DotsThree,
  CaretDown,
  CaretLeft,
} from "@phosphor-icons/react";
import Link from "next/link";
import { getSafeUser, supabase } from "@/lib/supabase";
import { DfdCardSkeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { normalizeRole, type UserRole } from "@/lib/access";
import { getDfdProcessStage } from "@/lib/dfd-process-guide";
import { DfdSubmissionAnimation } from "@/components/feedback/DfdSubmissionAnimation";

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
    badgeClassName: "bg-[#E8EDF2] text-[#3E4C5F]",
    iconClassName: "bg-[#E8EDF2] text-[#3E4C5F]",
    borderClassName: "bg-[#A7B1BD]",
  },
  triagem: {
    label: "Em análise",
    badgeClassName: "bg-[#DCEAF0] text-[#1F6F78]",
    iconClassName: "bg-[#DCEAF0] text-[#1C5A6B]",
    borderClassName: "bg-[#1F6F78]",
  },
  aprovada: {
    label: "Homologada",
    badgeClassName: "bg-[#E7F0EA] text-[#5F735C]",
    iconClassName: "bg-[#E7F0EA] text-[#5F735C]",
    borderClassName: "bg-[#5F735C]",
  },
  devolvida: {
    label: "Devolvida",
    badgeClassName: "bg-[#FFF3E6] text-[#B9895A]",
    iconClassName: "bg-[#FFF3E6] text-[#B9895A]",
    borderClassName: "bg-[#B9895A]",
  },
  pactuando: {
    label: "Pactuação",
    badgeClassName: "bg-[#F4F7FA] text-[#2D5D94]",
    iconClassName: "bg-[#F4F7FA] text-[#2D5D94]",
    borderClassName: "bg-[#2D5D94]",
  },
  concluida: {
    label: "Concluída",
    badgeClassName: "bg-[#E7F0EA] text-[#5F735C]",
    iconClassName: "bg-[#E7F0EA] text-[#5F735C]",
    borderClassName: "bg-[#5F735C]",
  },
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function MinhasDFDsPage() {
  const router = useRouter();
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
      setDfds(rows);

      const uniqueCampusIds = Array.from(
        new Set(rows.map((row) => row.campus_id).filter((id): id is string => Boolean(id))),
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
          rows
            .filter((row) => row.tipo_unidade === "departamento" && row.unidade_id)
            .map((row) => String(row.unidade_id)),
        ),
      );
      const labIds = Array.from(
        new Set(
          rows
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
      const { data, error } = await supabase
        .from("legacy_pa_minhas_demandas_v2")
        .select(
          "legacy_year,demand_code,campus,status,object,total_estimated,items_count",
        )
        .order("legacy_year", { ascending: false })
        .order("demand_code", { ascending: false });

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

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/catalogo"
              className="ux-btn-secondary inline-flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold uppercase tracking-[0.12em]"
            >
              <Files size={16} weight="bold" />
              Catálogo
            </Link>
            <Link
              href="/catalogo"
              className="ux-btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-5 text-xs font-semibold uppercase tracking-[0.12em]"
            >
              <Plus size={16} weight="bold" />
              Nova Demanda
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Total de DFDs" value={String(activeKpis.total)} icon={Files} tone="action" />
        <KpiCard label="Rascunhos" value={String(activeKpis.drafts)} icon={ClipboardText} tone="neutral" />
        <KpiCard label="Em análise" value={String(activeKpis.inReview)} icon={FunnelSimple} tone="warning" />
        <KpiCard label="Concluídas" value={String(activeKpis.done)} icon={CheckCircle} tone="success" />
        <KpiCard
          label="Valor estimado"
          value={formatCurrency(activeKpis.totalValue)}
          icon={ChartLineUp}
          tone="collab"
        />
        <KpiCard label="Legadas" value={String(activeKpis.legacy)} icon={Archive} tone="insight" />
      </section>

      <section className="ux-panel rounded-[20px] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7D98B8]"
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
              className="h-11 w-full rounded-xl border border-[var(--semantic-neutral-border)] bg-[#FAFBFC] pl-10 pr-3 text-sm text-[#2E3A4A] outline-none transition focus:border-[var(--semantic-collab)] focus:bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-[#5B6675]">Ordenar por:</label>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className="h-11 min-w-[220px] appearance-none rounded-xl border border-[var(--semantic-neutral-border)] bg-[#FAFBFC] px-4 pr-10 text-sm font-semibold text-[var(--semantic-action)] outline-none transition focus:border-[var(--semantic-collab)] focus:bg-white"
              >
                <option value="recentes">Mais recentes</option>
                <option value="antigas">Mais antigas</option>
                <option value="maior_valor">Maior valor</option>
                <option value="menor_valor">Menor valor</option>
              </select>
              <CaretDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5B6675]" />
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
                    : "border border-[var(--semantic-neutral-border)] bg-[var(--semantic-neutral-soft)] text-[#3E4C5F] hover:bg-[#E8EDF2]"
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
                          <span className="ux-chip bg-[var(--semantic-neutral-soft)] px-4 py-1.5 text-sm text-[#5B6675]">
                            Etapa {stage.stepIndex}/4
                          </span>
                          {(dfd.status === "rascunho" || dfd.status === "devolvida") && (
                            <span className="ux-chip ux-chip-warning px-4 py-1.5 text-sm">
                              Requer sua ação
                            </span>
                          )}
                        </div>
                        <h3 className="ux-title mt-4 line-clamp-2 text-[26px] font-semibold">
                          {dfd.objeto_contratacao || "Demanda sem objeto informado"}
                        </h3>
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#5B6675]">
                          <span>{campusName}</span>
                          <span className="text-[#B5BFCC]">•</span>
                          <span>{localUso}</span>
                          <span className="text-[#B5BFCC]">•</span>
                          <span>{new Date(dfd.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#7B889A]">
                          <span>{protocol}</span>
                        </div>
                      </div>
                      <div className="flex min-w-[180px] flex-col items-end gap-6">
                        <button
                          type="button"
                          aria-label="Mais ações"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#5B6675] hover:bg-[#F4F7FA]"
                        >
                          <DotsThree size={20} weight="bold" />
                        </button>
                        <p className="ux-title text-[26px] font-semibold">
                          {formatCurrency(Number(dfd.valor_total_estimado || 0))}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#E8EDF2] pt-4">
                      <div className="flex flex-wrap items-center gap-3">
                        {(dfd.status === "rascunho" || dfd.status === "devolvida") && (
                          <button
                            type="button"
                            onClick={() => handleSendToChefia(dfd.id)}
                            disabled={sendingDfdId === dfd.id}
                            className="ux-btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {sendingDfdId === dfd.id ? (
                              <CircleNotch size={14} className="animate-spin" />
                            ) : (
                              <PaperPlaneTilt size={14} weight="bold" />
                            )}
                            {sendingDfdId === dfd.id ? "Enviando..." : "Enviar à chefia"}
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
            <EmptyState
              icon={<Files size={30} weight="fill" />}
              title="Nenhum pedido encontrado"
              description="Ajuste os filtros ou inicie uma nova demanda no catálogo."
              action={
                <Link
                  href="/catalogo"
                  className="mt-6 inline-flex h-10 items-center rounded-xl border border-[#C7D7EA] bg-[#E8EDF2] px-4 text-sm font-semibold text-[#164073] transition hover:bg-[#DCEAF0]"
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
          <h2 className="text-[34px] font-semibold tracking-tight text-[#172C5A]">Demandas legadas</h2>
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
                    <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E8EDF2] text-[#3E4C5F]">
                      <Archive size={20} weight="fill" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#F4F7FA] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3E4C5F]">
                          {legacy.status || "Em pactuação"}
                        </span>
                        <span className="rounded-full bg-[#E8EDF2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#164073]">
                          {legacy.legacy_year}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7D98B8]">
                          {legacy.demand_code}
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-semibold tracking-tight text-[#164073]">
                        {legacy.object || "Demanda legada sem descrição"}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#5B6675]">
                        <span className="inline-flex items-center gap-1">
                          <Buildings size={14} />
                          {legacy.campus || "Campus não informado"}
                        </span>
                        <span className="text-[#A7B1BD]">•</span>
                        <span className="inline-flex items-center gap-1">
                          <Files size={14} />
                          {legacy.items_count || 0} itens
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-left xl:text-right">
                      <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7D98B8]">
                        <CurrencyDollar size={13} />
                        Valor legado
                      </p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight text-[#164073]">
                        {formatCurrency(Number(legacy.total_estimated || 0))}
                      </p>
                    </div>
                    <Link
                      href={`/historico/${encodeURIComponent(legacy.demand_code)}`}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#C7D7EA] bg-[#E8EDF2] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#164073] hover:bg-[#DCEAF0]"
                    >
                      Ver detalhe
                      <ArrowSquareOut size={15} weight="bold" />
                    </Link>
                  </div>
                </div>
              </motion.article>
            ))}

          {!legacyLoading && sortedLegacy.length === 0 && (
            <EmptyState
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
      <DfdSubmissionAnimation
        open={Boolean(submittedDfd)}
        protocol={submittedDfd?.protocol}
        onClose={() => setSubmittedDfd(null)}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "action",
}: {
  label: string;
  value: string;
  icon: React.ComponentType<any>;
  tone?: "action" | "collab" | "success" | "warning" | "insight" | "neutral";
}) {
  const toneClasses = {
    action: {
      icon: "ux-icon-action",
      value: "text-[var(--semantic-action)]",
    },
    collab: {
      icon: "ux-icon-collab",
      value: "text-[var(--semantic-collab)]",
    },
    success: {
      icon: "ux-icon-success",
      value: "text-[var(--semantic-success)]",
    },
    warning: {
      icon: "ux-icon-warning",
      value: "text-[#8A5A00]",
    },
    insight: {
      icon: "ux-icon-insight",
      value: "text-[var(--semantic-insight)]",
    },
    neutral: {
      icon: "bg-[var(--semantic-neutral-soft)] text-[#5B6675]",
      value: "text-[#3E4C5F]",
    },
  }[tone];

  return (
    <article className="ux-panel-soft rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.14em] text-black/45 font-semibold">
          {label}
        </p>
        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${toneClasses.icon}`}>
          <Icon size={17} weight="duotone" />
        </div>
      </div>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${toneClasses.value}`}>{value}</p>
    </article>
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
    <div className="flex flex-col gap-3 rounded-[20px] border border-[#D9E0E8] bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[#5B6675]">
        {itemLabel} · página {page} de {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D9E0E8] bg-[#F4F7FA] px-4 text-sm font-semibold text-[#164073] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CaretLeft size={14} weight="bold" />
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D9E0E8] bg-[#F4F7FA] px-4 text-sm font-semibold text-[#164073] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Próxima
          <CaretRight size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#D9E0E8] bg-white p-14 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F4F7FA] text-[#7D98B8]">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[#164073]">{title}</h3>
      <p className="mt-1 text-sm text-[#5B6675]">{description}</p>
      {action || null}
    </div>
  );
}
