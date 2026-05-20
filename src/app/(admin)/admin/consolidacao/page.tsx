"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import {
  ArrowsClockwise,
  DownloadSimple,
  ArrowSquareOut,
  Funnel,
  Lightning,
  List,
  Sparkle,
  Star,
  Warning,
} from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { downloadWorkbookFromSheets } from "@/lib/export-excel";
import {
  buildCsv,
  buildDfdItemDetailRows,
  buildDfdSheetRows,
  collectExportHeaders,
  protectReportRow,
} from "@/lib/admin-reports";

type ApprovedDfd = {
  id: string;
  numero_protocolo: string;
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
  item_count: number;
  valor_total: number;
  itens_sem_classificacao: number;
  raw?: Record<string, unknown>;
};

type RawItem = {
  id?: string;
  dfd_id: string;
  codigo_tce: string;
  descricao: string;
  quantidade: number;
  valor_unitario_estimado: number;
  is_highlight_item: boolean;
  criticidade?: string | null;
  moscow_categoria?: string | null;
  gnd?: string | null;
  link_referencia?: string | null;
  justificativa_item?: string | null;
  justificativa_quantidade?: string | null;
  local_uso?: string | null;
  raw?: Record<string, unknown>;
};

type ConsolidatedItem = {
  siad: string;
  descricao: string;
  grupo_nome: string;
  classe_nome: string;
  tipo_nome: "Material" | "Serviço";
  gnd_dominante: string;
  quantidade_total: number;
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
  }>;
};

type SmartFilter = "all" | "divergencia" | "outlier" | "incompleto" | "pareto";
type DensityMode = "comfortable" | "compact";
type ContrastMode = "soft" | "high";
type NaturezaDespesaFilter = "all" | "custeio" | "permanente" | "sem_gnd";
type FilterPresetKey =
  | "custom"
  | "executivo_pareto"
  | "risco_dados"
  | "outlier_preco"
  | "servicos"
  | "materiais"
  | "laboratorios";

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

function criticidadeBadgeClass(level: number): string {
  if (level >= 4) return "bg-upe-red-upe/15 text-upe-red-dark border-upe-red-upe/30";
  if (level === 3) return "bg-upe-warm-light-terracotta/15 text-upe-warm-light-terracotta border-upe-warm-light-terracotta/35";
  if (level === 2) return "bg-upe-accent-soft-mustard/15 text-upe-accent-matte-gold border-upe-accent-soft-mustard/40";
  if (level === 1) return "bg-upe-support-blue-neutral-aqua/20 text-upe-support-blue-deep-teal border-upe-support-blue-neutral-aqua/40";
  return "bg-upe-neutral-cool-ice text-upe-neutral-cool-steel-gray border-upe-neutral-cool-light-gray";
}

