"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  Filter,
  GitBranch,
  Grid3X3,
  Layers3,
  LineChart,
  Network,
  RefreshCw,
  Search,
  TimerReset,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { LoadingPanel, EmptyState } from "@/components/feedback/SystemFeedback";
import { toast } from "sonner";
import { getSafeUser, supabase } from "@/lib/supabase";
import { isSuperadminEmail } from "@/lib/access";
import { parseCollectiveDistributionText } from "@/lib/collective-dfd";
import {
  buildCsv as buildReportCsv,
  collectExportHeaders,
  protectReportRow,
} from "@/lib/admin-reports";
import { cn } from "@/lib/utils";

type DfdStatus =
  | "rascunho"
  | "enviada"
  | "triagem"
  | "devolvida"
  | "aprovada"
  | "pactuando"
  | "concluida"
  | string;

type UnitScope = {
  unit_id: string;
  unit_type?: string | null;
  unit_name?: string | null;
};

type ScopeOption = {
  key: string;
  label: string;
  detail: string;
  unit_id?: string | null;
  unit_type?: string | null;
};

interface DfdDashboardRow {
  id: string;
  numero_protocolo: string | null;
  objeto_contratacao: string | null;
  justificativa_contratacao: string | null;
  justificativa_quantidade?: string | null;
  status: DfdStatus;
  valor_total_estimado: number | null;
  created_at: string | null;
  previsao_recebimento?: string | null;
  unidade_id?: string | null;
  tipo_unidade?: string | null;
  analysis_unidade_id?: string | null;
  analysis_tipo_unidade?: string | null;
  prioridade?: number | null;
  raw?: Record<string, unknown>;
}

interface DfdItemDashboardRow {
  id: string;
  dfd_id: string | null;
  descricao: string | null;
  quantidade: number | null;
  valor_unitario_estimado: number | null;
  gnd: string | null;
  local_uso?: string | null;
  justificativa_item?: string | null;
  justificativa_quantidade?: string | null;
  criticidade?: string | null;
  moscow_categoria?: string | null;
  is_highlight_item?: boolean | null;
  raw?: Record<string, unknown>;
}

type DfdWithMetrics = DfdDashboardRow & {
  value: number;
  itemCount: number;
  itemQuantity: number;
  gnds: string[];
  expenseClass: "Custeio" | "Capital" | "Misto" | "Sem GND";
  collective: boolean;
  participants: string[];
  qualityScore: number;
  qualityFlags: string[];
  ageDays: number | null;
  priorityScore: number;
  topItem: string;
};

type GndMetric = {
  gnd: string;
  label: string;
  value: number;
  percent: number;
  count: number;
};

type RankedItem = {
  key: string;
  label: string;
  value: number;
  quantity: number;
  count: number;
};

type DuplicateGroup = {
  key: string;
  label: string;
  count: number;
  dfds: DfdWithMetrics[];
  value: number;
};

const DFD_SELECT = "*";

const DFD_SELECT_LEGACY =
  "id, numero_protocolo, objeto_contratacao, justificativa_contratacao, justificativa_quantidade, status, valor_total_estimado, created_at, previsao_recebimento, unidade_id, tipo_unidade, prioridade";

const DFD_STATUSES = [
  "rascunho",
  "enviada",
  "triagem",
  "devolvida",
  "aprovada",
  "pactuando",
  "concluida",
];

const GND_LABELS: Record<string, string> = {
  "3.3.90.30": "Material de Consumo",
  "3.3.90.36": "Serviços PF",
  "3.3.90.39": "Serviços PJ",
  "4.4.90.51": "Obras e Instalações",
  "4.4.90.52": "Equipamentos/Permanente",
};

