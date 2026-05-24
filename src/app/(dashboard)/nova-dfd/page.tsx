"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  Calendar,
  Briefcase,
  CheckCircle,
  CircleNotch,
  Flask,
  GraduationCap,
  Handshake,
  Info,
  SquaresFour,
  StackSimple,
  Target,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
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

type UnitType = "departamento" | "laboratorio";
type GroupingMode = "grupo" | "classe" | "livre" | "coletiva";

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
    description: "Recomendado para gerar DFDs por família ampla do e-Fisco.",
    recommended: true,
  },
  {
    value: "classe",
    title: "Unir por classe",
    description: "Mais granular, útil quando um grupo reúne necessidades distintas.",
  },
  {
    value: "livre",
    title: "Deixar livre",
    description: "Mantém o carrinho junto, mas separa custeio e capital automaticamente.",
  },
  {
    value: "coletiva",
    title: "Coletiva por setor",
    description: "Soma itens comuns da mesma unidade e guarda quantidades por usuário.",
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
  const { items, clearCarrinho, removeItem } = useCarrinhoStore();
  const [dfdGroups, setDfdGroups] = useState<DFDGroup[]>([]);
  const [userUnits, setUserUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFinalizeFlow, setShowFinalizeFlow] = useState(false);
  const [groupingMode, setGroupingMode] = useState<GroupingMode>("grupo");
  const [showGuide, setShowGuide] = useState(true);

  // Autosave do wizard (migration 0042 + dfdDraftActions).
  // Salva groupingMode + formData de cada grupo (não os itens, que já vivem
  // no Zustand carrinho persistente). Restaura ao montar; limpa após finalize.
  const draft = useDfdDraft();
  const draftRestoredRef = React.useRef(false);

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
      showGuide?: boolean;
    };
    if (payload.groupingMode) setGroupingMode(payload.groupingMode);
    if (typeof payload.showGuide === "boolean") setShowGuide(payload.showGuide);
    // groupForms é aplicado no effect que reconstrói dfdGroups (logo abaixo),
    // através de uma ref consultada lá.
    pendingFormRestoreRef.current = payload.groupForms || null;
    draftRestoredRef.current = true;
  }, [draft.loading, draft.draft]);

  const pendingFormRestoreRef = React.useRef<
    Record<string, DFDGroup["formData"]> | null
  >(null);

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

    const restoreMap = pendingFormRestoreRef.current;
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
    if (restoreMap) pendingFormRestoreRef.current = null;
  }, [items, groupingMode]);

  // Autosave: a cada mudança de dfdGroups/groupingMode/showGuide, agenda save.
  // O hook tem debounce 1500ms + dedup por hash; chamar sempre é seguro.
  useEffect(() => {
    if (draft.loading || !draftRestoredRef.current) return;
    if (dfdGroups.length === 0 && items.length === 0) return;
    const groupForms: Record<string, DFDGroup["formData"]> = {};
    dfdGroups.forEach((g) => {
      groupForms[g.key] = g.formData;
    });
    draft.save(
      {
        groupingMode,
        groupForms,
        showGuide,
        savedAt: new Date().toISOString(),
      },
      groupingMode,
    );
  }, [dfdGroups, groupingMode, showGuide, items.length, draft]);

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
          "DFD coletiva: todos os itens devem usar o mesmo setor/laboratorio.",
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
        errors.push(`${label}: título do objeto é obrigatório.`);
      }
      if (!group.formData.unidade_id) {
        errors.push(`${label}: local de uso é obrigatório.`);
      }
      if (!group.formData.analysis_unidade_id) {
        errors.push(`${label}: responsável pela análise é obrigatório.`);
      }
      if (!group.formData.finalidade) {
        errors.push(`${label}: finalidade da demanda é obrigatória.`);
      }
      if (!group.formData.contexto_academico) {
        errors.push(`${label}: contexto de uso é obrigatório.`);
      }
      if (!String(group.formData.justificativa_contratacao || "").trim()) {
        errors.push(`${label}: justificativa da necessidade é obrigatória.`);
      }
      if (!String(group.formData.justificativa_quantidade || "").trim()) {
        errors.push(`${label}: base de cálculo é obrigatória.`);
      }
      if (!String(group.formData.previsao_data || "").trim()) {
        errors.push(
          `${label}: previsão de recebimento é obrigatória (a partir de ${formatIsoDateToPtBr(NEXT_YEAR_MIN_DATE)}).`,
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
          errors.push(`${itemLabel}: quantidade deve ser maior que zero.`);
        }
        if (!unit) errors.push(`${itemLabel}: unidade é obrigatória.`);
        if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
          errors.push(`${itemLabel}: valor unitário deve ser maior que zero.`);
        }
        if (!gnd) errors.push(`${itemLabel}: GND não informado.`);
        if (!link) errors.push(`${itemLabel}: link de referência é obrigatório.`);
        if (link && !isValidReferenceLink(link)) {
          errors.push(`${itemLabel}: informe um link válido (http/https).`);
        }
        if (just.length < MIN_ITEM_JUSTIFICATIVA_CHARS) {
          errors.push(
            `${itemLabel}: justificativa técnica com mínimo de ${MIN_ITEM_JUSTIFICATIVA_CHARS} caracteres.`,
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

  const handleFinalize = async () => {
    if (blockingErrors.length > 0) {
      toast.error(
        `Preencha os campos obrigatórios antes de finalizar (${blockingErrors.length} pendência(s)). Ex.: ${blockingErrors[0]}`,
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
          justificativa_contratacao: group.formData.justificativa_contratacao,
          justificativa_quantidade: group.formData.justificativa_quantidade,
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
          /analysis_unidade_id|analysis_tipo_unidade|analysis_routing_reason/i.test(
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
        const contributionKeys = Array.from(
          new Set(contributionRows.map((row) => row.collective_key)),
        );

        if (contributionRows.length === 0) {
          throw new Error("Nenhum item encontrado para a DFD coletiva.");
        }

        await supabase
          .from("dfd_collective_contributions")
          .delete()
          .eq("user_id", user.id)
          .eq("unit_id", selectedUnit.unit_id)
          .eq("unit_type", selectedUnit.unit_type)
          .eq("status", "aberta")
          .in("collective_key", contributionKeys);

        const { error: contributionError } = await supabase
          .from("dfd_collective_contributions")
          .insert(contributionRows);
        if (contributionError) throw contributionError;

        const { data: openRows, error: openRowsError } = await supabase
          .from("dfd_collective_contributions")
          .select("*")
          .eq("unit_id", selectedUnit.unit_id)
          .eq("unit_type", selectedUnit.unit_type)
          .eq("status", "aberta");
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

          const itemsToInsert = collectiveItems.map((item) => ({
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
            gnd: String(item.gnd || item.gnd_derivado || "3.3.90.30"),
            gnd_derivado: String(item.gnd_derivado || item.gnd || "") || null,
            tipo_objeto: item.tipo_objeto || null,
            codigo_grupo: item.codigo_grupo || null,
            nome_grupo: item.nome_grupo || null,
            codigo_classe: item.codigo_classe || null,
            nome_classe: item.nome_classe || null,
            codigo_material_servico: null,
            nome_material_servico: null,
            codigo_natureza_despesa: item.codigo_natureza_despesa || null,
          }));

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

          const idsToClose = rows.map((row) => row.id).filter(Boolean);
          if (idsToClose.length > 0) {
            const { error: closeError } = await supabase
              .from("dfd_collective_contributions")
              .update({ status: "consolidada", consolidated_dfd_id: dfd.id })
              .in("id", idsToClose);
            if (closeError) throw closeError;
          }
          createdCount += 1;
        }

        toast.success(`${createdCount} DFD(s) coletiva(s) criada(s) com sucesso.`);
        clearCarrinho();
        // Apaga rascunho — DFDs já existem no banco; nada a recuperar.
        await draft.clear();
        router.push("/minhas-dfds");
        return;
      }

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
            justificativa_contratacao: group.formData.justificativa_contratacao,
            justificativa_quantidade: group.formData.justificativa_quantidade,
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
          /analysis_unidade_id|analysis_tipo_unidade|analysis_routing_reason/i.test(
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

        const itemsToInsert = group.items.map((item) => ({
          dfd_id: dfd.id,
          codigo_tce: String(item.item_efisco?.codigo_tce || "").trim(),
          codigo_item_efisco: String(item.item_efisco?.codigo_tce || "").trim(),
          descricao: String(item.item_efisco?.descricao || "").trim(),
          quantidade: Number(item.quantidade || 0),
          valor_unitario_estimado: Number(item.valor_unitario || 0),
          justificativa_item: String(item.justificativa_item || ""),
          local_uso: selectedUnit.nome || null,
          link_referencia: String(item.link_referencia || ""),
          gnd: String(item.item_efisco?.gnd || "3.3.90.30"),
          gnd_derivado: String(
            item.item_efisco?.gnd_derivado || item.item_efisco?.gnd || "",
          ) || null,
          tipo_objeto: item.item_efisco?.tipo_objeto || null,
          codigo_grupo: item.item_efisco?.codigo_grupo || null,
          nome_grupo: item.item_efisco?.nome_grupo || null,
          codigo_classe: item.item_efisco?.codigo_classe || null,
          nome_classe: item.item_efisco?.nome_classe || null,
          codigo_material_servico:
            item.item_efisco?.codigo_material_servico || null,
          nome_material_servico: item.item_efisco?.nome_material_servico || null,
          codigo_natureza_despesa:
            item.item_efisco?.codigo_natureza_despesa || null,
        }));

        const { error: itemsError } = await supabase
          .from("dfd_items")
          .insert(itemsToInsert);
        if (itemsError) {
          await supabase.from("dfds").delete().eq("id", dfd.id);
          throw itemsError;
        }
      }

      toast.success(`${dfdGroups.length} DFD(s) criada(s) com sucesso.`);
      clearCarrinho();
      await draft.clear();
      router.push("/minhas-dfds");
    } catch (error: any) {
      toast.error(`Erro ao finalizar DFDs: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex min-h-[72vh] flex-col items-center justify-center gap-5 px-6">
        <img
          src="/guidance/empty-cart.png"
          alt=""
          className="aspect-[16/9] w-full max-w-[420px] object-contain"
        />
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-[#164073]">Carrinho vazio</h2>
          <p className="text-sm text-[#5B6675]">
            Selecione itens no catálogo para iniciar a elaboração das DFDs.
          </p>
        </div>
        <Button
          onClick={() => router.push("/catalogo")}
          className="h-10 rounded-xl bg-[#164073] px-6 text-white hover:bg-[#0F2E57]"
        >
          Abrir catálogo
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-6 px-4 pb-36 pt-6 md:px-6">
      <section className="rounded-[28px] border border-[#D9E0E8] bg-white p-6 shadow-[0_10px_24px_rgba(15,46,87,0.06)] md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-[#164073]">
              Solicitação guiada
            </span>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#0F2E57] md:text-5xl">
              Vamos organizar sua demanda
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-[#3E4C5F]">
              O sistema separa o carrinho em etapas para que você consiga montar os rascunhos de DFD
              com mais clareza, justificativas melhores e menos sensação de preenchimento solto.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Itens" value={String(items.length)} />
            <Stat label="DFDs" value={String(dfdGroups.length)} />
            <Stat label="GNDs" value={String(globalGndSummary.entries.length)} />
            <Stat label="Total" value={toCurrency(totalGeral)} />
          </div>
        </div>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden rounded-[24px] border border-[#C7D7EA] bg-[#F7FBFF] shadow-[0_10px_24px_rgba(15,46,87,0.05)]"
      >
        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#164073] text-white">
              <Info size={18} weight="bold" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#164073]">
                Você não precisa lembrar tudo de uma vez
              </h2>
              <p className="mt-1 max-w-4xl text-sm leading-6 text-[#52627A]">
                Complete os dados essenciais, finalize os rascunhos e, depois, envie cada DFD para a chefia
                em Minhas DFDs. O sistema usa este fluxo para ajudar você a construir a solicitação com mais segurança.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowGuide((value) => !value)}
            className="h-9 rounded-xl border border-[#C7D7EA] bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#164073] hover:bg-[#EAF2FF]"
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
              className="border-t border-[#D9E0E8]"
            >
              <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-5">
                <div className="grid gap-2 md:grid-cols-4">
                  {DFD_PROCESS_STEPS.map((step, index) => (
                    <div key={step.id} className="rounded-2xl border border-[#D9E0E8] bg-white p-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E8EDF2] text-xs font-bold text-[#164073]">
                          {index + 1}
                        </span>
                        <p className="text-sm font-semibold text-[#164073]">{step.label}</p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#5B6675]">{step.description}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-[#D9E0E8] bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#164073]">
                    Checklist antes de finalizar
                  </p>
                  <div className="mt-3 space-y-2">
                    {processChecklist.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-start gap-2 text-xs">
                        {item.state === "done" ? (
                          <CheckCircle size={15} weight="fill" className="mt-0.5 shrink-0 text-emerald-600" />
                        ) : (
                          <WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0 text-amber-600" />
                        )}
                        <div>
                          <p className="font-semibold text-[#2E3A4A]">{item.label}</p>
                          <p className="text-[#66758A]">{item.helper}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.section>

      <section className="rounded-[28px] border border-[#D9E0E8] bg-white p-5 shadow-[0_10px_24px_rgba(15,46,87,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-[#164073]">
              <StackSimple size={16} />
              Organização do carrinho
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-[#0F2E57]">
              Como deseja gerar as DFDs?
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#5B6675]">
              Nossa recomendação é unir por grupo e-Fisco. Isso cria uma DFD por família ampla
              de necessidade e mantém as classes como seções internas de análise. Custeio e
              capital são sempre separados. Para demandas compartilhadas, use a opção coletiva
              por setor.
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
                      ? "border-[#164073] bg-[#E8EDF2] shadow-[0_8px_18px_rgba(15,46,87,0.10)]"
                      : "border-[#D9E0E8] bg-[#FAFBFC] hover:bg-[#F4F7FA]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-[#164073]">
                      <SquaresFour size={16} />
                      {option.title}
                    </span>
                    {option.recommended ? (
                      <span className="rounded-full bg-[#164073] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                        Recomendado
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#5B6675]">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
        {globalGndSummary.hasMixedExpenseClasses ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D9E0E8] bg-[#F8FAFC] px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-[#164073]">
              <SquaresFour size={18} />
              <span className="font-semibold">
                Separação automática por natureza da despesa
              </span>
            </div>
            <span className="text-xs font-semibold text-[#3E4C5F]">
              O carrinho tem custeio e capital; as DFDs foram divididas para não misturar.
            </span>
          </div>
        ) : null}
        {groupingMode === "coletiva" ? (
            <div className="mt-4 rounded-2xl border border-[#D9E0E8] bg-[#F8FAFC] px-4 py-3 text-sm text-[#3E4C5F]">
              <p className="font-semibold text-[#164073]">
                Modo coletivo ativo
              </p>
              <p className="mt-1 text-xs leading-5">
                Ao finalizar, seus itens entram no rascunho coletivo da unidade selecionada e
                o sistema preserva a distribuicao por usuario para que a colaboracao continue legivel.
              </p>
            </div>
          ) : null}
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-24">
          <div className="rounded-[28px] border border-[#A7B1BD]/25 bg-white/90 p-5 shadow-[0_10px_28px_rgba(15,46,87,0.05)]">
            <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-[#164073]">
              Resumo
            </h3>
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex items-center justify-between text-[#3E4C5F]">
                <span>Itens mapeados</span>
                <b className="text-[#164073]">{items.length}</b>
              </p>
              <p className="flex items-center justify-between text-[#3E4C5F]">
                <span>DFDs previstas</span>
                <b className="text-[#164073]">{dfdGroups.length}</b>
              </p>
              <p className="flex items-center justify-between text-[#3E4C5F]">
                <span>Total estimado</span>
                <b className="text-[#164073]">{toCurrency(totalGeral)}</b>
              </p>
            </div>
            {blockingErrors.length > 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {blockingErrors.length} pendência(s) obrigatória(s)
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Validação parcial concluída
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-[#A7B1BD]/25 bg-white/90 p-5 shadow-[0_10px_28px_rgba(15,46,87,0.05)]">
            <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-[#164073]">
              Mapa GND
            </h3>
            <div className="mt-3 space-y-2">
              {globalGndSummary.entries.slice(0, 4).map((entry) => (
                <div
                  key={`global-gnd-${entry.gnd}`}
                  className="rounded-xl border border-[#D9E0E8] bg-[#F8FAFC] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[#164073]">{entry.gnd}</span>
                    <span className="font-semibold text-[#5B6675]">
                      {entry.itemCount} item(ns)
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#5B6675]">
                    {entry.expenseLabel} · {entry.elementLabel}
                  </p>
                </div>
              ))}
              {globalGndSummary.entries.length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Nenhum GND identificado no carrinho.
                </p>
              ) : null}
            </div>
            {globalGndSummary.hasMixedExpenseClasses ? (
              <p className="mt-3 rounded-xl border border-[#D9E0E8] bg-[#F8FAFC] px-3 py-2 text-xs leading-5 text-[#164073]">
                Custeio e capital detectados no carrinho. A tela separa automaticamente as
                DFDs por natureza.
              </p>
            ) : globalGndSummary.warnings.length > 0 ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                {globalGndSummary.warnings[0]}
              </p>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-[#A7B1BD]/25 bg-white/90 p-5 shadow-[0_10px_28px_rgba(15,46,87,0.05)]">
            <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-[#164073]">
              Navegação
            </h3>
            <div className="mt-3 grid gap-2">
              {dfdGroups.map((group, index) => (
                <a
                  key={`${group.key}-nav-${index}`}
                  href={`#grupo-${index + 1}`}
                  className="rounded-xl border border-[#D9E0E8] bg-[#F4F7FA] px-3 py-2 text-sm font-semibold text-[#164073] transition hover:bg-[#E8EDF2]"
                >
                  {group.label}
                </a>
              ))}
            </div>
          </div>
        </aside>

        <section className="grid gap-6">
          {blockingErrors.length > 0 && (
            <section className="rounded-[28px] border border-amber-200 bg-amber-50/70 px-4 py-3">
              <div className="flex items-start gap-2">
                <WarningCircle size={18} className="mt-0.5 text-amber-700" />
                <div className="text-sm text-amber-900">
                  <p className="font-semibold">
                    {blockingErrors.length} pendência(s) obrigatória(s)
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
                className="overflow-hidden rounded-[30px] border border-[#A7B1BD]/25 bg-white/90 shadow-[0_10px_28px_rgba(15,46,87,0.05)]"
              >
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E8EDF2] px-5 py-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#7D98B8]">
                      {groupingModeLabel(group.mode)}
                    </p>
                    <h2 className="text-2xl font-semibold text-[#164073]">{group.label}</h2>
                    <p className="mt-1 text-sm text-[#5B6675]">
                      Configure objeto, local de uso, justificativas e detalhes técnicos dos itens.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-[#C7D7EA] bg-[#E8EDF2] px-3 py-1 text-xs font-bold text-[#164073]">
                    {group.items.length} item(ns) • {toCurrency(groupTotal)}
                  </span>
                </header>

                <div className="space-y-5 p-5">
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                    <Field className="xl:col-span-12" label="Objeto da contratação">
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
                        description="Escolha o eixo institucional antes de definir o encaminhamento."
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
                      className="xl:col-span-4"
                      label="Local de uso"
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
                      className="xl:col-span-4"
                      label="Responsável pela análise"
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
                      <p className="mt-1 text-[11px] text-[#7D98B8]">
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

                    <Field className="xl:col-span-3" label="Previsão de recebimento">
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
                        {!group.formData.previsao_data && (
                          <span className="m3-date-placeholder">dd/mm/aaaa</span>
                        )}
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
                      <p className="mt-1 text-[11px] text-[#7D98B8]">
                        Permitido somente a partir de {formatIsoDateToPtBr(NEXT_YEAR_MIN_DATE)}.
                      </p>
                    </Field>

                    <Field className="xl:col-span-5" label="Motivo do roteamento">
                      <input
                        type="text"
                        value={group.formData.analysis_routing_reason}
                        onChange={(event) =>
                          updateGroupForm(
                            gIdx,
                            "analysis_routing_reason",
                            event.target.value,
                          )
                        }
                        className={inputClass}
                        placeholder="Ex: demanda curricular do curso, uso transversal ou disciplina específica."
                      />
                    </Field>

                    <Field className="xl:col-span-7" label="Justificativa da necessidade">
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
                        placeholder="Descreva a necessidade institucional, finalidade e impacto esperado desta contratação."
                      />
                    </Field>

                    <Field
                      className="xl:col-span-5"
                      label="Base de cálculo (quantidades)"
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
                        placeholder="Informe como o quantitativo foi definido: consumo histórico, demanda projetada, turmas, equipes ou séries anteriores."
                      />
                    </Field>

                    <div className="xl:col-span-12 rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-3 py-2 text-[12px] leading-5 text-[#3E4C5F]">
                      <b className="text-[#164073]">Como preencher:</b> a{" "}
                      <b>justificativa da necessidade (DFD)</b> explica o problema
                      institucional do agrupamento inteiro. A <b>justificativa do item</b>{" "}
                      descreve a aplicação técnica específica de cada item.
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-[#D9E0E8] bg-[#F4F7FA] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#7D98B8]">
                      Itens da DFD
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
                                ? "border-[#D9E0E8]"
                                : "border-[#C9A646]/45 bg-[#FFFDF2]",
                            )}
                          >
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold text-[#7D98B8]">
                                  Código e-Fisco: {item.item_efisco.codigo_tce}
                                </p>
                                <h3 className="text-sm font-semibold text-[#164073]">
                                  {item.item_efisco.descricao}
                                </h3>
                                <p className="text-xs text-[#5B6675]">
                                  Grupo: {item.item_efisco?.nome_grupo || "-"} | Classe:{" "}
                                  {item.item_efisco?.nome_classe || item.item_efisco?.classe || "-"} | GND:{" "}
                                  {item.item_efisco.gnd || "-"}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <GndPill classification={gndInfo} />
                                </div>
                              </div>
                              <button
                                onClick={() => removeItem(item.uid)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
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

                              <Field className="xl:col-span-6" label="Referência técnica (link)">
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

                              <Field className="xl:col-span-12" label="Justificativa do item">
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
                                    !justOk && "border-[#C9A646]/50 bg-[#FFF8E6]",
                                  )}
                                  placeholder="Descreva a aplicação do item, o contexto de uso e o motivo técnico da necessidade."
                                />
                              </Field>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <p
                                className={cn(
                                  "font-semibold",
                                  justOk ? "text-emerald-700" : "text-amber-700",
                                )}
                              >
                                {justOk
                                  ? "Justificativa técnica válida."
                                  : `Mínimo de ${MIN_ITEM_JUSTIFICATIVA_CHARS} caracteres (${justLen}/${MIN_ITEM_JUSTIFICATIVA_CHARS}).`}
                              </p>
                              <p className="font-semibold text-[#164073]">
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
        <div className="mx-auto flex max-w-[1480px] flex-col gap-3 rounded-2xl border border-[#D9E0E8] bg-white/95 p-3 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="text-sm">
            <span className="font-semibold text-[#164073]">
              Total: {toCurrency(totalGeral)}
            </span>
            <span className="ml-2 text-[#5B6675]">
              | {dfdGroups.length} DFD(s) por{" "}
              {groupingMode === "livre"
                ? "modo livre"
                : groupingMode === "coletiva"
                  ? "modo coletivo"
                  : groupingMode}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => router.back()}
              variant="ghost"
              className="h-10 rounded-lg border border-[#D9E0E8] px-4 text-[#3E4C5F] hover:bg-[#F4F7FA]"
            >
              <ArrowLeft size={14} className="mr-1" />
              Voltar
            </Button>
            <Button
              onClick={() => setShowFinalizeFlow(true)}
              disabled={loading || blockingErrors.length > 0}
              className={cn(
                "h-10 rounded-lg px-5 text-white",
                loading
                  ? "bg-[#2D5D94]"
                  : blockingErrors.length > 0
                    ? "cursor-not-allowed bg-[#7D98B8]"
                    : "bg-[#164073] hover:bg-[#0F2E57]",
              )}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <CircleNotch size={14} className="animate-spin" />
                  Processando
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Finalizar rascunhos
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
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0F2E57]/35 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 8 }}
              className="w-full max-w-sm rounded-3xl border border-white/40 bg-white p-5 text-center shadow-2xl"
            >
              <CircleNotch size={28} className="mx-auto animate-spin text-[#164073]" />
              <h3 className="mt-3 text-lg font-semibold text-[#164073]">
                Criando rascunhos de DFD
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#5B6675]">
                Estamos salvando itens, GND, roteamento e distribuição coletiva quando houver.
                Mantenha esta tela aberta até a conclusão.
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Dialog open={showFinalizeFlow} onOpenChange={setShowFinalizeFlow}>
        <DialogContent className="max-w-[560px] rounded-2xl border border-[#D9E0E8] bg-white p-0 text-[#2E3A4A]">
          <DialogHeader className="border-b border-[#E8EDF2] p-5">
            <DialogTitle className="text-xl font-semibold text-[#164073]">
              Confirmar finalização dos rascunhos
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-[#5B6675]">
              Ao continuar, o sistema criará {dfdGroups.length} rascunho(s) usando o modo{" "}
              <b>{GROUPING_OPTIONS.find((option) => option.value === groupingMode)?.title}</b>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-5 pb-5 pt-2 text-sm text-[#3E4C5F]">
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
                    className="rounded-xl border border-[#D9E0E8] bg-white px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-[#164073]">{group.label}</p>
                      <span className="rounded-full bg-[#E8EDF2] px-2 py-0.5 text-[11px] font-bold text-[#164073]">
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
                      <p className="mt-2 text-xs leading-5 text-[#5B6675]">
                        {routing.reason}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="font-semibold text-[#164073]">Fluxo após a finalização</p>
            <p>1. As DFDs serão salvas em <b>Minhas DFDs</b> para conferência final.</p>
            <p>2. Após revisão, elas seguem para a <b>fila da chefia</b> na etapa de triagem/homologação.</p>
            <p>3. Itens com pendência obrigatória bloqueiam avanço até correção.</p>
          </div>

          <DialogFooter className="border-t border-[#E8EDF2] bg-[#FAFBFC] p-4">
            <Button
              variant="ghost"
              onClick={() => setShowFinalizeFlow(false)}
              disabled={loading}
              className="h-10 rounded-lg border border-[#D9E0E8] px-4 text-[#3E4C5F] hover:bg-[#F4F7FA]"
            >
              Revisar dados
            </Button>
            <Button
              onClick={async () => {
                setShowFinalizeFlow(false);
                await handleFinalize();
              }}
              disabled={loading}
              className="h-10 rounded-lg bg-[#164073] px-5 text-white hover:bg-[#0F2E57]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <CircleNotch size={14} className="animate-spin" />
                  Processando
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Confirmar e finalizar
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
          ? "border-amber-200 bg-amber-50"
          : "border-[#D9E0E8] bg-[#F8FAFC]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#164073]">
            Leitura orçamentária por GND
          </p>
          <p className="mt-1 text-xs leading-5 text-[#5B6675]">
            Use esta leitura para evitar DFDs com naturezas incompatíveis e reforçar a
            justificativa.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#164073]">
          {summary.entries.length} GND(s)
        </span>
      </div>

      {summary.entries.length > 0 ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {summary.entries.map((entry) => (
            <div
              key={entry.gnd}
              className="rounded-xl border border-[#D9E0E8] bg-white px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-[#164073]">{entry.gnd}</p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold",
                    gndClassBadgeStyle(entry.expenseClass),
                  )}
                >
                  {entry.expenseLabel}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold text-[#3E4C5F]">
                {entry.elementLabel}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#5B6675]">{entry.guidance}</p>
              <p className="mt-2 text-xs font-semibold text-[#164073]">
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
              className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs leading-5 text-amber-800"
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
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
        GND não identificado
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
      <span className="rounded-full bg-[#F4F7FA] px-2 py-1 text-xs font-bold text-[#3E4C5F]">
        {classification.elementLabel}
      </span>
    </>
  );
}

function gndClassBadgeStyle(expenseClass: string) {
  if (expenseClass === "investimento") return "bg-[#E8EDF2] text-[#164073]";
  if (expenseClass === "custeio") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-600";
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
  return (
    <div className="rounded-2xl border border-[#D9E0E8] bg-[#F8FAFC] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-[#164073]">{title}</p>
          <p className="text-xs leading-5 text-[#5B6675]">{description}</p>
        </div>
        {value ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
            <CheckCircle size={14} />
            {purposeLabel(value)}
          </span>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {options.map((option) => {
          const Icon = option.icon;
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "min-h-[112px] rounded-xl border p-3 text-left transition",
                active
                  ? "border-[#164073] bg-white shadow-[0_8px_18px_rgba(15,46,87,0.10)]"
                  : "border-[#D9E0E8] bg-white/70 hover:bg-white",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-lg",
                  active ? "bg-[#164073] text-white" : "bg-[#E8EDF2] text-[#164073]",
                )}
              >
                <Icon size={18} weight="bold" />
              </span>
              <p className="mt-2 text-sm font-bold text-[#164073]">{option.title}</p>
              <p className="mt-1 text-xs leading-5 text-[#5B6675]">
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
    <div className="rounded-2xl border border-[#D9E0E8] bg-white p-3">
      <div className="flex items-center gap-2">
        <Target size={16} className="text-[#164073]" />
        <div>
          <p className="text-sm font-bold text-[#164073]">Contexto de uso</p>
          <p className="text-xs leading-5 text-[#5B6675]">
            Esta escolha define se a demanda vai para departamento ou laboratório.
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {CONTEXT_OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "min-h-[92px] rounded-xl border px-3 py-2 text-left transition",
                active
                  ? "border-[#164073] bg-[#E8EDF2]"
                  : "border-[#D9E0E8] bg-[#FAFBFC] hover:bg-[#F4F7FA]",
              )}
            >
              <p className="text-sm font-bold text-[#164073]">{option.title}</p>
              <p className="mt-1 text-xs leading-5 text-[#5B6675]">
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
      <div className="rounded-2xl border border-dashed border-[#C7D7EA] bg-[#F8FAFC] px-4 py-3 text-sm text-[#5B6675]">
        Selecione finalidade, contexto e local de uso para visualizar o encaminhamento.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        routing.requiresAttention || mismatch
          ? "border-amber-200 bg-amber-50"
          : "border-emerald-200 bg-emerald-50",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#164073]">Encaminhamento sugerido</p>
          <p className="mt-1 text-xs leading-5 text-[#3E4C5F]">{routing.reason}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-white px-3 py-1 text-[#164073]">
            Uso: {selectedUnitName || "-"} · {unitTypeLabel(selectedUnitType)}
          </span>
          <ArrowRight size={14} className="text-[#7D98B8]" />
          <span className="rounded-full bg-white px-3 py-1 text-[#164073]">
            Análise: {selectedAnalysisName || recommendedName || "-"} ·{" "}
            {unitTypeLabel(selectedAnalysisType || routing.analysisUnitType)}
          </span>
        </div>
      </div>
      {mismatch ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-amber-800">
          <span>
            A unidade selecionada não segue a recomendação. Preferência:{" "}
            {unitTypeLabel(routing.analysisUnitType)}
            {recommendedName ? ` - ${recommendedName}` : ""}.
          </span>
          <button
            type="button"
            onClick={onApply}
            className="rounded-lg bg-[#164073] px-3 py-1.5 font-bold text-white hover:bg-[#0F2E57]"
          >
            Aplicar recomendação
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[110px] rounded-lg border border-[#D9E0E8] bg-[#FAFBFC] px-3 py-2">
      <p className="text-[10px] font-semibold text-[#7D98B8]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#164073]">{value}</p>
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
