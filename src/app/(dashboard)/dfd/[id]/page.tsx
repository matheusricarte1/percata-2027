"use client";
import { correctionHistoryDetails } from "@/lib/dfd-correction-history";

import { dfdTimelineDescription } from "@/lib/dfd-timeline-description";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "@/components/icons/phosphor/exports/ArrowLeft";
import { ArrowRight } from "@/components/icons/phosphor/exports/ArrowRight";
import { Printer } from "@/components/icons/phosphor/exports/Printer";
import { XCircle } from "@/components/icons/phosphor/exports/XCircle";
import { CircleNotch } from "@/components/icons/phosphor/exports/CircleNotch";
import { FileText } from "@/components/icons/phosphor/exports/FileText";
import { Package } from "@/components/icons/phosphor/exports/Package";
import { User } from "@/components/icons/phosphor/exports/User";
import { Clock } from "@/components/icons/phosphor/exports/Clock";
import { Paperclip } from "@/components/icons/phosphor/exports/Paperclip";
import { Buildings } from "@/components/icons/phosphor/exports/Buildings";
import { ShieldCheck } from "@/components/icons/phosphor/exports/ShieldCheck";
import { PaperPlaneTilt } from "@/components/icons/phosphor/exports/PaperPlaneTilt";
import { Trash } from "@/components/icons/phosphor/exports/Trash";
import { CaretRight } from "@/components/icons/phosphor/exports/CaretRight";
import { House } from "@/components/icons/phosphor/exports/House";
import { FileCsv } from "@/components/icons/phosphor/exports/FileCsv";
import { CalendarBlank } from "@/components/icons/phosphor/exports/CalendarBlank";
import { PencilSimpleLine } from "@/components/icons/phosphor/exports/PencilSimpleLine";
import { MapPin } from "@/components/icons/phosphor/exports/MapPin";
import { ListBullets } from "@/components/icons/phosphor/exports/ListBullets";
import { useRouter, useParams } from "next/navigation";
import { getSafeUser, supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { normalizeRole, type UserRole } from "@/lib/access";
import { canSendDfdToChefia } from "@/lib/dfd-send-permissions";
import { buildDfdPrintExportCsv } from "@/lib/dfd-print-export";
import {
  formatCollectiveDistributionText,
  formatCollectiveJustificationText,
  parseCollectiveDistributionText,
} from "@/lib/collective-dfd";
import { DfdSubmissionAnimation } from "@/components/feedback/DfdSubmissionAnimation";
import { useReducedMotion, motionProps } from "@/lib/use-reduced-motion";
import { CategoryAvatar } from "@/components/user/CategoryAvatar";
import { AvatarStack } from "@/components/user/AvatarStack";
import {
  DFD_PLANNING_FIELD_LABELS,
  DFD_PLANNING_FIELD_ORDER,
  hasPlanningSubsidies,
  type DfdPlanningSubsidies,
} from "@/lib/dfd-planning";
import { DFD_PROCESS_STEPS, getDfdProcessStage } from "@/lib/dfd-process-guide";
import {
  OperationalChip,
  OperationalEmptyState,
  OperationalStepper,
  OperationalTimeline,
  SkeuoDocumentCard,
} from "@/components/ui/operational";
import { MechanicalValue } from "@/components/ui/MechanicalValue";
import { useSubmissionPolicy } from "@/lib/use-submission-policy";
import { formatBahiaDate } from "@/lib/submission-policy";
import { DfdCorrectionEditor } from "@/components/dfd/DfdCorrectionEditor";

type DfdStatus = "rascunho" | "triagem" | "aprovada" | "devolvida" | "pactuando" | "concluida";

type DfdDetails = {
  id: string;
  status: DfdStatus;
  created_at: string;
  numero_protocolo?: string | null;
  origin_type?: "individual" | "collective" | null;
  collective_origin_room_id?: string | null;
  collective_origin_room_title?: string | null;
  collective_origin_expense_class?: string | null;
  campus?: string | null;
  campus_id?: string | null;
  unidade_nome?: string | null;
  analysis_unidade_nome?: string | null;
  solicitante_id?: string | null;
  objeto_contratacao?: string | null;
  justificativa_contratacao?: string | null;
  justificativa_quantidade?: string | null;
  valor_total_estimado?: number | null;
  planning_subsidies?: DfdPlanningSubsidies | null;
  exercicio?: number | null;
  analysis_unidade_id?: string | null;
  analysis_tipo_unidade?: "departamento" | "laboratorio" | null;
  analysis_routing_reason?: string | null;
  analysis_responsavel_nome?: string | null;
  analysis_responsavel_avatar_url?: string | null;
  profiles?: { full_name?: string | null; email?: string | null; avatar_url?: string | null } | null;
  campi?: { nome?: string | null; sigla?: string | null } | null;
};

type CollectiveAuthorSummary = {
  contribution_user_id: string;
  author_name_snapshot?: string | null;
  author_email_snapshot?: string | null;
  author_avatar_url?: string | null;
  item_count?: number | null;
  quantidade_total?: number | null;
  valor_total_estimado?: number | null;
};

type DfdItem = {
  id: string;
  descricao?: string | null;
  codigo_tce?: string | null;
  quantidade?: number | null;
  valor_unitario_estimado?: number | null;
  justificativa_item?: string | null;
  local_uso?: string | null;
  link_referencia?: string | null;
  unidade_medida?: string | null;
  gnd?: string | null;
  gnd_derivado?: string | null;
  codigo_natureza_despesa?: string | null;
};

type AnalysisUnitOption = {
  id: string;
  nome: string;
  type: "departamento" | "laboratorio";
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getExpenseTypeLabel(item: Pick<DfdItem, "gnd" | "gnd_derivado" | "codigo_natureza_despesa">) {
  const digits = String(item.gnd || item.gnd_derivado || item.codigo_natureza_despesa || "").replace(/\D/g, "");
  if (digits.startsWith("3")) return "Corrente";
  if (digits.startsWith("4")) return "Capital";
  return "Não informado";
}

const STATUS_META: Record<DfdStatus, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-[var(--p-color-surface-subtle)] text-[var(--p-color-fg-muted)]" },
  triagem: { label: "Em análise", className: "bg-[var(--p-color-info-border)] text-[var(--p-color-collab)]" },
  aprovada: { label: "Homologada", className: "bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]" },
  devolvida: { label: "Devolvida", className: "bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]" },
  pactuando: { label: "Pactuação", className: "bg-[var(--p-color-surface-subtle)] text-[var(--p-color-brand-400)]" },
  concluida: { label: "Concluída", className: "bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]" },
};

export default function DfdDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const reducedMotion = useReducedMotion();

  const [dfd, setDfd] = useState<DfdDetails | null>(null);
  const submissionPolicy = useSubmissionPolicy(id);
  const [correctionEditorOpen, setCorrectionEditorOpen] = useState(false);
  const [items, setItems] = useState<DfdItem[]>([]);
  const [collectiveAuthors, setCollectiveAuthors] = useState<CollectiveAuthorSummary[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>("solicitante");
  const [currentCampusId, setCurrentCampusId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [markingKit, setMarkingKit] = useState(false);
  const [sendingToChefia, setSendingToChefia] = useState(false);
  const [resubmissionJustification, setResubmissionJustification] = useState("");
  const [submissionAnimationOpen, setSubmissionAnimationOpen] = useState(false);
  const [deletingDfd, setDeletingDfd] = useState(false);
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [reassignmentOpen, setReassignmentOpen] = useState(false);
  const [reassignmentLoading, setReassignmentLoading] = useState(false);
  const [reassigningChefia, setReassigningChefia] = useState(false);
  const [analysisUnitOptions, setAnalysisUnitOptions] = useState<AnalysisUnitOption[]>([]);
  const [selectedAnalysisUnitKey, setSelectedAnalysisUnitKey] = useState("");

  const handleBackNavigation = useCallback(() => {
    if (typeof window !== "undefined") {
      const hasHistory = window.history.length > 1;
      const hasSameOriginReferrer = (() => {
        try {
          return Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
        } catch {
          return false;
        }
      })();

      if (hasHistory && hasSameOriginReferrer) {
        router.back();
        return;
      }
    }
    router.push("/minhas-dfds");
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: dfdData, error: dfdError } = await supabase
        .from("dfds")
        .select("*")
        .eq("id", id)
        .single();

      if (dfdError?.code === "PGRST116") { setDfd(null); return; }
      if (dfdError) throw dfdError;

      const currentUser = await getSafeUser();
      setCurrentUserId(currentUser?.id || null);
      const analysisUnitId = dfdData?.analysis_unidade_id || dfdData?.unidade_id || null;
      const analysisUnitType = dfdData?.analysis_tipo_unidade || dfdData?.tipo_unidade || null;
      const [profileResult, campusResult, deptResult, labResult, analysisUnitResult, currentProfileResult] = await Promise.all([
        dfdData?.solicitante_id
          ? supabase
              .from("profiles")
              .select("full_name,email,avatar_url")
              .eq("id", dfdData.solicitante_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        dfdData?.campus_id
          ? supabase.from("campi").select("nome,sigla").eq("id", dfdData.campus_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        dfdData?.unidade_id
          ? supabase.from("departamentos").select("nome").eq("id", dfdData.unidade_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        dfdData?.unidade_id
          ? supabase.from("laboratorios").select("nome").eq("id", dfdData.unidade_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        analysisUnitId && analysisUnitType
          ? supabase
              .from(analysisUnitType === "departamento" ? "departamentos" : "laboratorios")
              .select("nome")
              .eq("id", analysisUnitId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        currentUser?.id
          ? supabase.from("profiles").select("role,campus_id").eq("id", currentUser.id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (campusResult.error) throw campusResult.error;
      if (deptResult.error) throw deptResult.error;
      if (labResult.error) throw labResult.error;
      if (analysisUnitResult.error) throw analysisUnitResult.error;
      if (currentProfileResult.error) throw currentProfileResult.error;

      setCurrentRole(normalizeRole(currentProfileResult.data?.role, currentUser?.email));
      setCurrentCampusId(currentProfileResult.data?.campus_id || null);

      const unidadeNome =
        deptResult.data?.nome || labResult.data?.nome || dfdData?.local_de_uso || null;
      let analysisResponsibleName: string | null = null;
      let analysisResponsibleAvatarUrl: string | null = null;

      if (analysisUnitId && analysisUnitType) {
        const { data: chefiaLink, error: chefiaLinkError } = await supabase
          .from("user_units")
          .select("user_id")
          .eq("unit_id", analysisUnitId)
          .eq("unit_type", analysisUnitType)
          .eq("role_in_unit", "chefia")
          .limit(1)
          .maybeSingle();
        if (chefiaLinkError) throw chefiaLinkError;

        if (chefiaLink?.user_id) {
          const { data: chefiaProfile, error: chefiaProfileError } = await supabase
            .from("profiles")
            .select("full_name,email,avatar_url")
            .eq("id", chefiaLink.user_id)
            .maybeSingle();
          if (chefiaProfileError) throw chefiaProfileError;
          analysisResponsibleName =
            String(chefiaProfile?.full_name || "").trim() ||
            String(chefiaProfile?.email || "").trim() ||
            null;
          analysisResponsibleAvatarUrl = chefiaProfile?.avatar_url || null;
        }
      }

      setDfd({
        ...dfdData,
        profiles: profileResult.data || null,
        campi: campusResult.data || null,
        unidade_nome: unidadeNome,
        analysis_unidade_nome:
          String(analysisUnitResult.data?.nome || "").trim() || unidadeNome,
        analysis_responsavel_nome: analysisResponsibleName,
        analysis_responsavel_avatar_url: analysisResponsibleAvatarUrl,
      });

      if (dfdData?.origin_type === "collective") {
        const { data: authorRows, error: authorError } = await supabase
          .from("dfd_collective_dfd_authors")
          .select(
            "contribution_user_id,author_name_snapshot,author_email_snapshot,item_count,quantidade_total,valor_total_estimado",
          )
          .eq("dfd_id", id)
          .order("valor_total_estimado", { ascending: false });
        if (authorError) throw authorError;
        const rawAuthors = (authorRows || []) as CollectiveAuthorSummary[];
        const profileIds = Array.from(
          new Set(rawAuthors.map((author) => String(author.contribution_user_id || "").trim()).filter(Boolean)),
        );
        let avatarByUserId = new Map<string, { avatar_url?: string | null; full_name?: string | null; email?: string | null }>();
        if (profileIds.length > 0) {
          const { data: profileRows, error: profileError } = await supabase
            .from("profiles")
            .select("id,avatar_url,full_name,email")
            .in("id", profileIds);
          if (profileError) throw profileError;
          avatarByUserId = new Map(
            (profileRows || []).map((profile: any) => [String(profile.id), profile]),
          );
        }

        setCollectiveAuthors(
          rawAuthors.map((author) => {
            const profile = avatarByUserId.get(String(author.contribution_user_id || ""));
            return {
              ...author,
              author_name_snapshot:
                String(author.author_name_snapshot || "").trim() ||
                String(profile?.full_name || "").trim() ||
                null,
              author_email_snapshot:
                String(author.author_email_snapshot || "").trim() ||
                String(profile?.email || "").trim() ||
                null,
              author_avatar_url: profile?.avatar_url || null,
            };
          }),
        );
      } else {
        setCollectiveAuthors([]);
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from("dfd_items")
        .select("*")
        .eq("dfd_id", id);

      if (itemsError) throw itemsError;
      setItems((itemsData || []) as DfdItem[]);

      const { data: logsData, error: logsError } = await supabase
        .from("dfd_logs")
        .select("*")
        .eq("dfd_id", id)
        .order("created_at", { ascending: false });

      if (logsError) throw logsError;
      setLogs(logsData || []);
    } catch (error: any) {
      setLoadError("Não foi possível carregar todos os dados da DFD. Tente novamente antes de realizar uma ação.");
      toast.error("Erro ao carregar DFD: " + (error?.message || "erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleSendToTriagem = async () => {
    setSendingToChefia(true);
    try {
      const response = await fetch("/api/dfd/send-to-triagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resubmissionJustification }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao enviar DFD para análise.");
      }

      toast.success("DFD enviada para análise.");
      setSubmissionAnimationOpen(true);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao enviar DFD: " + (error?.message || "erro desconhecido"));
    } finally {
      setSendingToChefia(false);
    }
  };

  const handleMarkAsKit = async () => {
    setMarkingKit(true);
    try {
      const response = await fetch("/api/admin/kits/from-dfd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dfdId: id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao marcar DFD como kit.");
      }

      const ignoredItems = Array.isArray(payload?.unmatched) ? payload.unmatched.length : 0;
      toast.success(
        ignoredItems > 0
          ? `DFD marcada como kit. ${ignoredItems} item(ns) sem catálogo foram ignorados.`
          : "DFD marcada como kit.",
      );
      router.push("/admin/kits");
    } catch (error: any) {
      toast.error("Erro ao marcar como kit: " + (error?.message || "erro desconhecido"));
    } finally {
      setMarkingKit(false);
    }
  };

  const handleDeleteDfdAsSuperadmin = async () => {
    if (!dfd) return;
    const protocol = String(dfd.numero_protocolo || "").trim();
    const confirmation = window.prompt(
      `Esta ação exclui a DFD e seus itens. Digite o protocolo ${protocol} para confirmar.`,
    );
    if (confirmation === null) return;

    setDeletingDfd(true);
    try {
      const response = await fetch("/api/superadmin/dfds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, confirmProtocol: confirmation }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao excluir DFD.");
      }

      toast.success("DFD excluída pelo superadmin.");
      router.push("/admin/consolidacao");
    } catch (error: any) {
      toast.error("Erro ao excluir DFD: " + (error?.message || "erro desconhecido"));
    } finally {
      setDeletingDfd(false);
    }
  };

  const openChefiaReassignment = async () => {
    if (!dfd?.campus_id) return;
    setReassignmentOpen(true);
    setReassignmentLoading(true);
    try {
      const [departmentsResult, laboratoriesResult, chefiaLinksResult] = await Promise.all([
        supabase.from("departamentos").select("id,nome").eq("campus_id", dfd.campus_id).eq("ativo", true),
        supabase.from("laboratorios").select("id,nome").eq("campus_id", dfd.campus_id).eq("ativo", true),
        supabase.from("user_units").select("unit_id,unit_type").eq("role_in_unit", "chefia"),
      ]);
      if (departmentsResult.error) throw departmentsResult.error;
      if (laboratoriesResult.error) throw laboratoriesResult.error;
      if (chefiaLinksResult.error) throw chefiaLinksResult.error;

      const chefiaKeys = new Set(
        (chefiaLinksResult.data || []).map((link) => `${link.unit_type}:${link.unit_id}`),
      );
      const options = [
        ...(departmentsResult.data || []).map((unit) => ({ ...unit, type: "departamento" as const })),
        ...(laboratoriesResult.data || []).map((unit) => ({ ...unit, type: "laboratorio" as const })),
      ].filter((unit) => chefiaKeys.has(`${unit.type}:${unit.id}`));
      setAnalysisUnitOptions(options);
      const currentKey = `${dfd.analysis_tipo_unidade}:${dfd.analysis_unidade_id}`;
      setSelectedAnalysisUnitKey(options.some((option) => `${option.type}:${option.id}` === currentKey) ? currentKey : "");
    } catch (error: any) {
      setReassignmentOpen(false);
      toast.error("Não foi possível carregar as chefias disponíveis: " + (error?.message || "erro desconhecido"));
    } finally {
      setReassignmentLoading(false);
    }
  };

  const handleChefiaReassignment = async () => {
    const selected = analysisUnitOptions.find((option) => `${option.type}:${option.id}` === selectedAnalysisUnitKey);
    if (!selected) return;
    setReassigningChefia(true);
    try {
      const response = await fetch("/api/dfd/reassign-chefia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          analysis_unidade_id: selected.id,
          analysis_tipo_unidade: selected.type,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Falha ao alterar a chefia responsável.");
      toast.success("Chefia responsável alterada e registrada no histórico.");
      setReassignmentOpen(false);
      await fetchData();
    } catch (error: any) {
      toast.error("Não foi possível alterar a chefia: " + (error?.message || "erro desconhecido"));
    } finally {
      setReassigningChefia(false);
    }
  };

  const handleDownloadData = () => {
    if (!dfd) return;
    const csv = buildDfdPrintExportCsv({
      protocolo: dfd.numero_protocolo || `DFD-${dfd.id.slice(0, 8).toUpperCase()}`,
      data: new Date(dfd.created_at).toLocaleDateString("pt-BR"),
      status: STATUS_META[dfd.status]?.label || dfd.status,
      solicitante: dfd.profiles?.full_name || "Não identificado",
      email: dfd.profiles?.email || "",
      setor: dfd.unidade_nome || "",
      campus: dfd.campi?.nome || dfd.campi?.sigla || dfd.campus || "",
      objeto: dfd.objeto_contratacao || "",
      justificativa: dfd.justificativa_contratacao || "",
      planning_subsidies: dfd.planning_subsidies || {},
      gnd: Array.from(
        new Set(items.map((item) => String(item.gnd || item.gnd_derivado || "").trim()).filter(Boolean)),
      ).join(", "),
      origem:
        dfd.origin_type === "collective"
          ? "DFD coletiva convertida"
          : "DFD individual",
      sala_coletiva: dfd.collective_origin_room_title || "",
      coautores: collectiveAuthorsSummary,
      itens: items.map((item) => ({
        cod: String(item.codigo_tce || ""),
        desc: String(item.descricao || ""),
        qtd: Number(item.quantidade || 0),
        un: String(item.unidade_medida || "UN"),
        valor: Number(item.valor_unitario_estimado || 0),
        gnd: String(item.gnd || item.gnd_derivado || ""),
        natureza: String(item.codigo_natureza_despesa || ""),
        local_uso: String(item.local_uso || ""),
        justificativa_item: formatCollectiveJustificationText(item.justificativa_item),
        link_referencia: String(item.link_referencia || ""),
        distribuicao_usuarios: formatCollectiveDistributionText(item.justificativa_item),
        distribuicao_usuarios_json: JSON.stringify(parseCollectiveDistributionText(item.justificativa_item)),
      })),
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const protocol = dfd.numero_protocolo || `dfd-${dfd.id.slice(0, 8)}`;
    link.href = url;
    link.download = `${protocol.replace(/[^\w.-]+/g, "_")}_dados.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Dados da DFD baixados em CSV.");
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id, fetchData]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 md:px-6">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-80 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-[560px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return <div className="px-4 py-12"><OperationalEmptyState title="Não foi possível carregar a DFD" description={loadError} action={<button type="button" onClick={() => void fetchData()} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Tentar novamente</button>} /></div>;
  }

  if (!dfd) {
    return (
      <div className="px-6 py-20">
        <OperationalEmptyState
          icon={<XCircle size={32} />}
          title="DFD não encontrada"
          description="O protocolo solicitado não existe ou você não tem permissão para acessar."
          action={
            <button
              type="button"
              onClick={handleBackNavigation}
              className="rounded-lg border border-[var(--p-color-info-border)] bg-[var(--p-color-surface-subtle)] px-4 py-2 text-sm font-semibold text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-info-border)]"
            >
              Voltar
            </button>
          }
          className="mx-auto max-w-2xl"
        />
      </div>
    );
  }

  const status = STATUS_META[dfd.status] || STATUS_META.rascunho;
  const processStage = getDfdProcessStage(dfd.status);
  const campusLabel = dfd.campi?.nome || dfd.campi?.sigla || dfd.campus || "Campus UPE";
  const itemRowsTotal = items.reduce(
    (acc, item) => acc + Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0),
    0,
  );
  const savedEstimatedTotal = Number(dfd.valor_total_estimado || 0);
  const totalGeral = items.length > 0 ? itemRowsTotal : savedEstimatedTotal;
  const canCorrectAsAdmin = ["rascunho", "triagem", "devolvida", "aprovada", "pactuando"].includes(dfd.status) && (currentRole === "superadmin" || (currentRole === "admin" && Boolean(currentCampusId) && currentCampusId === dfd.campus_id));
  const canMarkAsKit = currentRole === "admin" || currentRole === "superadmin";
  const canDeleteDfdAsSuperadmin = currentRole === "superadmin";
  const canReassignChefia =
    currentRole === "superadmin" && (dfd.status === "rascunho" || dfd.status === "triagem");
  const isEditablePhase = dfd.status === "rascunho" || dfd.status === "devolvida" || (dfd.status === "triagem" && submissionPolicy.correctionActive);
  const canSendToChefia =
    isEditablePhase && submissionPolicy.canEditDfd &&
    canSendDfdToChefia({
      currentUserId,
      solicitanteId: dfd.solicitante_id,
    });
  const isCollectiveDfd = dfd.origin_type === "collective";
  const collectiveParticipantNames = collectiveAuthors
    .map((author) =>
      String(
        author.author_name_snapshot ||
          author.author_email_snapshot ||
          author.contribution_user_id ||
          "",
      ).trim(),
    )
    .filter(Boolean);
  const requesterLabel = isCollectiveDfd ? "Solicitantes" : "Solicitante";
  const requesterValue =
    isCollectiveDfd && collectiveParticipantNames.length > 0
      ? `${collectiveParticipantNames.length} participante(s) ativos`
      : dfd.profiles?.full_name || "Não identificado";
  const requesterAvatarName =
    collectiveParticipantNames[0] || dfd.profiles?.full_name || "Usuário";
  const collectiveAuthorsSummary = collectiveAuthors
    .map((author) => {
      const name = String(
        author.author_name_snapshot ||
          author.author_email_snapshot ||
          author.contribution_user_id ||
          "Autor não identificado",
      ).trim();
      return `${name} (qtd ${Number(author.quantidade_total || 0)})`;
    })
    .join("; ");
  const timelineEntries = buildTimelineEntries(logs);
  const fullTimelineEntries = [...(logs || [])].sort(
    (a, b) => new Date(String(a?.created_at || 0)).getTime() - new Date(String(b?.created_at || 0)).getTime(),
  );

  return (
    <div className="mx-auto max-w-[1280px] space-y-4 px-4 py-5 pb-24 md:px-6 lg:px-8">
      <nav className="flex items-center gap-2 text-sm font-medium text-[var(--p-color-brand-400)]">
        <button type="button" onClick={() => router.push("/dashboard")} className="inline-flex items-center gap-1.5 hover:text-[var(--p-color-action)]">
          <House size={14} />
          Início
        </button>
        <CaretRight size={12} className="text-[var(--p-color-fg-subtle)]" />
        <button type="button" onClick={() => router.push("/minhas-dfds")} className="hover:text-[var(--p-color-action)]">
          DFDs
        </button>
        <CaretRight size={12} className="text-[var(--p-color-fg-subtle)]" />
        <span className="text-[var(--p-color-brand-600)]">Detalhes da DFD</span>
      </nav>

      <motion.header
        {...motionProps(reducedMotion, {
          initial: { opacity: 0, y: 22, scale: 0.985 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: { duration: 0.45 },
        })}
        className="rounded-2xl border border-[var(--semantic-neutral-border)] bg-white p-5 shadow-[0_10px_28px_rgba(23,35,60,0.08)] md:p-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleBackNavigation}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-400)] hover:bg-[var(--p-color-info-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-color-action)]/30"
                aria-label="Voltar"
              >
                <ArrowLeft size={16} />
              </button>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--semantic-action)] md:text-3xl">
                {dfd.numero_protocolo || `DFD #${dfd.id.slice(0, 8).toUpperCase()}`}
              </h1>
              <span className={`rounded-full px-4 py-1 text-sm font-semibold ${status.className}`}>
                {status.label}
              </span>
              <OperationalChip tone={isEditablePhase ? "warning" : "collab"}>
                Etapa {processStage.stepIndex}/4
              </OperationalChip>
            </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-base text-[var(--semantic-text-muted)]">
              <p className="inline-flex items-center gap-2 text-base font-semibold text-[var(--semantic-action)]">
                <Buildings size={24} />
                <span className="text-lg">{campusLabel}</span>
              </p>
              <span>|</span>
              <p className="inline-flex items-center gap-2 text-base font-semibold text-[var(--semantic-action)]">
                <CalendarBlank size={24} />
                <span className="text-lg">Ciclo: {String(dfd.exercicio || 2027)}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
            {canSendToChefia && (
              <button
                type="button"
                onClick={() => setCorrectionEditorOpen(true)}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--semantic-action-border)] bg-white px-4 text-sm font-semibold text-[var(--semantic-action)] hover:bg-[var(--semantic-action-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-action)]/30"
              >
                <PencilSimpleLine size={18} />
                Editar
            </button>
            )}
            {(dfd.status === "devolvida" || submissionPolicy.correctionActive) && canSendToChefia ? (
              <label className="w-full max-w-xl rounded-xl border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] p-3 text-sm font-medium text-[var(--semantic-text)]">
                <span className="block font-semibold text-[var(--p-color-warning)]">O que foi corrigido para o reenvio?</span>
                <textarea
                  className="mt-2 min-h-20 w-full rounded-lg border border-[var(--semantic-neutral-border)] bg-white p-2 text-sm"
                  value={resubmissionJustification}
                  onChange={(event) => setResubmissionJustification(event.target.value)}
                  placeholder="Explique brevemente as correções realizadas conforme a devolução da chefia."
                />
              </label>
            ) : null}
            {canSendToChefia ? (
              <button
                type="button"
                onClick={handleSendToTriagem}
                disabled={sendingToChefia || ((dfd.status === "devolvida" || submissionPolicy.correctionActive) && resubmissionJustification.trim().length < 3)}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--semantic-action)] px-4 text-sm font-semibold text-white hover:bg-[var(--semantic-action-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-action)]/40 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sendingToChefia ? <CircleNotch size={18} className="animate-spin" /> : <PaperPlaneTilt size={18} />}
                {sendingToChefia ? "Enviando..." : "Enviar para análise"}
              </button>
            ) : isEditablePhase && currentUserId !== dfd.solicitante_id ? (
              <span className="inline-flex h-12 items-center rounded-xl border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] px-4 text-sm font-semibold text-[var(--p-color-warning)]">
                Somente quem criou a DFD pode enviar
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => router.push(`/dfd/${id}/impressao`)}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--semantic-action-border)] bg-white px-4 text-sm font-semibold text-[var(--semantic-action)] hover:bg-[var(--semantic-action-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-action)]/30"
            >
              <Printer size={18} weight="fill" />
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={handleDownloadData}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--semantic-action-border)] bg-white px-4 text-sm font-semibold text-[var(--semantic-action)] hover:bg-[var(--semantic-action-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-action)]/30"
            >
              <FileCsv size={18} weight="fill" />
              Exportar CSV
            </button>
            {canCorrectAsAdmin && <button type="button" onClick={() => setCorrectionEditorOpen(true)} className="inline-flex min-h-11 items-center rounded-xl bg-[var(--semantic-action)] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-action)]/30">Corrigir DFD</button>}
            {canMarkAsKit ? (
            <button
              type="button"
              onClick={handleMarkAsKit}
              disabled={markingKit}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--semantic-action-border)] bg-white px-4 text-sm font-semibold text-[var(--semantic-action)] hover:bg-[var(--semantic-action-soft)] disabled:opacity-60"
            >
                <Package size={16} />
                {markingKit ? "Marcando..." : "Kit"}
              </button>
            ) : null}
            {canDeleteDfdAsSuperadmin ? (
            <button
              type="button"
              onClick={handleDeleteDfdAsSuperadmin}
              disabled={deletingDfd}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--semantic-danger-border)] bg-[var(--semantic-danger-soft)] px-4 text-sm font-semibold text-[var(--semantic-danger)] hover:brightness-95 disabled:opacity-60"
            >
                {deletingDfd ? <CircleNotch size={16} className="animate-spin" /> : <Trash size={16} weight="bold" />}
                Excluir
              </button>
            ) : null}
          </div>
        </div>
      </motion.header>

      {submissionPolicy.correctionActive && submissionPolicy.state?.correction && (
        <aside className="rounded-2xl border border-[var(--p-color-info-border)] bg-[var(--p-color-bg-elevated)] p-4 text-sm text-[var(--p-color-fg)]"><p className="font-semibold">Correção autorizada pela chefia até {formatBahiaDate(submissionPolicy.state.correction.expires_at)}</p><p className="mt-1 whitespace-pre-wrap">{submissionPolicy.state.correction.reason}</p><p className="mt-2 text-[var(--p-color-fg-muted)]">Edite a DFD, salve as alterações e explique o que foi corrigido para concluir o reenvio.</p></aside>
      )}
      {dfd.status === "rascunho" && currentUserId === dfd.solicitante_id && !submissionPolicy.loading && !submissionPolicy.canCreate && (
        <p role="status" className="rounded-xl bg-[var(--p-color-warning-bg)] p-4 text-sm text-[var(--p-color-warning)]">Este rascunho está preservado para consulta. A edição e o primeiro envio exigem liberação do superadmin.</p>
      )}

      <section>
        <SkeuoDocumentCard
          title="Avanço do processo"
          meta={processStage.description}
          stamp={processStage.label}
          tone={isEditablePhase ? "warning" : dfd.status === "concluida" ? "success" : "collab"}
        >
          <OperationalStepper
            currentStep={processStage.stepIndex}
            steps={DFD_PROCESS_STEPS.map((step) => ({
              label: step.label,
              helper: step.description,
            }))}
          />
        </SkeuoDocumentCard>
      </section>

      <motion.section
        {...motionProps(reducedMotion, {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.42, delay: 0.06 },
        })}
        className="rounded-2xl border border-[var(--semantic-neutral-border)] bg-white p-5 shadow-[0_8px_22px_rgba(23,35,60,0.06)]"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetaCard
            icon={User}
            label={requesterLabel}
            value={requesterValue}
            tone="blue"
            rightContent={
                <CategoryAvatar
                  name={requesterAvatarName}
                  avatarUrl={dfd.profiles?.avatar_url || null}
                  category={isCollectiveDfd ? "collective" : "solicitante"}
                  size="md"
                />
            }
          />
          <MetaCard icon={MapPin} label="Local de uso" value={dfd.unidade_nome || "Não informado"} tone="violet" />
          <MetaCard
            icon={ShieldCheck}
            label="Responsável pela análise"
            value={dfd.analysis_responsavel_nome || "Chefia não definida"}
            tone="violet"
            rightContent={
              canReassignChefia ? (
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {dfd.analysis_responsavel_nome ? (
                    <CategoryAvatar
                      name={dfd.analysis_responsavel_nome}
                      avatarUrl={dfd.analysis_responsavel_avatar_url || null}
                      category="chefia"
                      size="md"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={openChefiaReassignment}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--semantic-insight-border)] bg-white px-2 text-[11px] font-bold text-[var(--semantic-insight)] hover:bg-[var(--semantic-insight-soft)]"
                  >
                    <PencilSimpleLine size={13} />
                    Trocar responsável
                  </button>
                </div>
              ) : dfd.analysis_responsavel_nome ? (
                <CategoryAvatar
                  name={dfd.analysis_responsavel_nome}
                  avatarUrl={dfd.analysis_responsavel_avatar_url || null}
                  category="chefia"
                  size="md"
                />
              ) : null
            }
          />
          <MetaCard
            icon={CalendarBlank}
            label="Data de registro"
            value={new Date(dfd.created_at).toLocaleDateString("pt-BR")}
            tone="amber"
          />
          <MetaCard icon={FileText} label="Protocolo" value={dfd.numero_protocolo || dfd.id.slice(0, 8).toUpperCase()} tone="teal" />
          <MetaCard icon={Clock} label="Status" value={status.label} tone="teal" />
          <ValueCard label="Total estimado" value={formatCurrency(totalGeral)} className="md:col-span-2" />
        </div>
        {isCollectiveDfd && collectiveParticipantNames.length > 0 ? (
          <div className="mt-4 rounded-xl border border-[var(--semantic-action-border)] bg-[var(--semantic-action-soft)] p-4">
            <p className="text-sm font-semibold text-[var(--semantic-action)]">
              Participantes da DFD coletiva ({collectiveParticipantNames.length})
            </p>
            <AvatarStack
              members={collectiveAuthors.map((author) => ({
                id: author.contribution_user_id,
                name: getCollectiveAuthorName(author),
                email: author.author_email_snapshot || null,
                avatarUrl: author.author_avatar_url || null,
              }))}
              total={collectiveAuthors.length}
              label="Autoria coletiva preservada"
              size="md"
              className="mt-3"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {collectiveAuthors.map((author) => {
                const name = getCollectiveAuthorName(author);
                return (
                  <div
                    key={author.contribution_user_id}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--semantic-action-border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--semantic-text)]"
                  >
                    <CategoryAvatar
                      name={name}
                      avatarUrl={author.author_avatar_url || null}
                      category="collective"
                      size="sm"
                    />
                    <span className="max-w-[260px] truncate">{name}</span>
                    <span className="rounded-full bg-[var(--semantic-collab-soft)] px-2 py-0.5 font-semibold text-[var(--semantic-collab)]">
                      {Number(author.quantidade_total || 0)} un.
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </motion.section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          <motion.section
            {...motionProps(reducedMotion, {
              initial: { opacity: 0, x: -20 },
              animate: { opacity: 1, x: 0 },
              transition: { duration: 0.38, delay: 0.08 },
            })}
            className="rounded-2xl border border-[var(--semantic-neutral-border)] bg-white p-5 shadow-[0_8px_22px_rgba(23,35,60,0.06)]"
          >
            <h2 className="inline-flex items-center gap-2 text-lg font-bold text-[var(--semantic-action)]">
              <FileText size={30} weight="fill" />
              Justificativa da DFD
            </h2>
            <div className="mt-4 rounded-xl border border-[var(--semantic-action-border)] bg-[var(--semantic-action-soft)] p-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--semantic-text)]">
                {dfd.justificativa_contratacao || "Sem justificativa registrada para esta solicitação."}
              </p>
              {dfd.analysis_routing_reason ? (
                <p className="mt-4 rounded-lg border border-[var(--semantic-neutral-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--semantic-text)]">
                  Roteamento da chefia: {dfd.analysis_routing_reason}
                </p>
              ) : null}
            </div>
          </motion.section>

          {hasPlanningSubsidies(dfd.planning_subsidies) ? (
            <motion.section
              {...motionProps(reducedMotion, {
                initial: { opacity: 0, x: -20 },
                animate: { opacity: 1, x: 0 },
                transition: { duration: 0.38, delay: 0.1 },
              })}
              className="rounded-2xl border border-[var(--semantic-neutral-border)] bg-white p-5 shadow-[0_8px_22px_rgba(23,35,60,0.06)]"
            >
              <h2 className="inline-flex items-center gap-2 text-lg font-bold text-[var(--semantic-action)]">
                <ListBullets size={28} weight="fill" />
                Complementos do planejamento
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {DFD_PLANNING_FIELD_ORDER.filter((field) =>
                  Boolean(String(dfd.planning_subsidies?.[field] || "").trim()),
                ).map((field) => (
                  <div
                    key={field}
                    className="rounded-xl border border-[var(--semantic-neutral-border)] bg-[var(--semantic-neutral-soft)] p-4"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--p-color-fg-muted)]">
                      {DFD_PLANNING_FIELD_LABELS[field]}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--semantic-text)]">
                      {dfd.planning_subsidies?.[field]}
                    </p>
                  </div>
                ))}
              </div>
            </motion.section>
          ) : null}

          <motion.section
            {...motionProps(reducedMotion, {
              initial: { opacity: 0, y: 20 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.42, delay: 0.12 },
            })}
            className="rounded-2xl border border-[var(--semantic-neutral-border)] bg-white shadow-[0_8px_22px_rgba(23,35,60,0.06)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--semantic-neutral-border)] px-5 py-4">
              <h2 className="inline-flex items-center gap-2 text-lg font-bold text-[var(--semantic-action)]">
                <Package size={30} weight="fill" />
                Itens da DFD
                <span className="rounded-full bg-[var(--semantic-action-soft)] px-3 py-1 text-sm font-semibold text-[var(--semantic-action)]">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </span>
              </h2>
              <p className="text-lg font-bold text-[var(--semantic-action)]">{formatCurrency(totalGeral)}</p>
            </div>

            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <img
                  src="/guidance/empty-cart.png"
                  alt=""
                  className="mx-auto aspect-[16/9] w-full max-w-[300px] object-contain"
                />
                <p className="mt-2 text-sm font-medium text-[var(--p-color-fg-muted)]">
                  Nenhum item vinculado. Reabra a DFD para adicionar os itens antes de enviar para análise.
                </p>
                {savedEstimatedTotal > 0 ? (
                  <p className="mt-2 text-xs font-semibold text-[var(--semantic-action)]">
                    Valor estimado salvo na DFD: {formatCurrency(savedEstimatedTotal)}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4 p-4">
                {items.map((item, index) => {
                  const qtd = Number(item.quantidade || 0);
                  const unit = Number(item.valor_unitario_estimado || 0);
                  const subtotal = qtd * unit;
                  const justificationText = formatCollectiveJustificationText(item.justificativa_item);
                  const distributionText = formatCollectiveDistributionText(item.justificativa_item);
                  return (
                    <motion.article
                      {...motionProps(reducedMotion, {
                        initial: { opacity: 0, y: 16, scale: 0.992 },
                        animate: { opacity: 1, y: 0, scale: 1 },
                        transition: { duration: 0.34, delay: Math.min(index * 0.04, 0.22) },
                      })}
                      whileHover={reducedMotion ? undefined : { y: -4, boxShadow: "0 16px 28px rgba(23,35,60,0.12)" }}
                      key={item.id}
                      className="rounded-xl border border-[var(--semantic-neutral-border)] bg-[var(--p-color-bg-elevated)] p-4 shadow-sm"
                    >
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--semantic-action)] to-[var(--p-color-action)] text-lg font-bold text-white shadow-md">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs text-[var(--semantic-text-muted)]">Código</p>
                            <p className="truncate text-xl font-bold tracking-tight text-[var(--semantic-action)]">
                              #{item.codigo_tce || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-xl border border-[var(--semantic-action-border)] bg-gradient-to-r from-white to-[var(--semantic-action-soft)] px-3 py-2.5">
                          <p className="text-xs font-semibold uppercase tracking-[0.03em] text-[var(--semantic-action)]">
                            Resumo financeiro
                          </p>
                          <div className="mt-2 grid grid-cols-3 divide-x divide-[var(--semantic-action-border)]">
                            <MetricChip variant="summary" label="Qtd." value={String(qtd)} />
                            <MetricChip variant="summary" label="Valor unitário" value={formatCurrency(unit)} />
                            <MetricChip variant="summary" label="Subtotal" value={formatCurrency(subtotal)} />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-[var(--semantic-neutral-border)] pt-4">
                        <div className="flex items-start gap-3">
                          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--semantic-action-soft)] text-[var(--semantic-action)]">
                            <Package size={22} weight="duotone" />
                          </span>
                          <h3 className="break-words text-sm font-semibold leading-[1.4] text-[var(--semantic-text)] [overflow-wrap:anywhere]">
                            {formatCatalogDescription(item.descricao)}
                          </h3>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-[var(--semantic-neutral-border)] bg-[var(--semantic-neutral-soft)] p-3">
                        <p className="text-sm font-semibold uppercase tracking-[0.03em] text-[var(--semantic-insight)]">
                          Dados administrativos
                        </p>
                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                          <SmallInfo label="Local de uso" value={item.local_uso || "Não informado"} />
                          <SmallInfo label="Unidade" value={item.unidade_medida || "UN"} />
                          <SmallInfo label="Tipo de despesa" value={getExpenseTypeLabel(item)} />
                        </div>
                      </div>

                      {justificationText ? (
                        <div className="mt-3 rounded-lg border border-[var(--semantic-neutral-border)] bg-white p-3">
                          <p className="text-sm font-semibold tracking-[0.03em] text-[var(--semantic-action)]">
                            Justificativa do item
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--semantic-text-muted)]">
                            {justificationText}
                          </p>
                        </div>
                      ) : null}

                      {dfd.origin_type === "collective" && distributionText ? (
                        <div className="mt-2 rounded-lg border border-[var(--semantic-collab-border)] bg-[var(--semantic-collab-soft)] p-2.5">
                          <p className="text-sm font-semibold tracking-[0.03em] text-[var(--semantic-collab)]">
                            Distribuição da sala coletiva
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {parseCollectiveDistributionEntries(distributionText).map((entry, idx) => (
                              <div
                                key={`${entry.name}-${idx}`}
                                className="inline-flex items-center gap-2 rounded-full border border-[var(--semantic-collab-border)] bg-white px-2.5 py-1"
                              >
                                <CategoryAvatar
                                  name={entry.name}
                                  avatarUrl={findCollectiveAuthorAvatar(entry.name, collectiveAuthors)}
                                  category="collective"
                                  size="sm"
                                />
                                <span className="max-w-[220px] truncate text-xs font-semibold text-[var(--semantic-text)]">
                                  {entry.name}
                                </span>
                                {typeof entry.quantity === "number" ? (
                                  <span className="rounded-full bg-[var(--semantic-collab-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--semantic-collab)]">
                                    {entry.quantity} un.
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {item.link_referencia ? (
                        <a
                          href={item.link_referencia}
                          target="_blank"
                          rel="noreferrer"
                          className="group mt-3 inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--semantic-action-border)] bg-white px-4 text-sm font-semibold text-[var(--semantic-action)] transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--semantic-action-soft)] hover:shadow-[0_8px_16px_rgba(23,35,60,0.12)]"
                        >
                          <Paperclip size={16} className="transition-transform duration-200 group-hover:rotate-6" />
                          Abrir referência técnica
                          <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
                        </a>
                      ) : null}
                    </motion.article>
                  );
                })}
              </div>
            )}
          </motion.section>
        </div>

        <motion.section
          {...motionProps(reducedMotion, {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            transition: { duration: 0.42, delay: 0.1 },
          })}
          className="rounded-2xl border border-[var(--semantic-neutral-border)] bg-white p-5 shadow-[0_8px_22px_rgba(23,35,60,0.06)] lg:sticky lg:top-4 lg:h-fit"
        >
          <h2 className="inline-flex items-center gap-2 text-lg font-bold text-[var(--semantic-action)]">
            <Clock size={30} weight="fill" />
            Histórico de tramitação
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--semantic-text-muted)]">
            Acompanhe as etapas e movimentações desta DFD.
          </p>

          {timelineEntries.length === 0 ? (
            <OperationalEmptyState
              title="Sem movimentações"
              description="Ainda não há movimentações registradas para esta DFD."
              className="mt-4 p-6 shadow-none"
            />
          ) : (
            <OperationalTimeline
              className="mt-5"
              items={timelineEntries.map((entry, index) => {
                const meta = getTimelineMeta(entry.action);
                return {
                  title: meta.label,
                  tone: index === 0 ? "action" : "neutral",
                  meta: formatTimelineDate(entry.created_at),
                  description: (
                    <div>
                      <p className="whitespace-pre-wrap break-words">{entry.action === "correcao_administrativa" ? correctionHistoryDetails(entry.details || "") : dfdTimelineDescription(entry.details)}</p>
                      {entry.actor_name ? (
                        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--semantic-neutral-border)] bg-white px-2 py-0.5">
                          <CategoryAvatar
                            name={String(entry.actor_name)}
                            avatarUrl={String(entry.actor_avatar_url || "") || null}
                            category={String(entry.actor_role || "").toLowerCase() === "chefia" ? "chefia" : "usuario"}
                            size="sm"
                          />
                          <span className="text-xs font-semibold text-[var(--semantic-text)]">{entry.actor_name}</span>
                        </span>
                      ) : null}
                    </div>
                  ),
                };
              })}
            />
          )}

          <button
            type="button"
            onClick={() => setTimelineModalOpen(true)}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--semantic-action-border)] bg-white text-sm font-semibold text-[var(--semantic-action)] hover:bg-[var(--semantic-action-soft)]"
          >
            <ListBullets size={18} />
            Ver todas as movimentações
          </button>
        </motion.section>
      </div>
      <DfdCorrectionEditor administrative={canCorrectAsAdmin} dfdId={id} open={correctionEditorOpen} onOpenChange={setCorrectionEditorOpen} onSaved={() => { void fetchData(); void submissionPolicy.refresh(); }} />
      <DfdSubmissionAnimation
        open={submissionAnimationOpen}
        protocol={dfd.numero_protocolo || `DFD-${dfd.id.slice(0, 8).toUpperCase()}`}
        onClose={() => setSubmissionAnimationOpen(false)}
      />
      <Dialog open={timelineModalOpen} onOpenChange={setTimelineModalOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto border border-[var(--semantic-neutral-border)] bg-white text-[var(--semantic-text)] shadow-2xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Caminho completo da DFD</DialogTitle>
          </DialogHeader>
          {fullTimelineEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--semantic-neutral-border)] bg-[var(--semantic-neutral-soft)] px-4 py-8 text-center text-sm text-[var(--semantic-text-muted)]">
              Ainda não há movimentações registradas.
            </div>
          ) : (
            <div className="mt-2 space-y-4">
              {fullTimelineEntries.map((entry, index) => {
                const meta = getTimelineMeta(String(entry?.action || ""));
                const isLast = index === fullTimelineEntries.length - 1;
                return (
                  <div key={entry.id || `${entry.action}-${entry.created_at}-${index}`} className="relative flex gap-3">
                    {!isLast ? (
                      <span className="absolute left-[10px] top-8 h-[calc(100%-8px)] w-px bg-[var(--semantic-action-border)]" />
                    ) : null}
                    <span className={`z-10 mt-1 h-5 w-5 rounded-full border-4 ${meta.dot}`} />
                    <div className="flex-1 rounded-xl border border-[var(--semantic-neutral-border)] bg-white px-4 py-3">
                      <p className="text-sm font-bold text-[var(--semantic-action)]">{meta.label}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--semantic-text-muted)]">
                        {entry.action === "correcao_administrativa" ? correctionHistoryDetails(entry.details || "") : entry.details || "Movimentação registrada automaticamente pelo sistema."}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--semantic-text-muted)]">
                        <span>{formatTimelineDate(entry.created_at)}</span>
                        {entry.actor_name ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--semantic-neutral-border)] bg-white px-2 py-0.5">
                            <CategoryAvatar
                              name={String(entry.actor_name)}
                              avatarUrl={String(entry.actor_avatar_url || "") || null}
                              category={String(entry.actor_role || "").toLowerCase() === "chefia" ? "chefia" : "usuario"}
                              size="sm"
                            />
                            <span className="type-caption font-semibold text-[var(--semantic-text)]">{entry.actor_name}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={reassignmentOpen} onOpenChange={setReassignmentOpen}>
        <DialogContent className="border border-[var(--semantic-collab-border)] bg-white text-[var(--semantic-text)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Alterar chefia responsável</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-6 text-[var(--semantic-text-muted)]">
            Reencaminhe esta DFD para uma unidade ativa do mesmo campus. A ação fica registrada e só é permitida antes da avaliação da chefia.
          </p>
          {reassignmentLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-[var(--semantic-text-muted)]"><CircleNotch className="animate-spin" /> Carregando chefias disponíveis...</div>
          ) : analysisUnitOptions.length === 0 ? (
            <p className="rounded-xl border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] p-3 text-sm text-[var(--p-color-warning)]">
              Não há outra unidade ativa com chefia definida neste campus.
            </p>
          ) : (
            <>
              <label className="block text-sm font-semibold text-[var(--semantic-text)]" htmlFor="dfd-analysis-unit">
                Nova unidade responsável pela análise
              </label>
              <select
                id="dfd-analysis-unit"
                value={selectedAnalysisUnitKey}
                onChange={(event) => setSelectedAnalysisUnitKey(event.target.value)}
                className="h-11 w-full rounded-xl border border-[var(--semantic-neutral-border)] bg-white px-3 text-sm"
              >
                <option value="">Selecione uma chefia</option>
                {analysisUnitOptions.map((option) => (
                  <option key={`${option.type}:${option.id}`} value={`${option.type}:${option.id}`}>
                    {option.nome} ({option.type === "departamento" ? "setor" : "laboratório"})
                  </option>
                ))}
              </select>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setReassignmentOpen(false)} disabled={reassigningChefia} className="h-10 rounded-xl border border-[var(--semantic-neutral-border)] px-4 text-sm font-semibold">Cancelar</button>
                <button type="button" onClick={handleChefiaReassignment} disabled={!selectedAnalysisUnitKey || reassigningChefia} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--semantic-action)] px-4 text-sm font-semibold text-white disabled:opacity-60">
                  {reassigningChefia ? <CircleNotch className="animate-spin" /> : null}
                  Confirmar alteração
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetaCard({
  icon: Icon,
  label,
  value,
  rightContent,
  tone = "blue",
}: {
  icon: any;
  label: string;
  value: string;
  rightContent?: React.ReactNode;
  tone?: "blue" | "teal" | "violet" | "amber";
}) {
  const toneMap: Record<string, string> = {
    blue: "border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-500)]",
    teal: "border-[var(--p-color-collab-border)] bg-[var(--p-color-collab-bg)] text-[var(--p-color-collab)]",
    violet: "border-[var(--p-color-insight-border)] bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]",
    amber: "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]",
  };

  return (
    <div className={`rounded-xl border p-4 ${toneMap[tone] || toneMap.blue}`}>
      <p className="text-xs font-medium tracking-[0.02em] opacity-85">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="inline-flex min-w-0 items-start gap-2 text-base font-semibold leading-tight">
          <Icon size={20} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2 break-words">{value}</span>
        </p>
        {rightContent || null}
      </div>
    </div>
  );
}

function ValueCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-xl border border-[var(--p-color-info-border)] bg-gradient-to-r from-[var(--p-color-action)] via-[var(--p-color-action)] to-[var(--p-color-action)] p-4 text-white ${className || ""}`}>
      <p className="text-sm font-semibold opacity-95">{label}</p>
      <p className="mt-1 text-xl font-bold leading-tight">{value}</p>
    </div>
  );
}

function SmallInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] px-3 py-2.5">
      <p className="text-xs font-medium text-[var(--p-color-fg-muted)]">{label}</p>
      <p className="mt-1 text-base font-semibold leading-tight text-[var(--p-color-brand-500)]">{value}</p>
    </div>
  );
}

function MetricChip({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string;
  variant?: "default" | "summary";
}) {
  if (variant === "summary") {
    return (
      <div className="px-3 first:pl-0 last:pr-0">
        <p className="type-caption font-semibold uppercase tracking-[0.03em] text-[var(--semantic-text-muted)]">
          {label}
        </p>
        <p className="mt-1 whitespace-nowrap text-base font-bold leading-tight tracking-tight text-[var(--semantic-action)] sm:text-lg">
          <MechanicalValue value={value} />
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-xl border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] px-3 py-3 text-center">
      <p className="text-xs font-semibold text-[var(--p-color-fg-muted)]">{label}</p>
      <p className="mt-1 min-w-0 overflow-visible break-words text-lg font-bold leading-tight text-[var(--p-color-brand-500)]">
        <MechanicalValue value={value} />
      </p>
    </div>
  );
}

function buildTimelineEntries(logs: any[]) {
  const seen = new Set<string>();
  return (logs || []).filter((log) => {
    const created = String(log?.created_at || "").slice(0, 16);
    const key = `${String(log?.action || "").toLowerCase()}|${String(log?.details || "")}|${created}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getCollectiveAuthorName(author: CollectiveAuthorSummary) {
  return String(
    author.author_name_snapshot ||
      author.author_email_snapshot ||
      author.contribution_user_id ||
      "Participante",
  ).trim();
}

