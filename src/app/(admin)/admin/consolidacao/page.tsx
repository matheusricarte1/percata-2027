"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./consolidation.css";
import { Cube } from "@/components/icons/phosphor/exports/Cube";
import { Files } from "@/components/icons/phosphor/exports/Files";
import { CurrencyDollar } from "@/components/icons/phosphor/exports/CurrencyDollar";
import { Info } from "@/components/icons/phosphor/exports/Info";
import { ConsolidationScenarios } from "@/components/admin/ConsolidationScenarios";
import { dataIssues, type ScenarioItem } from "@/lib/consolidation-scenarios";
import { Virtuoso } from "react-virtuoso";
import { ArrowsClockwise } from "@/components/icons/phosphor/exports/ArrowsClockwise";
import { DownloadSimple } from "@/components/icons/phosphor/exports/DownloadSimple";
import { ArrowSquareOut } from "@/components/icons/phosphor/exports/ArrowSquareOut";
import { Funnel } from "@/components/icons/phosphor/exports/Funnel";
import { MagnifyingGlass } from "@/components/icons/phosphor/exports/MagnifyingGlass";
import { Star } from "@/components/icons/phosphor/exports/Star";
import { DotsThree } from "@/components/icons/phosphor/exports/DotsThree";
import { WarningCircle } from "@/components/icons/phosphor/exports/WarningCircle";
import { X } from "@/components/icons/phosphor/exports/X";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  OperationalEmptyState,
} from "@/components/ui/operational";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { usePathname } from "next/navigation";
import { downloadWorkbookFromSheets } from "@/lib/export-excel";
import { concentration, priceSignals } from "@/lib/consolidation-analytics";
import { consolidationContextKey } from "@/lib/consolidation-context";
import { calculateCapitalPriorities, type CapitalPriorityResult } from "@/lib/capital-priority";
import { computeWeightedPriority } from "@/lib/weighted-priority";
import { institutionalGroup, institutionalScore, INSTITUTIONAL_GROUP_LEVELS, INSTITUTIONAL_PRIORITY_VERSION, INSTITUTIONAL_GROUP_LABELS, type InstitutionalGroup } from "@/lib/institutional-priority";
import {
  buildDfdItemDetailRows,
  buildDfdSheetRows,
  protectReportRow,
} from "@/lib/admin-reports";

type ApprovedDfd = {
  id: string;
  numero_protocolo: string;
  status?: string | null;
  objeto_contratacao: string;
  created_at: string | null;
  campus_id: string | null;
  campus_nome: string;
  solicitante_id: string | null;
  solicitante_nome: string;
  solicitante_email: string | null;
  solicitante_avatar_url: string | null;
  unidade_id: string | null;
  tipo_unidade: "departamento" | "laboratorio" | null;
  unidade_nome: string;
  origin_type?: string | null;
  collective_origin_room_id?: string | null;
  collective_origin_room_title?: string | null;
  collective_origin_expense_class?: string | null;
  coautoria_coletiva_relatorio?: string | null;
  item_count: number;
  valor_total: number;
  itens_sem_classificacao: number;
  raw?: Record<string, unknown>;
};

const CONSOLIDATED_TABLE_GRID = "grid grid-cols-[28px_86px_minmax(260px,1.7fr)_minmax(110px,.9fr)_88px_72px_110px_76px_minmax(100px,.8fr)_90px_44px_62px_44px]";

type RawItem = {
  id?: string;
  dfd_id: string;
  codigo_tce: string;
  codigo_item_efisco?: string | null;
  item_key: string;
  campus_id: string | null;
  unit_key: string | null;
  institutional_group: InstitutionalGroup;
  eligible_status: boolean;
  analysis_default_score?: number | null;
  descricao: string;
  quantidade: number;
  valor_unitario_estimado: number;
  is_highlight_item: boolean;
  criticidade?: string | null;
  moscow_categoria?: string | null;
  gnd?: string | null;
  gnd_derivado?: string | null;
  codigo_natureza_despesa?: string | null;
  unidade_medida?: string | null;
  efisco_item_id?: number | string | null;
  efisco_item_natureza_id?: number | string | null;
  link_referencia?: string | null;
  justificativa_item?: string | null;
  justificativa_quantidade?: string | null;
  local_uso?: string | null;
  raw?: Record<string, unknown>;
};

type ConsolidatedItem = {
  item_key: string;
  campus_id: string | null;
  unit_key: string | null;
  institutional_group: InstitutionalGroup;
  eligible_status: boolean;
  analysis_default_score?: number | null;
  siad: string;
  descricao: string;
  grupo_nome: string;
  classe_nome: string;
  tipo_nome: "Material" | "Serviço";
  gnd_dominante: string;
  quantidade_total: number;
  unidades_medida: string[];
  valor_total: number;
  pedidos: string[];
  solicitantes: string[];
  solicitante_people: Array<{ name: string; avatarUrl: string | null }>;
  locais_uso: string[];
  dfd_count: number;
  source_item_count: number;
  source_highlight_count: number;
  criticidade_level: number;
  priorizacao_level: number;
  rank_score: number;
  technical_score?: number;
  institutional_score?: number | null;
  capital_priority?: CapitalPriorityResult;
  official_criticidade_level?: number;
  official_priorizacao_level?: number;
  is_highlight: boolean;
  description_variants: number;
  min_unit_value: number;
  max_unit_value: number;
  spread_percent: number;
  missing_quality_count: number;
  dfd_sources: Array<{
    id: string;
    numero_protocolo: string;
    solicitante_nome: string;
    status: string;
  }>;
};

type SmartFilter = "all" | "divergencia" | "outlier" | "incompleto" | "pareto";
type ContrastMode = "soft" | "high";
type NaturezaDespesaFilter = "all" | "custeio" | "permanente" | "sem_gnd";
type QuickFocus = "none" | "criticos" | "essenciais";
type FilterPresetKey =
  | "custom"
  | "executivo_pareto"
  | "risco_dados"
  | "outlier_preco"
  | "servicos"
  | "materiais"
  | "laboratorios";

type StarConfettiPiece = {
  id: string;
  left: number;
  size: number;
  durationMs: number;
  delayMs: number;
  driftPx: number;
  rotateDeg: number;
  color: string;
  round: boolean;
};

const STAR_CONFETTI_COLORS = [
  "#EC2029",
  "#2456B6",
  "#16A34A",
  "#C46A00",
  "#7F5E11",
  "#7C3AED",
];

const CRITICIDADE_TO_LEVEL: Record<string, number> = {
  baixa: 1,
  media: 2,
  alta: 3,
  critica: 4,
};

const PRIORIZACAO_TO_LEVEL: Record<string, number> = {
  nao_tera_agora: 1,
  poderia_ter: 2,
  deveria_ter: 3,
  deve_ter: 4,
};

const CRITICIDADE_LABELS = ["N/D", "Baixa", "Média", "Alta", "Crítica"];
const PRIORIZACAO_LABELS = ["N/D", "Postergado", "Oportuno", "Relevante", "Essencial"];
const CONSOLIDATION_ELIGIBLE_STATUSES = new Set([
  "aprovada",
  "pactuando",
  "concluida",
  "homologada",
]);

function normalizeDfdStatus(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function buildStarConfettiPieces(total = 36): StarConfettiPiece[] {
  return Array.from({ length: total }, (_, index) => ({
    id: `star-confetti-${Date.now()}-${index}`,
    left: 4 + Math.random() * 92,
    size: 6 + Math.random() * 8,
    durationMs: 1100 + Math.round(Math.random() * 900),
    delayMs: Math.round(Math.random() * 280),
    driftPx: -48 + Math.round(Math.random() * 96),
    rotateDeg: -220 + Math.round(Math.random() * 440),
    color: STAR_CONFETTI_COLORS[index % STAR_CONFETTI_COLORS.length],
    round: Math.random() > 0.65,
  }));
}

function parseCriticidadeLevel(value: string | null | undefined): number {
  if (!value) return 0;
  return CRITICIDADE_TO_LEVEL[String(value).trim()] || 0;
}

function parsePriorizacaoLevel(value: string | null | undefined): number {
  if (!value) return 0;
  return PRIORIZACAO_TO_LEVEL[String(value).trim()] || 0;
}

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(4, Math.round(level)));
}


function compactList(values: string[], max = 2): string {
  const clean = values
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (clean.length === 0) return "N/D";
  if (clean.length <= max) return clean.join(", ");
  return `${clean.slice(0, max).join(", ")} +${clean.length - max}`;
}