function priorizacaoBadgeClass(level: number): string {
  if (level >= 4) return "bg-upe-blue-upe/15 text-upe-blue-upe border-upe-blue-upe/30";
  if (level === 3) return "bg-upe-blue-medium/15 text-upe-blue-medium border-upe-blue-medium/35";
  if (level === 2) return "bg-upe-blue-closed-sky/20 text-upe-blue-closed-sky border-upe-blue-closed-sky/35";
  if (level === 1) return "bg-upe-support-blue-bluish-mist text-upe-support-blue-deep-teal border-upe-support-blue-neutral-aqua/40";
  return "bg-upe-neutral-cool-ice text-upe-neutral-cool-steel-gray border-upe-neutral-cool-light-gray";
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

function getHighlightLimit(totalItems: number): number {
  return totalItems > 0 ? Math.max(1, Math.ceil(totalItems * 0.2)) : 0;
}

function compactList(values: string[], max = 2): string {
  const clean = values
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (clean.length === 0) return "N/D";
  if (clean.length <= max) return clean.join(", ");
  return `${clean.slice(0, max).join(", ")} +${clean.length - max}`;
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

function computeRankScore(
  item: Pick<ConsolidatedItem, "criticidade_level" | "priorizacao_level" | "valor_total">,
  criticidadeWeight: number,
  priorizacaoWeight: number,
): number {
  const matrixSignal = item.criticidade_level * item.priorizacao_level;
  const financialSignal = Math.log10(Number(item.valor_total || 0) + 1);
  return (
    matrixSignal * 10 +
    item.criticidade_level * 8 * criticidadeWeight +
    item.priorizacao_level * 8 * priorizacaoWeight +
    financialSignal
  );
}

function applyPareto(
  source: ConsolidatedItem[],
  criticidadeWeight: number,
  priorizacaoWeight: number,
): ConsolidatedItem[] {
  const scored = source.map((item) => ({
    ...item,
    rank_score: computeRankScore(item, criticidadeWeight, priorizacaoWeight),
  }));

  const limit = getHighlightLimit(scored.length);
  if (limit === 0) return scored.map((item) => ({ ...item, is_highlight: false }));

  const sorted = [...scored].sort((a, b) => {
    const scoreDiff = b.rank_score - a.rank_score;
    if (scoreDiff !== 0) return scoreDiff;
    const valueDiff = b.valor_total - a.valor_total;
    if (valueDiff !== 0) return valueDiff;
    return String(a.siad || "").localeCompare(String(b.siad || ""), "pt-BR");
  });

  const topSet = new Set(sorted.slice(0, limit).map((item) => item.siad));
  return scored.map((item) => ({ ...item, is_highlight: topSet.has(item.siad) }));
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const ratio = index - lower;
  return sorted[lower] * (1 - ratio) + sorted[upper] * ratio;
}

function simulateBudgetCut(items: ConsolidatedItem[], cutPercent: number) {
  const total = items.reduce((acc, item) => acc + Number(item.valor_total || 0), 0);
  if (total <= 0 || cutPercent <= 0) {
    return {
      total,
      targetCut: 0,
      simulatedCut: 0,
      remaining: total,
      affectedCount: 0,
    };
  }

  const targetCut = (total * cutPercent) / 100;
  let simulatedCut = 0;
  let affectedCount = 0;

  const removable = [...items].sort((a, b) => {
    const aBucket =
      Number(a.is_highlight) * 10 +
      (a.priorizacao_level === 4 ? 4 : a.priorizacao_level === 3 ? 3 : a.priorizacao_level);
    const bBucket =
      Number(b.is_highlight) * 10 +
      (b.priorizacao_level === 4 ? 4 : b.priorizacao_level === 3 ? 3 : b.priorizacao_level);
    if (aBucket !== bBucket) return aBucket - bBucket;
    return b.valor_total - a.valor_total;
  });

  for (const item of removable) {
    if (simulatedCut >= targetCut) break;
    simulatedCut += Number(item.valor_total || 0);
    affectedCount += 1;
  }

  const remaining = Math.max(0, total - simulatedCut);
  return { total, targetCut, simulatedCut, remaining, affectedCount };
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
      score: Number(item.rank_score.toFixed(2)),
      pareto: item.is_highlight ? "SIM" : "NAO",
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
  const [loading, setLoading] = useState(true);
  const [dfds, setDfds] = useState<ApprovedDfd[]>([]);
  const [rawItems, setRawItems] = useState<RawItem[]>([]);
  const [baseItems, setBaseItems] = useState<ConsolidatedItem[]>([]);
  const [items, setItems] = useState<ConsolidatedItem[]>([]);
  const [selectedDfdId, setSelectedDfdId] = useState<string>("all");
  const [dfdSearchTerm, setDfdSearchTerm] = useState("");
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [criticidadeWeight] = useState(1);
  const [priorizacaoWeight] = useState(1);
  const [cutPercent, setCutPercent] = useState(10);
  const [highlightOnly, setHighlightOnly] = useState(false);
  const [densityMode, setDensityMode] = useState<DensityMode>("comfortable");
  const [contrastMode, setContrastMode] = useState<ContrastMode>("soft");
  const [showLegends, setShowLegends] = useState(true);
  const [showScoreBars, setShowScoreBars] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dfdMenuOpen, setDfdMenuOpen] = useState(false);
  const [insightsMenuOpen, setInsightsMenuOpen] = useState(false);
  const [naturezaFilter, setNaturezaFilter] = useState<NaturezaDespesaFilter>("all");
  const [grupoFilter, setGrupoFilter] = useState("all");
  const [classeFilter, setClasseFilter] = useState("all");
  const [tipoFilter, setTipoFilter] = useState<"all" | "Material" | "Serviço">("all");
  const [servidorFilter, setServidorFilter] = useState("all");
  const [localUsoFilter, setLocalUsoFilter] = useState("all");
  const [activePreset, setActivePreset] = useState<FilterPresetKey>("custom");

  const centerColSpanClass = dfdMenuOpen
    ? insightsMenuOpen
      ? "xl:col-span-6"
      : "xl:col-span-9"
    : insightsMenuOpen
      ? "xl:col-span-9"
      : "xl:col-span-12";

  const recomputeItems = useCallback(
    (source: ConsolidatedItem[]) => {
      setItems(applyPareto(source, criticidadeWeight, priorizacaoWeight));
    },
    [criticidadeWeight, priorizacaoWeight],
  );

  const resetFilters = useCallback(() => {
    setSelectedDfdId("all");
    setItemSearchTerm("");
    setSmartFilter("all");
    setHighlightOnly(false);
    setNaturezaFilter("all");
    setGrupoFilter("all");
    setClasseFilter("all");
    setTipoFilter("all");
    setServidorFilter("all");
    setLocalUsoFilter("all");
    setDensityMode("comfortable");
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
        setDensityMode("compact");
      } else if (preset === "risco_dados") {
        setSmartFilter("incompleto");
        setContrastMode("high");
      } else if (preset === "outlier_preco") {
        setSmartFilter("outlier");
        setDensityMode("compact");
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let dfdsRes: any = await supabase
        .from("dfds")
        .select("*")
        .eq("status", "aprovada")
        .order("created_at", { ascending: false });

      if (
        dfdsRes.error &&
        /unidade_id|tipo_unidade/i.test(String(dfdsRes.error.message || ""))
      ) {
        dfdsRes = await supabase
          .from("dfds")
          .select(
            "id, numero_protocolo, objeto_contratacao, created_at, campus_id, solicitante_id, valor_total_estimado",
          )
          .eq("status", "aprovada")
          .order("created_at", { ascending: false });
      }
      if (dfdsRes.error) throw dfdsRes.error;

      const approvedDfdsRows = (dfdsRes.data || []) as any[];
      if (approvedDfdsRows.length === 0) {
        setDfds([]);
        setRawItems([]);
        setBaseItems([]);
        setItems([]);
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

      const [campiRes, profilesRes, departamentosRes, laboratoriosRes] = await Promise.all([
        campusIds.length > 0
          ? supabase.from("campi").select("id, nome, sigla").in("id", campusIds)
          : Promise.resolve({ data: [], error: null } as any),
        solicitanteIds.length > 0
          ? supabase
              .from("profiles")
              .select("id, full_name, email, avatar_url")
              .in("id", solicitanteIds)
          : Promise.resolve({ data: [], error: null } as any),
        departamentoIds.length > 0
          ? supabase.from("departamentos").select("id, nome").in("id", departamentoIds)
          : Promise.resolve({ data: [], error: null } as any),
        laboratorioIds.length > 0
          ? supabase.from("laboratorios").select("id, nome").in("id", laboratorioIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (campiRes.error) throw campiRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (departamentosRes.error) throw departamentosRes.error;
      if (laboratoriosRes.error) throw laboratoriosRes.error;

      let itemsRes: any = await supabase
        .from("dfd_items")
        .select("*")
        .in("dfd_id", dfdIds);

      if (
        itemsRes.error &&
        /criticidade|moscow_categoria|local_uso/i.test(String(itemsRes.error.message || ""))
      ) {
        itemsRes = await supabase
          .from("dfd_items")
          .select(
            "id, dfd_id, codigo_tce, descricao, quantidade, valor_unitario_estimado, is_highlight_item, gnd, link_referencia, justificativa_item, justificativa_quantidade",
          )
          .in("dfd_id", dfdIds);
      }
      if (itemsRes.error) throw itemsRes.error;

      const itemsRows = ((itemsRes.data || []) as any[])
        .map(
          (row) =>
            ({
              id: String(row.id || ""),
              dfd_id: String(row.dfd_id || ""),
              codigo_tce: String(row.codigo_tce || "").trim(),
              descricao: String(row.descricao || "").trim() || "Descrição não informada",
              quantidade: Math.max(0, Number(row.quantidade || 0)),
              valor_unitario_estimado: Math.max(0, Number(row.valor_unitario_estimado || 0)),
              is_highlight_item: Boolean(row.is_highlight_item),
              criticidade: row.criticidade || null,
              moscow_categoria: row.moscow_categoria || null,
              gnd: row.gnd || null,
              link_referencia: row.link_referencia || null,
              justificativa_item: row.justificativa_item || null,
              justificativa_quantidade: row.justificativa_quantidade || null,
              local_uso: row.local_uso || null,
              raw: row,
            }) satisfies RawItem,
        )
        .filter((row) => row.dfd_id && row.codigo_tce);

      const campusMap = new Map(
        ((campiRes.data || []) as any[]).map((campus) => [
          campus.id,
          String(campus.sigla || campus.nome || "N/D"),
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
        ((profilesRes.data || []) as any[]).map((profile) => [
          profile.id,
          {
            nome: String(profile.full_name || profile.email || "Usuário"),
            email: profile.email ? String(profile.email).toLowerCase() : null,
            avatarUrl: profile.avatar_url ? String(profile.avatar_url) : null,
          },
        ]),
      );
      const departamentoMap = new Map(
        ((departamentosRes.data || []) as any[]).map((row) => [
          String(row.id),
          String(row.nome || "").trim(),
        ]),
      );
      const laboratorioMap = new Map(
        ((laboratoriosRes.data || []) as any[]).map((row) => [
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
          siad: string;
          descricao: string;
          descricaoSet: Set<string>;
          quantidade_total: number;
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

        if (!consolidated.has(row.codigo_tce)) {
          consolidated.set(row.codigo_tce, {
            siad: row.codigo_tce,
            descricao: row.descricao,
            descricaoSet: new Set<string>(),
            quantidade_total: 0,
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

        const entry = consolidated.get(row.codigo_tce)!;
        entry.descricaoSet.add(row.descricao);
        entry.quantidade_total += Number(row.quantidade || 0);
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
        const localUso = resolveUnitName(dfd) || String(row.local_uso || "").trim();
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
        return {
          id: dfd.id,
          numero_protocolo: String(dfd.numero_protocolo || ""),
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
      const uniqueCodes = Array.from(new Set(itemsRows.map((row) => row.codigo_tce))).filter(
        Boolean,
      );
      try {
        const chunkSize = 400;
        for (let i = 0; i < uniqueCodes.length; i += chunkSize) {
          const chunk = uniqueCodes.slice(i, i + chunkSize);
          const { data: catalogRows, error: catalogError } = await supabase
            .from("catalogo")
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
        const medianValue = percentile(entry.unitValues, 0.5);
        const p90Value = percentile(entry.unitValues, 0.9);
        const dominantGnd =
          [...entry.gndFrequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Sem GND";
        const taxo = catalogByCode.get(entry.siad);
        const grupo = taxo?.grupo || deriveGroupFromGnd(dominantGnd);
        const classe = taxo?.classe || "Sem Classe";
        const tipo = taxo?.tipo || deriveTypeFromGnd(dominantGnd);

        return {
          siad: entry.siad,
          descricao: entry.descricao,
          grupo_nome: grupo,
          classe_nome: classe,
          tipo_nome: tipo,
          gnd_dominante: dominantGnd,
          quantidade_total: entry.quantidade_total,
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
          missing_quality_count: Math.round(qualityRatio * 100) + (p90Value > medianValue * 2 ? 5 : 0),
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
              };
            })
            .sort((a, b) => a.numero_protocolo.localeCompare(b.numero_protocolo, "pt-BR")),
        };
      });

      setDfds(dfdSummaries);
      setRawItems(itemsRows);
      setBaseItems(normalized);
      setItems(applyPareto(normalized, criticidadeWeight, priorizacaoWeight));
    } catch (error: any) {
      toast.error("Erro ao carregar consolidação: " + (error?.message || "erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }, [criticidadeWeight, priorizacaoWeight]);

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
    siad: string,
    field: "criticidade_level" | "priorizacao_level",
    nextValue: number,
  ) => {
    const safeValue = clampLevel(nextValue);
    setBaseItems((prev) =>
      prev.map((item) => (item.siad === siad ? { ...item, [field]: safeValue } : item)),
    );
  };

  const selectedDfdCodeSet = useMemo(() => {
    if (selectedDfdId === "all") return null;
    const codes = rawItems
      .filter((item) => item.dfd_id === selectedDfdId)
      .map((item) => item.codigo_tce);
    return new Set(codes);
  }, [selectedDfdId, rawItems]);

  const filteredDfds = useMemo(() => {
    const query = dfdSearchTerm.trim().toLowerCase();
    if (!query) return dfds;
    return dfds.filter((dfd) => {
      return (
        String(dfd.numero_protocolo || "").toLowerCase().includes(query) ||
        String(dfd.objeto_contratacao || "").toLowerCase().includes(query) ||
        String(dfd.campus_nome || "").toLowerCase().includes(query) ||
        String(dfd.solicitante_nome || "").toLowerCase().includes(query) ||
        String(dfd.solicitante_email || "").toLowerCase().includes(query) ||
        String(dfd.unidade_nome || "").toLowerCase().includes(query)
      );
    });
  }, [dfdSearchTerm, dfds]);

  const displayItems = useMemo(() => {
    const query = itemSearchTerm.trim().toLowerCase();
    let next = items;

    if (selectedDfdCodeSet) {
      next = next.filter((item) => selectedDfdCodeSet.has(item.siad));
    }

    if (query) {
      next = next.filter((item) => {
        return (
          String(item.siad || "").toLowerCase().includes(query) ||
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
          item.locais_uso.some((local) =>
            String(local || "").toLowerCase().includes("laborat"),
          ),
        );
      } else {
        next = next.filter((item) => item.locais_uso.includes(localUsoFilter));
      }
    }

    if (highlightOnly) {
      next = next.filter((item) => item.is_highlight);
    }

    if (smartFilter === "divergencia") {
      next = next.filter((item) => item.description_variants > 1);
    } else if (smartFilter === "outlier") {
      next = next.filter((item) => item.spread_percent >= 80);
    } else if (smartFilter === "incompleto") {
      next = next.filter((item) => item.criticidade_level === 0 || item.priorizacao_level === 0);
    } else if (smartFilter === "pareto") {
      next = next.filter((item) => item.is_highlight);
    }

    return [...next].sort((a, b) => {
      const scoreDiff = b.rank_score - a.rank_score;
      if (scoreDiff !== 0) return scoreDiff;
      return b.valor_total - a.valor_total;
    });
  }, [
    classeFilter,
    grupoFilter,
    highlightOnly,
    itemSearchTerm,
    items,
    localUsoFilter,
    naturezaFilter,
    selectedDfdCodeSet,
    servidorFilter,
    smartFilter,
    tipoFilter,
  ]);
  const maxVisibleScore = useMemo(
    () =>
      Math.max(
        1,
        ...displayItems.map((item) => Number.isFinite(item.rank_score) ? item.rank_score : 0),
      ),
    [displayItems],
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
    () => items.filter((item) => item.is_highlight).length,
    [items],
  );
  const paretoLimit = useMemo(() => getHighlightLimit(items.length), [items]);

  const divergenciasCount = useMemo(
    () => items.filter((item) => item.description_variants > 1).length,
    [items],
  );
  const outliersCount = useMemo(
    () => items.filter((item) => item.spread_percent >= 80).length,
    [items],
  );
  const incompletosCount = useMemo(
    () =>
      items.filter((item) => item.criticidade_level === 0 || item.priorizacao_level === 0)
        .length,
    [items],
  );
  const visibleValue = useMemo(
    () => displayItems.reduce((acc, item) => acc + Number(item.valor_total || 0), 0),
    [displayItems],
  );
  const activeFilterCount = useMemo(
    () =>
      [
        selectedDfdId !== "all",
        Boolean(itemSearchTerm.trim()),
        smartFilter !== "all",
        highlightOnly,
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
      selectedDfdId,
      servidorFilter,
      smartFilter,
      tipoFilter,
    ],
  );
  const simulation = useMemo(() => simulateBudgetCut(items, cutPercent), [cutPercent, items]);

  const exportCSV = () => {
    if (displayItems.length === 0) {
      toast.info("Sem linhas para exportar.");
      return;
    }

    const rows = buildConsolidatedExportRows(displayItems);
    const headers = collectExportHeaders(rows, [
      "codigo_efisco",
      "descricao",
      "grupo",
      "gnd_dominante",
      "natureza_despesa",
      "classe",
      "tipo",
      "qtd_total",
      "valor_total",
      "dfds",
      "itens_origem",
      "campi",
      "servidores",
      "departamentos_laboratorios",
      "criticidade",
      "priorizacao",
      "score",
      "pareto",
      "dfds_origem",
    ]);

    const csv = buildCsv(rows, headers);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `consolidacao_pca_${new Date().toLocaleDateString("pt-BR").replaceAll("/", "-")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV completo exportado.");
  };

  const exportXLSX = async () => {
    if (displayItems.length === 0) {
      toast.info("Sem linhas para exportar.");
      return;
    }

    const rows = buildConsolidatedExportRows(displayItems);
    const dfdRows = buildDfdSheetRows(dfds as any);
    const sourceRows = buildSourceItemRows(rawItems, dfds);

    try {
      await downloadWorkbookFromSheets(
        [
          { name: "Consolidacao", rows },
          { name: "DFDs_Aprovadas", rows: dfdRows },
          { name: "Itens_Origem", rows: sourceRows },
          {
            name: "Contexto",
            rows: [
              { chave: "gerado_em", valor: new Date().toISOString() },
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
              { chave: "total_dfds_aprovadas", valor: dfds.length },
              { chave: "total_itens_consolidados", valor: items.length },
              { chave: "total_itens_exibidos", valor: displayItems.length },
              { chave: "total_valor_exibido", valor: Number(visibleValue.toFixed(2)) },
            ],
          },
        ],
        `consolidacao_pca_${new Date().toLocaleDateString("pt-BR").replaceAll("/", "-")}.xlsx`,
      );
      toast.success("Planilha XLSX exportada.");
    } catch (error: any) {
      toast.error(error?.message || "Falha ao exportar XLSX.");
    }
  };

  return (
    <div className="min-h-screen space-y-5 bg-[#F3F2F1] px-4 py-6 md:px-6">
      <div className="overflow-hidden rounded-[24px] border border-[#C7D7EA] bg-white text-[#17233C] shadow-sm">
        <div className="border-b border-[#D9E0E8] bg-[#F7FBFF] p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[#17233C]">
              Consolidação Inteligente
            </h1>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-[#47739F]">
              Admin · DFDs aprovadas para PCA
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={fetchData}
              className="h-10 rounded-xl border-[#C7D7EA] bg-white text-[#164073] hover:bg-[#EAF2FF]"
            >
              <ArrowsClockwise size={16} className="mr-2" />
              Atualizar
            </Button>
            <Button
              type="button"
              onClick={exportCSV}
              className="h-10 rounded-xl border border-[#C7D7EA] bg-white text-[#164073] hover:bg-[#EAF2FF]"
            >
              <DownloadSimple size={16} className="mr-2" />
              Exportar CSV
            </Button>
            <Button
              type="button"
              onClick={exportXLSX}
              className="h-10 rounded-xl bg-[#164073] text-white hover:bg-[#0F2E57]"
            >
              <DownloadSimple size={16} className="mr-2" />
              Exportar XLSX
            </Button>
          </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="DFDs aprovadas" value={dfds.length} />
          <KpiCard label="Itens exibidos" value={`${displayItems.length}/${items.length}`} />
          <KpiCard
            label="Valor do recorte"
            value={visibleValue.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          />
          <KpiCard label="Pareto 20%" value={`${paretoCount}/${paretoLimit}`} />
          <KpiCard label="Filtros ativos" value={activeFilterCount} />
        </div>
      </div>

      <div className="grid min-h-[74vh] grid-cols-1 gap-4 xl:grid-cols-12">
        <section
          className={cn(
            "rounded-[28px] border border-black/5 bg-white shadow-sm flex flex-col min-h-[620px]",
            dfdMenuOpen ? "xl:col-span-3" : "hidden xl:hidden",
          )}
        >
          <div className="p-4 border-b border-black/5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold uppercase tracking-tight text-upe-blue-upe">
                DFDs Enviadas
              </h2>
              <button
                type="button"
                onClick={() => setDfdMenuOpen(false)}
                className="h-8 w-8 rounded-lg border border-black/10 bg-white text-upe-blue-upe hover:bg-upe-neutral-cool-ice inline-flex items-center justify-center"
                title="Recolher menu de DFDs"
              >
                <List size={16} weight="bold" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-black/40">
                {filteredDfds.length}
              </span>
            </div>
            <input
              value={dfdSearchTerm}
              onChange={(event) => setDfdSearchTerm(event.target.value)}
              placeholder="Buscar protocolo, campus, solicitante..."
              className="h-10 w-full rounded-xl border border-black/10 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-blue-medium/20"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedDfdId("all")}
                className={cn(
                  "h-9 rounded-xl text-[10px] uppercase tracking-widest font-semibold border transition-colors",
                  selectedDfdId === "all"
                    ? "bg-upe-blue-upe text-white border-upe-blue-upe"
                    : "bg-white text-upe-blue-upe border-black/10 hover:bg-upe-neutral-cool-ice",
                )}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setHighlightOnly((prev) => !prev)}
                className={cn(
                  "h-9 rounded-xl text-[10px] uppercase tracking-widest font-semibold border transition-colors inline-flex items-center justify-center gap-1",
                  highlightOnly
                    ? "bg-upe-accent-matte-gold text-white border-upe-accent-matte-gold"
                    : "bg-white text-upe-blue-upe border-black/10 hover:bg-upe-neutral-cool-ice",
                )}
              >
                <Star size={12} weight="fill" />
                Pareto
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, index) => (
                  <Skeleton key={index} className="h-24 rounded-2xl" />
                ))}
              </div>
            ) : filteredDfds.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-6 text-sm font-semibold text-black/40">
                Sem DFDs para o filtro informado.
              </div>
            ) : (
              <Virtuoso
                className="h-full"
                data={filteredDfds}
                itemContent={(_, dfd) => (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDfdId((prev) => (prev === dfd.id ? "all" : dfd.id))
                    }
                    className={cn(
                      "w-full text-left p-3 border-b border-black/5 transition-colors",
                      selectedDfdId === dfd.id
                        ? "bg-upe-blue-upe/7"
                        : "hover:bg-upe-neutral-cool-ice",
                    )}
                  >
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-black/35 inline-flex items-center gap-1.5">
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          selectedDfdId === dfd.id ? "bg-upe-blue-upe" : "bg-black/25",
                        )}
                      />
                      {dfd.numero_protocolo}
                    </p>
                    <p className="mt-1 text-[15px] font-semibold text-upe-neutral-dark-soft-black leading-snug line-clamp-2">
                      {dfd.objeto_contratacao}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-black/45">
                      <span>{dfd.campus_nome}</span>
                      <span>{dfd.item_count} itens</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-black/60">
                      <div className="flex min-w-0 items-center gap-2">
                        <CompactAvatar
                          name={dfd.solicitante_nome}
                          avatarUrl={dfd.solicitante_avatar_url}
                        />
                        <span className="truncate max-w-[130px]">{dfd.unidade_nome || "local não definido"}</span>
                      </div>
                      <span className="shrink-0">
                        {dfd.valor_total.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-black/45 truncate">
                      {dfd.solicitante_email || "email não informado"}
                    </p>
                    <p className="mt-1 text-[11px] text-black/45">
                      {dfd.created_at
                        ? new Date(dfd.created_at).toLocaleDateString("pt-BR")
                        : "Data não informada"}
                    </p>
                    {dfd.itens_sem_classificacao > 0 && (
                      <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 uppercase tracking-widest">
                        <Warning size={12} />
                        {dfd.itens_sem_classificacao} sem classificação
                      </p>
                    )}
                  </button>
                )}
              />
            )}
          </div>
        </section>

        <section
          className={cn(
            "rounded-[28px] border border-[#9FB9D6] bg-white shadow-[0_18px_44px_rgba(22,64,115,0.14)] flex flex-col min-h-[720px] overflow-hidden",
            centerColSpanClass,
            contrastMode === "high" && "border-upe-blue-upe/30 shadow-[0_18px_44px_rgba(22,64,115,0.18)]",
          )}
        >
          <div className="border-b border-[#C7D7EA] bg-[#F7FBFF] p-4 md:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDfdMenuOpen((prev) => !prev)}
                  className="h-9 px-3 rounded-xl border border-black/10 bg-white text-upe-blue-upe hover:bg-upe-neutral-cool-ice text-[10px] uppercase tracking-widest font-semibold inline-flex items-center gap-1.5"
                  title={dfdMenuOpen ? "Ocultar menu de DFDs" : "Mostrar menu de DFDs"}
                >
                  <List size={14} weight="bold" />
                  DFDs
                </button>
                <button
                  type="button"
                  onClick={() => setInsightsMenuOpen((prev) => !prev)}
                  className="h-9 px-3 rounded-xl border border-black/10 bg-white text-upe-blue-upe hover:bg-upe-neutral-cool-ice text-[10px] uppercase tracking-widest font-semibold inline-flex items-center gap-1.5"
                  title={
                    insightsMenuOpen
                      ? "Ocultar menu de opções inteligentes"
                      : "Mostrar menu de opções inteligentes"
                  }
                >
                  <List size={14} weight="bold" />
                  Opções
                </button>
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-semibold uppercase tracking-tight text-upe-blue-upe">
                    Itens Consolidados
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-black/55">
                    Área principal de decisão: revise o item, a origem, a prioridade, o valor e o Pareto.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-[#C7D7EA] bg-white px-4 py-2 text-right shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-black/40">
                  Itens no recorte
                </p>
                <p className="text-lg font-semibold text-upe-blue-upe">{displayItems.length}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(280px,1fr)_auto_auto_auto]">
              <input
                value={itemSearchTerm}
                onChange={(event) => {
                  setItemSearchTerm(event.target.value);
                  setActivePreset("custom");
                }}
                placeholder="Buscar nos itens consolidados..."
                className="h-11 min-w-0 rounded-2xl border border-[#C7D7EA] bg-white px-4 text-sm font-semibold outline-none shadow-sm focus:ring-2 focus:ring-upe-blue-medium/20"
              />
              <button
                type="button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                className={cn(
                  "h-11 rounded-2xl border px-4 text-[10px] font-semibold uppercase tracking-widest shadow-sm transition-colors inline-flex items-center justify-center gap-2",
                  filtersOpen
                    ? "border-upe-blue-upe bg-upe-blue-upe text-white"
                    : "border-[#C7D7EA] bg-white text-upe-blue-upe hover:bg-upe-neutral-cool-ice",
                )}
              >
                <Funnel size={14} />
                Filtros {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
              </button>
              <div className="h-11 rounded-2xl border border-[#C7D7EA] bg-white px-4 text-[10px] font-semibold uppercase tracking-widest text-upe-blue-upe shadow-sm inline-flex items-center justify-center">
                {selectedDfdId === "all" ? "Visão geral" : "Filtrado por DFD"}
              </div>
              <div className="h-11 rounded-2xl border border-[#C7D7EA] bg-white px-4 text-[10px] font-semibold uppercase tracking-widest text-black/45 shadow-sm inline-flex items-center justify-center">
                {smartFilter}
              </div>
            </div>

            {filtersOpen && (
              <div className="space-y-3 rounded-2xl border border-[#C7D7EA] bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-black/40">
                    Presets:
                  </span>
                  <PresetButton
                    label="Executivo Pareto"
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
                    className="h-8 px-3 rounded-lg border border-black/10 bg-white text-[10px] uppercase tracking-widest font-semibold text-upe-blue-upe hover:bg-upe-neutral-cool-ice"
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
                className="h-10 min-w-0 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-blue-medium/20 md:col-span-2 xl:col-span-2"
              />
              <select
                value={naturezaFilter}
                onChange={(event) => {
                  setNaturezaFilter(event.target.value as NaturezaDespesaFilter);
                  setActivePreset("custom");
                }}
                className="h-10 min-w-0 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-upe-blue-upe outline-none focus:ring-2 focus:ring-upe-blue-medium/20"
              >
                <option value="all">Natureza: todas</option>
                <option value="custeio">Custeio</option>
                <option value="permanente">Permanente</option>
                <option value="sem_gnd">Sem GND</option>
              </select>
              <select
                value={grupoFilter}
                onChange={(event) => {
                  setGrupoFilter(event.target.value);
                  setActivePreset("custom");
                }}
                className="h-10 min-w-0 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-upe-blue-upe outline-none focus:ring-2 focus:ring-upe-blue-medium/20"
              >
                <option value="all">Grupo: todos</option>
                {grupoOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                value={classeFilter}
                onChange={(event) => {
                  setClasseFilter(event.target.value);
                  setActivePreset("custom");
                }}
                className="h-10 min-w-0 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-upe-blue-upe outline-none focus:ring-2 focus:ring-upe-blue-medium/20"
              >
                <option value="all">Classe: todas</option>
                {classeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                value={tipoFilter}
                onChange={(event) => {
                  setTipoFilter(event.target.value as "all" | "Material" | "Serviço");
                  setActivePreset("custom");
                }}
                className="h-10 min-w-0 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-upe-blue-upe outline-none focus:ring-2 focus:ring-upe-blue-medium/20"
              >
                <option value="all">Tipo: todos</option>
                <option value="Material">Material</option>
                <option value="Serviço">Serviço</option>
              </select>
              <select
                value={servidorFilter}
                onChange={(event) => {
                  setServidorFilter(event.target.value);
                  setActivePreset("custom");
                }}
                className="h-10 min-w-0 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-upe-blue-upe outline-none focus:ring-2 focus:ring-upe-blue-medium/20 xl:col-span-2"
              >
                <option value="all">Servidor: todos</option>
                {servidorOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                value={localUsoFilter}
                onChange={(event) => {
                  setLocalUsoFilter(event.target.value);
                  setActivePreset("custom");
                }}
                className="h-10 min-w-0 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-upe-blue-upe outline-none focus:ring-2 focus:ring-upe-blue-medium/20 md:col-span-2 xl:col-span-2"
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
              <div className="h-8 rounded-lg border border-black/10 bg-white px-3 text-[10px] font-semibold uppercase tracking-widest text-upe-blue-upe inline-flex items-center">
                {selectedDfdId === "all" ? "Visão geral" : "Filtrado por DFD"}
              </div>
              <div className="h-8 rounded-lg border border-black/10 bg-white px-3 text-[10px] font-semibold uppercase tracking-widest text-black/45 inline-flex items-center">
                <Funnel size={12} className="mr-1" />
                {smartFilter}
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    resetFilters();
                    setActivePreset("custom");
                  }}
                  className="h-8 rounded-lg border border-black/10 bg-white px-3 text-[10px] font-semibold uppercase tracking-widest text-upe-blue-upe hover:bg-upe-neutral-cool-ice"
                >
                  Remover filtros
                </button>
              )}
              </div>
            {showLegends && (
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-lg border text-[10px] uppercase tracking-widest font-semibold bg-upe-red-upe/15 text-upe-red-dark border-upe-red-upe/30">
                  Criticidade alta
                </span>
                <span className="px-2.5 py-1 rounded-lg border text-[10px] uppercase tracking-widest font-semibold bg-upe-blue-upe/15 text-upe-blue-upe border-upe-blue-upe/30">
                  Priorização essencial
                </span>
                <span className="px-2.5 py-1 rounded-lg border text-[10px] uppercase tracking-widest font-semibold bg-upe-accent-matte-gold/20 text-upe-accent-matte-gold border-upe-accent-matte-gold/30">
                  Top Pareto
                </span>
                <span className="px-2.5 py-1 rounded-lg border text-[10px] uppercase tracking-widest font-semibold bg-amber-100 text-amber-700 border-amber-200">
                  Atenção de qualidade
                </span>
              </div>
            )}
              </div>
            )}
          </div>

          <div
            className={cn(
              "hidden border-b border-black/5 px-5 py-2 text-[10px] font-semibold uppercase tracking-widest 2xl:grid 2xl:grid-cols-[minmax(560px,1fr)_250px_92px] 2xl:gap-4",
              contrastMode === "high"
                ? "bg-upe-blue-upe text-white/85"
                : "bg-upe-neutral-cool-ice text-black/45",
            )}
          >
            <span>Item</span>
            <span className="text-right">Decisão</span>
            <span className="text-right">Pareto</span>
          </div>

          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(7)].map((_, index) => (
                  <Skeleton key={index} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : displayItems.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-6 text-sm font-semibold text-black/40">
                Sem itens para o recorte atual.
              </div>
            ) : (
              <Virtuoso
                className="h-full"
                data={displayItems}
                overscan={320}
                itemContent={(index, item) => {
                  const rowDensity = densityMode === "compact" ? "py-2" : "py-3";
                  const scoreWidth = Math.max(
                    6,
                    Math.min(100, Math.round((item.rank_score / maxVisibleScore) * 100)),
                  );
                  const hasQualityGap =
                    item.criticidade_level === 0 ||
                    item.priorizacao_level === 0 ||
                    item.missing_quality_count >= 40;
                  const hasOutlier = item.spread_percent >= 80;
                  const primaryDfd = item.dfd_sources[0] || null;
                  const stripedBg =
                    contrastMode === "high"
                      ? index % 2 === 0
                        ? "bg-white"
                        : "bg-upe-neutral-cool-ice/50"
                      : index % 2 === 0
                        ? "bg-white"
                        : "bg-upe-neutral-cool-off-white/60";

                  return (
                    <div
                      className={cn(
                        "mx-3 my-1.5 rounded-xl border border-black/5 p-3 shadow-sm transition-colors md:mx-4 md:p-4 2xl:mx-0 2xl:my-0 2xl:rounded-none 2xl:border-x-0 2xl:border-t-0 2xl:px-4 2xl:shadow-none 2xl:grid 2xl:grid-cols-[minmax(560px,1fr)_250px_76px] 2xl:gap-4 2xl:items-start",
                        stripedBg,
                        rowDensity,
                        item.is_highlight && "ring-1 ring-inset ring-upe-accent-matte-gold/25",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-[0.14em] font-semibold text-black/35">
                          #{item.siad} · {item.dfd_count} DFDs · {item.pedidos.join(", ")}
                        </p>
                        <p
                          className={cn(
                            "mt-1 font-semibold text-upe-neutral-dark-soft-black line-clamp-2 leading-snug",
                            densityMode === "compact" ? "text-[13px]" : "text-[15px]",
                          )}
                        >
                          {item.descricao}
                        </p>
                        <p className="mt-1 text-[11px] text-black/55">
                          {item.grupo_nome} · {item.classe_nome} · {item.tipo_nome} ·{" "}
                          {item.gnd_dominante}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-black/50">
                          <div className="inline-flex items-center gap-2">
                            <AvatarGroup people={item.solicitante_people} />
                            <span className="font-medium text-black/60">
                              {item.solicitante_people.length} servidor{item.solicitante_people.length === 1 ? "" : "es"}
                            </span>
                          </div>
                          <span className="truncate">
                            Local: {compactList(item.locais_uso, 2)}
                          </span>
                          <span className="text-black/35">•</span>
                          <span>{item.source_item_count} origem{item.source_item_count === 1 ? "" : "ens"}</span>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-md border text-[10px] uppercase tracking-widest font-semibold",
                              criticidadeBadgeClass(item.criticidade_level),
                            )}
                          >
                            {CRITICIDADE_LABELS[item.criticidade_level]}
                          </span>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-md border text-[10px] uppercase tracking-widest font-semibold",
                              priorizacaoBadgeClass(item.priorizacao_level),
                            )}
                          >
                            {PRIORIZACAO_LABELS[item.priorizacao_level]}
                          </span>
                          {hasOutlier && (
                            <span className="px-2 py-0.5 rounded-md border text-[10px] uppercase tracking-widest font-semibold bg-upe-warm-light-peach text-upe-warm-light-terracotta border-upe-warm-light-terracotta/30">
                              Outlier preço
                            </span>
                          )}
                          {hasQualityGap && (
                            <span className="px-2 py-0.5 rounded-md border text-[10px] uppercase tracking-widest font-semibold bg-amber-100 text-amber-700 border-amber-200">
                              Revisar dados
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium text-black/45">
                          <span>Variações {item.description_variants}</span>
                          <span className="text-black/25">•</span>
                          <span>Faixa {formatCompactCurrencyRange(item.min_unit_value, item.max_unit_value)}</span>
                          <span className="text-black/25">•</span>
                          <span>Pendências {item.missing_quality_count}%</span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {primaryDfd ? (
                            <a
                              href={`/dfd/${primaryDfd.id}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[#C7D7EA] bg-white px-2.5 text-[10px] font-semibold uppercase tracking-widest text-upe-blue-upe transition-colors hover:border-upe-blue-upe hover:bg-[#EAF2FF]"
                              title={
                                item.dfd_sources.length > 1
                                  ? `Abrir ${primaryDfd.numero_protocolo}. Este item aparece em ${item.dfd_sources.length} DFDs.`
                                  : `Abrir ${primaryDfd.numero_protocolo}`
                              }
                            >
                              <ArrowSquareOut size={13} weight="bold" />
                              Abrir DFD
                            </a>
                          ) : null}
                          {item.dfd_sources.length > 1 ? (
                            <span className="text-[10px] font-medium text-black/45">
                              +{item.dfd_sources.length - 1} protocolo{item.dfd_sources.length - 1 === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <p className="text-[9px] uppercase tracking-widest text-[#9A5B44] font-semibold">
                                Criticidade
                              </p>
                              <span className="text-[10px] font-semibold text-[#C14953]">
                                {CRITICIDADE_LABELS[item.criticidade_level]}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={4}
                              step={1}
                              value={item.criticidade_level}
                              onChange={(event) =>
                                updateItemLevel(
                                  item.siad,
                                  "criticidade_level",
                                  Number(event.target.value),
                                )
                              }
                              className="w-full h-1.5 rounded-lg slider-crit accent-[#C14953]"
                            />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <p className="text-[9px] uppercase tracking-widest text-[#46698F] font-semibold">
                                Priorização
                              </p>
                              <span className="text-[10px] font-semibold text-[#164073]">
                                {PRIORIZACAO_LABELS[item.priorizacao_level]}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={4}
                              step={1}
                              value={item.priorizacao_level}
                              onChange={(event) =>
                                updateItemLevel(
                                  item.siad,
                                  "priorizacao_level",
                                  Number(event.target.value),
                                )
                              }
                              className="w-full h-1.5 rounded-lg slider-prio accent-[#164073]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 2xl:mt-0 2xl:grid-cols-1">
                        <div className="rounded-xl border border-[#D9E0E8] bg-white/90 p-3 text-left shadow-sm 2xl:text-right">
                          <p className="text-[9px] font-semibold uppercase tracking-widest text-black/35">
                            Valor total
                          </p>
                          <p className="mt-1 text-lg font-semibold tracking-tight text-upe-blue-upe">
                            {item.valor_total.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </p>
                        </div>
                        <div className="rounded-lg border border-black/5 bg-white/70 p-2.5 text-left 2xl:text-right">
                          <p className="text-[9px] font-semibold uppercase tracking-widest text-black/35">
                            Quantidade
                          </p>
                          <p className="mt-1 text-sm font-semibold text-upe-neutral-dark-soft-black">
                            {item.quantidade_total}
                          </p>
                        </div>
                        <div className="rounded-lg border border-black/5 bg-white/70 p-2.5 text-left 2xl:text-right">
                          <p className="text-[9px] font-semibold uppercase tracking-widest text-black/35">
                            Score
                          </p>
                          <p className="mt-1 text-sm font-semibold text-upe-neutral-dark-soft-black">
                            {Math.round(item.rank_score)}
                          </p>
                          {showScoreBars && (
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/10 2xl:ml-auto 2xl:w-[104px]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-upe-support-blue-neutral-aqua via-upe-blue-medium to-upe-blue-upe"
                                style={{ width: `${scoreWidth}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 rounded-lg border border-black/5 bg-white/70 p-2.5 2xl:mt-0 2xl:border-0 2xl:bg-transparent 2xl:p-0">
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-black/35 text-left 2xl:text-right">
                          Pareto
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2 2xl:flex-col 2xl:items-end">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-black/45">
                            {item.is_highlight ? "Top 20%" : "Acompanhar"}
                          </span>
                          <div className="flex justify-start 2xl:justify-end">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center w-8 h-8 rounded-lg",
                            item.is_highlight
                              ? "bg-upe-accent-matte-gold text-white"
                              : "bg-upe-neutral-cool-ice text-upe-neutral-cool-steel-gray",
                          )}
                          title={item.is_highlight ? "Dentro do Pareto (20%)" : "Fora do Pareto"}
                        >
                          <Star size={14} weight={item.is_highlight ? "fill" : "bold"} />
                        </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            )}
          </div>
        </section>

        <section
          className={cn(
            "rounded-[28px] border border-black/5 bg-white shadow-sm p-4 space-y-4 min-h-[620px]",
            insightsMenuOpen ? "xl:col-span-3" : "hidden xl:hidden",
          )}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold uppercase tracking-tight text-upe-blue-upe">
                Opções Inteligentes
              </h2>
              <button
                type="button"
                onClick={() => setInsightsMenuOpen(false)}
                className="h-8 w-8 rounded-lg border border-black/10 bg-white text-upe-blue-upe hover:bg-upe-neutral-cool-ice inline-flex items-center justify-center"
                title="Recolher menu de opções"
              >
                <List size={16} weight="bold" />
              </button>
            </div>
            <p className="text-xs text-black/55 mt-1">
              Sugestões de ação para planejamento com alto volume.
            </p>
          </div>

          <div className="rounded-2xl border border-black/5 bg-upe-neutral-cool-off-white p-3 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-black/45 inline-flex items-center gap-2">
              <Funnel size={12} />
              Opções Visuais
            </p>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-black/40 font-semibold">
                Densidade
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDensityMode("comfortable")}
                  className={cn(
                    "h-8 rounded-lg text-[10px] uppercase tracking-widest font-semibold border transition-colors",
                    densityMode === "comfortable"
                      ? "bg-upe-blue-upe text-white border-upe-blue-upe"
                      : "bg-white text-upe-blue-upe border-black/10 hover:bg-upe-neutral-cool-ice",
                  )}
                >
                  Confortável
                </button>
                <button
                  type="button"
                  onClick={() => setDensityMode("compact")}
                  className={cn(
                    "h-8 rounded-lg text-[10px] uppercase tracking-widest font-semibold border transition-colors",
                    densityMode === "compact"
                      ? "bg-upe-blue-upe text-white border-upe-blue-upe"
                      : "bg-white text-upe-blue-upe border-black/10 hover:bg-upe-neutral-cool-ice",
                  )}
                >
                  Compacta
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-black/40 font-semibold">
                Contraste
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setContrastMode("soft")}
                  className={cn(
                    "h-8 rounded-lg text-[10px] uppercase tracking-widest font-semibold border transition-colors",
                    contrastMode === "soft"
                      ? "bg-upe-blue-upe text-white border-upe-blue-upe"
                      : "bg-white text-upe-blue-upe border-black/10 hover:bg-upe-neutral-cool-ice",
                  )}
                >
                  Suave
                </button>
                <button
                  type="button"
                  onClick={() => setContrastMode("high")}
                  className={cn(
                    "h-8 rounded-lg text-[10px] uppercase tracking-widest font-semibold border transition-colors",
                    contrastMode === "high"
                      ? "bg-upe-blue-upe text-white border-upe-blue-upe"
                      : "bg-white text-upe-blue-upe border-black/10 hover:bg-upe-neutral-cool-ice",
                  )}
                >
                  Alto
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowLegends((prev) => !prev)}
                className={cn(
                  "h-8 rounded-lg text-[10px] uppercase tracking-widest font-semibold border transition-colors",
                  showLegends
                    ? "bg-upe-support-blue-neutral-aqua/30 text-upe-support-blue-deep-teal border-upe-support-blue-neutral-aqua"
                    : "bg-white text-upe-blue-upe border-black/10 hover:bg-upe-neutral-cool-ice",
                )}
              >
                Legendas
              </button>
              <button
                type="button"
                onClick={() => setShowScoreBars((prev) => !prev)}
                className={cn(
                  "h-8 rounded-lg text-[10px] uppercase tracking-widest font-semibold border transition-colors",
                  showScoreBars
                    ? "bg-upe-support-blue-neutral-aqua/30 text-upe-support-blue-deep-teal border-upe-support-blue-neutral-aqua"
                    : "bg-white text-upe-blue-upe border-black/10 hover:bg-upe-neutral-cool-ice",
                )}
              >
                Barra Score
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <SmartAction
              title="Divergência de descrição"
              count={divergenciasCount}
              description="Mesmo código e-fisco com textos diferentes."
              active={smartFilter === "divergencia"}
              onClick={() => {
                setSmartFilter((prev) => (prev === "divergencia" ? "all" : "divergencia"));
                setActivePreset("custom");
              }}
            />
            <SmartAction
              title="Outlier de preço"
              count={outliersCount}
              description="Spread de preço elevado para o mesmo código."
              active={smartFilter === "outlier"}
              onClick={() => {
                setSmartFilter((prev) => (prev === "outlier" ? "all" : "outlier"));
                setActivePreset("custom");
              }}
            />
            <SmartAction
              title="Sem classificação"
              count={incompletosCount}
              description="Itens sem criticidade ou priorização definida."
              active={smartFilter === "incompleto"}
              onClick={() => {
                setSmartFilter((prev) => (prev === "incompleto" ? "all" : "incompleto"));
                setActivePreset("custom");
              }}
            />
            <SmartAction
              title="Top Pareto"
              count={paretoCount}
              description="Itens estratégicos que concentram impacto."
              active={smartFilter === "pareto"}
              onClick={() => {
                setSmartFilter((prev) => (prev === "pareto" ? "all" : "pareto"));
                setActivePreset("custom");
              }}
            />
          </div>

          <div className="rounded-2xl border border-black/5 bg-upe-neutral-cool-off-white p-3 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-black/45 inline-flex items-center gap-2">
              <Sparkle size={12} />
              Simulador de Corte
            </p>
            <div>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-semibold text-black/45">
                <span>Corte orçamentário</span>
                <span>{cutPercent}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={cutPercent}
                onChange={(event) => setCutPercent(Number(event.target.value) || 0)}
                className="w-full h-2 rounded-lg slider-prio"
              />
            </div>
            <div className="rounded-xl border border-black/5 bg-white p-3 space-y-2">
              <MetricLine
                label="Meta de corte"
                value={simulation.targetCut.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              />
              <MetricLine
                label="Corte simulado"
                value={simulation.simulatedCut.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              />
              <MetricLine
                label="Itens afetados"
                value={`${simulation.affectedCount}`}
              />
              <MetricLine
                label="Saldo projetado"
                value={simulation.remaining.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 bg-white p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-black/45 inline-flex items-center gap-1">
              <Lightning size={12} />
              Recomendações
            </p>
            <ul className="space-y-1 text-xs text-black/65">
              <li className="leading-relaxed">
                Priorizar correção dos {incompletosCount} itens sem classificação.
              </li>
              <li className="leading-relaxed">
                Revisar {divergenciasCount} códigos com descrição divergente antes da exportação.
              </li>
              <li className="leading-relaxed">
                Validar outliers de preço para evitar distorção no PCA.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[#D9E0E8] bg-white px-4 py-3 shadow-sm">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7D98B8]">
        {label}
      </p>
      <p className="mt-1.5 text-lg font-semibold tracking-tight text-[#164073]">{value}</p>
    </div>
  );
}

function CompactAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [broken, setBroken] = useState(false);

  if (!avatarUrl || broken) {
    return (
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D9E0E8] bg-[#E8EDF2] text-[10px] font-semibold uppercase text-[#164073]">
        {getInitials(name)}
      </span>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={name}
      className="h-7 w-7 shrink-0 rounded-full border border-[#D9E0E8] object-cover"
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
        <span className="-ml-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-white bg-[#D9E0E8] px-1.5 text-[10px] font-semibold text-[#526070]">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function SmartAction({
  title,
  count,
  description,
  active,
  onClick,
}: {
  title: string;
  count: number;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl border p-3 transition-colors",
        active
          ? "border-upe-blue-upe bg-upe-blue-upe/5"
          : "border-black/5 bg-white hover:bg-upe-neutral-cool-ice",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-upe-neutral-dark-soft-black">{title}</p>
        <span className="px-2 py-0.5 rounded-lg bg-upe-neutral-cool-ice text-[10px] font-semibold text-upe-blue-upe">
          {count}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-black/55 leading-relaxed">{description}</p>
    </button>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] uppercase tracking-widest text-black/45 font-semibold">
        {label}
      </span>
      <span className="text-xs font-semibold text-upe-blue-upe">{value}</span>
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
        "h-8 px-3 rounded-lg border text-[10px] uppercase tracking-widest font-semibold transition-colors",
        active
          ? "bg-upe-blue-upe text-white border-upe-blue-upe"
          : "bg-white text-upe-blue-upe border-black/10 hover:bg-upe-neutral-cool-ice",
      )}
    >
      {label}
    </button>
  );
}