function normalizeParticipantLabel(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findCollectiveAuthorAvatar(name: string, authors: CollectiveAuthorSummary[]) {
  const target = normalizeParticipantLabel(name);
  const matched = authors.find(
    (author) => normalizeParticipantLabel(getCollectiveAuthorName(author)) === target,
  );
  return matched?.author_avatar_url || null;
}

function parseCollectiveDistributionEntries(distribution: string) {
  const raw = String(distribution || "").trim();
  if (!raw) return [];
  const chunks = raw
    .split(/\s*[;|]\s*|\s*,\s*(?=[^,]+:\s*\d+)/g)
    .map((part) => part.trim())
    .filter(Boolean);

  const entries = chunks
    .map((chunk) => {
      const match = chunk.match(/^(.*?):\s*(\d+(?:[.,]\d+)?)$/);
      if (!match) return null;
      const name = String(match[1] || "").trim();
      const quantity = Number(String(match[2] || "0").replace(",", "."));
      if (!name || !Number.isFinite(quantity)) return null;
      return { name, quantity };
    })
    .filter((entry): entry is { name: string; quantity: number } => Boolean(entry));

  if (entries.length > 0) return entries;
  return [{ name: raw, quantity: null }];
}

function getTimelineMeta(action: string) {
  const map: Record<string, { label: string; dot: string }> = {
    correcao_administrativa: { label: "Correção administrativa", dot: "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning)]" },
    rascunho: { label: "Rascunho criado", dot: "border-[var(--p-color-info-border)] bg-[var(--p-color-action)]" },
    triagem: { label: "DFD criada", dot: "border-[var(--p-color-collab-border)] bg-[var(--p-color-collab)]" },
    aprovada: { label: "DFD aprovada", dot: "border-[var(--p-color-success-border)] bg-[var(--p-color-success)]" },
    devolvida: { label: "DFD devolvida", dot: "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning)]" },
    pactuando: { label: "Em pactuação", dot: "border-[var(--p-color-insight-border)] bg-[var(--p-color-insight)]" },
    concluida: { label: "Processo concluído", dot: "border-[var(--p-color-success-border)] bg-[var(--p-color-success)]" },
  };
  return map[action] || { label: "Início do processo", dot: "border-[var(--p-color-insight-border)] bg-[var(--p-color-insight)]" };
}

function formatTimelineDate(value?: string | null) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCatalogDescription(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "Descrição não informada.";

  return raw
    .replace(/\s+/g, " ")
    .replace(/,\s*/g, ", ")
    .replace(/;\s*/g, "; ")
    .replace(/\.\s*/g, ". ")
    .replace(/:\s*/g, ": ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
