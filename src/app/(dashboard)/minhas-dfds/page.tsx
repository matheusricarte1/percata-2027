"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  MagnifyingGlass,
  Files,
  Clock,
  CheckCircle,
  CaretRight,
  Buildings,
  CurrencyDollar,
  Archive,
  ArrowSquareOut,
  ClipboardText,
  FunnelSimple,
  ChartLineUp,
  EnvelopeSimple,
  Package,
  PaperPlaneTilt,
  CircleNotch,
} from "@phosphor-icons/react";
import Link from "next/link";
import { getSafeUser, supabase } from "@/lib/supabase";
import { DfdCardSkeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { resolveCampusBranding } from "@/lib/campus-branding";
import { normalizeRole, type UserRole } from "@/lib/access";
import { DFD_PROCESS_STEPS, getDfdProcessStage } from "@/lib/dfd-process-guide";
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

type AuthorProfile = {
  fullName: string;
  email: string;
  avatarUrl: string | null;
};

type StatusVisual = {
  label: string;
  badgeClassName: string;
  iconClassName: string;
  borderClassName: string;
};

const FILTERS = ["Todas", "Rascunhos", "Em Análise", "Concluídas"] as const;
type FilterOption = (typeof FILTERS)[number];

const VIEW_MODES = ["Ativas", "Legadas"] as const;
type ViewMode = (typeof VIEW_MODES)[number];

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

function getInitials(fullName: string) {
  const safe = String(fullName || "").trim();
  if (!safe) return "US";
  const parts = safe.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

export default function MinhasDFDsPage() {
  const router = useRouter();
  const [dfds, setDfds] = useState<DfdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterOption>("Todas");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("Ativas");
  const [legacyLoading, setLegacyLoading] = useState(true);
  const [legacyRecords, setLegacyRecords] = useState<LegacyDemandSummary[]>([]);
  const [campusMap, setCampusMap] = useState<Record<string, string>>({});
  const [unitNameMap, setUnitNameMap] = useState<Record<string, string>>({});
  const [currentRole, setCurrentRole] = useState<UserRole>("solicitante");
  const [sendingDfdId, setSendingDfdId] = useState<string | null>(null);
  const [submittedDfd, setSubmittedDfd] = useState<{ id: string; protocol?: string | null } | null>(null);
  const [markingKitId, setMarkingKitId] = useState<string | null>(null);
  const [author, setAuthor] = useState<AuthorProfile>({
    fullName: "Solicitante",
    email: "",
    avatarUrl: null,
  });

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
      setAuthor({
        fullName:
          String(
            profileData?.full_name ||
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              "Solicitante",
          ).trim() || "Solicitante",
        email: String(profileData?.email || user.email || "").trim(),
        avatarUrl:
          String(
            profileData?.avatar_url ||
              user.user_metadata?.avatar_url ||
              user.user_metadata?.picture ||
              "",
          ).trim() || null,
      });

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

  return (
    <div className="space-y-5 bg-[#F3F2F1] px-4 py-6 md:px-6">
      <section className="rounded-[20px] border border-[#C7D7EA] bg-[#F7FBFF] p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#47739F]">
              Fluxo do Solicitante
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#17233C]">
              Meus Pedidos (DFD)
            </h1>
            <p className="mt-1 text-sm text-[#52627A]">
              Controle completo das suas demandas ativas e do histórico legado.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/catalogo"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#C7D7EA] bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#164073] hover:bg-[#EAF2FF]"
            >
              <Files size={16} weight="bold" />
              Catálogo
            </Link>
            <Link
              href="/catalogo"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#164073] px-5 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-[#0F2E57]"
            >
              <Plus size={16} weight="bold" />
              Nova Demanda
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-[20px] border border-[#D9E0E8] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#47739F]">
              Guia rápido
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#164073]">
              O que fazer com cada DFD
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#52627A]">
              Rascunhos ficam sob seu controle. Quando estiverem conferidos, envie à chefia.
              Depois disso, a chefia homologa ou devolve com orientação de ajuste.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-4 lg:min-w-[560px]">
            {DFD_PROCESS_STEPS.map((step, index) => (
              <div key={step.id} className="rounded-2xl border border-[#E8EDF2] bg-[#FAFBFC] p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#164073] text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="text-xs font-semibold text-[#164073]">{step.label}</p>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[#5B6675]">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Total de DFDs" value={String(activeKpis.total)} icon={Files} />
        <KpiCard label="Rascunhos" value={String(activeKpis.drafts)} icon={ClipboardText} />
        <KpiCard label="Em análise" value={String(activeKpis.inReview)} icon={FunnelSimple} />
        <KpiCard label="Concluídas" value={String(activeKpis.done)} icon={CheckCircle} />
        <KpiCard
          label="Valor estimado"
          value={formatCurrency(activeKpis.totalValue)}
          icon={ChartLineUp}
        />
        <KpiCard label="Legadas" value={String(activeKpis.legacy)} icon={Archive} />
      </section>

      <section className="rounded-[20px] border border-[#D9E0E8] bg-white p-4 shadow-sm">
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
                viewMode === "Ativas"
                  ? "Buscar por protocolo, objeto ou campus"
                  : "Buscar por ano, código legado ou objeto"
              }
              className="h-11 w-full rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] pl-10 pr-3 text-sm text-[#2E3A4A] outline-none transition focus:border-[#4D79A8] focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {VIEW_MODES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setViewMode(option)}
                className={`h-10 rounded-xl px-4 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  viewMode === option
                    ? "bg-[#164073] text-white"
                    : "border border-[#D9E0E8] bg-[#F4F7FA] text-[#3E4C5F] hover:bg-[#E8EDF2]"
                }`}
              >
                {option}
                <span className="ml-2 text-[10px] opacity-80">
                  ({option === "Ativas" ? dfds.length : legacyRecords.length})
                </span>
              </button>
            ))}
          </div>
        </div>

        {viewMode === "Ativas" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`h-9 rounded-xl px-4 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                  filter === option
                    ? "bg-[#164073] text-white"
                    : "border border-[#D9E0E8] bg-[#F4F7FA] text-[#3E4C5F] hover:bg-[#E8EDF2]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </section>

      {viewMode === "Ativas" && (
        <section className="space-y-4">
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <DfdCardSkeleton key={i} />
              ))}
            </div>
          )}

          {!loading &&
            filteredActiveDfds.map((dfd) => {
              const visual = STATUS_VISUALS[dfd.status] || STATUS_VISUALS.rascunho;
              const campusName = dfd.campus_id
                ? campusMap[dfd.campus_id] || dfd.campus || "Campus UPE"
                : dfd.campus || "Campus UPE";
              const branding = resolveCampusBranding(campusName);
              const protocol = String(dfd.numero_protocolo || `DFD-${dfd.id.slice(0, 8)}`);
              const localUso =
                dfd.unidade_id && dfd.tipo_unidade
                  ? unitNameMap[`${dfd.tipo_unidade}:${dfd.unidade_id}`] || "Unidade não encontrada"
                  : "Não informado";
              const stage = getDfdProcessStage(dfd.status);

              return (
                <motion.article
                  key={dfd.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16 }}
                  className="relative overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm"
                >
                  <div className={`absolute left-0 top-0 h-full w-1.5 ${visual.borderClassName}`} />

                  <div className="p-4 pl-5">
                    <div className="flex flex-wrap items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#E8EDF2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#164073]">
                            {protocol}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${visual.badgeClassName}`}
                          >
                            {visual.label}
                          </span>
                        </div>

                        <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-tight tracking-tight text-[#164073]">
                          {dfd.objeto_contratacao || "Demanda sem objeto informado"}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-[#D9E0E8] bg-[#FAFBFC] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#3E4C5F]">
                            Etapa {stage.stepIndex}/4 · {stage.label}
                          </span>
                          <span className="text-xs text-[#66758A]">{stage.description}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => router.push(`/dfd/${dfd.id}`)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#164073] px-3 text-[10px] font-semibold uppercase tracking-[0.11em] text-white hover:bg-[#0F2E57]"
                      >
                        Abrir
                        <CaretRight size={12} weight="bold" />
                      </button>
                    </div>

                    <div className="mt-2.5 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto]">
                      <div className="flex flex-wrap items-center gap-2">
                        <InfoPill
                          label="Data"
                          value={new Date(dfd.created_at).toLocaleDateString("pt-BR")}
                          icon={<Clock size={12} />}
                        />
                        <InfoPill
                          label="Campus"
                          value={campusName}
                          icon={<Buildings size={12} />}
                        />
                        <InfoPill label="Local de uso" value={localUso} />
                        <InfoPill
                          label="Valor"
                          value={formatCurrency(Number(dfd.valor_total_estimado || 0))}
                          icon={<CurrencyDollar size={12} />}
                        />
                      </div>

                      <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-2.5 py-2">
                        <AuthorAvatar author={author} />
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold text-[#3E4C5F]">
                            {author.fullName}
                          </p>
                          {author.email ? (
                            <p className="mt-0.5 inline-flex items-center gap-1 truncate text-[10px] text-[#5B6675]">
                              <EnvelopeSimple size={11} />
                              {author.email}
                            </p>
                          ) : null}
                        </div>
                        <img
                          src={branding.logoSrc}
                          alt={branding.label}
                          className="hidden h-5 w-auto object-contain opacity-95 xl:block"
                        />
                      </div>
                    </div>

                    {dfd.status === "rascunho" || dfd.status === "devolvida" ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E8EDF2] pt-3">
                        <button
                          type="button"
                          onClick={() => handleSendToChefia(dfd.id)}
                          disabled={sendingDfdId === dfd.id}
                          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1F6F78] px-3 text-[10px] font-semibold uppercase tracking-[0.11em] text-white hover:bg-[#1C5A6B] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {sendingDfdId === dfd.id ? (
                            <CircleNotch size={13} className="animate-spin" />
                          ) : (
                            <PaperPlaneTilt size={13} weight="bold" />
                          )}
                          {sendingDfdId === dfd.id ? "Enviando..." : "Enviar à chefia"}
                        </button>
                        {canCreateKits ? (
                          <button
                            type="button"
                            onClick={() => handleMarkAsKit(dfd.id)}
                            disabled={markingKitId === dfd.id}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#C7D7EA] bg-[#F7FBFF] px-3 text-[10px] font-semibold uppercase tracking-[0.11em] text-[#164073] hover:bg-[#EAF2FF] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Package size={13} weight="bold" />
                            {markingKitId === dfd.id ? "Gerando..." : "Transformar em kit"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </motion.article>
              );
            })}

          {!loading && filteredActiveDfds.length === 0 && (
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
        </section>
      )}

      {viewMode === "Legadas" && (
        <section className="space-y-4">
          {legacyLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <DfdCardSkeleton key={`legacy-skeleton-${i}`} />
              ))}
            </div>
          )}

          {!legacyLoading &&
            filteredLegacy.map((legacy) => (
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

          {!legacyLoading && filteredLegacy.length === 0 && (
            <EmptyState
              icon={<Archive size={30} weight="fill" />}
              title="Nenhuma demanda legada encontrada"
              description="Ajuste o termo de busca para localizar registros de anos anteriores."
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
}: {
  label: string;
  value: string;
  icon: React.ComponentType<any>;
}) {
  return (
    <article className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.14em] text-black/45 font-semibold">
          {label}
        </p>
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#E8EDF2] text-[#164073]">
          <Icon size={17} weight="duotone" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[#164073]">{value}</p>
    </article>
  );
}

function InfoPill({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#E8EDF2] bg-white px-2.5 py-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">
        {label}
      </p>
      <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-[#3E4C5F]">
        {icon}
        {value}
      </p>
    </div>
  );
}

function AuthorAvatar({ author }: { author: AuthorProfile }) {
  const [broken, setBroken] = useState(false);

  if (!author.avatarUrl || broken) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D9E0E8] bg-[#E8EDF2] text-[10px] font-semibold uppercase text-[#164073]">
        {getInitials(author.fullName)}
      </div>
    );
  }

  return (
    <img
      src={author.avatarUrl}
      alt={author.fullName}
      className="h-8 w-8 rounded-full border border-[#D9E0E8] object-cover"
      onError={() => setBroken(true)}
    />
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
