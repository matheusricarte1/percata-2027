"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import {
  ArrowsClockwise,
  DownloadSimple,
  ArrowSquareOut,
  Funnel,
  Sparkle,
  Star,
  X,
} from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { downloadWorkbookFromSheets } from "@/lib/export-excel";
import {
  buildDfdItemDetailRows,
  buildDfdSheetRows,
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
  codigo_item_efisco?: string | null;
  item_key: string;
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
  item_key: string;
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
type QuickFocus = "none" | "criticos" | "essenciais";
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

function criticidadeBadgeClass(level: number): string {
  if (level >= 4) return "bg-upe-red-upe/15 text-upe-red-dark border-upe-red-upe/30";
  if (level === 3) return "bg-upe-warm-light-terracotta/15 text-upe-warm-light-terracotta border-upe-warm-light-terracotta/35";
  if (level === 2) return "bg-upe-accent-soft-mustard/15 text-upe-accent-matte-gold border-upe-accent-soft-mustard/40";
  if (level === 1) return "bg-upe-support-blue-neutral-aqua/20 text-upe-support-blue-deep-teal border-upe-support-blue-neutral-aqua/40";
  return "bg-upe-neutral-cool-ice text-upe-neutral-cool-steel-gray border-upe-neutral-cool-light-gray";
}

function priorizacaoBadgeClass(level: number): string {
  if (level >= 4) return "bg-[var(--semantic-collab-soft)] text-[var(--semantic-collab)] border-[var(--semantic-collab-border)]";
  if (level === 3) return "bg-[var(--semantic-insight-soft)] text-[var(--semantic-insight)] border-[var(--semantic-insight-border)]";
  if (level === 2) return "bg-[var(--semantic-success-soft)] text-[var(--semantic-success)] border-[var(--semantic-success-border)]";
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

  const topSet = new Set(sorted.slice(0, limit).map((item) => item.item_key));
  return scored.map((item) => ({ ...item, is_highlight: topSet.has(item.item_key) }));
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
  const [highlightOnly, setHighlightOnly] = useState(false);
  const [densityMode, setDensityMode] = useState<DensityMode>("comfortable");
  const [contrastMode, setContrastMode] = useState<ContrastMode>("soft");
  const [showLegends, setShowLegends] = useState(true);
  const [showScoreBars, setShowScoreBars] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dfdMenuOpen, setDfdMenuOpen] = useState(false);
  const [previewDfdId, setPreviewDfdId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
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

  const previewDfd = useMemo(
    () => (previewDfdId ? dfds.find((dfd) => dfd.id === previewDfdId) || null : null),
    [dfds, previewDfdId],
  );

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
    setQuickFocus("none");
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
      const chunkArray = <T,>(values: T[], chunkSize = 150): T[][] => {
        if (values.length === 0) return [];
        const safeChunkSize = Math.max(1, chunkSize);
        const chunks: T[][] = [];
        for (let i = 0; i < values.length; i += safeChunkSize) {
          chunks.push(values.slice(i, i + safeChunkSize));
        }
        return chunks;
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
          const { data, error } = await supabase
            .from(table)
            .select(selectColumns)
            .in(inColumn, idChunk);
          if (error) throw error;
          rows.push(...((data || []) as any[]));
        }
        return rows;
      };

      let dfdsRes: any = await supabase
        .from("dfds")
        .select("*")
        .in("status", Array.from(CONSOLIDATION_ELIGIBLE_STATUSES))
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
          .in("status", Array.from(CONSOLIDATION_ELIGIBLE_STATUSES))
          .order("created_at", { ascending: false });
      }
      if (dfdsRes.error) throw dfdsRes.error;

      let approvedDfdsRows = (dfdsRes.data || []) as any[];
      if (approvedDfdsRows.length === 0) {
        // Fallback defensivo para ambientes onde o status foi persistido com variação legada.
        const allDfdsRes: any = await supabase
          .from("dfds")
          .select("*")
          .order("created_at", { ascending: false });
        if (allDfdsRes.error) throw allDfdsRes.error;
        approvedDfdsRows = ((allDfdsRes.data || []) as any[]).filter((row) =>
          CONSOLIDATION_ELIGIBLE_STATUSES.has(normalizeDfdStatus(row?.status)),
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

      const [campiRes, profilesRes, departamentosRes, laboratoriosRes] = await Promise.all([
        fetchByInChunks("campi", "id, nome, sigla", "id", campusIds),
        fetchByInChunks("profiles", "id, full_name, email, avatar_url", "id", solicitanteIds),
        fetchByInChunks("departamentos", "id, nome", "id", departamentoIds),
        fetchByInChunks("laboratorios", "id, nome", "id", laboratorioIds),
      ]);

      const campiData = campiRes as any[];
      const profilesData = profilesRes as any[];
      const departamentosData = departamentosRes as any[];
      const laboratoriosData = laboratoriosRes as any[];

      const itemsRowsData: any[] = [];
      const legacyItemsSelect =
        "id, dfd_id, codigo_tce, codigo_item_efisco, descricao, quantidade, valor_unitario_estimado, is_highlight_item, gnd, link_referencia, justificativa_item, justificativa_quantidade";

      for (const dfdChunk of chunkArray(dfdIds, 120)) {
        const primaryRes: any = await supabase
          .from("dfd_items")
          .select("*")
          .in("dfd_id", dfdChunk);

        if (
          primaryRes.error &&
          /criticidade|moscow_categoria|local_uso/i.test(String(primaryRes.error.message || ""))
        ) {
          const fallbackRes: any = await supabase
            .from("dfd_items")
            .select(legacyItemsSelect)
            .in("dfd_id", dfdChunk);
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
            return {
              id: String(row.id || ""),
              dfd_id: String(row.dfd_id || ""),
              codigo_tce: itemCode,
              codigo_item_efisco: String(row.codigo_item_efisco || "").trim() || null,
              item_key:
                itemCode ||
                [String(row.descricao || "").trim().toLowerCase(), String(row.gnd || "").trim().toLowerCase()]
                  .filter(Boolean)
                  .join("|") ||
                String(row.id || ""),
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
            } satisfies RawItem;
          },
        )
        .filter((row) => row.dfd_id && row.item_key);

      const campusMap = new Map(
        campiData.map((campus) => [
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

        if (!consolidated.has(row.item_key)) {
          consolidated.set(row.item_key, {
            item_key: row.item_key,
            siad: row.codigo_tce || row.codigo_item_efisco || "Sem código",
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

        const entry = consolidated.get(row.item_key)!;
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
      const uniqueCodes = Array.from(new Set(itemsRows.map((row) => row.codigo_tce || row.codigo_item_efisco || ""))).filter(
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
          item_key: entry.item_key,
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
      setLastUpdatedAt(new Date());
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
    if (codes.length === 0) return null;
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
      next = next.filter((item) => selectedDfdCodeSet.has(item.item_key));
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

    if (quickFocus === "criticos") {
      next = next.filter((item) => item.criticidade_level >= 4);
    } else if (quickFocus === "essenciais") {
      next = next.filter((item) => item.priorizacao_level >= 4);
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
    quickFocus,
    selectedDfdCodeSet,
    servidorFilter,
    smartFilter,
    sortBy,
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
  const criticosCount = useMemo(
    () => items.filter((item) => item.criticidade_level >= 4).length,
    [items],
  );
  const essenciaisCount = useMemo(
    () => items.filter((item) => item.priorizacao_level >= 4).length,
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
      <section className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#102B4A_0%,#164073_48%,#1F6F78_100%)] text-white shadow-[0_24px_56px_rgba(13,44,89,0.24)]">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 md:px-8 md:py-6">
          <div className="flex items-start gap-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-sm">
              <Sparkle size={24} weight="fill" className="text-white" />
            </div>
            <div>
              <h1 className="font-display text-[32px] font-semibold tracking-tight">
                Consolidação Inteligente
              </h1>
              <p className="mt-1 text-base text-white/78">
                Admin · DFDs aprovadas para PCA
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/18 bg-white/6 px-4 text-sm font-medium text-white/84 backdrop-blur-sm">
              <ArrowsClockwise size={16} />
              {formatUpdatedAtLabel(lastUpdatedAt)}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={fetchData}
              className="h-11 rounded-2xl border-white/20 bg-white/6 px-5 text-white hover:bg-white/12 hover:text-white"
            >
              <ArrowsClockwise size={16} className="mr-2" />
              Atualizar dados
            </Button>
            <Button
              type="button"
              onClick={exportXLSX}
              className="h-11 rounded-2xl bg-[#2D7BFF] px-5 text-white hover:bg-[#2267D8]"
            >
              <DownloadSimple size={16} className="mr-2" />
              Exportar XLSX
            </Button>
          </div>
        </div>
      </section>

      <section className="ux-panel rounded-[28px] px-5 py-4">
        <div className="grid gap-3 xl:grid-cols-[1.35fr_1.15fr_1fr_1fr_1fr_1.25fr]">
          <TopMetric
            icon={<span className="text-[#2D7BFF]">$</span>}
            title="Valor do recorte"
            value={visibleValue.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
            subtitle="Total estimado"
            highlight
            tone="action"
          />
          <TopMetric title="Itens consolidados" value={String(displayItems.length)} subtitle="Itens no recorte" tone="collab" />
          <TopMetric title="DFDs aprovadas" value={String(dfds.length)} subtitle="DFDs de origem" tone="success" />
          <TopMetric title="Itens estrela" value={String(paretoCount)} subtitle="Recorte prioritário" tone="warning" />
          <TopMetric title="Filtros ativos" value={String(activeFilterCount)} subtitle={activeFilterCount > 0 ? "Recorte aplicado" : "Sem filtro"} tone="insight" />
          <div className="rounded-2xl border border-[var(--semantic-insight-border)] bg-[var(--semantic-insight-soft)] p-4">
            <p className="text-sm font-semibold text-[var(--semantic-insight)]">Insight do recorte</p>
            <p className="mt-2 text-sm leading-6 text-[#3D4E67]">
              {paretoCount} itens merecem leitura antes dos demais.
            </p>
          </div>
        </div>
      </section>

      <div className="min-h-[74vh]">
        <section
          className={cn(
            "flex min-h-[720px] flex-col overflow-hidden rounded-[28px] border border-[#D9E6F3] bg-white shadow-[0_14px_32px_rgba(22,64,115,0.08)]",
            contrastMode === "high" && "border-upe-blue-upe/30",
          )}
        >
          <div className="border-b border-[#C7D7EA] bg-[#F7FBFF] p-4 md:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-display text-[22px] font-semibold tracking-tight text-[var(--semantic-text)]">
                  Itens consolidados do recorte
                </h2>
                <p className="mt-1 text-sm leading-6 text-black/55">
                  A ordem mostra primeiro o que mais pesa na decisão: score, risco, valor e origem.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDfdMenuOpen(true)}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#C7D7EA] bg-white px-4 text-sm font-semibold text-upe-blue-upe shadow-sm hover:bg-[#F3F8FF]"
                >
                  <ArrowSquareOut size={16} />
                  Ver DFDs de origem ({dfds.length})
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(280px,1fr)_auto]">
              <input
                value={itemSearchTerm}
                onChange={(event) => {
                  setItemSearchTerm(event.target.value);
                  setActivePreset("custom");
                }}
                placeholder="Buscar por item, protocolo, campus, solicitante ou descrição..."
                className="h-11 min-w-0 rounded-2xl border border-[#C7D7EA] bg-white px-4 text-sm font-semibold outline-none shadow-sm focus:ring-2 focus:ring-upe-blue-medium/20"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((prev) => !prev)}
                  className={cn(
                    "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-[10px] font-semibold uppercase tracking-widest shadow-sm transition-colors",
                    filtersOpen
                      ? "border-upe-blue-upe bg-upe-blue-upe text-white"
                      : "border-[#C7D7EA] bg-white text-upe-blue-upe hover:bg-upe-neutral-cool-ice",
                  )}
                >
                  <Funnel size={14} />
                  Filtros
                </button>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as "score_desc" | "value_desc" | "quantity_desc")}
                  className="h-11 rounded-2xl border border-[#C7D7EA] bg-white px-4 text-sm font-semibold text-upe-blue-upe outline-none shadow-sm"
                >
                  <option value="score_desc">Maior score</option>
                  <option value="value_desc">Maior valor</option>
                  <option value="quantity_desc">Maior quantidade</option>
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
                label="Outliers"
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
            <span className="text-right">Score e decisão</span>
            <span className="text-right">Estrela</span>
          </div>

          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(7)].map((_, index) => (
                  <Skeleton key={index} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : displayItems.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 py-10">
                <div className="flex max-w-md flex-col items-center text-center">
                  <img
                    src="/guidance/triage-empty-queue.png"
                    alt="Sem itens no recorte"
                    className="h-auto w-full max-w-[240px]"
                  />
                  <h3 className="mt-5 text-lg font-semibold text-upe-blue-upe">
                    Nenhum item neste recorte
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-black/55">
                    Ajuste os filtros ou escolha outra DFD de origem para voltar a enxergar a fila de priorização.
                  </p>
                  {activeFilterCount > 0 || selectedDfdId !== "all" ? (
                    <button
                      type="button"
                      onClick={() => {
                        resetFilters();
                        setActivePreset("custom");
                      }}
                      className="mt-4 inline-flex h-10 items-center justify-center rounded-2xl border border-[#C7D7EA] bg-white px-4 text-sm font-semibold text-upe-blue-upe hover:bg-[#F3F8FF]"
                    >
                      Limpar recorte
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <Virtuoso
                className="w-full"
                style={{ minHeight: 420, height: "100%" }}
                data={displayItems}
                overscan={320}
                itemContent={(index, item) => {
                  const rowDensity = densityMode === "compact" ? "py-2" : "py-3";
                  const scoreWidth = Math.max(
                    6,
                    Math.min(100, Math.round((item.rank_score / maxVisibleScore) * 100)),
                  );
                  const isExpanded = expandedItemId === item.siad;
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
                        "mx-3 my-1.5 rounded-[22px] border border-[#E5EDF7] bg-white p-4 shadow-[0_10px_24px_rgba(22,64,115,0.06)] transition-colors md:mx-4",
                        stripedBg,
                        rowDensity,
                        item.is_highlight && "ring-1 ring-inset ring-upe-accent-matte-gold/25",
                      )}
                    >
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_220px_170px]">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-black/35">
                            #{item.siad} · {item.dfd_count} DFD{item.dfd_count === 1 ? "" : "s"} · {item.pedidos.join(", ")}
                          </p>
                          <p
                            className={cn(
                              "mt-1 font-semibold text-upe-neutral-dark-soft-black line-clamp-2 leading-snug",
                              densityMode === "compact" ? "text-[15px]" : "text-[16px]",
                            )}
                          >
                            {item.descricao}
                          </p>
                          <p className="mt-2 text-[12px] text-black/50">
                            {item.grupo_nome} · {item.classe_nome} · {item.tipo_nome} · {item.gnd_dominante}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "px-2.5 py-1 rounded-full border text-[11px] font-semibold",
                                criticidadeBadgeClass(item.criticidade_level),
                              )}
                            >
                              {CRITICIDADE_LABELS[item.criticidade_level]}
                            </span>
                            <span
                              className={cn(
                                "px-2.5 py-1 rounded-full border text-[11px] font-semibold",
                                priorizacaoBadgeClass(item.priorizacao_level),
                              )}
                            >
                              {PRIORIZACAO_LABELS[item.priorizacao_level]}
                            </span>
                            {hasOutlier ? (
                              <span className="px-2.5 py-1 rounded-full border text-[11px] font-semibold bg-upe-warm-light-peach text-upe-warm-light-terracotta border-upe-warm-light-terracotta/30">
                                Outlier
                              </span>
                            ) : null}
                            {hasQualityGap ? (
                              <span className="px-2.5 py-1 rounded-full border text-[11px] font-semibold bg-amber-100 text-amber-700 border-amber-200">
                                Revisar
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-black/55">
                            <div className="inline-flex items-center gap-2">
                              <AvatarGroup people={item.solicitante_people} />
                              <span className="font-medium text-black/65">
                                {item.solicitante_people.length} servidor{item.solicitante_people.length === 1 ? "" : "es"}
                              </span>
                            </div>
                            <span>Local: {compactList(item.locais_uso, 1)}</span>
                            <span>{item.source_item_count} origem{item.source_item_count === 1 ? "" : "ens"}</span>
                          </div>
                        </div>

                        <div className="grid gap-2 self-start rounded-[18px] border border-[#E6EDF7] bg-[#FBFDFF] p-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8CA7]">
                              Valor estimado
                            </p>
                            <p className="mt-1 text-[15px] font-semibold text-[#164073]">
                              {item.valor_total.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8CA7]">
                              Origem
                            </p>
                            <p className="mt-1 text-[13px] font-medium text-black/70">
                              {item.solicitante_people.length} servidor
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8CA7]">
                              Local
                            </p>
                            <p className="mt-1 text-[13px] font-medium text-black/70 line-clamp-2">
                              {compactList(item.locais_uso, 1)}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-2 self-start">
                          <div className="rounded-[18px] border border-[var(--semantic-success-border)] bg-[var(--semantic-success-soft)] p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--semantic-success)]">
                              Score
                            </p>
                            <p className="mt-1 text-[28px] font-semibold leading-none tracking-tight text-[var(--semantic-text)]">
                              {Math.round(item.rank_score)}
                            </p>
                            {showScoreBars ? (
                              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#DCE8F7]">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-[var(--semantic-warning)] via-[var(--semantic-collab)] to-[var(--semantic-action)]"
                                  style={{ width: `${scoreWidth}%` }}
                                />
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedItemId((prev) => (prev === item.siad ? null : item.siad))
                            }
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[#D9E6F3] bg-white px-4 text-sm font-semibold text-[#164073] hover:bg-[#F5F9FF]"
                          >
                            Ver detalhes
                          </button>
                          {primaryDfd ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setPreviewDfdId(primaryDfd.id);
                              }}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[#D9E6F3] bg-white px-4 text-sm font-semibold text-[#164073] hover:bg-[#F5F9FF]"
                            >
                              Ver origem
                            </button>
                          ) : null}
                          <div className="flex justify-end">
                            <span
                              className={cn(
                                "inline-flex items-center justify-center w-9 h-9 rounded-xl",
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

                      {isExpanded ? (
                        <div className="mt-4 grid gap-4 border-t border-[#E6EDF7] pt-4 lg:grid-cols-[1fr_1fr]">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-black/50">
                              <span>Variações {item.description_variants}</span>
                              <span className="text-black/25">•</span>
                              <span>Faixa {formatCompactCurrencyRange(item.min_unit_value, item.max_unit_value)}</span>
                              <span className="text-black/25">•</span>
                              <span>Pendências {item.missing_quality_count}%</span>
                            </div>
                            <div>
                              <div className="mb-1 flex items-center justify-between">
                                <p className="text-[10px] uppercase tracking-widest text-[#9A5B44] font-semibold">
                                  Criticidade
                                </p>
                                <span className="text-[11px] font-semibold text-[#C14953]">
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
                                <p className="text-[10px] uppercase tracking-widest text-[#46698F] font-semibold">
                                  Priorização
                                </p>
                                <span className="text-[11px] font-semibold text-[#164073]">
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
                          <div className="rounded-[18px] border border-[#E6EDF7] bg-[#FBFDFF] p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8CA7]">
                              Contexto do item
                            </p>
                            <div className="mt-3 space-y-2">
                              <MetricLine label="Quantidade" value={String(item.quantidade_total)} />
                              <MetricLine
                                label="Protocolos"
                                value={
                                  item.dfd_sources.length > 1
                                    ? `${primaryDfd?.numero_protocolo || "N/D"} +${item.dfd_sources.length - 1}`
                                    : primaryDfd?.numero_protocolo || "N/D"
                                }
                              />
                              <MetricLine label="Campus" value={compactList(item.pedidos, 2)} />
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                }}
              />
            )}
          </div>
        </section>
      </div>

      {dfdMenuOpen ? (
        <>
          <button
            type="button"
            aria-label="Fechar lista de DFDs"
            className="fixed inset-0 z-40 bg-[#0F2238]/18 backdrop-blur-[1px]"
            onClick={() => setDfdMenuOpen(false)}
          />
          <aside className="fixed inset-y-4 left-4 z-50 w-[400px] max-w-[calc(100vw-2rem)] rounded-[28px] border border-[#D9E6F3] bg-white shadow-[0_24px_56px_rgba(15,34,56,0.18)]">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-black/5 px-5 py-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#47739F]">
                    Origem do recorte
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-[#164073]">
                    DFDs de origem
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDfdMenuOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-upe-blue-upe hover:bg-[#F3F8FF]"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>
              <div className="space-y-3 border-b border-black/5 px-5 py-4">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-black/40">
                  <span>{filteredDfds.length} no recorte</span>
                  <span>{selectedDfdId === "all" ? "Todas" : "1 ativa"}</span>
                </div>
                <input
                  value={dfdSearchTerm}
                  onChange={(event) => setDfdSearchTerm(event.target.value)}
                  placeholder="Buscar protocolo ou solicitante"
                  className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-blue-medium/20"
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
                            ? "bg-upe-blue-upe/6"
                            : "hover:bg-upe-neutral-cool-ice/60",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-black/35">
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                selectedDfdId === dfd.id ? "bg-upe-blue-upe" : "bg-black/25",
                              )}
                            />
                            {dfd.numero_protocolo}
                          </p>
                          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-black/35">
                            {dfd.item_count} itens
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-upe-neutral-dark-soft-black">
                          {dfd.objeto_contratacao}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-black/60">
                          <div className="flex min-w-0 items-center gap-2">
                            <CompactAvatar
                              name={dfd.solicitante_nome}
                              avatarUrl={dfd.solicitante_avatar_url}
                            />
                            <span className="truncate">{dfd.solicitante_nome}</span>
                          </div>
                          <span className="shrink-0 font-semibold text-upe-blue-upe">
                            {dfd.valor_total.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-black/45">
                          {dfd.campus_nome} • {dfd.unidade_nome || "local não definido"}
                        </p>
                      </button>
                    )}
                  />
                )}
              </div>
            </div>
          </aside>
        </>
      ) : null}

      {previewDfd ? (
        <>
          <button
            type="button"
            aria-label="Fechar painel da DFD"
            className="fixed inset-0 z-40 bg-[#0F2238]/18 backdrop-blur-[1px]"
            onClick={() => setPreviewDfdId(null)}
          />
          <aside className="fixed inset-y-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-[28px] border border-[#9FB9D6] bg-white shadow-[0_24px_56px_rgba(15,34,56,0.22)]">
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-[#D9E0E8] bg-[#F7FBFF] px-5 py-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#47739F]">
                    Contexto da DFD
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-[#164073]">
                    {previewDfd.numero_protocolo}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewDfdId(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-upe-blue-upe hover:bg-upe-neutral-cool-ice"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="rounded-2xl border border-[#D9E0E8] bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-black/35">
                    Objeto
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-upe-neutral-dark-soft-black">
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

                <div className="rounded-2xl border border-black/5 bg-upe-neutral-cool-off-white p-4 space-y-3">
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
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-black/35">
                    Solicitante
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <CompactAvatar
                      name={previewDfd.solicitante_nome}
                      avatarUrl={previewDfd.solicitante_avatar_url}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-upe-neutral-dark-soft-black">
                        {previewDfd.solicitante_nome}
                      </p>
                      <p className="truncate text-xs text-black/50">
                        {previewDfd.solicitante_email || "email não informado"}
                      </p>
                    </div>
                  </div>
                </div>

                {previewDfd.itens_sem_classificacao > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                    <p className="text-[10px] font-semibold uppercase tracking-widest">
                      Atenção
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {previewDfd.itens_sem_classificacao} item(ns) ainda sem classificação completa.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-[#D9E0E8] px-5 py-4">
                <a
                  href={`/dfd/${previewDfd.id}`}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#164073] px-4 text-sm font-semibold text-white hover:bg-[#0F2E57]"
                >
                  <ArrowSquareOut size={16} weight="bold" />
                  Abrir DFD completa
                </a>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
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
          ? "border-[#9FB9D6] bg-[linear-gradient(180deg,#F9FCFF_0%,#F2F8FF_100%)] shadow-[0_12px_28px_rgba(22,64,115,0.08)]"
          : "border-[#D9E0E8] bg-white",
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7D98B8]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-semibold tracking-tight text-[#164073]",
          emphasis === "primary" ? "text-[28px]" : "text-lg",
        )}
      >
        {value}
      </p>
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
}: {
  title: string;
  value: string;
  subtitle: string;
  icon?: ReactNode;
  highlight?: boolean;
  tone?: "action" | "collab" | "success" | "warning" | "insight";
}) {
  const toneClass = {
    action: "ux-icon-action",
    collab: "ux-icon-collab",
    success: "ux-icon-success",
    warning: "ux-icon-warning",
    insight: "ux-icon-insight",
  }[tone];
  const valueClass = {
    action: "text-[var(--semantic-action)]",
    collab: "text-[var(--semantic-collab)]",
    success: "text-[var(--semantic-success)]",
    warning: "text-[#8A5A00]",
    insight: "text-[var(--semantic-insight)]",
  }[tone];

  return (
    <div
      className={cn(
        "flex h-full items-center gap-4 rounded-2xl border p-4",
        highlight
          ? "border-[#CFE0FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F5F9FF_100%)]"
          : "border-[#E5EDF7] bg-white",
      )}
    >
      {icon ? (
        <div className={cn("inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold", toneClass)}>
          {icon}
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#526070]">{title}</p>
        <p className={cn("mt-1 text-[18px] font-semibold tracking-tight md:text-[20px]", valueClass)}>
          {value}
        </p>
        <p className="mt-1 text-sm text-black/45">{subtitle}</p>
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
      ? "border-[#2456B6] bg-[#164073] text-white"
      : "border-[#D9E6F3] bg-white text-[#164073] hover:bg-[#F5F9FF]",
    gold: active
      ? "border-[#A67A15] bg-[#7F5E11] text-white"
      : "border-[#F0E2B8] bg-white text-[#7F5E11] hover:bg-[#FFF9EA]",
    red: active
      ? "border-[#C14953] bg-[#C14953] text-white"
      : "border-[#F1C7CC] bg-white text-[#C14953] hover:bg-[#FFF6F7]",
    blue: active
      ? "border-[#2456B6] bg-[#2456B6] text-white"
      : "border-[#CFE0FF] bg-white text-[#2456B6] hover:bg-[#F5F9FF]",
    orange: active
      ? "border-[#D97706] bg-[#D97706] text-white"
      : "border-[#F6D4A7] bg-white text-[#C46A00] hover:bg-[#FFF8EE]",
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
          "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
          active ? "bg-white/20 text-current" : "bg-black/5 text-current",
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
