"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "@/components/icons/phosphor/exports/ArrowLeft";
import { ArrowRight } from "@/components/icons/phosphor/exports/ArrowRight";
import { Buildings } from "@/components/icons/phosphor/exports/Buildings";
import { Calendar } from "@/components/icons/phosphor/exports/Calendar";
import { Briefcase } from "@/components/icons/phosphor/exports/Briefcase";
import { CheckCircle } from "@/components/icons/phosphor/exports/CheckCircle";
import { CircleNotch } from "@/components/icons/phosphor/exports/CircleNotch";
import { Flask } from "@/components/icons/phosphor/exports/Flask";
import { GraduationCap } from "@/components/icons/phosphor/exports/GraduationCap";
import { Handshake } from "@/components/icons/phosphor/exports/Handshake";
import { Info } from "@/components/icons/phosphor/exports/Info";
import { SquaresFour } from "@/components/icons/phosphor/exports/SquaresFour";
import { StackSimple } from "@/components/icons/phosphor/exports/StackSimple";
import { Target } from "@/components/icons/phosphor/exports/Target";
import { Trash } from "@/components/icons/phosphor/exports/Trash";
import { WarningCircle } from "@/components/icons/phosphor/exports/WarningCircle";
import { useRouter } from "next/navigation";
import { useCarrinhoStore } from "@/store/carrinho";
import { getSafeUser, supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  classifyGnd,
  getDfdExpenseClassViolation,
  getExpenseClassGroupingLabel,
  getItemExpenseClassKey,
  summarizeGndDistribution,
  type GndDistributionSummary,
} from "@/lib/dfd-gnd";
import {
  resolveDfdRouting,
  type AcademicContext,
  type DfdPurpose,
} from "@/lib/dfd-routing";
import {
  aggregateCollectiveContributions,
  buildCollectiveContributionKey,
  formatContributorDistribution,
  type CollectiveContribution,
} from "@/lib/collective-dfd";
import {
  DFD_PROCESS_STEPS,
  getDfdProcessChecklist,
} from "@/lib/dfd-process-guide";
import { useDfdDraft } from "@/lib/use-dfd-draft";
import {
  restoreDfdDraftCartItems,
  snapshotDfdDraftCartItems,
} from "@/lib/dfd-draft-cart";
import { sanitizePlanningSubsidies, type DfdPlanningSubsidies } from "@/lib/dfd-planning";
import { resolveDfdFiscalFields } from "@/lib/catalog-fiscal";
import { getDfdFinalizationCopy } from "@/lib/dfd-finalization";
import { useSubmissionPolicy } from "@/lib/use-submission-policy";
import {
  OperationalChip,
  OperationalEmptyState,
  OperationalKpiCard,
  OperationalStepper,
  SkeuoDocumentCard,
  SkeuoProgressRail,
} from "@/components/ui/operational";

type UnitType = "departamento" | "laboratorio";
type GroupingMode = "grupo" | "classe" | "livre" | "coletiva";
type FinalizeMode = "draft" | "triagem";

interface DFDGroup {
  key: string;
  label: string;
  mode: GroupingMode;
  items: any[];
  formData: {
    objeto: string;
    justificativa_contratacao: string;
    justificativa_quantidade: string;
    previsao_data: string;
    unidade_id: string;
    tipo_unidade: UnitType;
    analysis_unidade_id: string;
    analysis_tipo_unidade: UnitType;
    analysis_routing_reason: string;
    finalidade: DfdPurpose | "";
    contexto_academico: AcademicContext | "";
    planning_subsidies: DfdPlanningSubsidies;
  };
}

const UNIT_OPTIONS = ["UN", "CX", "PCT", "KG", "L", "M", "M2", "M3"];
const MIN_ITEM_JUSTIFICATIVA_CHARS = 12;
const NEXT_YEAR_MIN_DATE = `${new Date().getFullYear() + 1}-01-01`;

const PURPOSE_OPTIONS: Array<{
  value: DfdPurpose;
  title: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    value: "ensino",
    title: "Ensino",
    description: "Disciplina, aula prática, turma ou uso didático recorrente.",
    icon: GraduationCap,
  },
  {
    value: "pesquisa",
    title: "Pesquisa",
    description: "Projeto, grupo, experimento ou produção científica.",
    icon: Flask,
  },
  {
    value: "extensao",
    title: "Extensão",
    description: "Ação com comunidade, evento, programa ou atividade externa.",
    icon: Handshake,
  },
  {
    value: "gestao",
    title: "Gestão",
    description: "Rotina administrativa, manutenção, operação ou suporte.",
    icon: Briefcase,
  },
];

const CONTEXT_OPTIONS: Array<{
  value: AcademicContext;
  title: string;
  description: string;
}> = [
  {
    value: "disciplina",
    title: "Disciplina",
    description: "Usado em aula, componente curricular ou prática vinculada a curso.",
  },
  {
    value: "laboratorio_sem_disciplina",
    title: "Laboratório",
    description: "Uso próprio do laboratório, sem disciplina específica.",
  },
  {
    value: "projeto",
    title: "Projeto",
    description: "Pesquisa, extensão, ação institucional ou plano de trabalho.",
  },
  {
    value: "rotina_administrativa",
    title: "Rotina",
    description: "Demanda administrativa, manutenção ou funcionamento do setor.",
  },
  {
    value: "uso_compartilhado",
    title: "Compartilhado",
    description: "Atende mais de uma turma, setor, grupo ou ambiente.",
  },
];

const GROUPING_OPTIONS: Array<{
  value: GroupingMode;
  title: string;
  description: string;
  recommended?: boolean;
}> = [
  {
    value: "grupo",
    title: "Unir por grupo",
    description: "Melhor para começar: cria uma DFD por família maior do e-Fisco.",
    recommended: true,
  },
  {
    value: "classe",
    title: "Unir por classe",
    description: "Mais detalhado: separa melhor quando o grupo tem necessidades diferentes.",
  },
  {
    value: "livre",
    title: "Deixar livre",
    description: "Mantém tudo junto e ainda separa custeio e capital automaticamente.",
  },
  {
    value: "coletiva",
    title: "Coletiva por setor",
    description: "Junta itens em comum da unidade e registra quanto cada pessoa pediu.",
  },
];

function isValidReferenceLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatIsoDateToPtBr(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function buildNumeroProtocolo(seed = 0) {
  const now = new Date();
  const year = now.getFullYear();
  const timestamp =
    `${now.getMonth() + 1}`.padStart(2, "0") +
    `${now.getDate()}`.padStart(2, "0") +
    `${now.getHours()}`.padStart(2, "0") +
    `${now.getMinutes()}`.padStart(2, "0") +
    `${now.getSeconds()}`.padStart(2, "0");
  const randomChunk = Math.floor(Math.random() * 9000 + 1000) + seed;
  return `DFD-${year}-${timestamp}-${String(randomChunk).padStart(4, "0")}`;
}

function normalizeClasse(classe: string | undefined | null) {
  const value = String(classe || "").trim();
  return value.length > 0 ? value : "Sem Classe Informada";
}

function normalizeGrupo(grupo: string | undefined | null) {
  const value = String(grupo || "").trim();
  return value.length > 0 ? value : "Sem Grupo Informado";
}

function buildGroupingKey(mode: GroupingMode, item: any) {
  const efisco = item.item_efisco || {};
  if (mode === "coletiva") return "coletiva";
  if (mode === "livre") return "livre";
  if (mode === "grupo") {
    return String(efisco.codigo_grupo || normalizeGrupo(efisco.nome_grupo || efisco.grupo))
      .trim()
      .toUpperCase();
  }
  return String(efisco.codigo_classe || normalizeClasse(efisco.nome_classe || efisco.classe))
    .trim()
    .toUpperCase();
}

function buildGroupingLabel(mode: GroupingMode, item: any) {
  const efisco = item.item_efisco || {};
  if (mode === "coletiva") return "DFD coletiva";
  if (mode === "livre") return "Itens do carrinho";
  if (mode === "grupo") return normalizeGrupo(efisco.nome_grupo || efisco.grupo);
  return normalizeClasse(efisco.nome_classe || efisco.classe);
}

function getItemGndInput(item: any) {
  return {
    gnd: item.item_efisco?.gnd || item.item_efisco?.gnd_derivado,
    codigoNaturezaDespesa: item.item_efisco?.codigo_natureza_despesa,
    quantity: Number(item.quantidade || 0),
    total: Number(item.quantidade || 0) * Number(item.valor_unitario || 0),
  };
}

function getBudgetSplitKey(item: any) {
  return getItemExpenseClassKey(getItemGndInput(item));
}

function buildSeparatedGroupingKey(mode: GroupingMode, item: any) {
  return `${buildGroupingKey(mode, item)}::${getBudgetSplitKey(item)}`;
}

function buildSeparatedGroupingLabel(mode: GroupingMode, item: any) {
  const budgetLabel = getExpenseClassGroupingLabel(getBudgetSplitKey(item));
  return `${buildGroupingLabel(mode, item)} - ${budgetLabel}`;
}

function buildDefaultObjeto(mode: GroupingMode, label: string) {
  if (mode === "coletiva") return `${label} da unidade`;
  if (mode === "livre") return "Aquisição/contratação de itens do carrinho";
  if (mode === "grupo") return `Aquisição/contratação de itens do grupo ${label}`;
  return `Aquisição/contratação de itens da classe ${label}`;
}

function readKitSection(description: unknown, section: string) {
  const text = String(description || "");
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escaped}:\\n([\\s\\S]*?)(?:\\n\\n[A-ZÁ-Úa-zá-ú].*?:\\n|\\n\\nNatureza:|$)`, "i"));
  return String(match?.[1] || "").trim();
}

function buildKitPrefill(items: any[], fallbackObjeto: string) {
  const kitIds = new Set(items.map((item) => item.source_kit_id).filter(Boolean));
  if (kitIds.size !== 1) {
    return {
      objeto: fallbackObjeto,
      justificativaContratacao: "",
      justificativaQuantidade: "",
    };
  }

  const first = items.find((item) => item.source_kit_id);
  const description = first?.source_kit_descricao || "";
  const objeto = readKitSection(description, "Objeto da DFD") || fallbackObjeto;
  const justificativa =
    readKitSection(description, "Justificativa da necessidade") ||
    readKitSection(description, "Finalidade institucional");
  const quantidade = readKitSection(description, "Base de cálculo e dimensionamento");
  const contexto = readKitSection(description, "Contexto de uso");
  const orientacao = readKitSection(description, "Orientação ao solicitante");

  return {
    objeto,
    justificativaContratacao: [justificativa, contexto ? `Contexto de uso: ${contexto}` : ""]
      .filter(Boolean)
      .join("\n\n"),
    justificativaQuantidade: [quantidade, orientacao ? `Orientação de ajuste: ${orientacao}` : ""]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function groupingModeLabel(mode: GroupingMode) {
  if (mode === "coletiva") return "Coletiva por setor";
  if (mode === "grupo") return "Grupo e-Fisco";
  if (mode === "classe") return "Classe e-Fisco";
  return "Agrupamento livre";
}

function purposeLabel(value: DfdPurpose | "") {
  return PURPOSE_OPTIONS.find((option) => option.value === value)?.title || "Não definida";
}

function contextLabel(value: AcademicContext | "") {
  return CONTEXT_OPTIONS.find((option) => option.value === value)?.title || "Não definido";
}

function unitTypeLabel(value: UnitType | null | undefined) {
  if (!value) return "-";
  return value === "laboratorio" ? "Laboratório" : "Departamento";
}

function summarizeItemsByGnd(items: any[]) {
  return summarizeGndDistribution(items.map(getItemGndInput));
}

function getGroupExpenseViolation(items: any[]) {
  return getDfdExpenseClassViolation(items.map(getItemGndInput));
}

function buildCollectiveContributionFromItem({
  item,
  selectedUnit,
  user,
}: {
  item: any;
  selectedUnit: any;
  user: { id: string };
}) {
  const contribution: CollectiveContribution = {
    unit_id: selectedUnit.unit_id,
    unit_type: selectedUnit.unit_type,
    user_id: user.id,
    codigo_item_efisco: String(
      item.item_efisco?.codigo_item_efisco || item.item_efisco?.codigo_tce || "",
    ).trim(),
    codigo_tce: String(item.item_efisco?.codigo_tce || "").trim(),
    descricao: String(item.item_efisco?.descricao || "").trim(),
    unidade_medida: String(item.item_efisco?.unidade_medida || "").trim(),
    quantidade: Number(item.quantidade || 0),
    valor_unitario_estimado: Number(item.valor_unitario || 0),
    justificativa_item: String(item.justificativa_item || ""),
    link_referencia: String(item.link_referencia || ""),
    gnd: String(item.item_efisco?.gnd || ""),
    gnd_derivado: String(item.item_efisco?.gnd_derivado || item.item_efisco?.gnd || ""),
    codigo_natureza_despesa: item.item_efisco?.codigo_natureza_despesa || null,
    requires_natureza_review: Boolean(item.item_efisco?.requires_natureza_review),
    tipo_objeto: item.item_efisco?.tipo_objeto || null,
    codigo_grupo: item.item_efisco?.codigo_grupo || null,
    nome_grupo: item.item_efisco?.nome_grupo || null,
    codigo_classe: item.item_efisco?.codigo_classe || null,
    nome_classe: item.item_efisco?.nome_classe || null,
  };

  return {
    ...contribution,
    collective_key: buildCollectiveContributionKey(contribution),
    status: "aberta",
  };
}

export default function NovaDFDPage() {
  const router = useRouter();
  const submissionPolicy = useSubmissionPolicy();
  const { items, clearCarrinho, removeItem, restoreDraftItems } = useCarrinhoStore();
  const [dfdGroups, setDfdGroups] = useState<DFDGroup[]>([]);
  const [userUnits, setUserUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFinalizeFlow, setShowFinalizeFlow] = useState(false);
  const [finalizeMode, setFinalizeMode] = useState<FinalizeMode>("draft");
  const [groupingMode, setGroupingMode] = useState<GroupingMode>("grupo");
  const [showGuide, setShowGuide] = useState(true);
  const finalizationCopy = getDfdFinalizationCopy(finalizeMode);

  // Autosave do wizard (migration 0042 + dfdDraftActions).
  // Salva groupingMode + formData de cada grupo (não os itens, que já vivem
  // no Zustand carrinho persistente). Restaura ao montar; limpa após finalize.
  const draft = useDfdDraft();
  const { save: scheduleDraftSave, loading: draftLoading } = draft;
  const draftRestoredRef = React.useRef(false);
  const [pendingFormRestoreMap, setPendingFormRestoreMap] = useState<
    Record<string, DFDGroup["formData"]> | null
  >(null);

  // Restaura rascunho — quando a primeira passagem do effect abaixo gera os
  // grupos (a partir dos itens do carrinho), aplicamos formData salvos.
  useEffect(() => {
    if (draft.loading || draftRestoredRef.current) return;
    if (!draft.draft?.payload) {
      draftRestoredRef.current = true;
      return;
    }
    const payload = draft.draft.payload as {
      groupingMode?: GroupingMode;
      groupForms?: Record<string, DFDGroup["formData"]>;
      cartItems?: unknown;
      showGuide?: boolean;
    };
    const restoredCartItems = restoreDfdDraftCartItems(payload.cartItems);
    if (restoredCartItems.length > 0) {
      // Os itens restaurados passam por validação estrutural no helper de
      // rascunhos. A serialização do Zustand remove a identidade de tipo,
      // por isso a conversão precisa passar por unknown antes de voltar ao
      // tipo do carrinho.
      restoreDraftItems(restoredCartItems as unknown as typeof items);
    }
    if (payload.groupingMode) setGroupingMode(payload.groupingMode);
    if (typeof payload.showGuide === "boolean") setShowGuide(payload.showGuide);
    // groupForms é aplicado no effect que reconstrói dfdGroups (logo abaixo),
    // através de uma ref consultada lá.
    setPendingFormRestoreMap(payload.groupForms || null);
    draftRestoredRef.current = true;
  }, [draft.loading, draft.draft, restoreDraftItems]);

  useEffect(() => {
    if (items.length === 0) {
      setDfdGroups([]);
      return;
    }

    const grouped: Record<string, { label: string; items: any[] }> = {};

    items.forEach((item) => {
      const key = buildSeparatedGroupingKey(groupingMode, item);
      const label = buildSeparatedGroupingLabel(groupingMode, item);
      if (!grouped[key]) grouped[key] = { label, items: [] };
      grouped[key].items.push({
        ...item,
        quantidade: Number(item.quantidade || 1),
        valor_unitario: Number(item.valor_unitario_estimado || 0),
        justificativa_item: String(item.justificativa_item || ""),
        link_referencia: String(item.link_referencia || ""),
      });
    });

    const restoreMap = pendingFormRestoreMap;
    setDfdGroups(
      Object.entries(grouped).map(([key, group]) => {
        const fallbackObjeto = buildDefaultObjeto(groupingMode, group.label);
        const kitPrefill = buildKitPrefill(group.items, fallbackObjeto);
        const defaultFormData: DFDGroup["formData"] = {
          objeto: kitPrefill.objeto,
          justificativa_contratacao: kitPrefill.justificativaContratacao,
          justificativa_quantidade: kitPrefill.justificativaQuantidade,
          previsao_data: "",
          unidade_id: "",
          tipo_unidade: "departamento",
          analysis_unidade_id: "",
          analysis_tipo_unidade: "departamento",
          analysis_routing_reason: "",
          finalidade: "",
          contexto_academico: "",
          planning_subsidies: {},
        };
        const restored = restoreMap?.[key];
        return {
          key,
          label: group.label,
          mode: groupingMode,
          items: group.items,
          formData: restored
            ? { ...defaultFormData, ...restored }
            : defaultFormData,
        };
      }),
    );
    // Restauração é one-shot — não reaplica em mudanças subsequentes.
    if (restoreMap) setPendingFormRestoreMap(null);
  }, [items, groupingMode, pendingFormRestoreMap]);

  // Autosave: a cada mudança de dfdGroups/groupingMode/showGuide, agenda save.
  // O hook tem debounce 1500ms + dedup por hash; chamar sempre é seguro.
  useEffect(() => {
    if (!submissionPolicy.canCreate || draftLoading || !draftRestoredRef.current) return;
    if (dfdGroups.length === 0 && items.length === 0) return;
    const groupForms: Record<string, DFDGroup["formData"]> = {};
    dfdGroups.forEach((g) => {
      groupForms[g.key] = g.formData;
    });
    scheduleDraftSave(
      {
        groupingMode,
        groupForms,
        cartItems: snapshotDfdDraftCartItems(items),
        showGuide,
        savedAt: new Date().toISOString(),
      },
      groupingMode,
    );
  }, [dfdGroups, groupingMode, showGuide, items, scheduleDraftSave, draftLoading, submissionPolicy.canCreate]);

  // Surface de erro de autosave: avisa o usuário se o BD recusar.
  // Não toasta sucesso a cada save para não poluir; só mostra erros novos.
  const lastShownErrorRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (
      draft.status === "error" &&
      draft.lastError &&
      draft.lastError !== lastShownErrorRef.current
    ) {
      lastShownErrorRef.current = draft.lastError;
      toast.error(
        `Autosave do rascunho falhou: ${draft.lastError}. Suas alterações ainda estão na memória — finalize ou tente novamente.`,
      );
    }
    if (draft.status === "saved") {
      lastShownErrorRef.current = null;
    }
  }, [draft.status, draft.lastError]);

  useEffect(() => {
    async function loadUnits() {
      const user = await getSafeUser();
      if (!user) return;

      const { data: links } = await supabase
        .from("user_units")
        .select("*")
        .eq("user_id", user.id);

      if (!links || links.length === 0) return;

      const deptIds = links
        .filter((u) => u.unit_type === "departamento")
        .map((u) => u.unit_id);
      const labIds = links
        .filter((u) => u.unit_type === "laboratorio")
        .map((u) => u.unit_id);

      const { data: depts } = deptIds.length
        ? await supabase.from("departamentos").select("id,nome").in("id", deptIds)
        : { data: [] as Array<{ id: string; nome: string }> };
      const { data: labs } = labIds.length
        ? await supabase.from("laboratorios").select("id,nome").in("id", labIds)
        : { data: [] as Array<{ id: string; nome: string }> };

      const normalized = links.map((link) => {
        const nome =
          link.unit_type === "departamento"
            ? depts?.find((d) => d.id === link.unit_id)?.nome
            : labs?.find((l) => l.id === link.unit_id)?.nome;
        return {
          ...link,
          nome: nome || "Unidade não encontrada",
        };
      });

      setUserUnits(normalized);
    }

    loadUnits();
  }, []);

  const getRoutingPreview = (formData: DFDGroup["formData"]) => {
    if (!formData.finalidade || !formData.contexto_academico || !formData.unidade_id) {
      return null;
    }
    return resolveDfdRouting({
      purpose: formData.finalidade,
      context: formData.contexto_academico,
      localUnitType: formData.tipo_unidade,
    });
  };

  const findAnalysisUnitFor = (
    unitType: UnitType,
    formData: DFDGroup["formData"],
  ) => {
    if (unitType === "laboratorio" && formData.tipo_unidade === "laboratorio") {
      const localUnit = userUnits.find((unit) => unit.unit_id === formData.unidade_id);
      if (localUnit) return localUnit;
    }
    return userUnits.find((unit) => unit.unit_type === unitType) || null;
  };

  const updateGroupForm = (
    groupIndex: number,
    field: keyof DFDGroup["formData"],
    value: string,
  ) => {
    setDfdGroups((prev) => {
      const next = prev.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              formData: { ...group.formData, [field]: value },
            }
          : group,
      );
      const target = next[groupIndex];
      const routing = getRoutingPreview(target.formData);
      if (routing) {
        const currentAnalysis = userUnits.find(
          (unit) => unit.unit_id === target.formData.analysis_unidade_id,
        );
        const recommended = findAnalysisUnitFor(routing.analysisUnitType, target.formData);
        if (
          recommended &&
          (!target.formData.analysis_unidade_id ||
            currentAnalysis?.unit_type !== routing.analysisUnitType)
        ) {
          target.formData = {
            ...target.formData,
            analysis_unidade_id: recommended.unit_id,
            analysis_tipo_unidade: recommended.unit_type as UnitType,
          };
        }
        if (
          field === "finalidade" ||
          field === "contexto_academico" ||
          field === "unidade_id" ||
          !target.formData.analysis_routing_reason
        ) {
          target.formData = {
            ...target.formData,
            analysis_routing_reason: routing.reason,
          };
        }
      }
      return next;
    });
  };

  const applyRoutingRecommendation = (groupIndex: number) => {
    setDfdGroups((prev) => {
      const next = prev.map((group, index) =>
        index === groupIndex ? { ...group, formData: { ...group.formData } } : group,
      );
      const target = next[groupIndex];
      const routing = getRoutingPreview(target.formData);
      if (!routing) return next;
      const recommended = findAnalysisUnitFor(routing.analysisUnitType, target.formData);
      if (!recommended) return next;
      target.formData = {
        ...target.formData,
        analysis_unidade_id: recommended.unit_id,
        analysis_tipo_unidade: recommended.unit_type as UnitType,
        analysis_routing_reason: routing.reason,
      };
      return next;
    });
  };

  const updateItem = (
    groupIndex: number,
    itemIndex: number,
    field: string,
    value: any,
  ) => {
    setDfdGroups((prev) => {
      const next = [...prev];
      next[groupIndex].items[itemIndex] = {
        ...next[groupIndex].items[itemIndex],
        [field]: value,
      };
      return next;
    });
  };

  const blockingErrors = useMemo(() => {
    const errors: string[] = [];
    if (groupingMode === "coletiva") {
      const selectedUnitIds = new Set(
        dfdGroups
          .map((group) => group.formData.unidade_id)
          .filter((value) => Boolean(value)),
      );
      if (selectedUnitIds.size > 1) {
        errors.push(
          "Na DFD coletiva, todos os itens precisam ficar no mesmo setor/laboratório.",
        );
      }
    }

    dfdGroups.forEach((group, gIdx) => {
      const label = `${groupingModeLabel(group.mode)} ${group.label} (#${gIdx + 1})`;
      const expenseViolation = getGroupExpenseViolation(group.items);
      if (expenseViolation) {
        errors.push(`${label}: ${expenseViolation}`);
      }
      if (!String(group.formData.objeto || "").trim()) {
        errors.push(`${label}: informe o título do objeto.`);
      }
      if (!group.formData.unidade_id) {
        errors.push(`${label}: escolha o local de uso.`);
      }
      if (!group.formData.analysis_unidade_id) {
        errors.push(`${label}: escolha quem fará a análise.`);
      }
      if (!group.formData.finalidade) {
        errors.push(`${label}: escolha a finalidade da demanda.`);
      }
      if (!group.formData.contexto_academico) {
        errors.push(`${label}: escolha o contexto de uso.`);
      }
      if (!String(group.formData.justificativa_contratacao || "").trim()) {
        errors.push(`${label}: escreva o porquê dessa necessidade.`);
      }
      if (!String(group.formData.justificativa_quantidade || "").trim()) {
        errors.push(`${label}: explique como chegou nas quantidades.`);
      }
      if (!String(group.formData.previsao_data || "").trim()) {
        errors.push(
          `${label}: informe a previsão de recebimento (a partir de ${formatIsoDateToPtBr(NEXT_YEAR_MIN_DATE)}).`,
        );
      } else if (group.formData.previsao_data < NEXT_YEAR_MIN_DATE) {
        errors.push(
          `${label}: previsão de recebimento deve ser a partir de ${formatIsoDateToPtBr(NEXT_YEAR_MIN_DATE)}.`,
        );
      }

      group.items.forEach((item, idx) => {
        const code = String(item.item_efisco?.codigo_tce || idx + 1).trim();
        const itemLabel = `${label} - item ${code}`;
        const qtd = Number(item.quantidade || 0);
        const unitPrice = Number(item.valor_unitario || 0);
        const unit = String(item.item_efisco?.unidade_medida || "").trim();
        const gnd = String(item.item_efisco?.gnd || "").trim();
        const description = String(item.item_efisco?.descricao || "").trim();
        const link = String(item.link_referencia || "").trim();
        const just = String(item.justificativa_item || "").trim();

        if (!description) errors.push(`${itemLabel}: descrição não informada.`);
        if (!code) errors.push(`${itemLabel}: código e-Fisco não informado.`);
        if (!Number.isFinite(qtd) || qtd <= 0) {
          errors.push(`${itemLabel}: informe uma quantidade maior que zero.`);
        }
        if (!unit) errors.push(`${itemLabel}: informe a unidade.`);
        if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
          errors.push(`${itemLabel}: informe um valor unitário maior que zero.`);
        }
        if (!gnd) errors.push(`${itemLabel}: tipo de despesa não identificado.`);
        if (gnd === "SEM_NATUREZA" && !item.item_efisco?.requires_natureza_review) {
          errors.push(`${itemLabel}: item sem natureza precisa estar marcado para revisão.`);
        }
        if (!link) errors.push(`${itemLabel}: adicione um link de referência.`);
        if (link && !isValidReferenceLink(link)) {
          errors.push(`${itemLabel}: use um link válido (http/https).`);
        }
        if (just.length < MIN_ITEM_JUSTIFICATIVA_CHARS) {
          errors.push(
            `${itemLabel}: detalhe melhor a justificativa (${MIN_ITEM_JUSTIFICATIVA_CHARS}+ caracteres).`,
          );
        }
      });
    });

    return errors;
  }, [dfdGroups, groupingMode]);
  const processChecklist = useMemo(
    () =>
      getDfdProcessChecklist({
        status: "rascunho",
        isCreator: true,
        itemCount: items.length,
        hasObject: dfdGroups.every((group) => String(group.formData.objeto || "").trim().length > 0),
        hasJustification: dfdGroups.every(
          (group) => String(group.formData.justificativa_contratacao || "").trim().length > 0,
        ),
        hasQuantityBasis: dfdGroups.every(
          (group) => String(group.formData.justificativa_quantidade || "").trim().length > 0,
        ),
        hasUnit: dfdGroups.every(
          (group) => Boolean(group.formData.unidade_id) && Boolean(group.formData.analysis_unidade_id),
        ),
        hasOnlyOneExpenseClass: dfdGroups.every((group) => !getGroupExpenseViolation(group.items)),
      }),
    [dfdGroups, items.length],
  );
  const checklistPreview = processChecklist.slice(0, 5);
  const checklistPendingCount = checklistPreview.filter(
    (item) => item.state !== "done",
  ).length;
  const pendingChecklistLabels = checklistPreview
    .filter((item) => item.state !== "done")
    .map((item) => item.label);

  const totalGeral = useMemo(
    () =>
      dfdGroups.reduce(
        (acc, group) =>
          acc +
          group.items.reduce(
            (itemAcc, item) =>
              itemAcc +
              Number(item.quantidade || 0) * Number(item.valor_unitario || 0),
            0,
          ),
        0,
      ),
    [dfdGroups],
  );

  const globalGndSummary = useMemo(
    () => summarizeItemsByGnd(dfdGroups.flatMap((group) => group.items)),
    [dfdGroups],
  );

  const sendDfdToChefia = async (dfdId: string) => {
    const response = await fetch("/api/dfd/send-to-triagem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: dfdId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || "Não foi possível encaminhar para a chefia.");
    }
  };

  const handleFinalize = async (mode: FinalizeMode = "draft") => {
    if (!submissionPolicy.canCreate) { toast.error("O prazo de novas solicitações encerrou. Solicite liberação ao superadmin."); return; }
    if (blockingErrors.length > 0) {
      toast.error(
        `Faltam ${blockingErrors.length} ajuste(s) antes de concluir. Exemplo: ${blockingErrors[0]}`,
      );
      return;
    }

    setLoading(true);
    try {
      const user = await getSafeUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const { data: profile } = await supabase
        .from("profiles")
        .select("campus_id, full_name, email")
        .eq("id", user.id)
        .single();

      let campusLegacy = "SEM_CAMPUS";
      if (profile?.campus_id) {
        const { data: campusRow } = await supabase
          .from("campi")
          .select("sigla,nome")
          .eq("id", profile.campus_id)
          .maybeSingle();
        campusLegacy =
          String(campusRow?.sigla || campusRow?.nome || profile.campus_id).trim() ||
          "SEM_CAMPUS";
      }

      const createDfdWithItems = async ({
        group,
        groupIndex,
        selectedUnit,
        selectedAnalysisUnit,
        valorTotalEstimado,
        itemsToInsert,
      }: {
        group: DFDGroup;
        groupIndex: number;
        selectedUnit: any;
        selectedAnalysisUnit: any;
        valorTotalEstimado: number;
        itemsToInsert: Array<Record<string, any>>;
      }) => {
        const planningSubsidies = sanitizePlanningSubsidies(group.formData.planning_subsidies);
        const dfdPayload = {
          numero_protocolo: buildNumeroProtocolo(groupIndex),
          solicitante_id: user.id,
          campus: campusLegacy,
          campus_id: profile?.campus_id,
          unidade_id: group.formData.unidade_id,
          tipo_unidade: selectedUnit.unit_type as UnitType,
          analysis_unidade_id: group.formData.analysis_unidade_id,
          analysis_tipo_unidade: selectedAnalysisUnit.unit_type as UnitType,
          analysis_routing_reason:
            group.formData.analysis_routing_reason.trim() || null,
          objeto_contratacao: group.formData.objeto,
          justificativa_contratacao: String(group.formData.justificativa_contratacao || "").trim(),
          justificativa_quantidade: group.formData.justificativa_quantidade,
          planning_subsidies: planningSubsidies,
          previsao_recebimento: group.formData.previsao_data || null,
          valor_total_estimado: valorTotalEstimado,
          status: "rascunho",
        };

        let dfdResult = await supabase
          .from("dfds")
          .insert(dfdPayload)
          .select()
          .single();

        if (
          dfdResult.error &&
          /analysis_unidade_id|analysis_tipo_unidade|analysis_routing_reason|planning_subsidies/i.test(
            String(dfdResult.error.message || ""),
          )
        ) {
          const legacyPayload = {
            numero_protocolo: dfdPayload.numero_protocolo,
            solicitante_id: dfdPayload.solicitante_id,
            campus: dfdPayload.campus,
            campus_id: dfdPayload.campus_id,
            unidade_id: dfdPayload.unidade_id,
            tipo_unidade: dfdPayload.tipo_unidade,
            objeto_contratacao: dfdPayload.objeto_contratacao,
            justificativa_contratacao: dfdPayload.justificativa_contratacao,
            justificativa_quantidade: dfdPayload.justificativa_quantidade,
            previsao_recebimento: dfdPayload.previsao_recebimento,
            valor_total_estimado: dfdPayload.valor_total_estimado,
            status: dfdPayload.status,
          };
          dfdResult = await supabase.from("dfds").insert(legacyPayload).select().single();
        }

        if (dfdResult.error) throw dfdResult.error;
        const dfd = dfdResult.data;

        const { error: itemsError } = await supabase
          .from("dfd_items")
          .insert(itemsToInsert.map((item) => ({ ...item, dfd_id: dfd.id })));
        if (itemsError) {
          await supabase.from("dfds").delete().eq("id", dfd.id);
          throw itemsError;
        }

        return dfd;
      };

      if (groupingMode === "coletiva") {
        const selectedUnitIds = Array.from(
          new Set(dfdGroups.map((group) => group.formData.unidade_id).filter(Boolean)),
        );
        if (selectedUnitIds.length !== 1) {
          throw new Error(
            "Escolha uma única unidade para gerar a DFD coletiva.",
          );
        }

        const firstGroup = dfdGroups[0];
        const selectedUnit = userUnits.find(
          (u) => u.unit_id === selectedUnitIds[0],
        );
        if (!selectedUnit) {
          throw new Error("Local de uso inválido para o seu perfil.");
        }

        const contributionRows = dfdGroups.flatMap((group) =>
          group.items.map((item) =>
            buildCollectiveContributionFromItem({ item, selectedUnit, user }),
          ),
        );
        if (contributionRows.length === 0) {
          throw new Error("Nenhum item encontrado para a DFD coletiva.");
        }

        const contributionKeys = Array.from(
          new Set(contributionRows.map((row) => row.collective_key)),
        );

        const { error: deleteContributionError } = await supabase
          .from("dfd_collective_contributions")
          .delete()
          .eq("user_id", user.id)
          .eq("unit_id", selectedUnit.unit_id)
          .eq("unit_type", selectedUnit.unit_type)
          .eq("status", "aberta")
          .is("room_id", null)
          .in("collective_key", contributionKeys);
        if (deleteContributionError) throw deleteContributionError;

        const { error: contributionError } = await supabase
          .from("dfd_collective_contributions")
          .insert(contributionRows);
        if (contributionError) throw contributionError;

        const { data: openRows, error: openRowsError } = await supabase
          .from("dfd_collective_contributions")
          .select("*")
          .eq("unit_id", selectedUnit.unit_id)
          .eq("unit_type", selectedUnit.unit_type)
          .eq("status", "aberta")
          .is("room_id", null);
        if (openRowsError) throw openRowsError;

        const userIds = Array.from(
          new Set((openRows || []).map((row: any) => row.user_id).filter(Boolean)),
        );
        const { data: profiles, error: profilesError } = userIds.length
          ? await supabase
              .from("profiles")
              .select("id, full_name, email")
              .in("id", userIds)
          : { data: [], error: null };
        if (profilesError) throw profilesError;

        const profileById = new Map((profiles || []).map((row: any) => [row.id, row]));
        const enrichedRows = (openRows || []).map((row: any) => {
          const rowProfile = profileById.get(row.user_id);
          return {
            ...row,
            user_name: rowProfile?.full_name || null,
            user_email: rowProfile?.email || null,
          };
        });

        const rowsByExpenseClass = new Map<string, any[]>();
        for (const row of enrichedRows) {
          const classKey = getItemExpenseClassKey({
            gnd: row.gnd || row.gnd_derivado,
            codigoNaturezaDespesa: row.codigo_natureza_despesa,
          });
          if (!rowsByExpenseClass.has(classKey)) rowsByExpenseClass.set(classKey, []);
          rowsByExpenseClass.get(classKey)?.push(row);
        }

        let createdCount = 0;
        const createdDfdIds: string[] = [];
        for (const [classKey, rows] of rowsByExpenseClass.entries()) {
          const collectiveItems = aggregateCollectiveContributions(rows);
          if (collectiveItems.length === 0) continue;

          const baseGroup =
            dfdGroups.find((group) => getBudgetSplitKey(group.items[0]) === classKey) ||
            firstGroup;
          const selectedAnalysisUnit = userUnits.find(
            (u) => u.unit_id === baseGroup.formData.analysis_unidade_id,
          );
          if (!selectedAnalysisUnit) {
            throw new Error("Responsável pela análise inválido para o seu perfil.");
          }

          const valorTotalEstimado = collectiveItems.reduce(
            (acc, item) =>
              acc +
              Number(item.quantidade || 0) *
                Number(item.valor_unitario_estimado || 0),
            0,
          );

          const itemsToInsert = collectiveItems.map((item) => {
            const fiscal = resolveDfdFiscalFields({
              ...item,
              codigo_tce: item.codigo_tce || item.codigo_item_efisco,
            });
            return {
              codigo_tce: String(item.codigo_tce || item.codigo_item_efisco || "").trim(),
              codigo_item_efisco: String(item.codigo_item_efisco || item.codigo_tce || "").trim(),
              descricao: String(item.descricao || "").trim(),
              quantidade: Number(item.quantidade || 0),
              valor_unitario_estimado: Number(item.valor_unitario_estimado || 0),
              justificativa_item: [
                String(item.justificativa_item || "").trim(),
                `Distribuição por usuário: ${formatContributorDistribution(item.contributors)}`,
              ]
                .filter(Boolean)
                .join("\n"),
              local_uso: selectedUnit.nome || null,
              link_referencia: String(item.link_referencia || ""),
              gnd: fiscal.gnd,
              gnd_derivado: fiscal.gnd_derivado,
              tipo_objeto: item.tipo_objeto || null,
              codigo_grupo: item.codigo_grupo || null,
              nome_grupo: item.nome_grupo || null,
              codigo_classe: item.codigo_classe || null,
              nome_classe: item.nome_classe || null,
              codigo_material_servico: null,
              nome_material_servico: null,
              codigo_natureza_despesa: fiscal.codigo_natureza_despesa,
              efisco_item_id: fiscal.efisco_item_id,
              efisco_item_natureza_id: fiscal.efisco_item_natureza_id,
              requires_natureza_review: fiscal.requires_natureza_review,
            };
          });

          const dfd = await createDfdWithItems({
            group: {
              ...baseGroup,
              label: `DFD coletiva - ${getExpenseClassGroupingLabel(classKey as any)}`,
              formData: {
                ...baseGroup.formData,
                objeto:
                  baseGroup.formData.objeto ||
                  `DFD coletiva - ${getExpenseClassGroupingLabel(classKey as any)}`,
              },
            },
            groupIndex: createdCount,
            selectedUnit,
            selectedAnalysisUnit,
            valorTotalEstimado,
            itemsToInsert,
          });

          const contributionIds = rows.map((row) => String(row.id || "")).filter(Boolean);
          const closeResponse = await fetch("/api/collective-contributions/consolidate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dfd_id: dfd.id,
              unit_id: selectedUnit.unit_id,
              unit_type: selectedUnit.unit_type,
              contribution_ids: contributionIds,
            }),
          });
          const closePayload = await closeResponse.json().catch(() => ({}));
          if (!closeResponse.ok) {
            throw new Error(closePayload?.error || "Não foi possível concluir as contribuições da DFD coletiva.");
          }
          createdDfdIds.push(String(dfd.id));
          createdCount += 1;
        }

        if (mode === "triagem") {
          for (const dfdId of createdDfdIds) {
            await sendDfdToChefia(dfdId);
          }
        }

        toast.success(
          mode === "triagem"
            ? `${createdCount} DFD(s) coletiva(s) criada(s) e encaminhada(s) à chefia.`
            : `${createdCount} DFD(s) coletiva(s) criada(s). Tudo certo.`,
        );
        clearCarrinho();
        // Apaga rascunho — DFDs já existem no banco; nada a recuperar.
        await draft.clear();
        router.push("/minhas-dfds");
        return;
      }

      const createdDfdIds: string[] = [];
      for (const [groupIndex, group] of dfdGroups.entries()) {
        const selectedUnit = userUnits.find(
          (u) => u.unit_id === group.formData.unidade_id,
        );
        if (!selectedUnit) {
          throw new Error("Local de uso inválido para o seu perfil.");
        }
        const selectedAnalysisUnit = userUnits.find(
          (u) => u.unit_id === group.formData.analysis_unidade_id,
        );
        if (!selectedAnalysisUnit) {
          throw new Error("Responsável pela análise inválido para o seu perfil.");
        }

        const valorTotalEstimado = group.items.reduce(
          (acc, item) =>
            acc + Number(item.quantidade || 0) * Number(item.valor_unitario || 0),
          0,
        );
        const planningSubsidies = sanitizePlanningSubsidies(group.formData.planning_subsidies);

        const dfdPayload = {
          numero_protocolo: buildNumeroProtocolo(groupIndex),
          solicitante_id: user.id,
          campus: campusLegacy,
          campus_id: profile?.campus_id,
          unidade_id: group.formData.unidade_id,
          tipo_unidade: selectedUnit.unit_type as UnitType,
          analysis_unidade_id: group.formData.analysis_unidade_id,
          analysis_tipo_unidade: selectedAnalysisUnit.unit_type as UnitType,
          analysis_routing_reason:
            group.formData.analysis_routing_reason.trim() || null,
          objeto_contratacao: group.formData.objeto,
          justificativa_contratacao: String(group.formData.justificativa_contratacao || "").trim(),
          justificativa_quantidade: group.formData.justificativa_quantidade,
          planning_subsidies: planningSubsidies,
          previsao_recebimento: group.formData.previsao_data || null,
          valor_total_estimado: valorTotalEstimado,
          status: "rascunho",
        };

        let dfdResult = await supabase
          .from("dfds")
          .insert(dfdPayload)
          .select()
          .single();

        if (
          dfdResult.error &&
          /analysis_unidade_id|analysis_tipo_unidade|analysis_routing_reason|planning_subsidies/i.test(
            String(dfdResult.error.message || ""),
          )
        ) {
          const legacyPayload = {
            numero_protocolo: dfdPayload.numero_protocolo,
            solicitante_id: dfdPayload.solicitante_id,
            campus: dfdPayload.campus,
            campus_id: dfdPayload.campus_id,
            unidade_id: dfdPayload.unidade_id,
            tipo_unidade: dfdPayload.tipo_unidade,
            objeto_contratacao: dfdPayload.objeto_contratacao,
            justificativa_contratacao: dfdPayload.justificativa_contratacao,
            justificativa_quantidade: dfdPayload.justificativa_quantidade,
            previsao_recebimento: dfdPayload.previsao_recebimento,
            valor_total_estimado: dfdPayload.valor_total_estimado,
            status: dfdPayload.status,
          };
          dfdResult = await supabase.from("dfds").insert(legacyPayload).select().single();
        }

        if (dfdResult.error) throw dfdResult.error;
        const dfd = dfdResult.data;

        const itemsToInsert = group.items.map((item) => {
          const fiscal = resolveDfdFiscalFields(item.item_efisco || {});
          return {
            dfd_id: dfd.id,
            codigo_tce: String(item.item_efisco?.codigo_tce || "").trim(),
            codigo_item_efisco: String(item.item_efisco?.codigo_tce || "").trim(),
            descricao: String(item.item_efisco?.descricao || "").trim(),
            quantidade: Number(item.quantidade || 0),
            valor_unitario_estimado: Number(item.valor_unitario || 0),
            justificativa_item: String(item.justificativa_item || ""),
            local_uso: selectedUnit.nome || null,
            link_referencia: String(item.link_referencia || ""),
            gnd: fiscal.gnd,
            gnd_derivado: fiscal.gnd_derivado,
            tipo_objeto: item.item_efisco?.tipo_objeto || null,
            codigo_grupo: item.item_efisco?.codigo_grupo || null,
            nome_grupo: item.item_efisco?.nome_grupo || null,
            codigo_classe: item.item_efisco?.codigo_classe || null,
            nome_classe: item.item_efisco?.nome_classe || null,
            codigo_material_servico:
              item.item_efisco?.codigo_material_servico || null,
            nome_material_servico: item.item_efisco?.nome_material_servico || null,
            codigo_natureza_despesa: fiscal.codigo_natureza_despesa,
            efisco_item_id: fiscal.efisco_item_id,
            efisco_item_natureza_id: fiscal.efisco_item_natureza_id,
            requires_natureza_review: fiscal.requires_natureza_review,
          };
        });

        const { error: itemsError } = await supabase
          .from("dfd_items")
          .insert(itemsToInsert);
        if (itemsError) {
          await supabase.from("dfds").delete().eq("id", dfd.id);
          throw itemsError;
        }
        createdDfdIds.push(String(dfd.id));
      }

      if (mode === "triagem") {
        for (const dfdId of createdDfdIds) {
          await sendDfdToChefia(dfdId);
        }
      }

      toast.success(
        mode === "triagem"
          ? `${dfdGroups.length} DFD(s) criada(s) e encaminhada(s) à chefia.`
          : `${dfdGroups.length} DFD(s) criada(s). Tudo certo.`,
      );
      clearCarrinho();
      await draft.clear();
      router.push("/minhas-dfds");
    } catch (error: any) {
      toast.error(`Não foi possível concluir agora: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (submissionPolicy.loading || !submissionPolicy.canCreate) {
    return <div className="flex min-h-[60vh] items-center justify-center px-4"><OperationalEmptyState title={submissionPolicy.loading ? "Verificando prazo de submissão" : "Novas solicitações encerradas"} description={submissionPolicy.loading ? "Aguarde a verificação do ciclo e das autorizações." : submissionPolicy.error || "Seu rascunho foi preservado. Para uma nova solicitação, peça liberação ao superadmin. Para corrigir uma DFD devolvida ou autorizada, abra a própria DFD."} action={<button type="button" onClick={() => router.push("/minhas-dfds")} className="min-h-11 rounded-xl bg-[var(--semantic-action)] px-4 text-sm font-semibold text-[var(--p-color-action-fg)]">Acompanhar minhas DFDs</button>} /></div>;
  }
  if (items.length === 0) {
    return (
      <div className="flex min-h-[72vh] items-center justify-center px-6">
        <OperationalEmptyState
          icon={
            <img
              src="/guidance/empty-cart.png"
              alt=""
              className="aspect-[16/9] w-32 object-contain"
            />
          }
          title="Carrinho vazio"
          description="Escolha itens no catálogo para começar sua solicitação com um dossiê de DFD mais organizado."
          action={
            <Button
              onClick={() => router.push("/catalogo")}
              className="h-10 rounded-xl bg-[var(--p-color-brand-500)] px-6 text-white hover:bg-[var(--p-color-brand-600)]"
            >
              Abrir catálogo
            </Button>
          }
          className="max-w-2xl"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-6 px-4 pb-52 pt-6 md:px-6 md:pb-36">
      <section className="rounded-[28px] border border-[var(--p-color-border)] bg-white p-6 shadow-[0_10px_24px_rgba(15,46,87,0.06)] md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <OperationalChip tone="action" className="uppercase tracking-[0.08em]">
              Passo a passo
            </OperationalChip>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--p-color-brand-600)] md:text-5xl">
              Vamos organizar sua demanda
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-[var(--p-color-fg-muted)]">
              Separamos tudo por etapas para você preencher com calma, sem se perder,
              e montar DFDs mais claras.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <OperationalKpiCard label="Itens" value={String(items.length)} tone="action" className="min-w-[128px]" />
            <OperationalKpiCard label="DFDs" value={String(dfdGroups.length)} tone="collab" className="min-w-[128px]" />
            <OperationalKpiCard label="Classificações" value={String(globalGndSummary.entries.length)} tone="insight" className="min-w-[128px]" />
            <OperationalKpiCard label="Total" value={toCurrency(totalGeral)} tone="success" className="min-w-[160px]" />
          </div>
        </div>
      </section>

      <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--p-color-border)] bg-white p-4 text-sm">
        <div><p className="font-semibold">{draft.loading ? "Carregando rascunho…" : draft.status === "saving" ? "Salvando rascunho…" : draft.status === "error" ? "Não foi possível salvar o rascunho" : draft.status === "saved" ? (draft.location === "local" ? "Rascunho salvo neste navegador" : "Rascunho salvo no PERCATA") : "Preparando rascunho"}</p><p className="mt-1 text-[var(--p-color-fg-muted)]">{draft.location === "local" ? "A cópia local fica disponível neste navegador. Ela ainda não foi enviada para a chefia." : "Salvar o rascunho não envia a solicitação para análise."}</p></div>
        {draft.status === "error" && <button type="button" onClick={() => void draft.saveImmediate({ groupingMode, groupForms: Object.fromEntries(dfdGroups.map(g => [g.key, g.formData])), cartItems: snapshotDfdDraftCartItems(items), showGuide, savedAt: new Date().toISOString() }, groupingMode)} className="min-h-11 rounded-xl border px-4 font-semibold">Tentar salvar novamente</button>}
      </div>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden rounded-[24px] border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] shadow-[0_10px_24px_rgba(15,46,87,0.05)]"
      >
        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--p-color-brand-500)] text-white">
              <Info size={18} weight="bold" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--p-color-brand-500)]">
                Você não precisa lembrar tudo de uma vez
              </h2>
              <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--p-color-fg-muted)]">
                Primeiro complete os dados principais. Ao finalizar, você pode escolher:
                salvar como rascunho ou já encaminhar para a chefia.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowGuide((value) => !value)}
            className="h-9 rounded-xl border border-[var(--p-color-info-border)] bg-white px-3 type-caption font-semibold uppercase tracking-[0.1em] text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-info-bg)]"
          >
            {showGuide ? "Ocultar guia" : "Ver guia"}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {showGuide ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-[var(--p-color-border)]"
            >
              <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-5">
                <OperationalStepper
                  currentStep={checklistPendingCount === 0 ? 4 : 1}
                  steps={DFD_PROCESS_STEPS.map((step) => ({
                    label: step.label,
                    helper: step.description,
                  }))}
                />

                <SkeuoDocumentCard
                  title="O que falta para concluir"
                  meta={
                    checklistPendingCount === 0
                      ? "Tudo certo para concluir."
                      : `${checklistPendingCount} pendência(s) para liberar a conclusão.`
                  }
                  stamp={checklistPendingCount === 0 ? "OK" : "Pendência"}
                  tone={checklistPendingCount === 0 ? "success" : "warning"}
                  className="p-3"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--p-color-brand-500)]">
                    Checklist
                  </p>
                  <div className="mt-3 space-y-2">
                    {checklistPreview.map((item) => (
                      <div key={item.id} className="flex items-start gap-2 text-xs">
                        {item.state === "done" ? (
                          <CheckCircle
                            size={15}
                            weight="fill"
                            className="mt-0.5 shrink-0 text-[var(--p-color-success)]"
                          />
                        ) : (
                          <WarningCircle
                            size={15}
                            weight="fill"
                            className="mt-0.5 shrink-0 text-[var(--p-color-warning)]"
                          />
                        )}
                        <div>
                          <p className="font-semibold text-[var(--p-color-fg-default)]">{item.label}</p>
                          <p className="text-[var(--p-color-fg-muted)]">{item.helper}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </SkeuoDocumentCard>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <SkeuoDocumentCard
          title="Saúde da solicitação"
          meta="Um panorama rápido antes de preencher os formulários detalhados."
          stamp="Prévia"
          tone="collab"
        >
          <SkeuoProgressRail
            items={[
              {
                label: "Checklist concluído",
                value: checklistPreview.length
                  ? (checklistPreview.filter((item) => item.state === "done").length / checklistPreview.length) * 100
                  : 0,
                tone: "success",
              },
              {
                label: "Itens distribuídos",
                value: items.length ? Math.min(100, (dfdGroups.length / Math.max(1, items.length)) * 100) : 0,
                tone: "action",
              },
              {
                label: "Tipos de despesa mapeados",
                value: items.length ? Math.min(100, (globalGndSummary.entries.length / Math.max(1, items.length)) * 100) : 0,
                tone: "insight",
              },
            ]}
            className="border-0 p-0 shadow-none"
          />
        </SkeuoDocumentCard>
        <SkeuoDocumentCard
          title="Próxima melhor ação"
          meta={
            checklistPendingCount > 0
              ? "Resolva os campos marcados no checklist antes de salvar ou enviar."
              : "Revise os agrupamentos e escolha salvar como rascunho ou encaminhar para chefia."
          }
          stamp={checklistPendingCount > 0 ? "Completar" : "Enviar"}
          tone={checklistPendingCount > 0 ? "warning" : "success"}
        />
      </section>

      <section className="rounded-[28px] border border-[var(--p-color-border)] bg-white p-5 shadow-[0_10px_24px_rgba(15,46,87,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-[var(--p-color-brand-500)]">
              <StackSimple size={16} />
              Organização do carrinho
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--p-color-brand-600)]">
              Como você quer organizar as DFDs?
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--p-color-fg-muted)]">
              Recomendamos começar por <b>grupo e-Fisco</b>. Assim você cria uma DFD por família de itens,
              sem misturar custeio com capital. Para demandas em equipe, use o modo coletivo.
            </p>
          </div>

          <div className="grid w-full gap-3 lg:w-auto lg:grid-cols-4">
            {GROUPING_OPTIONS.map((option) => {
              const active = groupingMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setGroupingMode(option.value)}
                  className={cn(
                    "min-w-[210px] rounded-2xl border px-4 py-3 text-left transition",
                    active
                      ? "border-[var(--p-color-brand-500)] bg-[var(--p-color-surface-subtle)] shadow-[0_8px_18px_rgba(15,46,87,0.10)]"
                      : "border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] hover:bg-[var(--p-color-surface-muted)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-[var(--p-color-brand-500)]">
                      <SquaresFour size={16} />
                      {option.title}
                    </span>
                    {option.recommended ? (
                      <span className="rounded-full bg-[var(--p-color-brand-500)] px-2 py-0.5 type-kicker font-bold uppercase tracking-[0.08em] text-white">
                        Recomendado
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--p-color-fg-muted)]">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
        {globalGndSummary.hasMixedExpenseClasses ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-[var(--p-color-brand-500)]">
              <SquaresFour size={18} />
              <span className="font-semibold">
                Separação automática por natureza da despesa
              </span>
            </div>
            <span className="text-xs font-semibold text-[var(--p-color-fg-muted)]">
              Encontramos custeio e capital no carrinho; separamos para você automaticamente.
            </span>
          </div>
        ) : null}
        {groupingMode === "coletiva" ? (
            <div className="mt-4 rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] px-4 py-3 text-sm text-[var(--p-color-fg-muted)]">
              <p className="font-semibold text-[var(--p-color-brand-500)]">
                Modo coletivo ativo
              </p>
              <p className="mt-1 text-xs leading-5">
                Ao concluir, seus itens entram no rascunho coletivo da unidade e o sistema
                mantém quanto cada pessoa pediu.
              </p>
            </div>
          ) : null}
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-24">
          <div className="rounded-[28px] border border-[var(--p-color-border-strong)]/25 bg-white/90 p-5 shadow-[0_10px_28px_rgba(15,46,87,0.05)]">
            <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-[var(--p-color-brand-500)]">
              Resumo
            </h3>
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex items-center justify-between text-[var(--p-color-fg-muted)]">
                <span>Itens mapeados</span>
                <b className="text-[var(--p-color-brand-500)]">{items.length}</b>
              </p>
              <p className="flex items-center justify-between text-[var(--p-color-fg-muted)]">
                <span>DFDs previstas</span>
                <b className="text-[var(--p-color-brand-500)]">{dfdGroups.length}</b>
              </p>
              <p className="flex items-center justify-between text-[var(--p-color-fg-muted)]">
                <span>Total estimado</span>
                <b className="text-[var(--p-color-brand-500)]">{toCurrency(totalGeral)}</b>
              </p>
            </div>
            {blockingErrors.length > 0 ? (
              <div className="mt-4 rounded-xl border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] px-3 py-2 text-xs text-[var(--p-color-warning)]">
                <p className="font-semibold">
                  Faltam {pendingChecklistLabels.length || blockingErrors.length} campo(s):
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {(pendingChecklistLabels.length > 0
                    ? pendingChecklistLabels
                    : ["Revise os campos obrigatórios da DFD"]).map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
                <p className="mt-2 type-caption text-[var(--p-color-warning)]">
                  Exemplo: {blockingErrors[0]}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] px-3 py-2 text-xs text-[var(--p-color-success)]">
                Tudo pronto para concluir ou encaminhar à chefia.
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-[var(--p-color-border-strong)]/25 bg-white/90 p-5 shadow-[0_10px_28px_rgba(15,46,87,0.05)]">
            <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-[var(--p-color-brand-500)]">
              Mapa de tipos de despesa
            </h3>
            <div className="mt-3 space-y-2">
              {globalGndSummary.entries.slice(0, 4).map((entry) => (
                <div
                  key={`global-gnd-${entry.gnd}`}
                  className="rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[var(--p-color-brand-500)]">{entry.expenseLabel}</span>
                    <span className="font-semibold text-[var(--p-color-fg-muted)]">
                      {entry.itemCount} item(ns)
                    </span>
                  </div>
                  <p className="mt-1 type-caption text-[var(--p-color-fg-muted)]">
                    {entry.expenseLabel} · {entry.elementLabel}
                  </p>
                </div>
              ))}
              {globalGndSummary.entries.length === 0 ? (
                <p className="rounded-xl border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] px-3 py-2 text-xs text-[var(--p-color-warning)]">
                  Nenhum tipo de despesa identificado no carrinho.
                </p>
              ) : null}
            </div>
            {globalGndSummary.hasMixedExpenseClasses ? (
              <p className="mt-3 rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] px-3 py-2 text-xs leading-5 text-[var(--p-color-brand-500)]">
                Custeio e capital detectados no carrinho. A tela separa automaticamente as
                DFDs por natureza.
              </p>
            ) : globalGndSummary.warnings.length > 0 ? (
              <p className="mt-3 rounded-xl border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] px-3 py-2 text-xs leading-5 text-[var(--p-color-warning)]">
                {globalGndSummary.warnings[0]}
              </p>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-[var(--p-color-border-strong)]/25 bg-white/90 p-5 shadow-[0_10px_28px_rgba(15,46,87,0.05)]">
            <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-[var(--p-color-brand-500)]">
              Navegação
            </h3>
            <div className="mt-3 grid gap-2">
              {dfdGroups.map((group, index) => (
                <a
                  key={`${group.key}-nav-${index}`}
                  href={`#grupo-${index + 1}`}
                  className="rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--p-color-brand-500)] transition hover:bg-[var(--p-color-surface-subtle)]"
                >
                  {group.label}
                </a>
              ))}
            </div>
          </div>
        </aside>

        <section className="grid gap-6">
          {blockingErrors.length > 0 && (
            <section className="rounded-[28px] border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)]/80 px-4 py-3">
              <div className="flex items-start gap-2">
                <WarningCircle size={18} className="mt-0.5 text-[var(--p-color-warning)]" />
                <div className="text-sm text-[var(--p-color-warning)]">
                  <p className="font-semibold">
                    {blockingErrors.length} ajuste(s) pendente(s)
                  </p>
                  <p>{blockingErrors[0]}</p>
                </div>
              </div>
            </section>
          )}

          {dfdGroups.map((group, gIdx) => {
            const groupTotal = group.items.reduce(
              (acc, item) =>
                acc + Number(item.quantidade || 0) * Number(item.valor_unitario || 0),
              0,
            );
            const groupGndSummary = summarizeItemsByGnd(group.items);
            const selectedUnit = userUnits.find(
              (unit) => unit.unit_id === group.formData.unidade_id,
            );
            const selectedAnalysisUnit = userUnits.find(
              (unit) => unit.unit_id === group.formData.analysis_unidade_id,
            );
            const routing = getRoutingPreview(group.formData);
            const recommendedAnalysisUnit = routing
              ? findAnalysisUnitFor(routing.analysisUnitType, group.formData)
              : null;
            const routingMismatch =
              !!routing &&
              !!selectedAnalysisUnit &&
              selectedAnalysisUnit.unit_type !== routing.analysisUnitType;

            return (
              <section
                id={`grupo-${gIdx + 1}`}
                key={`${group.key}-${gIdx}`}
                className="overflow-hidden rounded-[30px] border border-[var(--p-color-border-strong)]/25 bg-white/90 shadow-[0_10px_28px_rgba(15,46,87,0.05)]"
              >
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--p-color-surface-subtle)] px-5 py-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--p-color-fg-subtle)]">
                      {groupingModeLabel(group.mode)}
                    </p>
                    <h2 className="text-2xl font-semibold text-[var(--p-color-brand-500)]">{group.label}</h2>
                    <p className="mt-1 text-sm text-[var(--p-color-fg-muted)]">
                      Revise o pedido, explique a necessidade e confirme os dados dos itens.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-[var(--p-color-info-border)] bg-[var(--p-color-surface-subtle)] px-3 py-1 text-xs font-bold text-[var(--p-color-brand-500)]">
                    {group.items.length} item(ns) • {toCurrency(groupTotal)}
                  </span>
                </header>

                <div className="space-y-5 p-5">
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                    <Field className="xl:col-span-12" label="O que você precisa contratar?">
                      <input
                        type="text"
                        value={group.formData.objeto}
                        onChange={(event) =>
                          updateGroupForm(gIdx, "objeto", event.target.value)
                        }
                        className={inputClass}
                      />
                    </Field>

                    <div className="xl:col-span-12">
                      <VisualOptionGroup
                        title="Finalidade da demanda"
                        description="Escolha a finalidade principal para ajudar no encaminhamento."
                        options={PURPOSE_OPTIONS}
                        value={group.formData.finalidade}
                        onChange={(value) =>
                          updateGroupForm(gIdx, "finalidade", value)
                        }
                      />
                    </div>

                    <div className="xl:col-span-12">
                      <ContextOptionGroup
                        value={group.formData.contexto_academico}
                        onChange={(value) =>
                          updateGroupForm(gIdx, "contexto_academico", value)
                        }
                      />
                    </div>

                    <Field
                      className="xl:col-span-6"
                      label="Onde isso será usado?"
                      icon={<Buildings size={14} />}
                    >
                      <select
                        value={group.formData.unidade_id}
                        onChange={(event) => {
                          const unit = userUnits.find((u) => u.unit_id === event.target.value);
                          updateGroupForm(gIdx, "unidade_id", event.target.value);
                          updateGroupForm(
                            gIdx,
                            "tipo_unidade",
                            (unit?.unit_type as UnitType) || "departamento",
                          );
                          if (!group.formData.analysis_unidade_id) {
                            updateGroupForm(gIdx, "analysis_unidade_id", event.target.value);
                            updateGroupForm(
                              gIdx,
                              "analysis_tipo_unidade",
                              (unit?.unit_type as UnitType) || "departamento",
                            );
                          }
                        }}
                        className={selectClass}
                      >
                        <option value="">Selecione departamento ou laboratório</option>
                        {userUnits.map((u, index) => (
                          <option
                            key={`${u.unit_type}-${u.unit_id}-${u.id ?? index}`}
                            value={u.unit_id}
                          >
                            {u.unit_type === "departamento" ? "Departamento" : "Laboratório"} -{" "}
                            {u.nome}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field
                      className="xl:col-span-6"
                      label="Quem deve analisar?"
                      icon={<Buildings size={14} />}
                    >
                      <select
                        value={group.formData.analysis_unidade_id}
                        onChange={(event) => {
                          const unit = userUnits.find((u) => u.unit_id === event.target.value);
                          updateGroupForm(gIdx, "analysis_unidade_id", event.target.value);
                          updateGroupForm(
                            gIdx,
                            "analysis_tipo_unidade",
                            (unit?.unit_type as UnitType) || "departamento",
                          );
                        }}
                        className={selectClass}
                      >
                        <option value="">Selecione quem deve avaliar</option>
                        {userUnits.map((u, index) => (
                          <option
                            key={`analysis-${u.unit_type}-${u.unit_id}-${u.id ?? index}`}
                            value={u.unit_id}
                          >
                            {u.unit_type === "departamento" ? "Departamento" : "Laboratório"} -{" "}
                            {u.nome}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 type-caption text-[var(--p-color-fg-subtle)]">
                        Use este campo quando o item será usado em laboratório, mas a decisão pertence ao curso ou setor.
                      </p>
                    </Field>

                    <div className="xl:col-span-12">
                      <RoutingPreview
                        routing={routing}
                        selectedUnitName={selectedUnit?.nome || null}
                        selectedUnitType={selectedUnit?.unit_type as UnitType | undefined}
                        selectedAnalysisName={selectedAnalysisUnit?.nome || null}
                        selectedAnalysisType={
                          selectedAnalysisUnit?.unit_type as UnitType | undefined
                        }
                        recommendedName={recommendedAnalysisUnit?.nome || null}
                        mismatch={routingMismatch}
                        onApply={() => applyRoutingRecommendation(gIdx)}
                      />
                    </div>

                    <div className="xl:col-span-12">
                      <GndBudgetPanel summary={groupGndSummary} />
                    </div>

                    <Field className="xl:col-span-3" label="Quando precisa receber?">
                      <div className="m3-date-shell">
                        <input
                          id={`previsao-data-${gIdx}`}
                          type="date"
                          min={NEXT_YEAR_MIN_DATE}
                          value={group.formData.previsao_data}
                          onChange={(event) =>
                            updateGroupForm(gIdx, "previsao_data", event.target.value)
                          }
                          className={cn(
                            inputClass,
                            "m3-date-input pr-11 font-medium tabular-nums",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById(
                              `previsao-data-${gIdx}`,
                            ) as HTMLInputElement | null;
                            if (!input) return;
                            if (typeof input.showPicker === "function") {
                              input.showPicker();
                            } else {
                              input.focus();
                            }
                          }}
                          className="m3-date-trigger"
                          aria-label="Abrir calendário"
                        >
                          <Calendar size={15} />
                        </button>
                      </div>
                      <p className="mt-1 type-caption text-[var(--p-color-fg-subtle)]">
                        Informe uma data prevista (a partir de{" "}
                        {formatIsoDateToPtBr(NEXT_YEAR_MIN_DATE)}).
                      </p>
                    </Field>

                    <Field className="xl:col-span-12" label="Por que isso é necessário?">
                      <textarea
                        rows={6}
                        value={group.formData.justificativa_contratacao}
                        onChange={(event) =>
                          updateGroupForm(
                            gIdx,
                            "justificativa_contratacao",
                            event.target.value,
                          )
                        }
                        className={textareaClass}
                        placeholder="Conte o problema, a finalidade e o impacto esperado."
                      />
                    </Field>

                    <Field
                      className="xl:col-span-12"
                      label="Como chegou nessa quantidade?"
                      icon={<Info size={14} />}
                    >
                      <textarea
                        rows={6}
                        value={group.formData.justificativa_quantidade}
                        onChange={(event) =>
                          updateGroupForm(
                            gIdx,
                            "justificativa_quantidade",
                            event.target.value,
                          )
                        }
                        className={textareaClass}
                        placeholder="Explique o cálculo: turmas, pessoas atendidas, consumo médio, estoque atual e período de uso."
                      />
                    </Field>
                  </div>

                  <div className="rounded-[22px] border border-[var(--p-color-border)] bg-[var(--p-color-surface-muted)] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--p-color-fg-subtle)]">
                      O que entra nesta DFD
                    </p>

                    <div className="mt-3 grid gap-3">
                      {group.items.map((item, iIdx) => {
                        const justLen = String(item.justificativa_item || "").trim().length;
                        const justOk = justLen >= MIN_ITEM_JUSTIFICATIVA_CHARS;
                        const subtotal =
                          Number(item.quantidade || 0) * Number(item.valor_unitario || 0);
                        const gndInfo = classifyGnd(
                          item.item_efisco?.gnd ||
                            item.item_efisco?.gnd_derivado ||
                            item.item_efisco?.codigo_natureza_despesa,
                        );

                        return (
                          <article
                            key={
                              item.uid ??
                              item.id ??
                              `${item.item_efisco?.codigo_tce ?? "item"}-${iIdx}`
                            }
                            className={cn(
                              "rounded-2xl border bg-white p-4",
                              justOk
                                ? "border-[var(--p-color-border)]"
                                : "border-[var(--p-color-warning)]/45 bg-[var(--p-color-warning-bg)]",
                            )}
                          >
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold text-[var(--p-color-fg-subtle)]">
                                  Código e-Fisco: {item.item_efisco.codigo_tce}
                                </p>
                                <h3 className="text-sm font-semibold text-[var(--p-color-brand-500)]">
                                  {item.item_efisco.descricao}
                                </h3>
                                <p className="text-xs text-[var(--p-color-fg-muted)]">
                                  Grupo: {item.item_efisco?.nome_grupo || "-"} | Classe:{" "}
                                  {item.item_efisco?.nome_classe || item.item_efisco?.classe || "-"}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <GndPill classification={gndInfo} />
                                </div>
                              </div>
                              <button
                                onClick={() => removeItem(item.uid)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--p-color-danger-border)] bg-[var(--p-color-danger-bg)] text-[var(--p-color-danger)] transition hover:bg-[var(--p-color-danger-bg)]/80"
                                aria-label="Remover item"
                              >
                                <Trash size={14} />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
                              <Field className="xl:col-span-2" label="Qtd">
                                <input
                                  type="number"
                                  min={1}
                                  value={item.quantidade}
                                  onChange={(event) =>
                                    updateItem(
                                      gIdx,
                                      iIdx,
                                      "quantidade",
                                      Math.max(1, Number(event.target.value || 1)),
                                    )
                                  }
                                  className={inputClass}
                                />
                              </Field>

                              <Field className="xl:col-span-2" label="Unidade">
                                <select
                                  value={String(item.item_efisco?.unidade_medida || "UN")}
                                  onChange={(event) =>
                                    updateItem(gIdx, iIdx, "item_efisco", {
                                      ...item.item_efisco,
                                      unidade_medida: event.target.value,
                                    })
                                  }
                                  className={selectClass}
                                >
                                  {UNIT_OPTIONS.map((unit) => (
                                    <option key={unit} value={unit}>
                                      {unit}
                                    </option>
                                  ))}
                                </select>
                              </Field>

                              <Field className="xl:col-span-2" label="Valor unitário">
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={item.valor_unitario}
                                  onChange={(event) =>
                                    updateItem(
                                      gIdx,
                                      iIdx,
                                      "valor_unitario",
                                      Math.max(0, Number(event.target.value || 0)),
                                    )
                                  }
                                  className={inputClass}
                                />
                              </Field>

                              <Field
                                className="xl:col-span-6"
                                label="Link usado para preço ou especificação"
                              >
                                <input
                                  type="url"
                                  inputMode="url"
                                  autoCapitalize="off"
                                  autoCorrect="off"
                                  spellCheck={false}
                                  value={item.link_referencia}
                                  onChange={(event) =>
                                    updateItem(
                                      gIdx,
                                      iIdx,
                                      "link_referencia",
                                      event.target.value,
                                    )
                                  }
                                  className={inputClass}
                                  placeholder="https://paineldeprecos.planejamento.gov.br/..."
                                />
                              </Field>

                              <Field
                                className="xl:col-span-12"
                                label="Por que este item entra no pedido?"
                              >
                                <textarea
                                  rows={3}
                                  value={item.justificativa_item}
                                  onChange={(event) =>
                                    updateItem(
                                      gIdx,
                                      iIdx,
                                      "justificativa_item",
                                      event.target.value,
                                    )
                                  }
                                  className={cn(
                                    textareaClass,
                                    !justOk && "border-[var(--p-color-warning)]/50 bg-[var(--p-color-warning-bg)]",
                                  )}
                                  placeholder="Explique onde o item será usado, por quem e por que ele é necessário."
                                />
                              </Field>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <p
                                className={cn(
                                  "font-semibold",
                                  justOk
                                    ? "text-[var(--p-color-success)]"
                                    : "text-[var(--p-color-warning)]",
                                )}
                              >
                                {justOk
                                  ? "Justificativa técnica válida."
                                  : `Mínimo de ${MIN_ITEM_JUSTIFICATIVA_CHARS} caracteres (${justLen}/${MIN_ITEM_JUSTIFICATIVA_CHARS}).`}
                              </p>
                              <p className="font-semibold text-[var(--p-color-brand-500)]">
                                Subtotal: {toCurrency(subtotal)}
                              </p>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </section>
      </div>

      <section className="fixed bottom-4 left-0 right-0 z-40 px-4 md:px-6">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-3 rounded-2xl border border-[var(--p-color-border)] bg-white/95 p-3 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="text-sm">
            <span className="font-semibold text-[var(--p-color-brand-500)]">
              Total: {toCurrency(totalGeral)}
            </span>
            <span className="ml-2 text-[var(--p-color-fg-muted)]">
              | {dfdGroups.length} DFD(s) por{" "}
              {groupingMode === "livre"
                ? "modo livre"
                : groupingMode === "coletiva"
                  ? "modo coletivo"
                  : groupingMode}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => router.back()}
              variant="ghost"
              className="h-10 rounded-lg border border-[var(--p-color-border)] px-4 text-[var(--p-color-fg-muted)] hover:bg-[var(--p-color-surface-muted)]"
            >
              <ArrowLeft size={14} className="mr-1" />
              Voltar
            </Button>
            <Button
              onClick={() => {
                setFinalizeMode("draft");
                setShowFinalizeFlow(true);
              }}
              disabled={loading || blockingErrors.length > 0}
              className={cn(
                "h-10 rounded-lg border border-[var(--p-color-border)] bg-white px-4 text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-surface-muted)]",
                loading || blockingErrors.length > 0 ? "opacity-70" : "",
              )}
            >
              <span className="flex items-center gap-2">
                Salvar como rascunho
                <ArrowRight size={14} />
              </span>
            </Button>
            <Button
              onClick={() => {
                setFinalizeMode("triagem");
                setShowFinalizeFlow(true);
              }}
              disabled={loading || blockingErrors.length > 0}
              className={cn(
                "h-10 rounded-lg px-5 text-white",
                loading
                  ? "bg-[var(--p-color-brand-400)]"
                  : blockingErrors.length > 0
                    ? "cursor-not-allowed bg-[var(--p-color-fg-subtle)]"
                    : "attention-pulse-soft bg-[var(--p-color-brand-500)] hover:bg-[var(--p-color-brand-600)]",
              )}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <CircleNotch size={14} className="animate-spin" />
                  Processando
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Finalizar e enviar à chefia
                  <ArrowRight size={14} />
                </span>
              )}
            </Button>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--p-color-brand-600)]/35 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 8 }}
              className="w-full max-w-sm rounded-3xl border border-white/40 bg-white p-5 text-center shadow-2xl"
            >
              <CircleNotch size={28} className="mx-auto animate-spin text-[var(--p-color-brand-500)]" />
              <h3 className="mt-3 text-lg font-semibold text-[var(--p-color-brand-500)]">
                {finalizationCopy.progressTitle}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--p-color-fg-muted)]">
                {finalizationCopy.progressDescription}{" "}
                Deixe esta tela aberta até terminar.
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Dialog open={showFinalizeFlow} onOpenChange={setShowFinalizeFlow}>
        <DialogContent className="max-h-[90vh] max-w-[560px] overflow-hidden rounded-2xl border border-[var(--p-color-border)] bg-white p-0 text-[var(--p-color-fg-default)]">
          <DialogHeader className="border-b border-[var(--p-color-surface-subtle)] p-5 pr-12">
            <DialogTitle className="text-xl font-semibold text-[var(--p-color-brand-500)]">
              {finalizationCopy.confirmationTitle}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-[var(--p-color-fg-muted)]">
              {finalizationCopy.description} Serão {dfdGroups.length} DFD(s) no modo{" "}
              <b>{GROUPING_OPTIONS.find((option) => option.value === groupingMode)?.title}</b>.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[52vh] space-y-3 overflow-y-auto px-5 pb-5 pt-2 text-sm text-[var(--p-color-fg-muted)]">
            <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
              {dfdGroups.map((group, index) => {
                const local = userUnits.find(
                  (unit) => unit.unit_id === group.formData.unidade_id,
                );
                const analysis = userUnits.find(
                  (unit) => unit.unit_id === group.formData.analysis_unidade_id,
                );
                const routing = getRoutingPreview(group.formData);
                return (
                  <div
                    key={`review-${group.key}-${index}`}
                    className="rounded-xl border border-[var(--p-color-border)] bg-white px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-[var(--p-color-brand-500)]">{group.label}</p>
                      <span className="rounded-full bg-[var(--p-color-surface-subtle)] px-2 py-0.5 type-caption font-bold text-[var(--p-color-brand-500)]">
                        {purposeLabel(group.formData.finalidade)} ·{" "}
                        {contextLabel(group.formData.contexto_academico)}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                      <p>
                        <b>Uso:</b> {local?.nome || "-"}
                      </p>
                      <p>
                        <b>Análise:</b> {analysis?.nome || "-"}
                      </p>
                    </div>
                    {routing ? (
                      <p className="mt-2 text-xs leading-5 text-[var(--p-color-fg-muted)]">
                        {routing.reason}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="font-semibold text-[var(--p-color-brand-500)]">O que acontece depois</p>
            {finalizeMode === "triagem" ? (
              <>
                <p>1. As DFDs são criadas e enviadas para a fila da chefia.</p>
                <p>2. Você acompanha o andamento em <b>Minhas DFDs</b>.</p>
                <p>3. Se houver erro em algum envio, exibimos a mensagem para correção.</p>
              </>
            ) : (
              <>
                <p>1. As DFDs ficam em <b>Minhas DFDs</b> para sua revisão final.</p>
                <p>2. Depois da revisão, você envia para a <b>análise da chefia</b>.</p>
                <p>3. Se houver campo obrigatório faltando, o envio fica bloqueado até ajuste.</p>
              </>
            )}
          </div>

          <DialogFooter className="border-t border-[var(--p-color-surface-subtle)] bg-[var(--p-color-bg-elevated)] p-4">
            <Button
              variant="ghost"
              onClick={() => setShowFinalizeFlow(false)}
              disabled={loading}
              className="h-10 rounded-lg border border-[var(--p-color-border)] px-4 text-[var(--p-color-fg-muted)] hover:bg-[var(--p-color-surface-muted)]"
            >
              Voltar e revisar
            </Button>
            <Button
              onClick={async () => {
                setShowFinalizeFlow(false);
                await handleFinalize(finalizeMode);
              }}
              disabled={loading}
              className="h-10 rounded-lg bg-[var(--p-color-brand-500)] px-5 text-white hover:bg-[var(--p-color-brand-600)]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <CircleNotch size={14} className="animate-spin" />
                  Processando
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {finalizationCopy.confirmLabel}
                  <ArrowRight size={14} />
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GndBudgetPanel({ summary }: { summary: GndDistributionSummary }) {
  if (summary.entries.length === 0 && summary.unknownCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        summary.warnings.length > 0
          ? "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)]"
          : "border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--p-color-brand-500)]">
            Conferência orçamentária
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--p-color-fg-muted)]">
            Use este resumo para evitar mistura de naturezas de despesa e deixar a DFD mais clara.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--p-color-brand-500)]">
          {summary.entries.length} tipo(s)
        </span>
      </div>

      {summary.entries.length > 0 ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {summary.entries.map((entry) => (
            <div
              key={entry.gnd}
              className="rounded-xl border border-[var(--p-color-border)] bg-white px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-[var(--p-color-brand-500)]">{entry.expenseLabel}</p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 type-caption font-bold",
                    gndClassBadgeStyle(entry.expenseClass),
                  )}
                >
                  {entry.expenseLabel}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold text-[var(--p-color-fg-muted)]">
                {entry.elementLabel}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--p-color-fg-muted)]">{entry.guidance}</p>
              <p className="mt-2 text-xs font-semibold text-[var(--p-color-brand-500)]">
                {entry.itemCount} item(ns) · {toCurrency(entry.total)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {summary.warnings.length > 0 ? (
        <div className="mt-3 space-y-2">
          {summary.warnings.map((warning) => (
            <p
              key={warning}
              className="rounded-xl border border-[var(--p-color-warning-border)] bg-white px-3 py-2 text-xs leading-5 text-[var(--p-color-warning)]"
            >
              {warning}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GndPill({ classification }: { classification: ReturnType<typeof classifyGnd> }) {
  if (!classification) {
    return (
      <span className="rounded-full border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] px-2 py-1 text-xs font-bold text-[var(--p-color-warning)]">
        Tipo de despesa não identificado
      </span>
    );
  }

  return (
    <>
      <span
        className={cn(
          "rounded-full px-2 py-1 text-xs font-bold",
          gndClassBadgeStyle(classification.expenseClass),
        )}
      >
        {classification.expenseLabel}
      </span>
      <span className="rounded-full bg-[var(--p-color-surface-muted)] px-2 py-1 text-xs font-bold text-[var(--p-color-fg-muted)]">
        {classification.elementLabel}
      </span>
    </>
  );
}

function gndClassBadgeStyle(expenseClass: string) {
  if (expenseClass === "investimento") return "bg-[var(--p-color-surface-subtle)] text-[var(--p-color-brand-500)]";
  if (expenseClass === "custeio") return "bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]";
  return "bg-[var(--p-color-surface-muted)] text-[var(--p-color-fg-muted)]";
}

function purposeTone(value: DfdPurpose) {
  if (value === "ensino") {
    return {
      activeCard:
        "border-[var(--p-color-action)] bg-[var(--p-color-info-bg)] shadow-sm",
      idleCard: "border-[var(--p-color-border)] bg-white hover:border-[var(--p-color-info-border)] hover:bg-[var(--p-color-info-bg)]",
      iconActive: "bg-[var(--p-color-info-bg)] text-[var(--p-color-action)]",
      iconIdle: "bg-[var(--p-color-info-bg)] text-[var(--p-color-action)]",
      selectedTag: "bg-[var(--p-color-info-bg)] text-[var(--p-color-action)]",
    };
  }
  if (value === "pesquisa") {
    return {
      activeCard:
        "border-[var(--p-color-collab)] bg-[var(--p-color-collab-bg)] shadow-sm",
      idleCard: "border-[var(--p-color-border)] bg-white hover:border-[var(--p-color-collab-border)] hover:bg-[var(--p-color-collab-bg)]",
      iconActive: "bg-[var(--p-color-collab-bg)] text-[var(--p-color-collab)]",
      iconIdle: "bg-[var(--p-color-collab-bg)] text-[var(--p-color-collab)]",
      selectedTag: "bg-[var(--p-color-collab-bg)] text-[var(--p-color-collab)]",
    };
  }
  if (value === "extensao") {
    return {
      activeCard:
        "border-[var(--p-color-insight)] bg-[var(--p-color-insight-bg)] shadow-sm",
      idleCard: "border-[var(--p-color-border)] bg-white hover:border-[var(--p-color-insight-border)] hover:bg-[var(--p-color-insight-bg)]",
      iconActive: "bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]",
      iconIdle: "bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]",
      selectedTag: "bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]",
    };
  }
  return {
    activeCard:
      "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] shadow-sm",
    idleCard: "border-[var(--p-color-border)] bg-white hover:border-[var(--p-color-warning-border)] hover:bg-[var(--p-color-warning-bg)]",
    iconActive: "bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]",
    iconIdle: "bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]",
    selectedTag: "bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]",
  };
}

function contextTone(value: AcademicContext) {
  if (value === "disciplina") {
    return {
      activeCard: "border-[var(--p-color-action)] bg-[var(--p-color-info-bg)]",
      idleCard: "border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] hover:border-[var(--p-color-info-border)] hover:bg-[var(--p-color-info-bg)]",
      badge: "bg-[var(--p-color-info-bg)] text-[var(--p-color-action)]",
    };
  }
  if (value === "laboratorio_sem_disciplina") {
    return {
      activeCard: "border-[var(--p-color-collab)] bg-[var(--p-color-collab-bg)]",
      idleCard: "border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] hover:border-[var(--p-color-collab-border)] hover:bg-[var(--p-color-collab-bg)]",
      badge: "bg-[var(--p-color-collab-bg)] text-[var(--p-color-collab)]",
    };
  }
  if (value === "projeto") {
    return {
      activeCard: "border-[var(--p-color-insight)] bg-[var(--p-color-insight-bg)]",
      idleCard: "border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] hover:border-[var(--p-color-insight-border)] hover:bg-[var(--p-color-insight-bg)]",
      badge: "bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]",
    };
  }
  if (value === "rotina_administrativa") {
    return {
      activeCard: "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)]",
      idleCard: "border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] hover:border-[var(--p-color-warning-border)] hover:bg-[var(--p-color-warning-bg)]",
      badge: "bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]",
    };
  }
  return {
    activeCard: "border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)]",
    idleCard: "border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] hover:border-[var(--p-color-info-border)] hover:bg-[var(--p-color-info-bg)]",
    badge: "bg-[var(--p-color-info-bg)] text-[var(--p-color-info)]",
  };
}

function VisualOptionGroup({
  title,
  description,
  options,
  value,
  onChange,
}: {
  title: string;
  description: string;
  options: typeof PURPOSE_OPTIONS;
  value: DfdPurpose | "";
  onChange: (value: DfdPurpose) => void;
}) {
  const selectedTone = value ? purposeTone(value) : null;
  return (
    <div className="rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-[var(--p-color-brand-500)]">{title}</p>
          <p className="text-xs leading-5 text-[var(--p-color-fg-muted)]">{description}</p>
        </div>
        {value ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold",
              selectedTone?.selectedTag,
            )}
          >
            <CheckCircle size={14} />
            {purposeLabel(value)}
          </span>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {options.map((option) => {
          const Icon = option.icon;
          const active = value === option.value;
          const tone = purposeTone(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "min-h-[112px] rounded-xl border p-3 text-left transition",
                active ? tone.activeCard : tone.idleCard,
              )}
            >
              <span
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-lg",
                  active ? tone.iconActive : tone.iconIdle,
                )}
              >
                <Icon size={18} weight="bold" />
              </span>
              <p className="mt-2 text-sm font-bold text-[var(--p-color-brand-500)]">{option.title}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--p-color-fg-muted)]">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ContextOptionGroup({
  value,
  onChange,
}: {
  value: AcademicContext | "";
  onChange: (value: AcademicContext) => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--p-color-border)] bg-white p-3">
      <div className="flex items-center gap-2">
        <Target size={16} className="text-[var(--p-color-brand-500)]" />
        <div>
          <p className="text-sm font-bold text-[var(--p-color-brand-500)]">Contexto de uso</p>
          <p className="text-xs leading-5 text-[var(--p-color-fg-muted)]">
            Esta escolha define se a demanda vai para departamento ou laboratório.
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {CONTEXT_OPTIONS.map((option) => {
          const active = value === option.value;
          const tone = contextTone(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "min-h-[92px] rounded-xl border px-3 py-2 text-left transition",
                active ? tone.activeCard : tone.idleCard,
              )}
            >
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 type-caption font-semibold",
                  tone.badge,
                )}
              >
                {option.title}
              </span>
              <p className="mt-1 text-xs leading-5 text-[var(--p-color-fg-muted)]">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoutingPreview({
  routing,
  selectedUnitName,
  selectedUnitType,
  selectedAnalysisName,
  selectedAnalysisType,
  recommendedName,
  mismatch,
  onApply,
}: {
  routing: ReturnType<typeof resolveDfdRouting> | null;
  selectedUnitName: string | null;
  selectedUnitType?: UnitType;
  selectedAnalysisName: string | null;
  selectedAnalysisType?: UnitType;
  recommendedName: string | null;
  mismatch: boolean;
  onApply: () => void;
}) {
  if (!routing) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--p-color-info-border)] bg-[var(--p-color-surface-soft)] px-4 py-3 text-sm text-[var(--p-color-fg-muted)]">
        Selecione finalidade, contexto e local de uso para visualizar o encaminhamento.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        routing.requiresAttention || mismatch
          ? "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)]"
          : "border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--p-color-brand-500)]">Encaminhamento sugerido</p>
          <p className="mt-1 text-xs leading-5 text-[var(--p-color-fg-muted)]">{routing.reason}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-white px-3 py-1 text-[var(--p-color-brand-500)]">
            Uso: {selectedUnitName || "-"} · {unitTypeLabel(selectedUnitType)}
          </span>
          <ArrowRight size={14} className="text-[var(--p-color-fg-subtle)]" />
          <span className="rounded-full bg-white px-3 py-1 text-[var(--p-color-brand-500)]">
            Análise: {selectedAnalysisName || recommendedName || "-"} ·{" "}
            {unitTypeLabel(selectedAnalysisType || routing.analysisUnitType)}
          </span>
        </div>
      </div>
      {mismatch ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--p-color-warning-border)] bg-white px-3 py-2 text-xs text-[var(--p-color-warning)]">
          <span>
            A unidade selecionada não segue a recomendação. Preferência:{" "}
            {unitTypeLabel(routing.analysisUnitType)}
            {recommendedName ? ` - ${recommendedName}` : ""}.
          </span>
          <button
            type="button"
            onClick={onApply}
            className="rounded-lg bg-[var(--p-color-brand-500)] px-3 py-1.5 font-bold text-white hover:bg-[var(--p-color-brand-600)]"
          >
            Aplicar recomendação
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  className,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="m3-label">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass = "m3-input";
const selectClass = "m3-select";

const textareaClass = "m3-textarea min-h-[128px] resize-y whitespace-pre-wrap";

function toCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