const STATUS_META: Record<string, { label: string; tone: string; dot: string }> = {
  rascunho: { label: "Rascunho", tone: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  enviada: { label: "Enviada", tone: "bg-blue-50 text-blue-800 border-blue-200", dot: "bg-blue-500" },
  triagem: { label: "Em análise", tone: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  devolvida: { label: "Devolvida", tone: "bg-red-50 text-red-800 border-red-200", dot: "bg-red-500" },
  aprovada: { label: "Homologada", tone: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  pactuando: { label: "Recebida pela Admin.", tone: "bg-cyan-50 text-cyan-800 border-cyan-200", dot: "bg-cyan-500" },
  concluida: { label: "Consolidada", tone: "bg-[#E8EDF2] text-[#164073] border-[#C7D7EA]", dot: "bg-[#164073]" },
};

function isMissingAnalysisColumns(error: any) {
  return /analysis_unidade_id|analysis_tipo_unidade/i.test(String(error?.message || ""));
}

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return formatCurrency(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeStatus(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function getStatusMeta(status?: string | null) {
  return STATUS_META[normalizeStatus(status)] || {
    label: String(status || "Sem status"),
    tone: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
  };
}

function itemSubtotal(item: DfdItemDashboardRow) {
  return Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0);
}

function getExpenseClassFromGnd(gnd?: string | null) {
  const digits = String(gnd || "").replace(/\D/g, "");
  if (digits[0] === "3") return "Custeio";
  if (digits[0] === "4") return "Capital";
  return "Sem GND";
}

function getDaysSince(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

function normalizeText(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function duplicateKey(value?: string | null) {
  const stopWords = new Set([
    "de",
    "da",
    "do",
    "das",
    "dos",
    "para",
    "com",
    "sem",
    "tipo",
    "unidade",
    "material",
    "servico",
    "diversos",
    "diversas",
  ]);
  const tokens = normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 3 && !stopWords.has(token));
  return tokens.slice(0, 3).join(" ");
}

function qualityForDfd(dfd: DfdDashboardRow, items: DfdItemDashboardRow[]) {
  const checks = [
    {
      ok: Boolean(String(dfd.justificativa_contratacao || "").trim()),
      label: "Requer justificativa",
    },
    {
      ok: items.length > 0 && items.every((item) => Number(item.quantidade || 0) > 0),
      label: "Quantitativo incompleto",
    },
    {
      ok: items.length > 0 && items.every((item) => Number(item.valor_unitario_estimado || 0) > 0),
      label: "Valor estimado ausente",
    },
    {
      ok: items.length > 0 && items.every((item) => String(item.gnd || "").trim()),
      label: "GND ausente",
    },
    {
      ok: items.length > 0 && items.some((item) => String(item.local_uso || "").trim()),
      label: "Local de uso ausente",
    },
  ];
  const passed = checks.filter((check) => check.ok).length;
  return {
    score: Math.round((passed / checks.length) * 100),
    flags: checks.filter((check) => !check.ok).map((check) => check.label),
  };
}

function priorityScoreForDfd(dfd: DfdDashboardRow, items: DfdItemDashboardRow[]) {
  const explicit = Number(dfd.prioridade || 0);
  if (explicit > 0) return Math.min(100, explicit * 10);
  const criticidadeScore = Math.max(
    0,
    ...items.map((item) => {
      const criticidade = String(item.criticidade || "");
      if (criticidade === "critica") return 95;
      if (criticidade === "alta") return 78;
      if (criticidade === "media") return 55;
      if (criticidade === "baixa") return 30;
      return 0;
    }),
  );
  const moscowScore = Math.max(
    0,
    ...items.map((item) => {
      const moscow = String(item.moscow_categoria || "");
      if (moscow === "deve_ter") return 90;
      if (moscow === "deveria_ter") return 70;
      if (moscow === "poderia_ter") return 45;
      return 0;
    }),
  );
  return Math.max(criticidadeScore, moscowScore, 40);
}

function belongsToChefiaScope(dfd: DfdDashboardRow, units: UnitScope[]) {
  return units.some((unit) => {
    const unitId = String(unit.unit_id || "");
    const unitType = String(unit.unit_type || "");
    const analysisId = String(dfd.analysis_unidade_id || "");
    const analysisType = String(dfd.analysis_tipo_unidade || "");
    if (analysisId && analysisType) {
      return analysisId === unitId && analysisType === unitType;
    }
    return String(dfd.unidade_id || "") === unitId;
  });
}

async function resolveUnitName(unitType?: string | null, unitId?: string | null) {
  const id = String(unitId || "").trim();
  const type = String(unitType || "").trim();
  if (!id || !type) return null;

  const tableName = type === "departamento" ? "departamentos" : "laboratorios";
  const { data, error } = await supabase
    .from(tableName as any)
    .select("nome")
    .eq("id", id)
    .maybeSingle();

  if (error) return null;
  return String((data as any)?.nome || "").trim() || null;
}

async function resolveScopeLabelFromUnits(units: UnitScope[], scopedDfds: DfdDashboardRow[]) {
  const candidates = [
    ...units.map((unit) => ({
      unit_id: unit.unit_id,
      unit_type: unit.unit_type,
    })),
    ...scopedDfds.map((dfd) => ({
      unit_id: dfd.analysis_unidade_id || dfd.unidade_id || null,
      unit_type: dfd.analysis_tipo_unidade || dfd.tipo_unidade || null,
    })),
  ].filter((unit) => unit.unit_id && unit.unit_type);

  const unique = Array.from(
    new Map(candidates.map((unit) => [`${unit.unit_type}:${unit.unit_id}`, unit])).values(),
  );
  const names = (
    await Promise.all(unique.map((unit) => resolveUnitName(unit.unit_type, unit.unit_id)))
  ).filter((name): name is string => Boolean(name));

  if (names.length === 0) return "Setor não identificado";
  if (names.length === 1) return names[0];
  return `${names[0]} + ${names.length - 1} unidade(s)`;
}

async function resolveScopeOptions(
  units: UnitScope[],
  includeInstitutional = false,
): Promise<ScopeOption[]> {
  const unitOptions = await Promise.all(
    units.map(async (unit) => {
      const unitName = await resolveUnitName(unit.unit_type, unit.unit_id);
      const typeLabel = unit.unit_type === "laboratorio" ? "Laboratório" : "Setor";
      const fallback = `${typeLabel} ${unit.unit_id.slice(0, 8)}`;
      return {
        key: `${unit.unit_type}:${unit.unit_id}`,
        label: unitName || fallback,
        detail: typeLabel,
        unit_id: unit.unit_id,
        unit_type: unit.unit_type,
      };
    }),
  );

  const institutionalOption: ScopeOption = {
    key: "institutional",
    label: "Visão geral institucional",
    detail: "Todas as DFDs visíveis ao superadmin",
  };

  if (unitOptions.length <= 1) {
    return includeInstitutional ? [...unitOptions, institutionalOption] : unitOptions;
  }

  const options = [
    {
      key: "all",
      label: `Visão consolidada: ${unitOptions.length} unidades`,
      detail: "Setor e laboratórios vinculados",
    },
    ...unitOptions,
  ];

  return includeInstitutional ? [...options, institutionalOption] : options;
}

function buildCsv(rows: DfdWithMetrics[]) {
  const preferredHeaders = [
    "protocolo",
    "objeto",
    "status",
    "valor",
    "quantidade_itens",
    "quantidade_total",
    "classe",
    "gnds",
    "qualidade",
    "pendencias_qualidade",
    "idade_dias",
    "prioridade_score",
    "item_principal",
    "participantes_coletiva",
  ];
  const exportRows = rows.map((dfd) =>
    protectReportRow({
      ...(dfd.raw || {}),
      protocolo: dfd.numero_protocolo || dfd.id,
      objeto: dfd.objeto_contratacao || "",
      status: getStatusMeta(dfd.status).label,
      status_original: dfd.status,
      valor: Number(dfd.value || 0),
      quantidade_itens: dfd.itemCount,
      quantidade_total: dfd.itemQuantity,
      classe: dfd.expenseClass,
      gnds: dfd.gnds.join("; "),
      qualidade: `${dfd.qualityScore}%`,
      pendencias_qualidade: dfd.qualityFlags.join("; "),
      idade_dias: dfd.ageDays ?? "",
      prioridade_score: dfd.priorityScore,
      item_principal: dfd.topItem,
      coletiva: dfd.collective ? "SIM" : "NAO",
      participantes_coletiva: dfd.participants.join("; "),
      unidade_id: dfd.analysis_unidade_id || dfd.unidade_id || "",
      tipo_unidade: dfd.analysis_tipo_unidade || dfd.tipo_unidade || "",
    }),
  );

  return buildReportCsv(exportRows, collectExportHeaders(exportRows, preferredHeaders));
}

export default function OrcamentoSetorial() {
  const [loading, setLoading] = useState(true);
  const [dfds, setDfds] = useState<DfdDashboardRow[]>([]);
  const [items, setItems] = useState<DfdItemDashboardRow[]>([]);
  const [scopeLabel, setScopeLabel] = useState("Escopo da chefia");
  const [scopeOptions, setScopeOptions] = useState<ScopeOption[]>([]);
  const [selectedScopeKey, setSelectedScopeKey] = useState("all");
  const [responsibleLabel, setResponsibleLabel] = useState("Chefia responsável");
  const [responsibleAvatarUrl, setResponsibleAvatarUrl] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [expenseFilter, setExpenseFilter] = useState("todos");
  const [search, setSearch] = useState("");

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const user = await getSafeUser();
      if (!user) {
        setDfds([]);
        setItems([]);
        return;
      }

      setResponsibleLabel(user.user_metadata?.full_name || user.email || "Chefia responsável");
      setResponsibleAvatarUrl(
        String(
          user.user_metadata?.avatar_url ||
            user.user_metadata?.picture ||
            user.user_metadata?.image ||
            "",
        ).trim() || null,
      );

      let scopedUnits: UnitScope[] = [];
      let resolvedScopeOptions: ScopeOption[] = [];
      const superadmin = isSuperadminEmail(user.email);

      {
        let unitsQuery = supabase
          .from("user_units")
          .select("unit_id, unit_type, role_in_unit")
          .eq("user_id", user.id);

        if (!superadmin) {
          unitsQuery = unitsQuery.eq("role_in_unit", "chefia");
        }

        const { data: units, error: unitsError } = await unitsQuery;
        if (unitsError) throw unitsError;

        const rawUnits = (units || []).map((unit: any) => ({
          unit_id: String(unit.unit_id || ""),
          unit_type: String(unit.unit_type || ""),
          role_in_unit: String(unit.role_in_unit || ""),
        }));
        const chefiaUnits = rawUnits.filter((unit) => unit.role_in_unit === "chefia");
        const unitsForScope = superadmin && chefiaUnits.length === 0 ? rawUnits : chefiaUnits;

        scopedUnits = unitsForScope
          .map((unit: any) => ({
            unit_id: String(unit.unit_id || ""),
            unit_type: String(unit.unit_type || ""),
          }))
          .filter((unit) => unit.unit_id);

        if (scopedUnits.length === 0) {
          if (!superadmin) {
            setDfds([]);
            setItems([]);
            setScopeLabel("Nenhum setor vinculado");
            setScopeOptions([]);
            return;
          }
          resolvedScopeOptions = await resolveScopeOptions([], true);
          setScopeOptions(resolvedScopeOptions);
          if (selectedScopeKey !== "institutional") {
            setSelectedScopeKey("institutional");
          }
          setScopeLabel("Visão geral institucional");
        } else {
          resolvedScopeOptions = await resolveScopeOptions(scopedUnits, superadmin);
          setScopeOptions(resolvedScopeOptions);
          const hasSelected = resolvedScopeOptions.some((option) => option.key === selectedScopeKey);
          if (!hasSelected) {
            setSelectedScopeKey(resolvedScopeOptions[0]?.key || "all");
          }
        }
      }

      let result: any = await supabase
        .from("dfds")
        .select(DFD_SELECT)
        .in("status", DFD_STATUSES)
        .order("created_at", { ascending: false });

      if (result.error && isMissingAnalysisColumns(result.error)) {
        result = await supabase
          .from("dfds")
          .select(DFD_SELECT_LEGACY)
          .in("status", DFD_STATUSES)
          .order("created_at", { ascending: false });
      }
      if (result.error) throw result.error;

      const rawDfds = ((result.data || []) as Array<Record<string, unknown>>)
        .map((row) => ({
          id: String(row.id || ""),
          numero_protocolo: String(row.numero_protocolo || "") || null,
          objeto_contratacao: String(row.objeto_contratacao || "") || null,
          justificativa_contratacao: String(row.justificativa_contratacao || "") || null,
          justificativa_quantidade: String(row.justificativa_quantidade || "") || null,
          status: String(row.status || ""),
          valor_total_estimado: Number(row.valor_total_estimado || 0),
          created_at: String(row.created_at || "") || null,
          previsao_recebimento: String(row.previsao_recebimento || "") || null,
          unidade_id: String(row.unidade_id || "") || null,
          tipo_unidade: String(row.tipo_unidade || "") || null,
          analysis_unidade_id: String(row.analysis_unidade_id || "") || null,
          analysis_tipo_unidade: String(row.analysis_tipo_unidade || "") || null,
          prioridade: Number(row.prioridade || 0),
          raw: row,
        }))
        .filter((row) => row.id);

      const selectedUnit =
        selectedScopeKey === "all" || selectedScopeKey === "institutional"
          ? null
          : scopedUnits.find((unit) => `${unit.unit_type}:${unit.unit_id}` === selectedScopeKey) ||
            null;
      const targetUnits = selectedUnit ? [selectedUnit] : scopedUnits;

      const scopedDfds = superadmin && (selectedScopeKey === "institutional" || scopedUnits.length === 0)
        ? rawDfds
        : rawDfds.filter((dfd) => belongsToChefiaScope(dfd, targetUnits));

      setDfds(scopedDfds);
      const selectedOption = resolvedScopeOptions.find((option) => option.key === selectedScopeKey);
      if (selectedOption) {
        setScopeLabel(selectedOption.label);
      } else if (selectedUnit) {
        setScopeLabel((await resolveUnitName(selectedUnit.unit_type, selectedUnit.unit_id)) || "Setor não identificado");
      } else if (scopedUnits.length > 0) {
        setScopeLabel(await resolveScopeLabelFromUnits(scopedUnits, scopedDfds));
      } else {
        setScopeLabel("Visão geral institucional");
      }

      const dfdIds = scopedDfds.map((dfd) => dfd.id);
      if (dfdIds.length === 0) {
        setItems([]);
        setLastUpdatedAt(new Date().toISOString());
        return;
      }

      const { data: itemRows, error: itemsError } = await supabase
        .from("dfd_items")
        .select("*")
        .in("dfd_id", dfdIds);
      if (itemsError) throw itemsError;

      setItems(
        ((itemRows || []) as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id || ""),
          dfd_id: String(row.dfd_id || "") || null,
          descricao: String(row.descricao || "") || null,
          quantidade: Number(row.quantidade || 0),
          valor_unitario_estimado: Number(row.valor_unitario_estimado || 0),
          gnd: String(row.gnd || "") || null,
          local_uso: String(row.local_uso || "") || null,
          justificativa_item: String(row.justificativa_item || "") || null,
          justificativa_quantidade: String(row.justificativa_quantidade || "") || null,
          criticidade: String(row.criticidade || "") || null,
          moscow_categoria: String(row.moscow_categoria || "") || null,
          is_highlight_item: Boolean(row.is_highlight_item),
          raw: row,
        })),
      );
      setLastUpdatedAt(new Date().toISOString());
    } catch (e: any) {
      toast.error("Erro ao carregar Resumo do Setor: " + (e?.message || "erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }, [selectedScopeKey]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const analytics = useMemo(() => buildAnalytics(dfds, items), [dfds, items]);

  const filteredDfds = useMemo(() => {
    const query = normalizeText(search);
    return analytics.dfdMetrics.filter((dfd) => {
      const statusOk = statusFilter === "todos" || normalizeStatus(dfd.status) === statusFilter;
      const expenseOk = expenseFilter === "todos" || dfd.expenseClass === expenseFilter;
      const searchOk =
        !query ||
        normalizeText(`${dfd.numero_protocolo || ""} ${dfd.objeto_contratacao || ""} ${dfd.topItem}`).includes(query);
      return statusOk && expenseOk && searchOk;
    });
  }, [analytics.dfdMetrics, expenseFilter, search, statusFilter]);

  function exportReport() {
    const blob = new Blob([buildCsv(filteredDfds)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `resumo-setor-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório do setor exportado.");
  }

  return (
    <div className="min-h-screen bg-[#F3F2F1] px-3 py-5 md:px-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <HeaderPanel
          scopeLabel={scopeLabel}
          scopeOptions={scopeOptions}
          selectedScopeKey={selectedScopeKey}
          onScopeChange={setSelectedScopeKey}
          responsibleLabel={responsibleLabel}
          responsibleAvatarUrl={responsibleAvatarUrl}
          lastUpdatedAt={lastUpdatedAt}
          loading={loading}
          onRefresh={fetchDashboardData}
          onExport={exportReport}
        />

        {loading ? (
          <LoadingPanel
            title="Montando sala de situação"
            description="Consolidando DFDs, itens, valores, GNDs, qualidade e demandas coletivas do setor."
          />
        ) : null}

        <HealthStrip analytics={analytics} />

        <ExecutiveCards analytics={analytics} />

        <ActionPanel actions={analytics.actions} duplicateGroups={analytics.duplicateGroups} />

        <KanbanPanel columns={analytics.kanbanColumns} />

        <TreemapPanel items={analytics.rankingByValue} totalValue={analytics.totalValue} />

        <div className="grid grid-cols-1 gap-5">
          <RankingPanel byValue={analytics.rankingByValue} byQuantity={analytics.rankingByQuantity} />
          <TimelinePanel dfds={analytics.dfdMetrics} />
        </div>

        <SmartList
          dfds={filteredDfds}
          statusFilter={statusFilter}
          expenseFilter={expenseFilter}
          search={search}
          onStatusFilter={setStatusFilter}
          onExpenseFilter={setExpenseFilter}
          onSearch={setSearch}
        />
      </div>
    </div>
  );
}

function buildAnalytics(dfds: DfdDashboardRow[], items: DfdItemDashboardRow[]) {
  const itemsByDfd = new Map<string, DfdItemDashboardRow[]>();
  for (const item of items) {
    const dfdId = String(item.dfd_id || "");
    if (!dfdId) continue;
    itemsByDfd.set(dfdId, [...(itemsByDfd.get(dfdId) || []), item]);
  }

  const dfdMetrics: DfdWithMetrics[] = dfds.map((dfd) => {
    const dfdItems = itemsByDfd.get(dfd.id) || [];
    const itemValue = dfdItems.reduce((acc, item) => acc + itemSubtotal(item), 0);
    const value = Number(dfd.valor_total_estimado || 0) || itemValue;
    const gnds = Array.from(new Set(dfdItems.map((item) => String(item.gnd || "").trim()).filter(Boolean)));
    const classes = Array.from(new Set(gnds.map(getExpenseClassFromGnd)));
    const expenseClass =
      classes.includes("Custeio") && classes.includes("Capital")
        ? "Misto"
        : classes.includes("Capital")
          ? "Capital"
          : classes.includes("Custeio")
            ? "Custeio"
            : "Sem GND";
    const participantNames = new Set<string>();
    let collective = false;
    for (const item of dfdItems) {
      const parsed = parseCollectiveDistributionText(item.justificativa_item);
      if (parsed.length > 0) collective = true;
      parsed.forEach((entry) => participantNames.add(entry.name));
    }
    const quality = qualityForDfd(dfd, dfdItems);
    const sortedItems = [...dfdItems].sort((a, b) => itemSubtotal(b) - itemSubtotal(a));

    return {
      ...dfd,
      value,
      itemCount: dfdItems.length,
      itemQuantity: dfdItems.reduce((acc, item) => acc + Number(item.quantidade || 0), 0),
      gnds,
      expenseClass,
      collective,
      participants: Array.from(participantNames),
      qualityScore: quality.score,
      qualityFlags: quality.flags,
      ageDays: getDaysSince(dfd.created_at),
      priorityScore: priorityScoreForDfd(dfd, dfdItems),
      topItem: sortedItems[0]?.descricao || dfd.objeto_contratacao || "Sem item informado",
    };
  });
  const dfdMetricById = new Map(dfdMetrics.map((dfd) => [dfd.id, dfd]));

  const totalValue = dfdMetrics.reduce((acc, dfd) => acc + dfd.value, 0);
  const statusCounts = new Map<string, number>();
  dfdMetrics.forEach((dfd) => statusCounts.set(normalizeStatus(dfd.status), (statusCounts.get(normalizeStatus(dfd.status)) || 0) + 1));

  const pendingDfds = dfdMetrics.filter((dfd) => normalizeStatus(dfd.status) === "triagem");
  const devolvidas = dfdMetrics.filter((dfd) => normalizeStatus(dfd.status) === "devolvida");
  const homologadas = dfdMetrics.filter((dfd) => ["aprovada", "pactuando", "concluida"].includes(normalizeStatus(dfd.status)));
  const coletivas = dfdMetrics.filter((dfd) => dfd.collective);

  const homologatedValue = homologadas.reduce((acc, dfd) => acc + dfd.value, 0);
  const pendingValue = pendingDfds.reduce((acc, dfd) => acc + dfd.value, 0);
  const returnedValue = devolvidas.reduce((acc, dfd) => acc + dfd.value, 0);
  const collectiveValue = coletivas.reduce((acc, dfd) => acc + dfd.value, 0);

  const gndMap = new Map<string, { value: number; count: number }>();
  const expenseMap = new Map<string, number>();
  const rankingMap = new Map<string, RankedItem>();
  const duplicateMap = new Map<string, DfdWithMetrics[]>();

  for (const item of items) {
    const dfd = dfdMetricById.get(String(item.dfd_id || ""));
    const subtotal = itemSubtotal(item);
    const gnd = String(item.gnd || "Sem GND").trim() || "Sem GND";
    const currentGnd = gndMap.get(gnd) || { value: 0, count: 0 };
    currentGnd.value += subtotal;
    currentGnd.count += 1;
    gndMap.set(gnd, currentGnd);
    expenseMap.set(getExpenseClassFromGnd(gnd), (expenseMap.get(getExpenseClassFromGnd(gnd)) || 0) + subtotal);

    const itemKey = duplicateKey(item.descricao) || normalizeText(item.descricao) || String(item.id);
    const ranking = rankingMap.get(itemKey) || {
      key: itemKey,
      label: item.descricao || "Item sem descrição",
      value: 0,
      quantity: 0,
      count: 0,
    };
    ranking.value += subtotal;
    ranking.quantity += Number(item.quantidade || 0);
    ranking.count += 1;
    rankingMap.set(itemKey, ranking);

    if (dfd && itemKey.length > 2) {
      const current = duplicateMap.get(itemKey) || [];
      if (!current.some((entry) => entry.id === dfd.id)) current.push(dfd);
      duplicateMap.set(itemKey, current);
    }
  }

  const gndMetrics: GndMetric[] = Array.from(gndMap.entries())
    .map(([gnd, metric]) => ({
      gnd,
      label: `${gnd} - ${GND_LABELS[gnd] || "Classificação"}`,
      value: metric.value,
      count: metric.count,
      percent: totalValue > 0 ? Math.round((metric.value / totalValue) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const rankingByValue = Array.from(rankingMap.values()).sort((a, b) => b.value - a.value).slice(0, 8);
  const rankingByQuantity = Array.from(rankingMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 8);

  const duplicateGroups: DuplicateGroup[] = Array.from(duplicateMap.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      label: group[0]?.topItem || key,
      count: group.length,
      dfds: group,
      value: group.reduce((acc, dfd) => acc + dfd.value, 0),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);

  const oldPendingCount = pendingDfds.filter((dfd) => Number(dfd.ageDays || 0) >= 7).length;
  const missingJustification = dfdMetrics.filter((dfd) => dfd.qualityFlags.includes("Requer justificativa")).length;
  const missingGnd = dfdMetrics.filter((dfd) => dfd.qualityFlags.includes("GND ausente")).length;
  const missingValue = dfdMetrics.filter((dfd) => dfd.qualityFlags.includes("Valor estimado ausente")).length;
  const averageQuality =
    dfdMetrics.length > 0
      ? Math.round(dfdMetrics.reduce((acc, dfd) => acc + dfd.qualityScore, 0) / dfdMetrics.length)
      : 100;

  const healthScore = dfdMetrics.length
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (homologadas.length / dfdMetrics.length) * 55 +
              (1 - devolvidas.length / dfdMetrics.length) * 20 +
              (1 - pendingDfds.length / dfdMetrics.length) * 15 +
              (averageQuality / 100) * 10,
          ),
        ),
      )
    : 100;
  const healthLabel =
    healthScore >= 88
      ? "Excelente"
      : healthScore >= 70
        ? "Atenção moderada"
        : healthScore >= 45
          ? "Atenção"
          : "Crítico";

  const actions = [
    ...pendingDfds
      .sort((a, b) => b.priorityScore + b.value / 1000 - (a.priorityScore + a.value / 1000))
      .slice(0, 4)
      .map((dfd) => ({
        type: "decision" as const,
        title: `${dfd.numero_protocolo || "DFD"} - ${dfd.objeto_contratacao || "Demanda sem objeto"}`,
        description: `Aguardando análise${dfd.ageDays !== null ? ` há ${dfd.ageDays} dia(s)` : ""}.`,
        meta: `${formatCompactCurrency(dfd.value)} | ${dfd.expenseClass} | ${dfd.gnds[0] || "Sem GND"}`,
        href: "/triagem",
        severity: Number(dfd.ageDays || 0) >= 7 || dfd.value >= 50_000 ? "critical" : "warning",
      })),
    ...duplicateGroups.slice(0, 2).map((group) => ({
      type: "duplicate" as const,
      title: `Possível duplicidade - ${group.label}`,
      description: `${group.count} DFDs usam descrições semelhantes. Avalie consolidação.`,
      meta: `${formatCompactCurrency(group.value)} em demandas relacionadas`,
      href: "#duplicidades",
      severity: "info" as const,
    })),
    ...coletivas.slice(0, 2).map((dfd) => ({
      type: "collective" as const,
      title: `DFD coletiva - ${dfd.objeto_contratacao || dfd.topItem}`,
      description: `${dfd.participants.length} participante(s) mapeados na distribuição.`,
      meta: `${formatCompactCurrency(dfd.value)} | ${dfd.itemQuantity} unidade(s)`,
      href: "#coletivas",
      severity: "info" as const,
    })),
  ].slice(0, 6);

  const pendingReasons = [
    { label: "Justificativa insuficiente", value: missingJustification },
    { label: "Erro ou ausência de GND", value: missingGnd },
    { label: "Quantitativo/valor incompleto", value: missingValue },
    { label: "Possível duplicidade", value: duplicateGroups.length },
    { label: "Aguardando há 7+ dias", value: oldPendingCount },
  ];

  const kanbanColumns = [
    { key: "triagem", title: "Em análise", dfds: pendingDfds.slice(0, 5) },
    { key: "devolvida", title: "Devolvidas", dfds: devolvidas.slice(0, 5) },
    { key: "aprovada", title: "Homologadas", dfds: homologadas.slice(0, 5) },
    { key: "coletiva", title: "Coletivas", dfds: coletivas.slice(0, 5) },
  ];

  return {
    dfdMetrics,
    totalValue,
    pendingValue,
    homologatedValue,
    returnedValue,
    collectiveValue,
    pendingDfds,
    devolvidas,
    homologadas,
    coletivas,
    statusCounts,
    gndMetrics,
    expenseMap,
    rankingByValue,
    rankingByQuantity,
    duplicateGroups,
    oldPendingCount,
    averageQuality,
    healthScore,
    healthLabel,
    actions,
    pendingReasons,
    kanbanColumns,
  };
}

function HeaderPanel({
  scopeLabel,
  scopeOptions,
  selectedScopeKey,
  onScopeChange,
  responsibleLabel,
  responsibleAvatarUrl,
  lastUpdatedAt,
  loading,
  onRefresh,
  onExport,
}: {
  scopeLabel: string;
  scopeOptions: ScopeOption[];
  selectedScopeKey: string;
  onScopeChange: (value: string) => void;
  responsibleLabel: string;
  responsibleAvatarUrl: string | null;
  lastUpdatedAt: string | null;
  loading: boolean;
  onRefresh: () => void;
  onExport: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-[#C7D7EA] bg-white p-5 shadow-sm md:p-7">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#164073] via-[#2A7C8C] to-[#EC2029]" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#5B6675]">
            <span>PERCATA</span>
            <ArrowRight className="h-3 w-3" />
            <span>Setores</span>
            <ArrowRight className="h-3 w-3" />
            <span className="text-[#164073]">{scopeLabel}</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E8EDF2] text-[#164073]">
              <Grid3X3 className="h-7 w-7" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-[#17233C] md:text-4xl">
                Resumo do Setor
              </h1>
              <p className="mt-1 text-sm font-medium text-[#5B6675]">
                {scopeLabel} | Exercício 2026
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ChiefChip name={responsibleLabel} avatarUrl={responsibleAvatarUrl} />
            <InfoChip icon={<Clock3 className="h-3.5 w-3.5" />} label={`Atualização: ${formatDateTime(lastUpdatedAt)}`} />
          </div>
          <div className="mt-4 max-w-xl rounded-2xl border border-[#D9E0E8] bg-[#F7FBFF] p-3">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5B6675]">
              Escopo do resumo
            </label>
            {scopeOptions.length > 1 ? (
              <select
                value={selectedScopeKey}
                onChange={(event) => onScopeChange(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-[#C7D7EA] bg-white px-3 text-sm font-bold text-[#164073] outline-none"
              >
                {scopeOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mt-2 rounded-xl bg-white px-3 py-3 text-sm font-bold text-[#164073]">
                {scopeLabel}
              </div>
            )}
            <p className="mt-2 text-xs font-semibold text-[#5B6675]">
              {scopeOptions.find((option) => option.key === selectedScopeKey)?.detail ||
                "O painel usa apenas as DFDs vinculadas a este recorte."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/nova-dfd" className={cn(buttonVariants({ variant: "default" }), "rounded-xl")}>
            Nova DFD
          </Link>
          <Link
            href="/triagem"
            className={cn(buttonVariants({ variant: "outline" }), "rounded-xl border-[#C7D7EA] text-[#164073]")}
          >
            Analisar DFDs
          </Link>
          <Link
            href="#coletivas"
            className={cn(buttonVariants({ variant: "outline" }), "rounded-xl border-[#C7D7EA] text-[#164073]")}
          >
            Demandas Coletivas
          </Link>
          <Button variant="outline" onClick={onExport} className="rounded-xl border-[#C7D7EA] text-[#164073]">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline" onClick={onRefresh} disabled={loading} className="rounded-xl border-[#C7D7EA] text-[#164073]">
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>
    </section>
  );
}

function ChiefChip({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CH";

  return (
    <span className="inline-flex items-center gap-3 rounded-full border border-[#D9E0E8] bg-[#F7FBFF] py-1.5 pl-1.5 pr-4 text-[12px] font-semibold text-[#164073]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#164073] text-sm font-bold text-white shadow-sm">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`Foto de ${name}`}
            className="h-full w-full object-cover"
          />
        ) : (
          initials
        )}
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[10px] uppercase tracking-[0.16em] text-[#5B6675]">
          Chefia
        </span>
        <span>{name}</span>
      </span>
    </span>
  );
}

function InfoChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#D9E0E8] bg-[#F7FBFF] px-3 py-1.5 text-[11px] font-semibold text-[#164073]">
      {icon}
      {label}
    </span>
  );
}

function HealthStrip({ analytics }: { analytics: ReturnType<typeof buildAnalytics> }) {
  const reasons = [
    `${analytics.pendingDfds.length} DFDs aguardam análise`,
    `${analytics.devolvidas.length} DFDs devolvidas`,
    `${analytics.duplicateGroups.length} possíveis duplicidades`,
    `${analytics.coletivas.length} DFDs coletivas vinculadas`,
  ];
  const tone =
    analytics.healthScore >= 88
      ? "border-emerald-200 bg-emerald-50"
      : analytics.healthScore >= 70
        ? "border-amber-200 bg-amber-50"
        : "border-red-200 bg-red-50";
  return (
    <section className={cn("rounded-[22px] border p-5 shadow-sm", tone)}>
      <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5B6675]">
            Saúde das DFDs do Setor
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <h2 className="font-display text-2xl font-semibold text-[#17233C]">
              {analytics.healthLabel}
            </h2>
            <span className="mb-1 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-[#164073]">
              {analytics.healthScore}%
            </span>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/70">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${analytics.healthScore}%` }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-[#EC2029] via-[#C9A646] to-[#2A7C8C]"
            />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {reasons.map((reason) => (
            <div key={reason} className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-[#2E3A4A]">
              <span className="h-2 w-2 rounded-full bg-[#164073]" />
              {reason}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ExecutiveCards({ analytics }: { analytics: ReturnType<typeof buildAnalytics> }) {
  const total = Math.max(analytics.dfdMetrics.length, 1);
  const homologatedPercent = Math.round((analytics.homologadas.length / total) * 100);
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
      <ExecutiveCard
        title="DFDs do setor"
        value={String(analytics.dfdMetrics.length)}
        subtitle="Distribuição por status"
        icon={<FileSpreadsheet className="h-5 w-5" />}
        micro={<StatusDots dfds={analytics.dfdMetrics} />}
      />
      <ExecutiveCard
        title="Valor total estimado"
        value={formatCompactCurrency(analytics.totalValue)}
        subtitle={`${homologatedPercent}% homologado`}
        icon={<Wallet className="h-5 w-5" />}
        micro={<MiniProgress value={homologatedPercent} />}
      />
      <ExecutiveCard
        title="Em análise"
        value={formatCompactCurrency(analytics.pendingValue)}
        subtitle={`${analytics.pendingDfds.length} DFDs | ${analytics.oldPendingCount} há 7+ dias`}
        icon={<TimerReset className="h-5 w-5" />}
        tone="warning"
      />
      <ExecutiveCard
        title="Homologado"
        value={formatCompactCurrency(analytics.homologatedValue)}
        subtitle={`${analytics.homologadas.length} DFDs aptas`}
        icon={<CheckCircle2 className="h-5 w-5" />}
        tone="success"
      />
      <ExecutiveCard
        title="Devolvidas"
        value={String(analytics.devolvidas.length)}
        subtitle={analytics.returnedValue > 0 ? formatCompactCurrency(analytics.returnedValue) : "Sem valor parado"}
        icon={<AlertTriangle className="h-5 w-5" />}
        tone="danger"
      />
      <ExecutiveCard
        title="Coletivas"
        value={String(analytics.coletivas.length)}
        subtitle={`Impacto: ${formatCompactCurrency(analytics.collectiveValue)}`}
        icon={<Network className="h-5 w-5" />}
        tone="info"
      />
    </section>
  );
}

function ExecutiveCard({
  title,
  value,
  subtitle,
  icon,
  micro,
  tone = "neutral",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  micro?: React.ReactNode;
  tone?: "neutral" | "warning" | "success" | "danger" | "info";
}) {
  const tones = {
    neutral: "border-[#D9E0E8] bg-white text-[#164073]",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    danger: "border-red-200 bg-red-50 text-red-800",
    info: "border-[#C7D7EA] bg-[#F7FBFF] text-[#164073]",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-[20px] border p-4 shadow-sm", tones[tone])}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">{title}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 shadow-sm">{icon}</span>
      </div>
      <p className="mt-3 font-display text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-semibold opacity-70">{subtitle}</p>
      {micro ? <div className="mt-4">{micro}</div> : null}
    </motion.div>
  );
}

function StatusDots({ dfds }: { dfds: DfdWithMetrics[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {dfds.slice(0, 24).map((dfd) => (
        <span
          key={dfd.id}
          title={getStatusMeta(dfd.status).label}
          className={cn("h-2.5 w-2.5 rounded-full", getStatusMeta(dfd.status).dot)}
        />
      ))}
    </div>
  );
}

function MiniProgress({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/80">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        className="h-full rounded-full bg-[#164073]"
      />
    </div>
  );
}

function ActionPanel({
  actions,
  duplicateGroups,
}: {
  actions: ReturnType<typeof buildAnalytics>["actions"];
  duplicateGroups: DuplicateGroup[];
}) {
  return (
    <section className="rounded-[24px] border border-[#D9E0E8] bg-white p-5 shadow-sm" id="duplicidades">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5B6675]">Bloco prioritário</p>
          <h2 className="font-display text-2xl font-semibold text-[#17233C]">O que exige minha ação?</h2>
        </div>
        <Link href="/triagem" className={cn(buttonVariants({ variant: "default" }), "rounded-xl")}>
          Abrir análise da chefia
        </Link>
      </div>

      {actions.length === 0 ? (
        <EmptyState
          title="Nenhuma ação imediata detectada"
          description="Não há DFD em análise, duplicidade relevante ou demanda coletiva pendente no recorte atual."
          tone="success"
          icon="success"
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {actions.map((action, index) => (
            <ActionCard key={`${action.title}-${index}`} action={action} />
          ))}
        </div>
      )}

      {duplicateGroups.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-[#C7D7EA] bg-[#F7FBFF] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#164073]">
            <GitBranch className="h-4 w-4" />
            Comparador visual de DFDs semelhantes
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {duplicateGroups.slice(0, 2).map((group) => (
              <div key={group.key} className="rounded-xl border border-[#D9E0E8] bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#5B6675]">{group.label}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {group.dfds.slice(0, 2).map((dfd) => (
                    <div key={dfd.id} className="rounded-lg bg-[#F4F7FA] p-3 text-xs">
                      <p className="font-bold text-[#164073]">{dfd.numero_protocolo || "DFD"}</p>
                      <p className="mt-1 line-clamp-2 text-[#2E3A4A]">{dfd.objeto_contratacao}</p>
                      <p className="mt-2 font-bold">{formatCompactCurrency(dfd.value)}</p>
                      <p>{dfd.gnds[0] || "Sem GND"}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs font-semibold text-[#5B6675]">
                  Similaridade operacional estimada: {Math.min(95, 58 + group.count * 10)}%. Ação sugerida: avaliar consolidação.
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ActionCard({ action }: { action: ReturnType<typeof buildAnalytics>["actions"][number] }) {
  const severity = {
    critical: "border-red-200 bg-red-50 text-red-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    info: "border-[#C7D7EA] bg-[#F7FBFF] text-[#164073]",
  }[action.severity];
  return (
    <div className={cn("rounded-2xl border p-4", severity)}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80">
          {action.type === "decision" ? <AlertTriangle className="h-4 w-4" /> : action.type === "duplicate" ? <GitBranch className="h-4 w-4" /> : <Network className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-bold">{action.title}</p>
          <p className="mt-1 text-xs font-semibold opacity-80">{action.meta}</p>
          <p className="mt-2 text-xs leading-5 opacity-80">{action.description}</p>
        </div>
      </div>
      <Link href={action.href} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-bold">
        Ver encaminhamento
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function KanbanPanel({ columns }: { columns: ReturnType<typeof buildAnalytics>["kanbanColumns"] }) {
  return (
    <Panel title="Kanban visual por status" eyebrow="Consulta operacional" icon={<Layers3 className="h-5 w-5" />}>
      <div className="grid gap-4 md:grid-cols-4">
        {columns.map((column) => (
          <div key={column.key} className="min-h-[330px] rounded-2xl border border-[#D9E0E8] bg-[#F7FBFF] p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#164073]">{column.title}</p>
              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#5B6675]">{column.dfds.length}</span>
            </div>
            <div className="space-y-2">
              {column.dfds.length === 0 ? (
                <p className="rounded-xl bg-white p-3 text-xs font-semibold text-[#7D98B8]">Sem DFDs neste status.</p>
              ) : (
                column.dfds.map((dfd) => <MiniDfdCard key={dfd.id} dfd={dfd} />)
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function MiniDfdCard({ dfd }: { dfd: DfdWithMetrics }) {
  return (
    <Link href={`/dfd/${dfd.id}`} className="block rounded-xl border border-[#D9E0E8] bg-white p-3 text-xs shadow-sm hover:border-[#C7D7EA]">
      <p className="font-bold text-[#164073]">{dfd.numero_protocolo || "DFD"}</p>
      <p className="mt-1 line-clamp-2 font-semibold text-[#2E3A4A]">{dfd.objeto_contratacao || dfd.topItem}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge label={dfd.expenseClass} />
        {dfd.gnds[0] ? <Badge label={dfd.gnds[0]} /> : null}
      </div>
      <p className="mt-2 font-bold text-[#17233C]">{formatCompactCurrency(dfd.value)}</p>
    </Link>
  );
}

function TreemapPanel({ items, totalValue }: { items: RankedItem[]; totalValue: number }) {
  return (
    <Panel title="Treemap de impacto financeiro" eyebrow="Itens que ocupam mais orçamento" icon={<Boxes className="h-5 w-5" />}>
      {items.length === 0 ? (
        <EmptyState title="Sem itens para compor treemap" description="Quando houver itens com valores, o impacto financeiro aparecerá aqui." />
      ) : (
        <div className="grid min-h-[280px] grid-cols-2 gap-2 md:grid-cols-4">
          {items.slice(0, 8).map((item, index) => {
            const large = index === 0 || index === 1;
            const percent = totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0;
            return (
              <div
                key={item.key}
                className={cn(
                  "flex flex-col justify-between rounded-2xl border border-white/70 bg-[#164073] p-4 text-white shadow-sm",
                  large ? "md:col-span-2" : "bg-[#2A7C8C]",
                  index > 3 && "bg-[#4D79A8]",
                )}
              >
                <p className="line-clamp-3 text-sm font-bold">{item.label}</p>
                <div>
                  <p className="font-display text-xl font-semibold">{formatCompactCurrency(item.value)}</p>
                  <p className="text-xs font-semibold text-white/75">{percent}% do recorte</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function RankingPanel({ byValue, byQuantity }: { byValue: RankedItem[]; byQuantity: RankedItem[] }) {
  return (
    <Panel title="Ranking de itens mais relevantes" eyebrow="Valor e quantidade" icon={<TrendingUp className="h-5 w-5" />}>
      <div className="grid gap-5 md:grid-cols-2">
        <RankingList title="Top 5 por valor" items={byValue.slice(0, 5)} mode="value" />
        <RankingList title="Top 5 por quantidade" items={byQuantity.slice(0, 5)} mode="quantity" />
      </div>
    </Panel>
  );
}

function RankingList({ title, items, mode }: { title: string; items: RankedItem[]; mode: "value" | "quantity" }) {
  const max = Math.max(1, ...items.map((item) => (mode === "value" ? item.value : item.quantity)));
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#5B6675]">{title}</p>
      <div className="space-y-3">
        {items.map((item, index) => {
          const amount = mode === "value" ? item.value : item.quantity;
          return (
            <div key={item.key}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="line-clamp-1 font-bold text-[#2E3A4A]">
                  {index + 1}. {item.label}
                </span>
                <span className="shrink-0 font-bold text-[#164073]">{mode === "value" ? formatCompactCurrency(item.value) : item.quantity}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#E8EDF2]">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(amount / max) * 100}%` }} className="h-full rounded-full bg-[#164073]" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelinePanel({ dfds }: { dfds: DfdWithMetrics[] }) {
  const recent = [...dfds]
    .filter((dfd) => dfd.created_at)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 7);
  return (
    <Panel title="Linha do tempo da tramitação" eyebrow="Últimas movimentações registradas" icon={<LineChart className="h-5 w-5" />}>
      <div className="space-y-4">
        {recent.map((dfd, index) => (
          <div key={dfd.id} className="relative flex gap-3">
            <div className="flex flex-col items-center">
              <span className={cn("h-3 w-3 rounded-full", getStatusMeta(dfd.status).dot)} />
              {index < recent.length - 1 ? <span className="mt-1 h-full min-h-12 w-px bg-[#D9E0E8]" /> : null}
            </div>
            <div className="pb-3">
              <p className="text-sm font-bold text-[#17233C]">
                {dfd.numero_protocolo || "DFD"} - {getStatusMeta(dfd.status).label}
              </p>
              <p className="mt-1 line-clamp-1 text-xs font-semibold text-[#5B6675]">{dfd.objeto_contratacao || dfd.topItem}</p>
              <p className="mt-1 text-xs text-[#7D98B8]">{formatDateTime(dfd.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SmartList({
  dfds,
  statusFilter,
  expenseFilter,
  search,
  onStatusFilter,
  onExpenseFilter,
  onSearch,
}: {
  dfds: DfdWithMetrics[];
  statusFilter: string;
  expenseFilter: string;
  search: string;
  onStatusFilter: (value: string) => void;
  onExpenseFilter: (value: string) => void;
  onSearch: (value: string) => void;
}) {
  return (
    <Panel title="Lista inteligente de DFDs" eyebrow="Camada final de consulta" icon={<Filter className="h-5 w-5" />}>
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_190px_190px]">
        <label className="flex h-11 items-center gap-2 rounded-xl border border-[#D9E0E8] bg-white px-3">
          <Search className="h-4 w-4 text-[#7D98B8]" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar protocolo, objeto ou item..."
            className="w-full bg-transparent text-sm font-semibold outline-none"
          />
        </label>
        <select value={statusFilter} onChange={(event) => onStatusFilter(event.target.value)} className="h-11 rounded-xl border border-[#D9E0E8] bg-white px-3 text-sm font-bold text-[#164073] outline-none">
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <option key={key} value={key}>{meta.label}</option>
          ))}
        </select>
        <select value={expenseFilter} onChange={(event) => onExpenseFilter(event.target.value)} className="h-11 rounded-xl border border-[#D9E0E8] bg-white px-3 text-sm font-bold text-[#164073] outline-none">
          <option value="todos">Todas as classes</option>
          <option value="Custeio">Custeio</option>
          <option value="Capital">Capital</option>
          <option value="Misto">Misto</option>
          <option value="Sem GND">Sem GND</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#D9E0E8] bg-white">
        <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.6fr_0.5fr] gap-3 border-b border-[#E8EDF2] bg-[#F7FBFF] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5B6675] max-lg:hidden">
          <span>DFD</span>
          <span>Status</span>
          <span>Classificação</span>
          <span>Valor</span>
          <span>Qualidade</span>
        </div>
        {dfds.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Nenhuma DFD encontrada" description="Ajuste os filtros ou aguarde novas demandas vinculadas ao setor." />
          </div>
        ) : (
          dfds.map((dfd) => (
            <Link
              key={dfd.id}
              href={`/dfd/${dfd.id}`}
              className="grid gap-3 border-b border-[#E8EDF2] px-4 py-4 last:border-b-0 hover:bg-[#F7FBFF] lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.6fr_0.5fr] lg:items-center"
            >
              <div>
                <p className="text-sm font-bold text-[#164073]">{dfd.numero_protocolo || dfd.id}</p>
                <p className="mt-1 line-clamp-1 text-xs font-semibold text-[#2E3A4A]">{dfd.objeto_contratacao || dfd.topItem}</p>
              </div>
              <StatusBadge status={dfd.status} />
              <div className="flex flex-wrap gap-1">
                <Badge label={dfd.expenseClass} />
                {dfd.collective ? <Badge label="Coletiva" tone="info" /> : <Badge label="Individual" />}
                {dfd.gnds[0] ? <Badge label={dfd.gnds[0]} /> : null}
              </div>
              <p className="text-sm font-bold text-[#17233C]">{formatCompactCurrency(dfd.value)}</p>
              <p className="text-sm font-bold text-[#164073]">{dfd.qualityScore}%</p>
            </Link>
          ))
        )}
      </div>
    </Panel>
  );
}

function Panel({
  title,
  eyebrow,
  icon,
  children,
  id,
}: {
  title: string;
  eyebrow: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="rounded-[24px] border border-[#D9E0E8] bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5B6675]">{eyebrow}</p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-[#17233C]">{title}</h2>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#E8EDF2] text-[#164073]">
          {icon}
        </span>
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = getStatusMeta(status);
  return (
    <span className={cn("inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-bold", meta.tone)}>
      <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "info" }) {
  const tones = {
    neutral: "border-[#D9E0E8] bg-white text-[#164073]",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    info: "border-[#C7D7EA] bg-[#E8EDF2] text-[#164073]",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]", tones[tone])}>
      {label}
    </span>
  );
}