function formatUpdatedAtLabel(date: Date | null) {
  if (!date) return "Ainda não atualizado";
  return `Atualizado às ${date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatCompactCurrencyRange(min: number, max: number): string {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) ? max : 0;
  if (safeMin <= 0 && safeMax <= 0) return "N/D";
  if (Math.abs(safeMax - safeMin) < 0.01) {
    return safeMax.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  return `${safeMin.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  })} - ${safeMax.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  })}`;
}

function getInitials(fullName: string) {
  return (
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function resolveConsolidationItemCode(row: Record<string, unknown>): string {
  const tce = String(row.codigo_tce || "").trim();
  if (tce) return tce;

  const efisco = String(row.codigo_item_efisco || "").trim();
  if (efisco) return efisco;

  return "";
}

function deriveGroupFromGnd(gnd: string): string {
  const normalized = String(gnd || "").trim();
  if (normalized.startsWith("4.")) return "Capital";
  if (normalized.startsWith("3.")) return "Custeio";
  return "Sem Grupo";
}

function deriveTypeFromGnd(gnd: string): "Material" | "Serviço" {
  const normalized = String(gnd || "").trim();
  if (normalized.startsWith("3.3.90.39")) return "Serviço";
  return "Material";
}

function resolveNaturezaDespesa(
  gnd: string | null | undefined,
  grupo: string | null | undefined,
): Exclude<NaturezaDespesaFilter, "all"> {
  const normalizedGnd = String(gnd || "").trim();
  const normalizedGrupo = String(grupo || "").trim().toLowerCase();

  if (normalizedGnd.startsWith("3") || normalizedGrupo.includes("custeio")) {
    return "custeio";
  }
  if (
    normalizedGnd.startsWith("4") ||
    normalizedGrupo.includes("capital") ||
    normalizedGrupo.includes("permanente")
  ) {
    return "permanente";
  }
  return "sem_gnd";
}

function naturezaDespesaLabel(value: NaturezaDespesaFilter): string {
  if (value === "custeio") return "Custeio";
  if (value === "permanente") return "Permanente";
  if (value === "sem_gnd") return "Sem GND";
  return "Todas";
}

function applyWeightedPriority(
  source: ConsolidatedItem[],
): ConsolidatedItem[] {
  const campuses = new Set(source.map(item => item.campus_id));
  if (campuses.size > 1) return Array.from(campuses).flatMap(campus => applyWeightedPriority(source.filter(item => item.campus_id === campus)));
  const capitalResults = calculateCapitalPriorities(source.filter((item) =>
    String(item.gnd_dominante || "").startsWith("4")
  ).map((item) => ({
    key: item.item_key,
    campusId: item.campus_id,
    unitKey: item.unit_key,
    value: item.valor_total,
    criticidadeLevel: item.criticidade_level,
    prioridadeLevel: item.priorizacao_level,
    chefiaPareto: item.source_highlight_count > 0,
    eligible: item.eligible_status,
  })));
  const scored = source.map((item) => {
    const capital_priority = item.analysis_default_score === 10 ? undefined : capitalResults.get(item.item_key);
    const technical_score = item.analysis_default_score === 10 ? 10 : capitalResults.has(item.item_key)
      ? capitalResults.get(item.item_key)?.finalScore ?? 0
      : computeWeightedPriority(item.criticidade_level, item.priorizacao_level, item.valor_total);
    const pending = capital_priority?.status === "pending" || (item.analysis_default_score !== 10 && (item.criticidade_level === 0 || item.priorizacao_level === 0));
    const institutional_score = pending ? null : institutionalScore(item.institutional_group, technical_score);
    return { ...item, capital_priority, technical_score, institutional_score, rank_score: institutional_score ?? 0 };
  });
  const limit = Math.ceil(scored.length * 0.2);
  const sorted = [...scored].sort((a, b) => b.rank_score - a.rank_score || a.siad.localeCompare(b.siad, "pt-BR"));
  const topSet = new Set(sorted.slice(0, limit).map(item => item.item_key));
  return scored.map(item => ({ ...item, is_highlight: topSet.has(item.item_key) }));
}

function buildConsolidatedExportRows(source: ConsolidatedItem[]) {
  return source.map((item) =>
    protectReportRow({
      codigo_efisco: item.siad,
      descricao: item.descricao,
      grupo: item.grupo_nome,
      gnd_dominante: item.gnd_dominante,
      natureza_despesa: naturezaDespesaLabel(
        resolveNaturezaDespesa(item.gnd_dominante, item.grupo_nome),
      ),
      classe: item.classe_nome,
      tipo: item.tipo_nome,
      qtd_total: item.quantidade_total,
      valor_total: Number(item.valor_total || 0),
      dfds: item.dfd_count,
      itens_origem: item.source_item_count,
      itens_pareto_origem: item.source_highlight_count,
      campi: item.pedidos.join(", "),
      servidores: item.solicitantes.join(", "),
      departamentos_laboratorios: item.locais_uso.join(", "),
      criticidade: CRITICIDADE_LABELS[item.criticidade_level] || CRITICIDADE_LABELS[0],
      priorizacao: PRIORIZACAO_LABELS[item.priorizacao_level] || PRIORIZACAO_LABELS[0],
      score: item.institutional_score ?? "",
      nota_tecnica: item.technical_score ?? "",
      formula_pontuacao_final: "base do nível + 100*T/(T+280), parcela limitada a 99,99; T = nota técnica",
      grupo_institucional: INSTITUTIONAL_GROUP_LABELS[item.institutional_group],
      nivel_institucional: INSTITUTIONAL_GROUP_LEVELS[item.institutional_group],
      versao_precedencia: INSTITUTIONAL_PRIORITY_VERSION,
      versao_ordenacao: item.analysis_default_score === 10 ? "administrative-fixed-10" : item.capital_priority?.version || "weighted-priority-v1",
      avaliacao_simulada: item.official_criticidade_level !== undefined && (item.criticidade_level !== item.official_criticidade_level || item.priorizacao_level !== item.official_priorizacao_level) ? "SIM" : "NAO",
      criticidade_oficial_nivel: item.official_criticidade_level ?? item.criticidade_level,
      prioridade_oficial_nivel: item.official_priorizacao_level ?? item.priorizacao_level,
      status_ordenacao: item.capital_priority?.status || "calculated",
      motivo_ordenacao: item.analysis_default_score === 10 ? "Nota administrativa fixa 10." : item.capital_priority?.reason || "Criticidade, prioridade e valor pela metodologia de pesos anterior.",
      destaque_chefia: item.source_highlight_count > 0 ? "SIM" : "NAO",
      versao_pontuacao_capital: item.capital_priority?.version || "",
      status_pontuacao_capital: item.capital_priority?.status || "",
      motivo_pendencia_capital: item.capital_priority?.reason || "",
      score_chefia_capital: item.capital_priority?.humanScore ?? "",
      bonus_pareto_capital: item.capital_priority?.paretoBonus ?? "",
      penalidade_campus_capital: item.capital_priority?.campusPenalty ?? "",
      acrescimo_unidade_capital: item.capital_priority?.unitIncrement ?? "",
      referencia_campus_capital: item.capital_priority?.campusReference ?? "",
      referencia_unidade_capital: item.capital_priority?.unitReference ?? "",
      variantes_descricao: item.description_variants,
      menor_valor_unitario: Number(item.min_unit_value || 0),
      maior_valor_unitario: Number(item.max_unit_value || 0),
      spread_preco_percent: Number(item.spread_percent.toFixed(2)),
      pendencias_qualidade_percent: item.missing_quality_count,
      dfds_origem: item.dfd_sources
        .map((dfd) => `${dfd.numero_protocolo} (${dfd.solicitante_nome})`)
        .join(" | "),
      dfds_origem_ids: item.dfd_sources.map((dfd) => dfd.id).join(" | "),
    }),
  );
}

function buildSourceItemRows(rawItems: RawItem[], dfds: ApprovedDfd[]) {
  const dfdRows = dfds.map((dfd) => ({
    ...(dfd.raw || {}),
    id: dfd.id,
    numero_protocolo: dfd.numero_protocolo,
    objeto_contratacao: dfd.objeto_contratacao,
    created_at: dfd.created_at,
    campus_id: dfd.campus_id,
    campus_nome_relatorio: dfd.campus_nome,
    unidade_id: dfd.unidade_id,
    tipo_unidade: dfd.tipo_unidade,
    unidade_nome_relatorio: dfd.unidade_nome,
    origin_type: dfd.origin_type || "",
    collective_origin_room_id: dfd.collective_origin_room_id || "",
    collective_origin_room_title: dfd.collective_origin_room_title || "",
    collective_origin_expense_class: dfd.collective_origin_expense_class || "",
    coautoria_coletiva_relatorio: dfd.coautoria_coletiva_relatorio || "",
    solicitante_id: dfd.solicitante_id,
    solicitante_nome_relatorio: dfd.solicitante_nome,
    solicitante_email_relatorio: dfd.solicitante_email,
    valor_total_estimado: dfd.valor_total,
  }));
  const itemRows = rawItems.map((item) => ({
    ...(item.raw || {}),
    id: item.id || "",
    dfd_id: item.dfd_id,
    codigo_tce: item.codigo_tce,
    descricao: item.descricao,
    quantidade: item.quantidade,
    valor_unitario_estimado: item.valor_unitario_estimado,
    gnd: item.gnd || "",
    gnd_derivado: item.gnd_derivado || "",
    codigo_natureza_despesa: item.codigo_natureza_despesa || "",
    unidade_medida: item.unidade_medida || "",
    efisco_item_id: item.efisco_item_id || "",
    efisco_item_natureza_id: item.efisco_item_natureza_id || "",
    local_uso: item.local_uso || "",
    criticidade: item.criticidade || "",
    moscow_categoria: item.moscow_categoria || "",
    justificativa_item: item.justificativa_item || "",
    justificativa_quantidade: item.justificativa_quantidade || "",
    link_referencia: item.link_referencia || "",
    is_highlight_item: item.is_highlight_item,
  }));

  return buildDfdItemDetailRows(itemRows as any, dfdRows as any);
}

export default function ConsolidationPage() {
  const pathname = usePathname();
  const globalDfdView = pathname === "/admin/todas-dfds";
  const reducedMotion = useReducedMotion();
  const starConfettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dfds, setDfds] = useState<ApprovedDfd[]>([]);
  const [rawItems, setRawItems] = useState<RawItem[]>([]);
  const [baseItems, setBaseItems] = useState<ConsolidatedItem[]>([]);
  const [allItems, setItems] = useState<ConsolidatedItem[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null);
  const campusOptions = useMemo(() => Array.from(new Map(dfds.map(dfd => [dfd.campus_id || "sem-campus", { id: dfd.campus_id || "sem-campus", name: dfd.campus_nome }])).values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [dfds]);
  const activeCampusId = campusOptions.some(campus => campus.id === selectedCampusId) ? selectedCampusId : campusOptions[0]?.id;
  const campusDfds = useMemo(() => dfds.filter(dfd => (dfd.campus_id || "sem-campus") === activeCampusId), [dfds, activeCampusId]);
  const items = useMemo(() => allItems.filter(item => (item.campus_id || "sem-campus") === activeCampusId), [allItems, activeCampusId]);
  const [selectedDfdId, setSelectedDfdId] = useState<string>("all");
  const [dfdSearchTerm, setDfdSearchTerm] = useState("");
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [highlightOnly, setHighlightOnly] = useState(false);
  const [contrastMode, setContrastMode] = useState<ContrastMode>("soft");
  const [showLegends, setShowLegends] = useState(true);
  const [showScoreBars, setShowScoreBars] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dfdMenuOpen, setDfdMenuOpen] = useState(false);
  const [previewDfdId, setPreviewDfdId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<"score_desc" | "value_desc" | "quantity_desc">("score_desc");
  const [quickFocus, setQuickFocus] = useState<QuickFocus>("none");
  const [naturezaFilter, setNaturezaFilter] = useState<NaturezaDespesaFilter>("all");
  const [grupoFilter, setGrupoFilter] = useState("all");
  const [classeFilter, setClasseFilter] = useState("all");
  const [tipoFilter, setTipoFilter] = useState<"all" | "Material" | "Serviço">("all");
  const [servidorFilter, setServidorFilter] = useState("all");
  const [localUsoFilter, setLocalUsoFilter] = useState("all");
  const [activePreset, setActivePreset] = useState<FilterPresetKey>("custom");
  const [starConfettiPieces, setStarConfettiPieces] = useState<StarConfettiPiece[]>([]);
  const [naturezaReviewOpenCount, setNaturezaReviewOpenCount] = useState(0);

  const previewDfd = useMemo(
    () => (previewDfdId ? dfds.find((dfd) => dfd.id === previewDfdId) || null : null),
    [dfds, previewDfdId],
  );

  const recomputeItems = useCallback(
    (source: ConsolidatedItem[]) => {
      setItems(applyWeightedPriority(source));
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setSelectedDfdId("all");
    setItemSearchTerm("");
    setSmartFilter("all");
    setHighlightOnly(false);
    setQuickFocus("none");
    setNaturezaFilter("all");
    setGrupoFilter("all");
    setClasseFilter("all");
    setTipoFilter("all");
    setServidorFilter("all");
    setLocalUsoFilter("all");
    setContrastMode("soft");
    setShowLegends(false);
    setShowScoreBars(true);
    setFiltersOpen(false);
  }, []);

  const applyPreset = useCallback(
    (preset: FilterPresetKey) => {
      resetFilters();

      if (preset === "executivo_pareto") {
        setSmartFilter("pareto");
        setHighlightOnly(true);
      } else if (preset === "risco_dados") {
        setSmartFilter("incompleto");
        setContrastMode("high");
      } else if (preset === "outlier_preco") {
        setSmartFilter("outlier");
      } else if (preset === "servicos") {
        setTipoFilter("Serviço");
      } else if (preset === "materiais") {
        setTipoFilter("Material");
      } else if (preset === "laboratorios") {
        setLocalUsoFilter("__LAB__");
      }

      setActivePreset(preset);
      if (preset !== "custom") {
        toast.success("Preset aplicado à consolidação.");
      }
    },
    [resetFilters],
  );

  const triggerStarCelebration = useCallback(() => {
    if (reducedMotion) return;
    if (starConfettiTimeoutRef.current) {
      clearTimeout(starConfettiTimeoutRef.current);
      starConfettiTimeoutRef.current = null;
    }
    setStarConfettiPieces(buildStarConfettiPieces());
    starConfettiTimeoutRef.current = setTimeout(() => {
      setStarConfettiPieces([]);
      starConfettiTimeoutRef.current = null;
    }, 2200);
  }, [reducedMotion]);

  useEffect(() => {
    return () => {
      if (starConfettiTimeoutRef.current) {
        clearTimeout(starConfettiTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadNaturezaReviewAlert() {
      try {
        const response = await fetch("/api/admin/efisco-natureza-review?limit=1&status=todos");
        const data = await response.json().catch(() => ({}));
        if (active && response.ok) {
          setNaturezaReviewOpenCount(Number(data?.summary?.abertos || 0));
        }
      } catch {
        if (active) setNaturezaReviewOpenCount(0);
      }
    }
    loadNaturezaReviewAlert();
    return () => {
      active = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const chunkArray = <T,>(values: T[], chunkSize = 150): T[][] => {
        if (values.length === 0) return [];
        const safeChunkSize = Math.max(1, chunkSize);
        const chunks: T[][] = [];
        for (let i = 0; i < values.length; i += safeChunkSize) {
          chunks.push(values.slice(i, i + safeChunkSize));
        }
        return chunks;
      };

      const fetchAllRows = async (query: any): Promise<any> => {
        const rows: any[] = [];
        for (let offset = 0; ; offset += 500) {
          const response = await query.range(offset, offset + 499);
          if (response.error) return response;
          rows.push(...(response.data || []));
          if ((response.data || []).length < 500) return { ...response, data: rows };
        }
      };

      const fetchByInChunks = async (
        table: string,
        selectColumns: string,
        inColumn: string,
        ids: string[],
        chunkSize = 150,
      ): Promise<any[]> => {
        if (ids.length === 0) return [];
        const rows: any[] = [];
        for (const idChunk of chunkArray(ids, chunkSize)) {
          const { data, error } = await fetchAllRows(supabase
            .from(table)
            .select(selectColumns)
            .in(inColumn, idChunk).order("id"));
          if (error) throw error;
          rows.push(...((data || []) as any[]));
        }
        return rows;
      };

      const { data: sessionData } = await supabase.auth.getUser();
      const { data: roleProfile } = sessionData.user
        ? await supabase.from("profiles").select("role").eq("id", sessionData.user.id).maybeSingle()
        : { data: null };
      const isSuperadmin = roleProfile?.role === "superadmin";
      let dfdQuery: any = supabase.from("dfds").select("*");
      if (!globalDfdView || !isSuperadmin) {
        dfdQuery = dfdQuery.in("status", Array.from(CONSOLIDATION_ELIGIBLE_STATUSES));
      }
      let dfdsRes: any = await fetchAllRows(dfdQuery.order("created_at", { ascending: false }).order("id"));

      if (
        dfdsRes.error &&
        /unidade_id|tipo_unidade/i.test(String(dfdsRes.error.message || ""))
      ) {
        dfdsRes = await fetchAllRows(supabase
          .from("dfds")
          .select(
            "id, numero_protocolo, objeto_contratacao, created_at, campus_id, solicitante_id, valor_total_estimado",
          )
          .in("status", Array.from(CONSOLIDATION_ELIGIBLE_STATUSES))
          .order("created_at", { ascending: false }).order("id"));
      }
      if (dfdsRes.error) throw dfdsRes.error;

      let approvedDfdsRows = (dfdsRes.data || []) as any[];
      if (approvedDfdsRows.length === 0) {
        // Fallback defensivo para ambientes onde o status foi persistido com variação legada.
        const allDfdsRes: any = await fetchAllRows(supabase
          .from("dfds")
          .select("*")
          .order("created_at", { ascending: false }).order("id"));
        if (allDfdsRes.error) throw allDfdsRes.error;
        approvedDfdsRows = ((allDfdsRes.data || []) as any[]).filter((row) =>
          (globalDfdView && isSuperadmin) || CONSOLIDATION_ELIGIBLE_STATUSES.has(normalizeDfdStatus(row?.status)),
        );
      }

      if (approvedDfdsRows.length === 0) {
        setDfds([]);
        setRawItems([]);
        setBaseItems([]);
        setItems([]);
        setLastUpdatedAt(new Date());
        return;
      }

      const dfdIds = approvedDfdsRows.map((dfd) => dfd.id).filter(Boolean);
      const campusIds = Array.from(
        new Set(
          approvedDfdsRows
            .map((dfd) => dfd.campus_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const solicitanteIds = Array.from(
        new Set(
          approvedDfdsRows
            .map((dfd) => dfd.solicitante_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const departamentoIds = Array.from(
        new Set(
          approvedDfdsRows
            .filter((dfd) => String(dfd.tipo_unidade || "").toLowerCase() === "departamento")
            .map((dfd) => dfd.unidade_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const laboratorioIds = Array.from(
        new Set(
          approvedDfdsRows
            .filter((dfd) => String(dfd.tipo_unidade || "").toLowerCase() === "laboratorio")
            .map((dfd) => dfd.unidade_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      const [campiRes, profilesRes, departamentosRes, laboratoriosRes, collectiveAuthorRes] = await Promise.all([
        fetchByInChunks("campi", "id, nome, sigla", "id", campusIds),
        fetchByInChunks("profiles", "id, full_name, email, avatar_url", "id", solicitanteIds),
        fetchByInChunks("departamentos", "id, nome", "id", departamentoIds),
        fetchByInChunks("laboratorios", "id, nome", "id", laboratorioIds),
        fetchByInChunks(
          "dfd_collective_dfd_authors",
          "dfd_id,contribution_user_id,author_name_snapshot,author_email_snapshot,quantidade_total,valor_total_estimado",
          "dfd_id",
          dfdIds,
        ).catch(() => []),
      ]);

      const campiData = campiRes as any[];
      const profilesData = profilesRes as any[];
      const departamentosData = departamentosRes as any[];
      const laboratoriosData = laboratoriosRes as any[];
      const collectiveAuthorData = collectiveAuthorRes as any[];
      const collectiveAuthorsByDfd = collectiveAuthorData.reduce<Map<string, any[]>>((map, row) => {
        const key = String(row.dfd_id || "").trim();
        if (!key) return map;
        const current = map.get(key) || [];
        current.push(row);
        map.set(key, current);
        return map;
      }, new Map());

      const itemsRowsData: any[] = [];
      const dfdMetaById = new Map(approvedDfdsRows.map((dfd) => [String(dfd.id), dfd]));
      const legacyItemsSelect =
        "id, dfd_id, codigo_tce, codigo_item_efisco, descricao, quantidade, valor_unitario_estimado, is_highlight_item, gnd, link_referencia, justificativa_item, justificativa_quantidade";

      for (const dfdChunk of chunkArray(dfdIds, 120)) {
        const primaryRes: any = await fetchAllRows(supabase
          .from("dfd_items")
          .select("*")
          .in("dfd_id", dfdChunk).order("id"));

        if (
          primaryRes.error &&
          /criticidade|moscow_categoria|local_uso/i.test(String(primaryRes.error.message || ""))
        ) {
          const fallbackRes: any = await fetchAllRows(supabase
            .from("dfd_items")
            .select(legacyItemsSelect)
            .in("dfd_id", dfdChunk).order("id"));
          if (fallbackRes.error) throw fallbackRes.error;
          itemsRowsData.push(...((fallbackRes.data || []) as any[]));
          continue;
        }

        if (primaryRes.error) throw primaryRes.error;
        itemsRowsData.push(...((primaryRes.data || []) as any[]));
      }

      const itemsRows = itemsRowsData
        .map(
          (row) => {
            const itemCode = resolveConsolidationItemCode(row);
            const dfdMeta = dfdMetaById.get(String(row.dfd_id)) as any;
            const campusId = String(dfdMeta?.campus_id || "").trim() || null;
            const unitId = String(dfdMeta?.unidade_id || "").trim();
            const unitKey = unitId ? `${String(dfdMeta?.tipo_unidade || "unidade")}:${unitId}` : null;
            const baseKey = itemCode ||
              [String(row.descricao || "").trim().toLowerCase(), String(row.gnd || "").trim().toLowerCase()]
                .filter(Boolean).join("|") || String(row.id || "");
            return {
              id: String(row.id || ""),
              dfd_id: String(row.dfd_id || ""),
              codigo_tce: itemCode,
              codigo_item_efisco: String(row.codigo_item_efisco || "").trim() || null,
              item_key: consolidationContextKey({
                id: String(row.id), dfdId: String(row.dfd_id), campusId, code: baseKey,
                gnd: String(row.gnd || ""), unit: String(row.unidade_medida || ""),
                eligible: CONSOLIDATION_ELIGIBLE_STATUSES.has(normalizeDfdStatus(dfdMeta?.status)),
                criticidade: String(row.criticidade || ""), prioridade: String(row.moscow_categoria || ""),
                highlight: Boolean(row.is_highlight_item),
                institutionalGroup: institutionalGroup(dfdMeta?.tipo_unidade, dfdMeta?.unidade_id),
              }),
              analysis_default_score: row.analysis_default_score === 10 || dfdMeta?.analysis_default_score === 10 ? 10 : null,
              campus_id: campusId,
              unit_key: unitKey,
              institutional_group: institutionalGroup(dfdMeta?.tipo_unidade, dfdMeta?.unidade_id),
              eligible_status: CONSOLIDATION_ELIGIBLE_STATUSES.has(normalizeDfdStatus(dfdMeta?.status)),
              descricao: String(row.descricao || "").trim() || "Descrição não informada",
              quantidade: Math.max(0, Number(row.quantidade || 0)),
              valor_unitario_estimado: Math.max(0, Number(row.valor_unitario_estimado || 0)),
              is_highlight_item: Boolean(row.is_highlight_item),
              criticidade: row.criticidade || null,
              moscow_categoria: row.moscow_categoria || null,
              gnd: row.gnd || null,
              gnd_derivado: row.gnd_derivado || null,
              codigo_natureza_despesa: row.codigo_natureza_despesa || null,
              unidade_medida: row.unidade_medida || null,
              efisco_item_id: row.efisco_item_id || null,
              efisco_item_natureza_id: row.efisco_item_natureza_id || null,
              link_referencia: row.link_referencia || null,
              justificativa_item: row.justificativa_item || null,
              justificativa_quantidade: row.justificativa_quantidade || null,
              local_uso: row.local_uso || null,
              raw: row,
            } satisfies RawItem;
          },
        )
        .map((row) => ({ ...row, item_key: row.analysis_default_score === 10 ? `${row.item_key}|median10` : row.item_key }))
        .filter((row) => row.dfd_id && row.item_key);

      const campusMap = new Map(
        campiData.map((campus) => [
          campus.id,
          String(campus.nome || campus.sigla || "N/D"),
        ]),
      );
      const profileMap = new Map<
        string,
        {
          nome: string;
          email: string | null;
          avatarUrl: string | null;
        }
      >(
        profilesData.map((profile) => [
          profile.id,
          {
            nome: String(profile.full_name || profile.email || "Usuário"),
            email: profile.email ? String(profile.email).toLowerCase() : null,
            avatarUrl: profile.avatar_url ? String(profile.avatar_url) : null,
          },
        ]),
      );
      const departamentoMap = new Map(
        departamentosData.map((row) => [
          String(row.id),
          String(row.nome || "").trim(),
        ]),
      );
      const laboratorioMap = new Map(
        laboratoriosData.map((row) => [
          String(row.id),
          String(row.nome || "").trim(),
        ]),
      );
      const dfdLookup = new Map(
        approvedDfdsRows.map((dfd) => [String(dfd.id), dfd]),
      );

      function resolveUnitName(dfd: any): string {
        const unitId = String(dfd?.unidade_id || "").trim();
        if (!unitId) return "";
        const tipo = String(dfd?.tipo_unidade || "").toLowerCase();
        if (tipo === "departamento") {
          return String(departamentoMap.get(unitId) || "").trim();
        }
        if (tipo === "laboratorio") {
          return String(laboratorioMap.get(unitId) || "").trim();
        }
        return (
          String(departamentoMap.get(unitId) || "").trim() ||
          String(laboratorioMap.get(unitId) || "").trim()
        );
      }

      const dfdStats = new Map<
        string,
        { item_count: number; valor_total: number; sem_classificacao: number }
      >();

      const consolidated = new Map<
        string,
        {
          item_key: string;
          campus_id: string | null;
          unit_key: string | null;
          institutional_group: InstitutionalGroup;
          eligible_status: boolean;
  analysis_default_score?: number | null;
          siad: string;
          descricao: string;
          descricaoSet: Set<string>;
          quantidade_total: number;
          unidadesMedida: Set<string>;
          valor_total: number;
          pedidos: Set<string>;
          solicitantes: Set<string>;
          solicitantePeople: Map<string, { name: string; avatarUrl: string | null }>;
          locais_uso: Set<string>;
          dfdSet: Set<string>;
          source_item_count: number;
          source_highlight_count: number;
          criticidade_sum: number;
          priorizacao_sum: number;
          prioritized_count: number;
          min_unit: number;
          max_unit: number;
          unitValues: number[];
          missing_quality_count: number;
          gndFrequency: Map<string, number>;
        }
      >();

      for (const row of itemsRows) {
        const itemSubtotal = Number(row.quantidade || 0) * Number(row.valor_unitario_estimado || 0);
        const qualityMissing =
          Number(!String(row.gnd || "").trim()) +
          Number(!String(row.link_referencia || "").trim()) +
          Number(!String(row.justificativa_item || "").trim()) +
          Number(!String(row.justificativa_quantidade || "").trim()) +
          Number(!row.criticidade) +
          Number(!row.moscow_categoria);

        const dfdStat = dfdStats.get(row.dfd_id) || {
          item_count: 0,
          valor_total: 0,
          sem_classificacao: 0,
        };
        dfdStat.item_count += 1;
        dfdStat.valor_total += itemSubtotal;
        if (!row.criticidade || !row.moscow_categoria) dfdStat.sem_classificacao += 1;
        dfdStats.set(row.dfd_id, dfdStat);

        if (!consolidated.has(row.item_key)) {
          consolidated.set(row.item_key, {
            item_key: row.item_key,
            analysis_default_score: row.analysis_default_score,
            campus_id: row.campus_id,
            unit_key: row.unit_key,
            institutional_group: row.institutional_group,
            eligible_status: row.eligible_status,
            siad: row.codigo_tce || row.codigo_item_efisco || "Sem código",
            descricao: row.descricao,
            descricaoSet: new Set<string>(),
            quantidade_total: 0,
            unidadesMedida: new Set<string>(),
            valor_total: 0,
            pedidos: new Set<string>(),
            solicitantes: new Set<string>(),
            solicitantePeople: new Map<string, { name: string; avatarUrl: string | null }>(),
            locais_uso: new Set<string>(),
            dfdSet: new Set<string>(),
            source_item_count: 0,
            source_highlight_count: 0,
            criticidade_sum: 0,
            priorizacao_sum: 0,
            prioritized_count: 0,
            min_unit: Number.POSITIVE_INFINITY,
            max_unit: 0,
            unitValues: [],
            missing_quality_count: 0,
            gndFrequency: new Map<string, number>(),
          });
        }

        const entry = consolidated.get(row.item_key)!;
        entry.descricaoSet.add(row.descricao);
        entry.quantidade_total += Number(row.quantidade || 0);
        const unidadeMedida = String(row.unidade_medida || "").trim().toUpperCase();
        if (unidadeMedida) entry.unidadesMedida.add(unidadeMedida);
        entry.valor_total += itemSubtotal;
        entry.source_item_count += 1;
        if (row.is_highlight_item) entry.source_highlight_count += 1;
        entry.dfdSet.add(row.dfd_id);
        entry.min_unit = Math.min(entry.min_unit, Number(row.valor_unitario_estimado || 0));
        entry.max_unit = Math.max(entry.max_unit, Number(row.valor_unitario_estimado || 0));
        entry.unitValues.push(Number(row.valor_unitario_estimado || 0));
        entry.missing_quality_count += qualityMissing;
        const gndKey = String(row.gnd || "").trim() || "Sem GND";
        entry.gndFrequency.set(gndKey, (entry.gndFrequency.get(gndKey) || 0) + 1);

        const criticidadeLevel = parseCriticidadeLevel(row.criticidade);
        const priorizacaoLevel = parsePriorizacaoLevel(row.moscow_categoria);
        if (criticidadeLevel > 0 || priorizacaoLevel > 0) {
          entry.criticidade_sum += criticidadeLevel;
          entry.priorizacao_sum += priorizacaoLevel;
          entry.prioritized_count += 1;
        }

        const dfd = dfdLookup.get(row.dfd_id);
        const campusSigla = dfd?.campus_id ? campusMap.get(dfd.campus_id) : null;
        entry.pedidos.add(campusSigla || "N/D");
        const profileInfo = dfd?.solicitante_id
          ? profileMap.get(String(dfd.solicitante_id))
          : null;
        const requesterName = profileInfo?.nome || "Usuário";
        entry.solicitantes.add(requesterName);
        entry.solicitantePeople.set(String(dfd?.solicitante_id || requesterName), {
          name: requesterName,
          avatarUrl: profileInfo?.avatarUrl || null,
        });
        const unitName = resolveUnitName(dfd);
        const localUso = String(row.local_uso || "").trim();
        if (unitName) entry.locais_uso.add(unitName);
        if (localUso) entry.locais_uso.add(localUso);
      }

      const dfdSummaries: ApprovedDfd[] = approvedDfdsRows.map((dfd) => {
        const stat = dfdStats.get(dfd.id) || {
          item_count: 0,
          valor_total: Number(dfd.valor_total_estimado || 0),
          sem_classificacao: 0,
        };
        const profileInfo = dfd.solicitante_id
          ? profileMap.get(String(dfd.solicitante_id))
          : null;
        const unitName = resolveUnitName(dfd) || "Não definido";
        const collectiveAuthors = (collectiveAuthorsByDfd.get(String(dfd.id || "")) || [])
          .map((row) => {
            const name = String(
              row.author_name_snapshot ||
                row.author_email_snapshot ||
                row.contribution_user_id ||
                "",
            ).trim();
            if (!name) return null;
            return `${name} (qtd ${Number(row.quantidade_total || 0)}, R$ ${Number(
              row.valor_total_estimado || 0,
            ).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })})`;
          })
          .filter(Boolean)
          .join(" ; ");
        return {
          id: dfd.id,
          numero_protocolo: String(dfd.numero_protocolo || ""),
          status: dfd.status || null,
          objeto_contratacao: String(dfd.objeto_contratacao || "Objeto não informado"),
          created_at: dfd.created_at || null,
          campus_id: dfd.campus_id || null,
          campus_nome: dfd.campus_id ? campusMap.get(dfd.campus_id) || "N/D" : "N/D",
          solicitante_id: dfd.solicitante_id || null,
          solicitante_nome: profileInfo?.nome || "Usuário",
          solicitante_email: profileInfo?.email || null,
          solicitante_avatar_url: profileInfo?.avatarUrl || null,
          unidade_id: dfd.unidade_id || null,
          tipo_unidade: (dfd.tipo_unidade as "departamento" | "laboratorio" | null) || null,
          unidade_nome: unitName,
          origin_type: dfd.origin_type || null,
          collective_origin_room_id: dfd.collective_origin_room_id || null,
          collective_origin_room_title: dfd.collective_origin_room_title || null,
          collective_origin_expense_class: dfd.collective_origin_expense_class || null,
          coautoria_coletiva_relatorio: collectiveAuthors,
          item_count: stat.item_count,
          valor_total: stat.valor_total,
          itens_sem_classificacao: stat.sem_classificacao,
          raw: dfd,
        };
      });

      const catalogByCode = new Map<
        string,
        { grupo: string; classe: string; tipo: "Material" | "Serviço" }
      >();
      const uniqueCodes = Array.from(new Set(itemsRows.map((row) => row.codigo_tce || row.codigo_item_efisco || ""))).filter(
        Boolean,
      );
      try {
        const chunkSize = 400;
        for (let i = 0; i < uniqueCodes.length; i += chunkSize) {
          const chunk = uniqueCodes.slice(i, i + chunkSize);
          const { data: catalogRows, error: catalogError } = await supabase
            .from("catalogo_efisco_v2")
            .select("codigo_efisco, grupo, classe, tipo")
            .in("codigo_efisco", chunk);

          if (catalogError) {
            throw catalogError;
          }

          (catalogRows || []).forEach((row: any) => {
            const key = String(row.codigo_efisco || "").trim();
            if (!key) return;
            const tipo =
              String(row.tipo || "").toLowerCase().includes("serv") ? "Serviço" : "Material";
            catalogByCode.set(key, {
              grupo: String(row.grupo || "").trim() || "Sem Grupo",
              classe: String(row.classe || "").trim() || "Sem Classe",
              tipo,
            });
          });
        }
      } catch {
        // Fallback silencioso para classificação derivada por GND
      }

      const normalized: ConsolidatedItem[] = Array.from(consolidated.values()).map((entry) => {
        const qualityDenominator = Math.max(1, entry.source_item_count * 6);
        const qualityRatio = entry.missing_quality_count / qualityDenominator;
        const spread =
          entry.min_unit > 0
            ? ((entry.max_unit - entry.min_unit) / entry.min_unit) * 100
            : 0;
        const dominantGnd =
          [...entry.gndFrequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Sem GND";
        const taxo = catalogByCode.get(entry.siad);
        const grupo = taxo?.grupo || deriveGroupFromGnd(dominantGnd);
        const classe = taxo?.classe || "Sem Classe";
        const tipo = taxo?.tipo || deriveTypeFromGnd(dominantGnd);

        return {
          item_key: entry.item_key,
          analysis_default_score: entry.analysis_default_score,
          campus_id: entry.campus_id,
          unit_key: entry.unit_key,
          institutional_group: entry.institutional_group,
          eligible_status: entry.eligible_status,
          siad: entry.siad,
          descricao: entry.descricao,
          grupo_nome: grupo,
          classe_nome: classe,
          tipo_nome: tipo,
          gnd_dominante: dominantGnd,
          quantidade_total: entry.quantidade_total,
          unidades_medida: Array.from(entry.unidadesMedida).sort((a, b) => a.localeCompare(b, "pt-BR")),
          valor_total: entry.valor_total,
          pedidos: Array.from(entry.pedidos),
          solicitantes: Array.from(entry.solicitantes).sort((a, b) =>
            String(a).localeCompare(String(b), "pt-BR"),
          ),
          solicitante_people: Array.from(entry.solicitantePeople.values()).sort((a, b) =>
            String(a.name).localeCompare(String(b.name), "pt-BR"),
          ),
          locais_uso: Array.from(entry.locais_uso).sort((a, b) =>
            String(a).localeCompare(String(b), "pt-BR"),
          ),
          dfd_count: entry.dfdSet.size,
          source_item_count: entry.source_item_count,
          source_highlight_count: entry.source_highlight_count,
          criticidade_level:
            entry.prioritized_count > 0
              ? clampLevel(entry.criticidade_sum / entry.prioritized_count)
              : 0,
          priorizacao_level:
            entry.prioritized_count > 0
              ? clampLevel(entry.priorizacao_sum / entry.prioritized_count)
              : 0,
          rank_score: 0,
          is_highlight: false,
          description_variants: entry.descricaoSet.size,
          min_unit_value: Number.isFinite(entry.min_unit) ? entry.min_unit : 0,
          max_unit_value: entry.max_unit,
          spread_percent: Number.isFinite(spread) ? spread : 0,
          missing_quality_count: Math.round(qualityRatio * 100),
          dfd_sources: Array.from(entry.dfdSet)
            .map((dfdId) => {
              const dfd = dfdLookup.get(dfdId);
              const profileInfo = dfd?.solicitante_id
                ? profileMap.get(String(dfd.solicitante_id))
                : null;
              return {
                id: dfdId,
                numero_protocolo: String(
                  dfd?.numero_protocolo || `DFD-${dfdId.slice(0, 8).toUpperCase()}`,
                ),
                solicitante_nome: profileInfo?.nome || "Usuário",
                status: normalizeDfdStatus(dfd?.status),
              };
            })
            .sort((a, b) => a.numero_protocolo.localeCompare(b.numero_protocolo, "pt-BR")),
        };
      });

      for (const item of normalized) {
        item.official_criticidade_level = item.criticidade_level;
        item.official_priorizacao_level = item.priorizacao_level;
      }
      setDfds(dfdSummaries);
      setRawItems(itemsRows);
      setBaseItems(normalized);
      setItems(applyWeightedPriority(normalized));
      setLastUpdatedAt(new Date());
    } catch (error: any) {
      setLoadError("Não foi possível atualizar os dados da consolidação. Tente novamente para consultar uma base atualizada.");
      toast.error("Erro ao carregar consolidação: " + (error?.message || "erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }, [globalDfdView]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    recomputeItems(baseItems);
  }, [baseItems, recomputeItems]);

  useEffect(() => {
    setClasseFilter("all");
  }, [grupoFilter]);

  const updateItemLevel = (
    itemKey: string,
    field: "criticidade_level" | "priorizacao_level",
    nextValue: number,
  ) => {
    const safeValue = clampLevel(nextValue);
    setBaseItems((prev) =>
      prev.map((item) => (item.item_key === itemKey ? { ...item, [field]: safeValue } : item)),
    );
  };

  const selectedDfdCodeSet = useMemo(() => {
    if (selectedDfdId === "all") return null;
    const codes = rawItems
      .filter((item) => item.dfd_id === selectedDfdId)
      .map((item) => item.item_key);
    if (codes.length === 0) return new Set<string>();
    return new Set(codes);
  }, [selectedDfdId, rawItems]);

  const filteredDfds = useMemo(() => {
    const query = dfdSearchTerm.trim().toLowerCase();
    if (!query) return campusDfds;
    return campusDfds.filter((dfd) => {
      return (
        String(dfd.numero_protocolo || "").toLowerCase().includes(query) ||
        String(dfd.objeto_contratacao || "").toLowerCase().includes(query) ||
        String(dfd.campus_nome || "").toLowerCase().includes(query) ||
        String(dfd.solicitante_nome || "").toLowerCase().includes(query) ||
        String(dfd.solicitante_email || "").toLowerCase().includes(query) ||
        String(dfd.unidade_nome || "").toLowerCase().includes(query)
      );
    });
  }, [dfdSearchTerm, campusDfds]);

  const priceReview = useMemo(() => priceSignals(rawItems.filter(row =>
    (row.campus_id || "sem-campus") === activeCampusId
  ).map(row => ({ id: row.id || row.item_key, campusId: row.campus_id,
    code: row.codigo_tce || row.codigo_item_efisco || "", unit: row.unidade_medida || "",
    gnd: row.gnd || "", price: row.valor_unitario_estimado }))), [rawItems, activeCampusId]);
  const priceReviewKeys = useMemo(() => new Set(rawItems.filter(row =>
    priceReview.get(row.id || row.item_key)?.flagged
  ).map(row => row.item_key)), [rawItems, priceReview]);
  const simulatedCount = useMemo(() => items.filter(item =>
    item.criticidade_level !== item.official_criticidade_level || item.priorizacao_level !== item.official_priorizacao_level
  ).length, [items]);
  const restoreSimulation = () => setBaseItems(prev => prev.map(item => ({ ...item,
    criticidade_level: item.official_criticidade_level ?? item.criticidade_level,
    priorizacao_level: item.official_priorizacao_level ?? item.priorizacao_level,
  })));

  const displayItems = useMemo(() => {
    const query = itemSearchTerm.trim().toLowerCase();
    let next = items;

    if (selectedDfdCodeSet) {
      next = next.filter((item) => selectedDfdCodeSet.has(item.item_key));
    }

    if (query) {
      next = next.filter((item) => {
        return (
          String(item.siad || "").toLowerCase().includes(query) ||
          item.dfd_sources.some(dfd => dfd.numero_protocolo.toLowerCase().includes(query)) ||
          String(item.descricao || "").toLowerCase().includes(query) ||
          String(item.pedidos.join(", ") || "").toLowerCase().includes(query) ||
          String(item.solicitantes.join(", ") || "").toLowerCase().includes(query) ||
          String(item.locais_uso.join(", ") || "").toLowerCase().includes(query) ||
          String(item.grupo_nome || "").toLowerCase().includes(query) ||
          String(item.classe_nome || "").toLowerCase().includes(query) ||
          String(item.tipo_nome || "").toLowerCase().includes(query)
        );
      });
    }

    if (grupoFilter !== "all") {
      next = next.filter((item) => item.grupo_nome === grupoFilter);
    }
    if (naturezaFilter !== "all") {
      next = next.filter(
        (item) => resolveNaturezaDespesa(item.gnd_dominante, item.grupo_nome) === naturezaFilter,
      );
    }
    if (classeFilter !== "all") {
      next = next.filter((item) => item.classe_nome === classeFilter);
    }
    if (tipoFilter !== "all") {
      next = next.filter((item) => item.tipo_nome === tipoFilter);
    }
    if (servidorFilter !== "all") {
      next = next.filter((item) => item.solicitantes.includes(servidorFilter));
    }
    if (localUsoFilter !== "all") {
      if (localUsoFilter === "__LAB__") {
        next = next.filter((item) =>
          item.institutional_group === "laboratorio",
        );
      } else {
        next = next.filter((item) => item.locais_uso.includes(localUsoFilter));
      }
    }

    if (highlightOnly) {
      next = next.filter((item) => item.source_highlight_count > 0);
    }

    if (quickFocus === "criticos") {
      next = next.filter((item) => item.criticidade_level >= 4);
    } else if (quickFocus === "essenciais") {
      next = next.filter((item) => item.priorizacao_level >= 4);
    }

    if (smartFilter === "divergencia") {
      next = next.filter((item) => item.description_variants > 1);
    } else if (smartFilter === "outlier") {
      next = next.filter((item) => item.spread_percent >= 80 || priceReviewKeys.has(item.item_key));
    } else if (smartFilter === "incompleto") {
      next = next.filter((item) => item.criticidade_level === 0 || item.priorizacao_level === 0 || item.institutional_score == null);
    } else if (smartFilter === "pareto") {
      next = next.filter((item) => item.source_highlight_count > 0);
    }

    return [...next].sort((a, b) => {
      const pendingScoreDiff = Number(a.institutional_score == null) - Number(b.institutional_score == null);
      if (pendingScoreDiff !== 0) return pendingScoreDiff;
      if (sortBy === "value_desc") {
        const valueDiff = b.valor_total - a.valor_total;
        if (valueDiff !== 0) return valueDiff;
        return b.rank_score - a.rank_score;
      }
      if (sortBy === "quantity_desc") {
        const quantityDiff = b.quantidade_total - a.quantidade_total;
        if (quantityDiff !== 0) return quantityDiff;
        return b.rank_score - a.rank_score;
      }

      const pendingDiff = Number(a.capital_priority?.status === "pending") - Number(b.capital_priority?.status === "pending");
      if (pendingDiff !== 0) return pendingDiff;
      const scoreDiff = b.rank_score - a.rank_score;
      if (scoreDiff !== 0) return scoreDiff;
      const technicalDiff = (b.technical_score || 0) - (a.technical_score || 0);
      if (technicalDiff !== 0) return technicalDiff;
      return a.item_key.localeCompare(b.item_key, "pt-BR");
    });
  }, [
    priceReviewKeys,
    classeFilter,
    grupoFilter,
    highlightOnly,
    itemSearchTerm,
    items,
    localUsoFilter,
    naturezaFilter,
    quickFocus,
    selectedDfdCodeSet,
    servidorFilter,
    smartFilter,
    sortBy,
    tipoFilter,
  ]);

  const pageCount = Math.max(1, Math.ceil(displayItems.length / pageSize));
  const effectivePage = Math.min(currentPage, pageCount - 1);
  const paginationPages = getPaginationPages(effectivePage, pageCount);
  const pageItems = useMemo(
    () => displayItems.slice(effectivePage * pageSize, (effectivePage + 1) * pageSize),
    [displayItems, effectivePage, pageSize],
  );
  const grupoOptions = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.grupo_nome).filter(Boolean))).sort((a, b) =>
        String(a).localeCompare(String(b), "pt-BR"),
      ),
    [items],
  );
  const classeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .filter((item) => grupoFilter === "all" || item.grupo_nome === grupoFilter)
            .map((item) => item.classe_nome)
            .filter(Boolean),
        ),
      ).sort((a, b) => String(a).localeCompare(String(b), "pt-BR")),
    [grupoFilter, items],
  );
  const servidorOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .flatMap((item) => item.solicitantes)
            .map((value) => String(value || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => String(a).localeCompare(String(b), "pt-BR")),
    [items],
  );
  const localUsoOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .flatMap((item) => item.locais_uso)
            .map((value) => String(value || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => String(a).localeCompare(String(b), "pt-BR")),
    [items],
  );

  useEffect(() => {
    if (servidorFilter !== "all" && !servidorOptions.includes(servidorFilter)) {
      setServidorFilter("all");
    }
  }, [servidorFilter, servidorOptions]);

  useEffect(() => {
    if (
      localUsoFilter !== "all" &&
      localUsoFilter !== "__LAB__" &&
      !localUsoOptions.includes(localUsoFilter)
    ) {
      setLocalUsoFilter("all");
    }
  }, [localUsoFilter, localUsoOptions]);

  const paretoCount = useMemo(
    () => displayItems.filter((item) => item.source_highlight_count > 0).length,
    [displayItems],
  );

  const outliersCount = useMemo(
    () => displayItems.filter((item) => item.spread_percent >= 80 || priceReviewKeys.has(item.item_key)).length,
    [displayItems, priceReviewKeys],
  );
  const incompletosCount = useMemo(
    () =>
      displayItems.filter((item) => item.criticidade_level === 0 || item.priorizacao_level === 0 || item.institutional_score == null)
        .length,
    [displayItems],
  );
  const criticosCount = useMemo(
    () => displayItems.filter((item) => item.criticidade_level >= 4).length,
    [displayItems],
  );
  const essenciaisCount = useMemo(
    () => displayItems.filter((item) => item.priorizacao_level >= 4).length,
    [displayItems],
  );
  const visibleValue = useMemo(
    () => displayItems.reduce((acc, item) => acc + Number(item.valor_total || 0), 0),
    [displayItems],
  );
  const scenarioItems = useMemo<ScenarioItem[]>(() => rawItems.filter(row => (row.campus_id || "sem-campus") === activeCampusId && row.eligible_status).map(row => {
    const dfd = campusDfds.find(d => d.id === row.dfd_id);
    return { id: row.id || row.item_key, campusId: row.campus_id || "", unitId: row.unit_key || "", unitName: dfd?.unidade_nome || "Não identificado", dfdId: row.dfd_id,
      code: row.codigo_tce || row.codigo_item_efisco || "", description: row.descricao, gnd: row.gnd || "", quantity: row.quantidade, price: row.valor_unitario_estimado,
      impact: parseCriticidadeLevel(row.criticidade), timing: parsePriorizacaoLevel(row.moscow_categoria), highlight: row.is_highlight_item, group: row.institutional_group,
      eligible: row.eligible_status, fixed10: row.analysis_default_score === 10 };
  }), [rawItems, activeCampusId, campusDfds]);
  const dataReviewRows = useMemo(() => scenarioItems.flatMap(item => dataIssues(item).map(reason => protectReportRow({ item_id: item.id, dfd_id: item.dfdId, campus: activeCampusId, unidade: item.unitName, codigo: item.code, descricao: item.description, gnd: item.gnd, quantidade: item.quantity, preco_unitario: item.price, motivo: reason }))), [scenarioItems, activeCampusId]);
  const financial = useMemo(() => concentration(rawItems.filter(row => (row.campus_id || "sem-campus") === activeCampusId).map(row => row.quantidade * row.valor_unitario_estimado)), [rawItems, activeCampusId]);
  const maxVisibleScore = useMemo(() => Math.max(1, ...displayItems.map(row => row.rank_score)), [displayItems]);
  const activeFilterCount = useMemo(
    () =>
      [
        selectedDfdId !== "all",
        Boolean(itemSearchTerm.trim()),
        smartFilter !== "all",
        highlightOnly,
        quickFocus !== "none",
        naturezaFilter !== "all",
        grupoFilter !== "all",
        classeFilter !== "all",
        tipoFilter !== "all",
        servidorFilter !== "all",
        localUsoFilter !== "all",
      ].filter(Boolean).length,
    [
      classeFilter,
      grupoFilter,
      highlightOnly,
      itemSearchTerm,
      localUsoFilter,
      naturezaFilter,
      quickFocus,
      selectedDfdId,
      servidorFilter,
      smartFilter,
      tipoFilter,
    ],
  );
  const exportXLSX = async () => {
    if (displayItems.length === 0) {
      toast.info("Sem linhas para exportar.");
      return;
    }

    const rows = buildConsolidatedExportRows(displayItems);
    const visibleKeys = new Set(displayItems.map(item => item.item_key));
    const sourceItems = rawItems.filter(item => visibleKeys.has(item.item_key));
    const sourceDfdIds = new Set(sourceItems.map(item => item.dfd_id));
    const sourceDfds = campusDfds.filter(dfd => sourceDfdIds.has(dfd.id));
    const dfdRows = buildDfdSheetRows(sourceDfds as any);
    const sourceRows = buildSourceItemRows(sourceItems, sourceDfds);

    try {
      await downloadWorkbookFromSheets(
        [
          { name: "Consolidacao", rows },
          { name: "DFDs_Origem", rows: dfdRows },
          { name: "Concentracao_Campus", rows: [{ campus: campusOptions.find(c => c.id === activeCampusId)?.name || "N/D", universo: "Itens de origem do campus, antes dos filtros da lista", ...financial }] },
          { name: "Conferencia_Precos", rows: sourceItems.map(row => protectReportRow({ item_id: row.id || "", codigo: row.codigo_tce, unidade: row.unidade_medida || "", preco: row.valor_unitario_estimado, ...priceReview.get(row.id || row.item_key), interpretacao: "Triagem por mesmo código, unidade e GND no campus; não comprova equivalência técnica nem sobrepreço." })) },
          { name: "Itens_Origem", rows: sourceRows },
          { name: "Conferencia_Cadastro_Campus", rows: dataReviewRows },
          {
            name: "Contexto",
            rows: [
              { chave: "precedencia_institucional", valor: INSTITUTIONAL_PRIORITY_VERSION },
              { chave: "gerado_em", valor: new Date().toISOString() },
              { chave: "simulacao_ativa", valor: simulatedCount ? "SIM — avaliações alteradas apenas nesta sessão" : "NAO" },
              { chave: "itens_simulados_no_campus", valor: simulatedCount },
              { chave: "base_atualizada_em", valor: lastUpdatedAt?.toISOString() || "" },
              { chave: "metodo_precos", valor: "z robusto em log10; mínimo 8 observações; mesmo campus, código, unidade e GND; MAD zero indisponível" },
              { chave: "campus", valor: campusOptions.find(campus => campus.id === activeCampusId)?.name || "N/D" },
              { chave: "filtro_dfd", valor: selectedDfdId },
              { chave: "filtro_busca", valor: itemSearchTerm || "N/A" },
              { chave: "filtro_acao_inteligente", valor: smartFilter },
              { chave: "filtro_natureza_despesa", valor: naturezaDespesaLabel(naturezaFilter) },
              { chave: "filtro_grupo", valor: grupoFilter },
              { chave: "filtro_classe", valor: classeFilter },
              { chave: "filtro_tipo", valor: tipoFilter },
              { chave: "filtro_servidor", valor: servidorFilter },
              { chave: "filtro_local_uso", valor: localUsoFilter },
              { chave: "somente_pareto", valor: highlightOnly ? "SIM" : "NAO" },
              { chave: "total_dfds_aprovadas", valor: sourceDfds.length },
              { chave: "total_itens_consolidados", valor: items.length },
              { chave: "total_itens_exibidos", valor: displayItems.length },
              { chave: "total_valor_exibido", valor: Number(visibleValue.toFixed(2)) },
            ],
          },
        ],
        `consolidacao_pca_${activeCampusId || "sem-campus"}_${simulatedCount ? "simulacao_" : ""}${new Date().toLocaleDateString("pt-BR").replaceAll("/", "-")}.xlsx`,
      );
      toast.success("Planilha XLSX exportada.");
    } catch (error: any) {
      toast.error(error?.message || "Falha ao exportar XLSX.");
    }
  };

  if (loadError && !loading) {
    return <div className="px-4 py-12"><OperationalEmptyState title="Consolidação indisponível no momento" description={loadError} action={<button type="button" onClick={() => void fetchData()} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Tentar novamente</button>} /></div>;
  }

  return (
    <div className="consolidation-page">
      <section className="consolidation-overview">
        <div className="consolidation-heading">
          <div className="consolidation-heading-copy"><span className="consolidation-section-icon"><Cube size={28} weight="bold" /></span><div><h1>Consolidação Inteligente</h1><p>Consolide pedidos, identifique necessidades conjuntas e gere cenários para o PCA.</p></div></div>
          <div className="consolidation-heading-actions">
            <span className="consolidation-updated"><ArrowsClockwise size={15} />{formatUpdatedAtLabel(lastUpdatedAt)}</span>
            <Button type="button" variant="outline" onClick={exportXLSX} className="consolidation-button"><DownloadSimple size={17} />Exportar XLSX</Button>
            <Button type="button" onClick={fetchData} className="consolidation-button consolidation-button-primary"><ArrowsClockwise size={17} />Atualizar análise</Button>
          </div>
        </div>
        <div className="consolidation-overview-body">
          <div className="consolidation-campus-row">
          <div aria-label="Selecionar campus" className="consolidation-campus-tabs">
            {campusOptions.map(campus => (
              <button key={campus.id} type="button" aria-pressed={activeCampusId === campus.id}
                onClick={() => { setSelectedCampusId(campus.id); resetFilters(); setDfdSearchTerm(""); setCurrentPage(0); setExpandedItemId(null); setPreviewDfdId(null); }}
                className={cn("min-h-11 rounded-xl border px-5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#073D9D]", activeCampusId === campus.id ? "border-[#073D9D] bg-[#073D9D] text-white" : "border-[#D5E0EF] bg-white text-[#48617F] hover:bg-[#F4F8FF]")}>
                {campus.name}
              </button>
            ))}
          </div>
          <button type="button" className="consolidation-source-summary" onClick={() => setDfdMenuOpen(true)}><Info size={24} /><span><strong>{financial.count.toLocaleString("pt-BR")}</strong> itens de origem selecionados<small>Base: DFDs aprovadas no PCA</small></span><ArrowSquareOut size={16} /></button>
          </div>
          <details className="consolidation-method"><summary>Método e indicadores do campus</summary>            <div className="mt-3 space-y-2 text-sm text-[var(--p-color-fg-subtle)]">
              <p>Concentração financeira do campus, antes dos filtros: {financial.pareto80Count} de {financial.count} itens de origem somam 80% do valor. Gini {financial.gini.toFixed(3)} · HHI {financial.hhi.toFixed(3)} · número efetivo de itens {financial.effectiveCount.toFixed(1)}.</p>
              <p>Pontuação por nível: gestão de 300 a 399,99; cursos e colegiados de 200 a 299,99; laboratórios de 100 a 199,99. Pontuação final = base do nível + 100 × nota técnica ÷ (nota técnica + 280), com parcela técnica limitada a 99,99. Avaliações pendentes e unidades sem classificação ficam sem pontuação final.</p>
              <p>Conferência de preços: código, unidade e GND iguais no campus, mínimo de oito observações. O sinal pede revisão da especificação e da estimativa. As linhas da lista podem exigir rolagem horizontal em telas menores.</p>
              <p>Controles de avaliação simulam cenários nesta sessão. Avaliações oficiais permanecem nas origens.</p>

            </div>
          </details>
              {simulatedCount > 0 && <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] p-3 text-[var(--p-color-warning)]"><strong>Simulação ativa: {simulatedCount} item(ns). Alterações não salvas; exportação identificada como simulação.</strong><button type="button" onClick={restoreSimulation} className="min-h-11 rounded-lg border border-current px-3 font-semibold">Restaurar avaliações oficiais</button></div>}

          <section className="consolidation-metrics">
            <TopMetric
              icon={<CurrencyDollar size={25} weight="bold" />}
              title="Valor do recorte"
              value={visibleValue.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
              subtitle="Total estimado"
              highlight
              tone="action"
              compact
            />
            <TopMetric
              icon={<Cube size={25} weight="bold" />}
              title="Itens consolidados"
              value={String(displayItems.length)}
              subtitle="Itens no recorte"
              tone="collab"
              compact
            />
            <TopMetric
              icon={<Files size={25} weight="bold" />}
              title="DFDs de origem"
              value={String(campusDfds.length)}
              subtitle="DFDs aprovadas"
              tone="success"
              compact
            />
            <TopMetric
              icon={<Star size={24} weight="fill" />}
              title="Destaques da chefia"
              value={String(paretoCount)}
              subtitle="Indicação registrada pela chefia"
              tone="warning"
              compact
            />
            <div className="consolidation-radar">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-display whitespace-nowrap text-sm font-semibold text-[#09275D]">
                  Radar financeiro e de qualidade
                </h2>
                <span className="rounded-lg border border-[#D5E0EF] px-2 py-1 text-xs font-bold text-[#0647A8]">PCA</span>
              </div>
              <ConsolidationProgress
                label="Destaques da chefia"
                helper="Itens em destaque"
                value={displayItems.length ? (paretoCount / displayItems.length) * 100 : 0}
                tone="action"
              />
              <ConsolidationProgress
                label="Itens críticos"
                helper="Criticidade alta ou crítica"
                value={displayItems.length ? (criticosCount / displayItems.length) * 100 : 0}
                tone="danger"
              />
              <ConsolidationProgress
                label="Pendências de dados"
                helper="Avaliação ou cálculo de capital pendente"
                value={displayItems.length ? (incompletosCount / displayItems.length) * 100 : 0}
                tone="warning"
              />
            </div>
          </section>
          <section className="consolidation-alert">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
              <div className="flex items-center gap-4">
                <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E00017] text-white">
                  <WarningCircle size={30} weight="fill" />
                </span>
                <div>
                  <h2 className="text-lg font-bold">
                    Ação prioritária: saneamento administrativo
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#17305B]">
                    Itens e-Fisco sem natureza aguardam tratamento.
                  </p>
                </div>
              </div>
              <div className="border-[#F0B5BA] text-center lg:border-l lg:px-9">
                <p className="text-3xl font-semibold leading-none text-[#D30013]">
                  {naturezaReviewOpenCount.toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#D30013]">
                  itens pendentes na fila geral
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-start gap-3 lg:justify-end">
                <a
                  href="/admin/efisco-natureza-review"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#D70416] px-7 text-sm font-bold uppercase text-white shadow-[0_10px_20px_rgba(215,4,22,0.2)] hover:bg-[#B90010]"
                >
                  Abrir fila
                  <ArrowSquareOut size={17} weight="bold" />
                </a>
                <a
                  href="#itens-consolidados-recorte"
                  className="inline-flex h-10 items-center rounded-xl px-2 text-sm font-semibold text-[#0647A8] hover:bg-white"
                >
                  Entenda o impacto
                </a>
              </div>
            </div>
          </section>


        </div>
      </section>

      {!loading && <ConsolidationScenarios key={`${activeCampusId}:${lastUpdatedAt?.toISOString()}`} items={scenarioItems} campusName={campusOptions.find(c => c.id === activeCampusId)?.name || "Campus não identificado"} updatedAt={lastUpdatedAt?.toISOString() || ""} />}
      <div className="consolidation-table-section">
        <section
          id="itens-consolidados-recorte"
          data-consolidation-table
          className={cn(
            "relative flex flex-col overflow-hidden rounded-2xl bg-white",
            contrastMode === "high" && "border-upe-blue-upe/30",
          )}
        >
          {starConfettiPieces.length > 0 ? (
            <StarConfettiRain pieces={starConfettiPieces} />
          ) : null}
          <div className="space-y-3 border-b border-[#E5ECF6] bg-white p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold tracking-tight text-[#09275D]">
                  Itens consolidados do recorte
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#526780]">
                  A pontuação final combina o nível institucional e a nota técnica. Custeio e serviços preservam os pesos anteriores; capital preserva avaliação, destaque e ajuste financeiro. Valor e quantidade são ordenações exploratórias.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDfdMenuOpen(true)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#D5E0EF] bg-white px-4 text-sm font-bold uppercase text-[#0647A8] shadow-sm hover:bg-[#F4F8FF]"
                >
                  <ArrowSquareOut size={16} />
                  Ver DFDs de origem ({campusDfds.length})
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(280px,1fr)_auto]">
              <div className="relative min-w-0">
                <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6F86A9]" />
                <input
                  aria-label="Buscar itens consolidados"
                  value={itemSearchTerm}
                  onChange={(event) => {
                    setItemSearchTerm(event.target.value);
                    setActivePreset("custom");
                  }}
                  placeholder="Buscar por item, protocolo, campus, solicitante ou descrição..."
                  className="h-11 w-full min-w-0 rounded-lg border border-[#C9D8EF] bg-white pl-11 pr-4 text-sm text-[#173B73] outline-none focus:border-[#3674D4] focus:ring-2 focus:ring-[#0D5DDB]/15"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((prev) => !prev)}
                  className={cn(
                    "inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 type-kicker font-semibold uppercase tracking-widest shadow-sm transition-colors",
                    filtersOpen
                      ? "border-[#073D9D] bg-[#073D9D] text-white"
                      : "border-[#D5E0EF] bg-white text-[#0647A8] hover:bg-[#F4F8FF]",
                  )}
                >
                  <Funnel size={14} />
                  Filtros
                </button>
                <select
                  aria-label="Ordenar itens consolidados"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as "score_desc" | "value_desc" | "quantity_desc")}
                  className="h-11 rounded-xl border border-[#D5E0EF] bg-white px-4 text-sm font-semibold text-[#0647A8] outline-none shadow-sm"
                >
                  <option value="score_desc">Pontuação final — prioridade</option>
                  <option value="value_desc">Maior valor — exploração</option>
                  <option value="quantity_desc">Maior quantidade — exploração</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <QuickFilterChip
                label="Todos"
                count={items.length}
                active={smartFilter === "all" && !highlightOnly && quickFocus === "none"}
                onClick={() => {
                  setSmartFilter("all");
                  setHighlightOnly(false);
                  setQuickFocus("none");
                }}
              />
              <QuickFilterChip
                label="Estrela"
                count={paretoCount}
                active={smartFilter === "pareto" || highlightOnly}
                onClick={() => {
                  setSmartFilter("pareto");
                  setHighlightOnly(false);
                  setQuickFocus("none");
                  triggerStarCelebration();
                }}
                tone="gold"
              />
              <QuickFilterChip
                label="Críticos"
                count={criticosCount}
                active={quickFocus === "criticos"}
                onClick={() => {
                  setSmartFilter("all");
                  setHighlightOnly(false);
                  setQuickFocus("criticos");
                }}
                tone="red"
              />
              <QuickFilterChip
                label="Essenciais"
                count={essenciaisCount}
                active={quickFocus === "essenciais"}
                onClick={() => {
                  setSmartFilter("all");
                  setHighlightOnly(false);
                  setQuickFocus("essenciais");
                }}
                tone="blue"
              />
              <QuickFilterChip
                label="Conferir preços"
                count={outliersCount}
                active={smartFilter === "outlier"}
                onClick={() => {
                  setSmartFilter("outlier");
                  setHighlightOnly(false);
                  setQuickFocus("none");
                }}
                tone="orange"
              />
              <QuickFilterChip
                label="Sem classificação"
                count={incompletosCount}
                active={smartFilter === "incompleto"}
                onClick={() => {
                  setSmartFilter("incompleto");
                  setHighlightOnly(false);
                  setQuickFocus("none");
                }}
              />
            </div>

            {filtersOpen && (
              <div className="space-y-3 rounded-2xl border border-[var(--p-color-info-border)] bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="type-kicker font-semibold uppercase tracking-widest text-black/40">
                    Presets:
                  </span>
                  <PresetButton
                    label="Destaques da chefia"
                    active={activePreset === "executivo_pareto"}
                    onClick={() => applyPreset("executivo_pareto")}
                  />
                  <PresetButton
                    label="Risco de Dados"
                    active={activePreset === "risco_dados"}
                    onClick={() => applyPreset("risco_dados")}
                  />
                  <PresetButton
                    label="Outlier de Preço"
                    active={activePreset === "outlier_preco"}
                    onClick={() => applyPreset("outlier_preco")}
                  />
                  <PresetButton
                    label="Somente Serviços"
                    active={activePreset === "servicos"}
                    onClick={() => applyPreset("servicos")}
                  />
                  <PresetButton
                    label="Somente Materiais"
                    active={activePreset === "materiais"}
                    onClick={() => applyPreset("materiais")}
                  />
                  <PresetButton
                    label="Foco Laboratórios"
                    active={activePreset === "laboratorios"}
                    onClick={() => applyPreset("laboratorios")}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      applyPreset("custom");
                      setActivePreset("custom");
                    }}
                    className="h-8 px-3 rounded-lg border border-black/10 bg-white type-kicker uppercase tracking-widest font-semibold text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-surface-muted)]"
                  >
                    Limpar
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
                  <input
                    value={itemSearchTerm}
                    onChange={(event) => {
                      setItemSearchTerm(event.target.value);
                      setActivePreset("custom");
                    }}
                    placeholder="Buscar código, descrição, servidor, local..."
                    className="h-10 min-w-0 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[var(--p-color-action)]/20 md:col-span-2 xl:col-span-2"
                  />
                  <select
                    aria-label="Filtrar natureza da despesa"
                    value={naturezaFilter}
                    onChange={(event) => {
                      setNaturezaFilter(event.target.value as NaturezaDespesaFilter);
                      setActivePreset("custom");
                    }}
                    className="h-10 min-w-0 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--p-color-brand-500)] outline-none focus:ring-2 focus:ring-[var(--p-color-action)]/20"
                  >
                    <option value="all">Natureza: todas</option>
                    <option value="custeio">Custeio</option>
                    <option value="permanente">Permanente</option>
                    <option value="sem_gnd">Sem GND</option>
                  </select>
                  <select
                    aria-label="Filtrar grupo de produtos"
                    value={grupoFilter}
                    onChange={(event) => {
                      setGrupoFilter(event.target.value);
                      setActivePreset("custom");
                    }}
                    className="h-10 min-w-0 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--p-color-brand-500)] outline-none focus:ring-2 focus:ring-[var(--p-color-action)]/20"
                  >
                    <option value="all">Grupo: todos</option>
                    {grupoOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filtrar classe de produtos"
                    value={classeFilter}
                    onChange={(event) => {
                      setClasseFilter(event.target.value);
                      setActivePreset("custom");
                    }}
                    className="h-10 min-w-0 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--p-color-brand-500)] outline-none focus:ring-2 focus:ring-[var(--p-color-action)]/20"
                  >
                    <option value="all">Classe: todas</option>
                    {classeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filtrar material ou serviço"
                    value={tipoFilter}
                    onChange={(event) => {
                      setTipoFilter(event.target.value as "all" | "Material" | "Serviço");
                      setActivePreset("custom");
                    }}
                    className="h-10 min-w-0 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--p-color-brand-500)] outline-none focus:ring-2 focus:ring-[var(--p-color-action)]/20"
                  >
                    <option value="all">Tipo: todos</option>
                    <option value="Material">Material</option>
                    <option value="Serviço">Serviço</option>
                  </select>
                  <select
                    aria-label="Filtrar solicitante"
                    value={servidorFilter}
                    onChange={(event) => {
                      setServidorFilter(event.target.value);
                      setActivePreset("custom");
                    }}
                    className="h-10 min-w-0 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--p-color-brand-500)] outline-none focus:ring-2 focus:ring-[var(--p-color-action)]/20 xl:col-span-2"
                  >
                    <option value="all">Servidor: todos</option>
                    {servidorOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filtrar unidade ou local de uso"
                    value={localUsoFilter}
                    onChange={(event) => {
                      setLocalUsoFilter(event.target.value);
                      setActivePreset("custom");
                    }}
                    className="h-10 min-w-0 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--p-color-brand-500)] outline-none focus:ring-2 focus:ring-[var(--p-color-action)]/20 md:col-span-2 xl:col-span-2"
                  >
                    <option value="all">Departamento/Lab: todos</option>
                    <option value="__LAB__">Somente laboratórios</option>
                    {localUsoOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        resetFilters();
                        setActivePreset("custom");
                      }}
                      className="h-8 rounded-lg border border-black/10 bg-white px-3 type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-surface-muted)]"
                    >
                      Remover filtros
                    </button>
                  )}
                </div>
                {showLegends && (
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 rounded-lg border type-kicker uppercase tracking-widest font-semibold bg-[var(--p-color-danger-bg)] text-[var(--p-color-danger)] border-[var(--p-color-danger-border)]">
                      Criticidade alta
                    </span>
                    <span className="px-2.5 py-1 rounded-lg border type-kicker uppercase tracking-widest font-semibold bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-500)] border-[var(--p-color-info-border)]">
                      Priorização essencial
                    </span>
                    <span className="px-2.5 py-1 rounded-lg border type-kicker uppercase tracking-widest font-semibold bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)] border-[var(--p-color-warning-border)]">
                      Destaques da chefia
                    </span>
                    <span className="px-2.5 py-1 rounded-lg border type-kicker uppercase tracking-widest font-semibold bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)] border-[var(--p-color-warning-border)]">
                      Atenção de qualidade
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div role="table" aria-label="Itens consolidados" aria-colcount={13} aria-rowcount={displayItems.length + 1} className="min-h-0 flex-1 overflow-x-auto">
            {!loading && displayItems.length > 0 ? (
              <div role="row" aria-rowindex={1} className={cn(CONSOLIDATED_TABLE_GRID, "min-w-[1320px] items-center gap-2 border-b border-[#DCE7F4] bg-[#F8FBFF] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.03em] text-[#61799C]")}>
                <span role="columnheader">#</span>
                <span role="columnheader">Código</span>
                <span role="columnheader">Item</span>
                <span role="columnheader">Categoria</span>
                <span role="columnheader" className="text-right">Qtd. solicitada</span>
                <span role="columnheader">Unidade</span>
                <span role="columnheader" className="text-right">Valor estimado</span>
                <span role="columnheader">Origem</span>
                <span role="columnheader">Local</span>
                <span role="columnheader">Pontuação final</span>
                <span role="columnheader" className="text-center">Estrela</span>
                <span role="columnheader" className="text-center">Solicitante</span>
                <span role="columnheader" className="text-center">Ações</span>
              </div>
            ) : null}
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(7)].map((_, index) => (
                  <Skeleton key={index} className="h-10 rounded-lg" />
                ))}
              </div>
            ) : displayItems.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 py-10">
                <OperationalEmptyState
                  icon={
                    <img
                      src="/guidance/triage-empty-queue.png"
                      alt=""
                      className="h-auto w-32 object-contain"
                    />
                  }
                  title="Nenhum item neste recorte"
                  description="Ajuste os filtros ou escolha outra DFD de origem para voltar a enxergar a fila de priorização."
                  className="max-w-lg"
                  action={
                    activeFilterCount > 0 || selectedDfdId !== "all" ? (
                      <button
                        type="button"
                        onClick={() => {
                          resetFilters();
                          setActivePreset("custom");
                        }}
                        className="inline-flex h-10 items-center justify-center rounded-2xl border border-[var(--p-color-info-border)] bg-white px-4 text-sm font-semibold text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-info-bg)]"
                      >
                        Limpar recorte
                      </button>
                    ) : null
                  }
                />
              </div>
            ) : (
              <Virtuoso
                className="min-w-[1320px]"
                style={{ height: 420, width: "100%" }}
                data={pageItems}
                overscan={320}
                computeItemKey={(_, item) => item.item_key}
                itemContent={(index, item) => {
                  const scoreWidth = Math.max(
                    6,
                    Math.min(100, Math.round((item.rank_score / maxVisibleScore) * 100)),
                  );
                  const isExpanded = expandedItemId === item.item_key;
                  const chefiaPareto = item.source_highlight_count > 0;
                   const originCount = item.solicitante_people.length || item.solicitantes.length;
                  return (
                    <div
                      className={cn(
                        "border-b border-[#E2EBF6] bg-white text-xs transition-colors hover:bg-[#F7FAFF]",
                        contrastMode === "high" && "border-b-2 border-[var(--p-color-action)]",
                      )}
                    >
                      <div role="row" aria-rowindex={effectivePage * pageSize + index + 2} className={cn(CONSOLIDATED_TABLE_GRID, "min-h-11 items-center gap-2 px-4 py-1.5")}>
                        <span role="cell" className="tabular-nums text-[#6680A7]">{effectivePage * pageSize + index + 1}</span>
                        <span role="cell" className="truncate font-medium text-[#486B9D]" title={`#${item.siad}`}>#{item.siad}</span>
                        <span role="cell" className="min-w-0 font-medium text-[#17315D]" title={item.descricao}>
                          <span className="block truncate">{item.descricao}</span>
                          <span className="block truncate text-[10px] font-semibold text-[#526780]">{INSTITUTIONAL_GROUP_LABELS[item.institutional_group]}</span>
                          <span className="block truncate text-[10px] font-normal text-[#526780]">{item.dfd_sources.length === 1 ? `${item.dfd_sources[0].numero_protocolo} · ${item.dfd_sources[0].solicitante_nome} · ${item.dfd_sources[0].status === "triagem" ? "Em triagem" : item.dfd_sources[0].status}` : `${item.dfd_sources.length} pedidos de origem`}</span>
                        </span>
                        <span role="cell" className={cn("w-fit max-w-full truncate rounded-md border px-2 py-1 text-[11px] font-medium", consolidationCategoryClass(item.grupo_nome))} title={item.grupo_nome}>{item.grupo_nome}</span>
                        <span role="cell" className="text-right font-semibold tabular-nums text-[#17315D]" title={`Quantidade total solicitada: ${item.quantidade_total.toLocaleString("pt-BR")}`}>{item.quantidade_total.toLocaleString("pt-BR")}</span>
                        <span role="cell" className="truncate font-medium text-[#486B9D]" title={item.unidades_medida.length > 0 ? item.unidades_medida.join(", ") : "Unidade não informada"}>{item.unidades_medida.length === 1 ? item.unidades_medida[0] : item.unidades_medida.length > 1 ? "Variadas" : "N/I"}</span>
                        <span role="cell" className="text-right font-semibold tabular-nums text-[#0751B4]">{item.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        <span role="cell" className="truncate text-[#355179]" title={`${originCount} solicitante${originCount === 1 ? "" : "s"} em ${item.dfd_sources.length} DFD${item.dfd_sources.length === 1 ? "" : "s"}`}>{originCount} servidor{originCount === 1 ? "" : "es"}</span>
                        <span role="cell" className="truncate text-[#355179]" title={compactList(item.locais_uso, 3)}>{compactList(item.locais_uso, 1)}</span>
                        <span role="cell" className="flex h-7 items-center gap-1.5 rounded-md border border-[#DBE9E3] bg-[#EEF8F3] px-2" title={item.institutional_score == null ? item.capital_priority?.reason || "Confirme a avaliação e o nível institucional." : `Pontuação final: ${item.rank_score.toFixed(2)} · nota técnica: ${item.technical_score?.toFixed(2)}`}>
                          <span className="font-bold tabular-nums text-[#173F35]">{item.institutional_score == null ? "Pendente" : item.rank_score.toFixed(2)}</span>
                          {showScoreBars ? <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#D8E5EF]"><span className="block h-full rounded-full bg-gradient-to-r from-[#B87A21] via-[#368783] to-[#1254AE]" style={{ width: `${scoreWidth}%` }} /></span> : null}
                        </span>
                        <span role="cell" className={cn("flex items-center justify-center", chefiaPareto ? "text-[#C87412]" : "text-[#7A92B6]")} title={chefiaPareto ? "Destaque indicado pela chefia" : "Sem destaque da chefia"}>
                          <Star size={19} weight={chefiaPareto ? "fill" : "regular"} />
                        </span>
                        <span role="cell" className="flex items-center justify-center"><AvatarGroup people={item.solicitante_people.slice(0, 1)} /></span>
                        <span role="cell"><button
                          type="button"
                          onClick={() => setExpandedItemId((prev) => (prev === item.item_key ? null : item.item_key))}
                          aria-label={`Abrir ações de ${item.descricao}`}
                          aria-expanded={isExpanded}
                          title="Ações do item"
                          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#C9D8EF] bg-white text-[#0751B4] hover:bg-[#EFF5FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0751B4]"
                        >
                          <DotsThree size={18} weight="bold" />
                        </button></span>
                      </div>

                      {isExpanded ? (
                        <div role="row"><div role="cell" aria-colspan={13}><div className="mx-4 mb-3 mt-1 grid gap-4 border-t border-[var(--p-color-border-muted)] pt-4 lg:grid-cols-[1fr_1fr]">
                          <div className="space-y-3">
                            {item.capital_priority ? (
                              <div className="rounded-xl border border-[#C9D8EF] bg-[#F4F8FF] p-3 text-xs text-[#17315D]">
                                <p className="font-semibold">Pontuação de capital · {item.capital_priority.version}</p>
                                {item.capital_priority.status === "pending" ? (
                                  <p className="mt-1">{item.capital_priority.reason}</p>
                                ) : (
                                  <div className="mt-2 space-y-1 tabular-nums">
                                    <p>Chefia: {item.capital_priority.humanScore?.toFixed(2)} · Pareto: +{item.capital_priority.paretoBonus?.toFixed(2)}</p>
                                    <p>Concentração no campus: −{item.capital_priority.campusPenalty?.toFixed(2)} · acréscimo da unidade: −{item.capital_priority.unitIncrement?.toFixed(2)}</p>
                                    <p>Carteira do campus: {item.capital_priority.campusTotal?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ({item.capital_priority.campusSize} necessidades)</p>
                                    <p>Referência do campus: {item.capital_priority.campusReference?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                                    {item.capital_priority.unitReference !== undefined ? <p>Referência da unidade: {item.capital_priority.unitReference.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ({item.capital_priority.unitSize} necessidades)</p> : <p>Unidade sem amostra suficiente para ajuste local.</p>}
                                  </div>
                                )}
                              </div>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[var(--p-color-fg-subtle)]">
                              <span>Variações {item.description_variants}</span>
                              <span className="text-black/25">•</span>
                              <span>Faixa {formatCompactCurrencyRange(item.min_unit_value, item.max_unit_value)}</span>
                              <span className="text-black/25">•</span>
                              <span>Campos ausentes {item.missing_quality_count}%</span>
                            </div>
                            <div>
                              <div className="mb-1 flex items-center justify-between">
                                <p className="type-kicker uppercase tracking-widest text-[var(--p-color-warning)] font-semibold">
                                  Criticidade
                                </p>
                                <span className="type-caption font-semibold text-[var(--p-color-danger)]">
                                  {CRITICIDADE_LABELS[item.criticidade_level]}
                                </span>
                              </div>
                              <input
                                type="range"
                                aria-label={`Simular criticidade de ${item.descricao}`}
                                min={0}
                                max={4}
                                step={1}
                                value={item.criticidade_level}
                                disabled={Boolean(item.capital_priority) || item.analysis_default_score === 10}
                                onChange={(event) =>
                                  updateItemLevel(
                                    item.item_key,
                                    "criticidade_level",
                                    Number(event.target.value),
                                  )
                                }
                                className="w-full h-1.5 rounded-lg slider-crit accent-[var(--p-color-danger)]"
                              />
                            </div>
                            <div>
                              <div className="mb-1 flex items-center justify-between">
                                <p className="type-kicker uppercase tracking-widest text-[var(--p-color-brand-400)] font-semibold">
                                  Priorização
                                </p>
                                <span className="type-caption font-semibold text-[var(--p-color-brand-500)]">
                                  {PRIORIZACAO_LABELS[item.priorizacao_level]}
                                </span>
                              </div>
                              <input
                                type="range"
                                aria-label={`Simular prioridade de ${item.descricao}`}
                                min={0}
                                max={4}
                                step={1}
                                value={item.priorizacao_level}
                                disabled={Boolean(item.capital_priority) || item.analysis_default_score === 10}
                                onChange={(event) =>
                                  updateItemLevel(
                                    item.item_key,
                                    "priorizacao_level",
                                    Number(event.target.value),
                                  )
                                }
                                className="w-full h-1.5 rounded-lg slider-prio accent-[var(--p-color-brand-500)]"
                              />
                            </div>
                          </div>
                          <div className="rounded-[18px] border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-3">
                            <p className="type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-fg-subtle)]">
                              Contexto do item
                            </p>
                            <div className="mt-3 space-y-2">
                              <MetricLine label="Quantidade" value={String(item.quantidade_total)} />
                              <MetricLine label="Valor unitário" value={formatCompactCurrencyRange(item.min_unit_value, item.max_unit_value)} />
                              <MetricLine label="Campus" value={compactList(item.pedidos, 2)} />
                              <MetricLine label="Nível institucional" value={INSTITUTIONAL_GROUP_LABELS[item.institutional_group]} />
                              <MetricLine label="Nota técnica" value={item.technical_score?.toFixed(2) || "Pendente"} />
                              <MetricLine label="Pontuação final" value={item.institutional_score?.toFixed(2) || "Pendente"} />
                            </div>
                            <div className="mt-3 space-y-3 text-xs text-[var(--p-color-fg-subtle)]">
                              {rawItems.filter(source => source.item_key === item.item_key).map(source => (
                                <div key={source.id} className="space-y-1 rounded-lg bg-[#F5F7FB] p-3">
                                  <p className="font-semibold">{source.local_uso || "Local de uso não informado"}</p>
                                  <p>Conferência de preço: {(() => { const signal = priceReview.get(source.id || source.item_key); return signal?.status === "available" ? `z robusto ${signal.z?.toFixed(2)} · ${signal.n} observações${signal.flagged ? " · conferir especificação e preço" : " · sem sinal estatístico"}` : signal?.status === "invalid" ? "Preço inválido ou não positivo; corrigir cadastro." : signal?.status === "zero_mad" ? "MAD zero: comparação indisponível, mesmo que existam preços diferentes." : `Amostra insuficiente (${signal?.n || 0}/8).`; })()}</p>
                                  <p className="whitespace-pre-wrap">{source.justificativa_item || "Justificativa não informada"}</p>
                                  {source.justificativa_quantidade ? <p className="whitespace-pre-wrap">Quantidade: {source.justificativa_quantidade}</p> : null}
                                  {source.link_referencia && /^https?:\/\//i.test(source.link_referencia) ? <a href={source.link_referencia} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center font-semibold text-[#073D9D]">Consultar referência de preço <ArrowSquareOut size={14} className="ml-1" /></a> : null}
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 border-t border-[var(--p-color-border-muted)] pt-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-color-fg-subtle)]">
                                DFDs de origem ({item.dfd_sources.length})
                              </p>
                              <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                                {item.dfd_sources.map((dfd) => (
                                  <a
                                    key={dfd.id}
                                    href={`/dfd/${dfd.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`Abrir DFD completa ${dfd.numero_protocolo}`}
                                    className="flex min-h-9 items-center justify-between gap-3 rounded-lg px-2 text-xs font-semibold text-[var(--p-color-brand-500)] transition-colors hover:bg-[var(--p-color-info-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p-color-action)]"
                                  >
                                    <span className="min-w-0 truncate" title={`${dfd.numero_protocolo} · ${dfd.solicitante_nome}`}>
                                      {dfd.numero_protocolo}
                                      <span className="ml-2 font-normal text-[var(--p-color-fg-subtle)]">{dfd.solicitante_nome}</span>
                                    </span>
                                    <span className="inline-flex shrink-0 items-center gap-1">
                                      Abrir completa
                                      <ArrowSquareOut size={16} aria-hidden="true" />
                                    </span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div></div></div>
                      ) : null}
                    </div>
                  );
                }}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5ECF6] px-4 py-3 text-sm text-[#526780]">
            <p>
              Mostrando {displayItems.length === 0 ? 0 : effectivePage * pageSize + 1}–{Math.min((effectivePage + 1) * pageSize, displayItems.length)} de {displayItems.length.toLocaleString("pt-BR")} itens
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="consolidacao-page-size" className="hidden sm:inline">Itens por página</label>
              <select
                id="consolidacao-page-size"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(0);
                }}
                className="h-9 rounded-lg border border-[#D5E0EF] bg-white px-2 text-sm text-[#0647A8]"
              >
                {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              <button
                type="button"
                aria-label="Página anterior"
                disabled={effectivePage === 0}
                onClick={() => setCurrentPage(effectivePage - 1)}
                className="h-9 rounded-lg border border-[#D5E0EF] px-3 disabled:opacity-40"
              >‹</button>
              <nav aria-label="Páginas dos itens consolidados" className="hidden items-center gap-1 sm:flex">
                {paginationPages.map((page, index) => page === "ellipsis" ? (
                  <span key={`gap-${index}`} className="px-1 text-[#6B83A4]">…</span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    aria-label={`Página ${page + 1}`}
                    aria-current={page === effectivePage ? "page" : undefined}
                    onClick={() => setCurrentPage(page)}
                    className={cn("h-9 min-w-9 rounded-lg px-2 text-sm font-semibold", page === effectivePage ? "bg-[#0B438F] text-white shadow-sm" : "text-[#355C96] hover:bg-[#EFF5FF]")}
                  >
                    {page + 1}
                  </button>
                ))}
              </nav>
              <span className="min-w-14 text-center text-sm font-semibold text-[#0647A8] sm:hidden">{effectivePage + 1} / {pageCount}</span>
              <button
                type="button"
                aria-label="Próxima página"
                disabled={effectivePage >= pageCount - 1}
                onClick={() => setCurrentPage(effectivePage + 1)}
                className="h-9 rounded-lg border border-[#D5E0EF] px-3 disabled:opacity-40"
              >›</button>
            </div>
          </div>
        </section>
      </div>

      {dfdMenuOpen ? (
        <>
          <button
            type="button"
            aria-label="Fechar lista de DFDs"
            className="fixed inset-0 z-40 bg-[var(--p-color-scrim-soft)] backdrop-blur-[1px]"
            onClick={() => setDfdMenuOpen(false)}
          />
          <AccessiblePanel label="DFDs de origem" onClose={() => setDfdMenuOpen(false)} className="fixed inset-y-4 left-4 z-50 w-[400px] max-w-[calc(100vw-2rem)] rounded-[28px] border border-[var(--p-color-info-border)] bg-white shadow-[0_24px_56px_rgba(15,34,56,0.18)]">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-black/5 px-5 py-4">
                <div>
                  <p className="type-kicker font-semibold uppercase tracking-[0.16em] text-[var(--p-color-brand-400)]">
                    Origem do recorte
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-[var(--p-color-brand-500)]">
                    DFDs de origem
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDfdMenuOpen(false)}
                  aria-label="Fechar lista de DFDs"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-info-bg)]"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>
              <div className="space-y-3 border-b border-black/5 px-5 py-4">
                <div className="flex items-center justify-between type-kicker font-semibold uppercase tracking-widest text-black/40">
                  <span>{filteredDfds.length} no recorte</span>
                  <span>{selectedDfdId === "all" ? "Todas" : "1 ativa"}</span>
                </div>
                <input
                  value={dfdSearchTerm}
                  onChange={(event) => setDfdSearchTerm(event.target.value)}
                  aria-label="Buscar DFD de origem por protocolo ou solicitante"
                  placeholder="Buscar protocolo ou solicitante"
                  className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[var(--p-color-action)]/20"
                />
              </div>
              <div className="flex-1 min-h-0">
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[...Array(5)].map((_, index) => (
                      <Skeleton key={index} className="h-24 rounded-2xl" />
                    ))}
                  </div>
                ) : filteredDfds.length === 0 ? (
                  <div className="flex h-full items-center justify-center p-6 text-center text-sm font-semibold text-black/40">
                    Sem DFDs para o filtro informado.
                  </div>
                ) : (
                  <Virtuoso
                    className="h-full"
                    data={filteredDfds}
                    itemContent={(_, dfd) => (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDfdId((prev) => (prev === dfd.id ? "all" : dfd.id));
                          setDfdMenuOpen(false);
                        }}
                        className={cn(
                          "w-full border-b border-black/5 px-4 py-3 text-left transition-colors",
                          selectedDfdId === dfd.id
                            ? "bg-[var(--p-color-info-bg)]"
                            : "hover:bg-[var(--p-color-surface-muted)]/60",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="inline-flex items-center gap-1.5 type-micro font-semibold uppercase tracking-[0.14em] text-black/35">
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                selectedDfdId === dfd.id ? "bg-[var(--p-color-action)]" : "bg-[var(--p-color-fg-subtle)]/45",
                              )}
                            />
                            {dfd.numero_protocolo}
                          </p>
                          <span className="type-micro font-semibold uppercase tracking-[0.14em] text-black/35">
                            {dfd.item_count} itens
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-[var(--p-color-fg-strong)]">
                          {dfd.objeto_contratacao}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2 type-caption text-black/60">
                          <div className="flex min-w-0 items-center gap-2">
                            <CompactAvatar
                              name={dfd.solicitante_nome}
                              avatarUrl={dfd.solicitante_avatar_url}
                            />
                            <span className="truncate">{dfd.solicitante_nome}</span>
                          </div>
                          <span className="shrink-0 font-semibold text-[var(--p-color-brand-500)]">
                            {dfd.valor_total.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                        </div>
                        <p className="mt-1 type-kicker text-[var(--p-color-fg-muted)]">
                          {dfd.campus_nome} • {dfd.unidade_nome || "local não definido"}
                        </p>
                      </button>
                    )}
                  />
                )}
              </div>
            </div>
          </AccessiblePanel>
        </>
      ) : null}

      {previewDfd ? (
        <>
          <button
            type="button"
            aria-label="Fechar painel da DFD"
            className="fixed inset-0 z-40 bg-[var(--p-color-scrim-soft)] backdrop-blur-[1px]"
            onClick={() => setPreviewDfdId(null)}
          />
          <AccessiblePanel label="Contexto da DFD" onClose={() => setPreviewDfdId(null)} className="fixed inset-y-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-[28px] border border-[var(--p-color-info-border)] bg-white shadow-[0_24px_56px_rgba(15,34,56,0.22)]">
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-[var(--p-color-border)] bg-[var(--p-color-info-bg)] px-5 py-4">
                <div className="min-w-0">
                  <p className="type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-brand-400)]">
                    Contexto da DFD
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-[var(--p-color-brand-500)]">
                    {previewDfd.numero_protocolo}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewDfdId(null)}
                  aria-label="Fechar contexto da DFD"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-surface-muted)]"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="rounded-2xl border border-[var(--p-color-border)] bg-white p-4">
                  <p className="type-kicker font-semibold uppercase tracking-widest text-black/35">
                    Objeto
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--p-color-fg-strong)]">
                    {previewDfd.objeto_contratacao}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <KpiCard label="Itens" value={previewDfd.item_count} />
                  <KpiCard
                    label="Valor total"
                    value={previewDfd.valor_total.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  />
                </div>

                <div className="rounded-2xl border border-black/5 bg-[var(--p-color-surface-soft)] p-4 space-y-3">
                  <MetricLine label="Campus" value={previewDfd.campus_nome || "Não informado"} />
                  <MetricLine label="Unidade" value={previewDfd.unidade_nome || "Não informada"} />
                  <MetricLine
                    label="Criada em"
                    value={
                      previewDfd.created_at
                        ? new Date(previewDfd.created_at).toLocaleString("pt-BR")
                        : "Data não informada"
                    }
                  />
                </div>

                <div className="rounded-2xl border border-black/5 bg-white p-4">
                  <p className="type-kicker font-semibold uppercase tracking-widest text-black/35">
                    Solicitante
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <CompactAvatar
                      name={previewDfd.solicitante_nome}
                      avatarUrl={previewDfd.solicitante_avatar_url}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--p-color-fg-strong)]">
                        {previewDfd.solicitante_nome}
                      </p>
                      <p className="truncate text-xs text-[var(--p-color-fg-subtle)]">
                        {previewDfd.solicitante_email || "email não informado"}
                      </p>
                    </div>
                  </div>
                </div>

                {previewDfd.itens_sem_classificacao > 0 ? (
                  <div className="rounded-2xl border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] p-4 text-[var(--p-color-warning)]">
                    <p className="type-kicker font-semibold uppercase tracking-widest">
                      Atenção
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {previewDfd.itens_sem_classificacao} item(ns) ainda sem classificação completa.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-[var(--p-color-border)] px-5 py-4">
                <a
                  href={`/dfd/${previewDfd.id}`}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--p-color-brand-500)] px-4 text-sm font-semibold text-white hover:bg-[var(--p-color-brand-600)]"
                >
                  <ArrowSquareOut size={16} weight="bold" />
                  Abrir DFD completa
                </a>
              </div>
            </div>
          </AccessiblePanel>
        </>
      ) : null}
    </div>
  );
}

function AccessiblePanel({ label, onClose, className, children }: { label: string; onClose: () => void; className: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-label={label} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }} className={cn(className, "m-0 h-[calc(100dvh-2rem)] max-h-none text-[var(--p-color-fg)] backdrop:bg-[var(--p-color-scrim-soft)]")}>{children}</dialog>;
}

function KpiCard({
  label,
  value,
  emphasis = "default",
}: {
  label: string;
  value: string | number;
  emphasis?: "default" | "primary";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 shadow-sm",
        emphasis === "primary"
          ? "border-[var(--p-color-info-border)] bg-[linear-gradient(180deg,white_0%,var(--p-color-info-bg)_100%)] shadow-[0_12px_28px_rgba(22,64,115,0.08)]"
          : "border-[var(--p-color-border)] bg-white",
      )}
    >
      <p className="type-micro font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-semibold tracking-tight text-[var(--p-color-brand-500)]",
          emphasis === "primary" ? "text-3xl" : "text-lg",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StarConfettiRain({ pieces }: { pieces: StarConfettiPiece[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className={cn("absolute -top-5 opacity-95 will-change-transform", piece.round ? "rounded-full" : "rounded-[2px]")}
          style={{
            left: `${piece.left}%`,
            width: `${piece.size}px`,
            height: `${piece.round ? piece.size : piece.size * 1.6}px`,
            backgroundColor: piece.color,
            transform: `translate3d(0,-16px,0) rotate(0deg)`,
            animationName: "star-confetti-fall",
            animationDuration: `${piece.durationMs}ms`,
            animationDelay: `${piece.delayMs}ms`,
            animationTimingFunction: "cubic-bezier(0.22, 0.7, 0.3, 1)",
            animationFillMode: "forwards",
            ["--star-drift" as string]: `${piece.driftPx}px`,
            ["--star-rotate" as string]: `${piece.rotateDeg}deg`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes star-confetti-fall {
          0% {
            transform: translate3d(0, -16px, 0) rotate(0deg);
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--star-drift), 560px, 0) rotate(var(--star-rotate));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function TopMetric({
  title,
  value,
  subtitle,
  icon,
  highlight = false,
  tone = "action",
  compact = false,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon?: ReactNode;
  highlight?: boolean;
  tone?: "action" | "collab" | "success" | "warning" | "insight";
  compact?: boolean;
}) {
  const toneClass = {
    action: "bg-[#EAF1FF] text-[#0647A8]",
    collab: "bg-[#EEF3FF] text-[#0B4BC6]",
    success: "bg-[#EDF8F0] text-[#16843C]",
    warning: "bg-[#FFF3E1] text-[#F08A00]",
    insight: "bg-[#F1ECFF] text-[#6D39D8]",
  }[tone];
  const valueClass = {
    action: "text-[#071D49]",
    collab: "text-[#071D49]",
    success: "text-[#071D49]",
    warning: "text-[#071D49]",
    insight: "text-[#071D49]",
  }[tone];

  return (
    <div
      className={cn(
        "consolidation-metric flex items-center overflow-hidden rounded-2xl border",
        compact ? "min-h-[112px] self-center gap-2 px-3 py-3" : "h-full min-h-[112px] gap-4 p-4",
        highlight
          ? "border-[#DDE6F3] bg-white"
          : "border-[#DDE6F3] bg-white",
      )}
    >
      {icon ? (
        <div className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", compact ? "h-9 w-9 text-lg" : "h-12 w-12 text-xl", toneClass)}>
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className={cn("font-semibold text-[#1D3154]", compact ? "text-xs leading-tight" : "text-sm")}>{title}</p>
        <p className={cn("mt-1 flex min-w-0 items-center overflow-hidden font-semibold leading-tight", compact ? "text-[17px]" : "min-h-[2rem] text-[clamp(1.2rem,1.6vw,1.55rem)]", valueClass)}>
          <span className="tabular-nums">{value}</span>
        </p>
        <p className={cn("mt-1 font-medium text-[#526780]", compact ? "line-clamp-1 text-[10px]" : "text-sm")}>{subtitle}</p>
      </div>
    </div>
  );
}
function consolidationCategoryClass(category: string): string {
  const value = String(category || "").toLocaleLowerCase("pt-BR");
  if (value.includes("climat")) return "border-[#CDEFE4] bg-[#ECFBF5] text-[#08764C]";
  if (value.includes("mobili")) return "border-[#E1D6FF] bg-[#F4F0FF] text-[#6436C5]";
  if (value.includes("audiovis")) return "border-[#F6D1E7] bg-[#FFF0F8] text-[#B52678]";
  if (value.includes("eletro")) return "border-[#CDEFE4] bg-[#ECFBF5] text-[#08764C]";
  if (value.includes("acessib")) return "border-[#F5E2B7] bg-[#FFF8E8] text-[#9A6200]";
  if (value.includes("serv")) return "border-[#D7D5FA] bg-[#F2F1FF] text-[#5144A8]";
  if (value.includes("laborat")) return "border-[#D2EAEF] bg-[#EFFAFF] text-[#16718A]";
  return "border-[#D5E0EF] bg-[#EFF5FF] text-[#0647A8]";
}

function getPaginationPages(currentPage: number, pageCount: number): Array<number | "ellipsis"> {
  const start = Math.max(0, Math.min(currentPage - 2, pageCount - 5));
  const pages = new Set<number>([0, pageCount - 1]);
  for (let page = start; page < Math.min(pageCount, start + 5); page += 1) pages.add(page);
  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push("ellipsis");
    result.push(page);
  });
  return result;
}

function ConsolidationProgress({
  label,
  helper,
  value,
  tone,
}: {
  label: string;
  helper: string;
  value: number;
  tone: "action" | "danger" | "warning";
}) {
  const roundedValue = Math.max(0, Math.min(100, Math.round(value)));
  const toneClass = {
    action: "bg-[#0647D9]",
    danger: "bg-[#D70416]",
    warning: "bg-[#F08A00]",
  }[tone];

  return (
    <div className="mb-3 last:mb-0" title={helper}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold text-[#17305B]">{label}</p>
        <span className="shrink-0 text-xs font-bold text-[#09275D]">{roundedValue}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#E8EEF7]">
        <div className={cn("h-full rounded-full", toneClass)} style={{ width: `${roundedValue}%` }} />
      </div>
    </div>
  );
}

function QuickFilterChip({
  label,
  count,
  active,
  onClick,
  tone = "default",
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: "default" | "gold" | "red" | "blue" | "orange";
}) {
  const toneClasses = {
    default: active
      ? "border-[var(--p-color-action)] bg-[var(--p-color-brand-500)] text-white"
      : "border-[var(--p-color-info-border)] bg-white text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-info-bg)]",
    gold: active
      ? "border-[var(--p-color-warning)] bg-[var(--p-color-warning)] text-white"
      : "border-[var(--p-color-warning-border)] bg-white text-[var(--p-color-warning)] hover:bg-[var(--p-color-warning-bg)]",
    red: active
      ? "border-[var(--p-color-danger)] bg-[var(--p-color-danger)] text-white"
      : "border-[var(--p-color-danger-border)] bg-white text-[var(--p-color-danger)] hover:bg-[var(--p-color-danger-bg)]",
    blue: active
      ? "border-[var(--p-color-action)] bg-[var(--p-color-action)] text-white"
      : "border-[var(--p-color-info-border)] bg-white text-[var(--p-color-action)] hover:bg-[var(--p-color-info-bg)]",
    orange: active
      ? "border-[var(--p-color-warning)] bg-[var(--p-color-warning)] text-white"
      : "border-[var(--p-color-warning-border)] bg-white text-[var(--p-color-warning)] hover:bg-[var(--p-color-warning-bg)]",
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-colors",
        toneClasses[tone],
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 type-caption font-semibold",
          active ? "bg-white/20 text-current" : "bg-[var(--p-color-border-muted)] text-current",
        )}
      >
        {count}
      </span>
    </button>
  );
}
function CompactAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [broken, setBroken] = useState(false);

  if (!avatarUrl || broken) {
    return (
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--p-color-border)] bg-[var(--p-color-surface-subtle)] type-kicker font-semibold uppercase text-[var(--p-color-brand-500)]">
        {getInitials(name)}
      </span>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={name}
      className="h-7 w-7 shrink-0 rounded-full border border-[var(--p-color-border)] object-cover"
      onError={() => setBroken(true)}
    />
  );
}

function AvatarGroup({
  people,
}: {
  people: Array<{ name: string; avatarUrl: string | null }>;
}) {
  const visible = people.slice(0, 3);
  const overflow = Math.max(0, people.length - visible.length);

  return (
    <div className="flex items-center">
      {visible.map((person, index) => (
        <div
          key={`${person.name}-${index}`}
          className={cn("relative", index > 0 && "-ml-2")}
          title={person.name}
        >
          <CompactAvatar name={person.name} avatarUrl={person.avatarUrl} />
        </div>
      ))}
      {overflow > 0 ? (
        <span className="-ml-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-white bg-[var(--p-color-border)] px-1.5 type-kicker font-semibold text-[var(--p-color-fg-muted)]">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="type-kicker uppercase tracking-widest text-[var(--p-color-fg-muted)] font-semibold">
        {label}
      </span>
      <span className="text-xs font-semibold text-[var(--p-color-brand-500)]">{value}</span>
    </div>
  );
}

function PresetButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 px-3 rounded-lg border type-kicker uppercase tracking-widest font-semibold transition-colors",
        active
          ? "bg-[var(--p-color-action)] text-white border-[var(--p-color-action)]"
          : "bg-white text-[var(--p-color-brand-500)] border-black/10 hover:bg-[var(--p-color-surface-muted)]",
      )}
    >
      {label}
    </button>
  );
}

