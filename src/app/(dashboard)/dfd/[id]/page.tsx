"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Printer,
  DownloadSimple,
  XCircle,
  CircleNotch,
  FileText,
  Package,
  User,
  Clock,
  Paperclip,
  Buildings,
  ShieldCheck,
  Hash,
  PaperPlaneTilt,
  CurrencyDollar,
  Trash,
} from "@phosphor-icons/react";
import { useRouter, useParams } from "next/navigation";
import { getSafeUser, supabase } from "@/lib/supabase";
import { DfdTimeline } from "@/components/dfd/DfdTimeline";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveCampusBranding } from "@/lib/campus-branding";
import { normalizeRole, type UserRole } from "@/lib/access";
import { canSendDfdToChefia } from "@/lib/dfd-send-permissions";
import { buildDfdPrintExportCsv } from "@/lib/dfd-print-export";
import { DfdSubmissionAnimation } from "@/components/feedback/DfdSubmissionAnimation";

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
  exercicio?: number | null;
  analysis_unidade_id?: string | null;
  analysis_tipo_unidade?: "departamento" | "laboratorio" | null;
  analysis_routing_reason?: string | null;
  profiles?: { full_name?: string | null; email?: string | null; avatar_url?: string | null } | null;
  campi?: { nome?: string | null; sigla?: string | null } | null;
};

type CollectiveAuthorSummary = {
  contribution_user_id: string;
  author_name_snapshot?: string | null;
  author_email_snapshot?: string | null;
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

const STATUS_META: Record<DfdStatus, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-[#E8EDF2] text-[#3E4C5F]" },
  triagem: { label: "Em análise", className: "bg-[#DCEAF0] text-[#1C5A6B]" },
  aprovada: { label: "Homologada", className: "bg-[#E7F0EA] text-[#5F735C]" },
  devolvida: { label: "Devolvida", className: "bg-[#FFF3E6] text-[#B9895A]" },
  pactuando: { label: "Pactuação", className: "bg-[#E8EDF2] text-[#2D5D94]" },
  concluida: { label: "Concluída", className: "bg-[#E7F0EA] text-[#5F735C]" },
};

const STATUS_GUIDANCE: Record<
  DfdStatus,
  {
    title: string;
    description: string;
    highlights: string[];
  }
> = {
  rascunho: {
    title: "Esta DFD ainda está em construção",
    description:
      "O objetivo agora é garantir que a demanda esteja compreensível para quem vai analisar depois.",
    highlights: [
      "Conferir se o objeto está claro",
      "Validar se cada item tem justificativa e referência",
      "Enviar apenas quando a leitura estiver madura",
    ],
  },
  devolvida: {
    title: "Esta DFD voltou para ajuste",
    description:
      "Use o histórico e os itens para entender o que precisa ser corrigido antes do reenvio.",
    highlights: [
      "Ler o parecer da devolução",
      "Revisar itens, quantidades e justificativas",
      "Reenviar só depois de eliminar as pendências",
    ],
  },
  triagem: {
    title: "A demanda está em análise pela chefia",
    description:
      "Agora a função desta tela é acompanhar o processo e manter rastreabilidade do que foi enviado.",
    highlights: [
      "Acompanhar o histórico de tramitação",
      "Usar a impressão e o CSV quando precisar compartilhar",
      "Observar se houver devolução para correção",
    ],
  },
  aprovada: {
    title: "A DFD foi homologada",
    description:
      "A demanda já passou pela triagem e segue como referência oficial para as próximas etapas.",
    highlights: [
      "Usar esta tela como memória da decisão",
      "Conferir itens homologados e valores",
      "Acompanhar movimentações posteriores no histórico",
    ],
  },
  pactuando: {
    title: "A demanda está em pactuação",
    description:
      "Esta etapa exige leitura cuidadosa do que foi homologado e do que ainda pode sofrer ajuste institucional.",
    highlights: [
      "Conferir alinhamento entre valor e prioridade",
      "Usar o histórico para sustentar decisões",
      "Preservar o contexto original da demanda",
    ],
  },
  concluida: {
    title: "A DFD está concluída",
    description:
      "A demanda já percorreu o fluxo principal. Esta tela passa a servir como registro e consulta.",
    highlights: [
      "Retomar o histórico quando necessário",
      "Usar a exportação para consultas futuras",
      "Tomar esta DFD como referência final do processo",
    ],
  },
};

export default function DfdDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [dfd, setDfd] = useState<DfdDetails | null>(null);
  const [items, setItems] = useState<DfdItem[]>([]);
  const [collectiveAuthors, setCollectiveAuthors] = useState<CollectiveAuthorSummary[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState<UserRole>("solicitante");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [markingKit, setMarkingKit] = useState(false);
  const [sendingToChefia, setSendingToChefia] = useState(false);
  const [submissionAnimationOpen, setSubmissionAnimationOpen] = useState(false);
  const [deletingDfd, setDeletingDfd] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: dfdData, error: dfdError } = await supabase
        .from("dfds")
        .select("*")
        .eq("id", id)
        .single();

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
          ? supabase.from("profiles").select("role").eq("id", currentUser.id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (campusResult.error) throw campusResult.error;
      if (deptResult.error) throw deptResult.error;
      if (labResult.error) throw labResult.error;
      if (analysisUnitResult.error) throw analysisUnitResult.error;
      if (currentProfileResult.error) throw currentProfileResult.error;

      setCurrentRole(normalizeRole(currentProfileResult.data?.role, currentUser?.email));

      const unidadeNome =
        deptResult.data?.nome || labResult.data?.nome || dfdData?.local_de_uso || null;

      setDfd({
        ...dfdData,
        profiles: profileResult.data || null,
        campi: campusResult.data || null,
        unidade_nome: unidadeNome,
        analysis_unidade_nome:
          String(analysisUnitResult.data?.nome || "").trim() || unidadeNome,
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
        setCollectiveAuthors((authorRows || []) as CollectiveAuthorSummary[]);
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
        body: JSON.stringify({ id }),
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
      gnd: Array.from(new Set(items.map((item) => String(item.gnd || "").trim()).filter(Boolean))).join(", "),
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

  if (!dfd) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <XCircle size={56} className="text-[#A7B1BD]" />
        <h2 className="mt-3 text-2xl font-semibold text-[#164073]">DFD não encontrada</h2>
        <p className="mt-1 text-sm text-[#5B6675]">
          O protocolo solicitado não existe ou você não tem permissão para acessar.
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 rounded-lg border border-[#C7D7EA] bg-[#E8EDF2] px-4 py-2 text-sm font-semibold text-[#164073] hover:bg-[#DCEAF0]"
        >
          Voltar
        </button>
      </div>
    );
  }

  const status = STATUS_META[dfd.status] || STATUS_META.rascunho;
  const campusLabel = dfd.campi?.nome || dfd.campi?.sigla || dfd.campus || "Campus UPE";
  const campusBranding = resolveCampusBranding(campusLabel);
  const totalGeral = items.reduce(
    (acc, item) => acc + Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0),
    0,
  );
  const canMarkAsKit = currentRole === "admin" || currentRole === "superadmin";
  const canDeleteDfdAsSuperadmin = currentRole === "superadmin";
  const isEditablePhase = dfd.status === "rascunho" || dfd.status === "devolvida";
  const canSendToChefia =
    isEditablePhase &&
    canSendDfdToChefia({
      currentUserId,
      solicitanteId: dfd.solicitante_id,
    });
  const statusGuide = STATUS_GUIDANCE[dfd.status] || STATUS_GUIDANCE.rascunho;
  const infoReadiness = [
    Boolean(String(dfd.objeto_contratacao || "").trim()),
    Boolean(String(dfd.justificativa_contratacao || "").trim()),
    items.length > 0,
    items.every((item) => Boolean(String(item.justificativa_item || "").trim())),
  ].filter(Boolean).length;
  const readinessPercent = Math.round((infoReadiness / 4) * 100);
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-24 md:px-6">
      <header className="rounded-2xl border border-[#D9E0E8] bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D9E0E8] bg-[#FAFBFC] text-[#3E4C5F] hover:bg-[#F4F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6F78]/40"
                aria-label="Voltar"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="rounded-full bg-[#E8EDF2] px-3 py-1 text-[11px] font-semibold text-[#164073]">
                {dfd.numero_protocolo || `DFD-${dfd.id.slice(0, 8).toUpperCase()}`}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${status.className}`}
              >
                {status.label}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#164073] md:text-3xl">
              {dfd.objeto_contratacao || "Demanda sem objeto informado"}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5B6675]">
              Uma leitura clara da demanda, dos itens e das decisões já registradas.
            </p>
            <p className="mt-2 text-xs font-medium text-[#64748B]">
              {campusLabel} • registrada em{" "}
              {new Date(dfd.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {canSendToChefia && (
              <button
                type="button"
                onClick={handleSendToTriagem}
                disabled={sendingToChefia}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1F6F78] px-4 text-[12px] font-semibold text-white hover:bg-[#1C5A6B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6F78]/40 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sendingToChefia ? (
                  <CircleNotch size={14} className="animate-spin" />
                ) : (
                  <PaperPlaneTilt size={14} weight="bold" />
                )}
                {sendingToChefia ? "Enviando..." : "Enviar para análise"}
              </button>
            )}
            {canMarkAsKit && (
              <button
                type="button"
                onClick={handleMarkAsKit}
                disabled={markingKit}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#C7D7EA] bg-[#F7FBFF] px-4 text-[12px] font-semibold text-[#164073] hover:bg-[#EAF2FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6F78]/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Package size={14} weight="bold" />
                {markingKit ? "Marcando..." : "Marcar como kit"}
              </button>
            )}
            {canDeleteDfdAsSuperadmin && (
              <button
                type="button"
                onClick={handleDeleteDfdAsSuperadmin}
                disabled={deletingDfd}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-[12px] font-semibold text-red-700 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingDfd ? (
                  <CircleNotch size={14} className="animate-spin" />
                ) : (
                  <Trash size={14} weight="bold" />
                )}
                {deletingDfd ? "Excluindo..." : "Excluir DFD"}
              </button>
            )}
            {isEditablePhase && !canSendToChefia && (
              <span className="inline-flex min-h-10 max-w-[260px] items-center rounded-xl border border-[#E8D7B7] bg-[#FFF8EA] px-3 text-[11px] font-semibold text-[#8A6424]">
                Somente quem criou a DFD pode enviar
              </span>
            )}
            <button
              type="button"
              onClick={() => router.push(`/dfd/${id}/impressao`)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-3 text-[12px] font-semibold text-[#3E4C5F] hover:bg-[#F4F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6F78]/30"
              aria-label="Imprimir DFD"
            >
              <Printer size={14} weight="fill" />
              Imprimir
            </button>
            <button
              type="button"
              onClick={handleDownloadData}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-3 text-[12px] font-semibold text-[#3E4C5F] hover:bg-[#F4F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6F78]/30"
              aria-label="Baixar dados da DFD"
            >
              <DownloadSimple size={14} weight="bold" />
              CSV
            </button>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-[#D9E0E8] bg-white p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <p className="text-[11px] font-semibold text-[#47739F]">
              Leitura da etapa atual
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[#164073] md:text-xl">
              {statusGuide.title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52627A]">
              {statusGuide.description}
            </p>
            <div className="mt-4 rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] p-4">
              <p className="text-[11px] font-semibold text-[#64748B]">
                O que fazer agora
              </p>
              <ul className="mt-2 space-y-2 text-sm text-[#445164]">
                {statusGuide.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#47739F]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rounded-2xl border border-[#D9E0E8] bg-white p-4">
              <p className="text-base font-semibold text-[#164073]">Pulso desta DFD</p>
            <div className="mt-4 grid gap-3">
              <ReadinessMetric label="Itens vinculados" value={items.length} />
              <ReadinessMetric label="Valor estimado" value={formatCurrency(totalGeral)} />
              <ReadinessMetric label="Prontidão da leitura" value={`${readinessPercent}%`} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-2xl border border-[#D9E0E8] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="inline-flex items-center gap-2 text-base font-semibold text-[#164073]">
                <FileText size={18} weight="fill" />
                Contexto da DFD
              </h2>
              <img src={campusBranding.logoSrc} alt={campusBranding.label} className="h-8 w-auto" />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <MetaCard
                icon={User}
                label="Solicitante"
                value={dfd.profiles?.full_name || "Não identificado"}
                rightContent={
                  <ProfileAvatar
                    name={dfd.profiles?.full_name || "Usuário"}
                    avatarUrl={dfd.profiles?.avatar_url || null}
                  />
                }
              />
              <MetaCard icon={Buildings} label="Campus" value={campusLabel} />
              <MetaCard icon={Buildings} label="Local de uso" value={dfd.unidade_nome || "Não informado"} />
              <MetaCard
                icon={ShieldCheck}
                label="Responsável pela análise"
                value={dfd.analysis_unidade_nome || dfd.unidade_nome || "Não informado"}
              />
              <MetaCard
                icon={Clock}
                label="Data de registro"
                value={new Date(dfd.created_at).toLocaleDateString("pt-BR")}
              />
              <MetaCard
                icon={ShieldCheck}
                label="Ciclo"
                value={String(dfd.exercicio || 2027)}
              />
              <MetaCard
                icon={CurrencyDollar}
                label="Total estimado"
                value={formatCurrency(totalGeral)}
              />
            </div>

            {dfd.origin_type === "collective" ? (
              <div className="mt-3 rounded-xl border border-[#D9E0E8] bg-[#F7FBFF] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#47739F]">
                  Procedência coletiva
                </p>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold text-[#164073]">Sala de origem</p>
                    <p className="mt-1 text-sm text-[#3E4C5F]">
                      {dfd.collective_origin_room_title || "Sala coletiva não identificada"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#164073]">Natureza da saída</p>
                    <p className="mt-1 text-sm text-[#3E4C5F]">
                      {String(dfd.collective_origin_expense_class || "")
                        .replace("custeio", "Despesa corrente")
                        .replace("investimento", "Despesa de capital")
                        .replace("outro", "Outra natureza")
                        .replace("sem-gnd", "Sem GND")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#164073]">Coautoria preservada</p>
                    <p className="mt-1 text-sm text-[#3E4C5F]">
                      {collectiveAuthors.length} participante(s) com registro estruturado
                    </p>
                  </div>
                </div>
                {collectiveAuthors.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {collectiveAuthors.map((author) => {
                      const name = String(
                        author.author_name_snapshot ||
                          author.author_email_snapshot ||
                          author.contribution_user_id ||
                          "Autor",
                      ).trim();
                      return (
                        <span
                          key={author.contribution_user_id}
                          className="inline-flex items-center rounded-full border border-[#C7D7EA] bg-white px-3 py-1 text-xs font-medium text-[#34506F]"
                        >
                          {name} • {Number(author.quantidade_total || 0)} un.
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-3 rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] p-3">
              <p className="text-xs font-semibold tracking-[0.03em] text-[#5A7596]">
                Justificativa da DFD
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#3E4C5F]">
                {dfd.justificativa_contratacao ||
                  "Sem justificativa registrada para esta solicitação."}
              </p>
              {dfd.analysis_routing_reason ? (
                <p className="mt-2 rounded-lg border border-[#D9E0E8] bg-white px-3 py-2 text-xs font-semibold text-[#3E4C5F]">
                  Roteamento da chefia: {dfd.analysis_routing_reason}
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-[#D9E0E8] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E8EDF2] px-4 py-3">
              <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[#164073]">
                <Package size={18} weight="fill" />
                Itens da DFD ({items.length})
              </h2>
              <p className="text-sm font-semibold text-[#164073]">{formatCurrency(totalGeral)}</p>
            </div>

            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <img
                  src="/guidance/empty-cart.png"
                  alt=""
                  className="mx-auto aspect-[16/9] w-full max-w-[300px] object-contain"
                />
                <p className="mt-2 text-sm font-medium text-[#5B6675]">Nenhum item vinculado.</p>
              </div>
            ) : (
              <div className="space-y-3 p-4">
                {items.map((item, index) => {
                  const qtd = Number(item.quantidade || 0);
                  const unit = Number(item.valor_unitario_estimado || 0);
                  const subtotal = qtd * unit;
                  const justificationText = formatJustificationForDisplay(item.justificativa_item);
                  const distributionText = extractCollectiveDistribution(item.justificativa_item);
                  return (
                    <article
                      key={item.id}
                      className="rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] p-3"
                    >
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#E8EDF2] px-2.5 py-1 text-[11px] font-semibold text-[#164073]">
                              Item {index + 1}
                            </span>
                            {item.codigo_tce ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#4B5C71]">
                                <Hash size={11} />
                                {item.codigo_tce}
                              </span>
                            ) : null}
                          </div>
                          <h3 className="break-words text-base font-semibold leading-7 text-[#123B6B] [overflow-wrap:anywhere]">
                            {formatCatalogDescription(item.descricao)}
                          </h3>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                            <SmallInfo label="Local de uso" value={item.local_uso || "Não informado"} />
                            <SmallInfo label="Unidade" value={item.unidade_medida || "UN"} />
                            <SmallInfo label="GND" value={item.gnd || "Não informado"} />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 lg:ml-4">
                          <MetricChip label="Qtd." value={String(qtd)} />
                          <MetricChip label="Unitário" value={formatCurrency(unit)} />
                          <MetricChip label="Subtotal" value={formatCurrency(subtotal)} />
                        </div>
                      </div>

                      {justificationText ? (
                        <div className="mt-2 rounded-lg border border-[#D9E0E8] bg-white p-2.5">
                          <p className="text-xs font-semibold tracking-[0.03em] text-[#5A7596]">
                            Justificativa do item
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-xs text-[#5B6675]">{justificationText}</p>
                        </div>
                      ) : null}

                      {dfd.origin_type === "collective" && distributionText ? (
                        <div className="mt-2 rounded-lg border border-[var(--semantic-collab-border)] bg-[var(--semantic-collab-soft)] p-2.5">
                          <p className="text-xs font-semibold tracking-[0.03em] text-[var(--semantic-collab)]">
                            Distribuição da sala coletiva
                          </p>
                          <p className="mt-1 break-words text-xs font-semibold text-[#3E4C5F]">{distributionText}</p>
                        </div>
                      ) : null}

                      {item.link_referencia ? (
                        <a
                          href={item.link_referencia}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#2D5D94] hover:underline"
                        >
                          <Paperclip size={13} />
                          Abrir referência técnica
                        </a>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="rounded-2xl border border-[#D9E0E8] bg-white p-4 shadow-sm"
          >
            <h2 className="inline-flex items-center gap-2 text-base font-semibold text-[#164073]">
              <Clock size={18} weight="fill" />
              Histórico de tramitação
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#5B6675]">
              Use este histórico para entender o que aconteceu e o que pode acontecer em seguida.
            </p>
            <div className="mt-3">
              <DfdTimeline logs={logs} />
            </div>
          </motion.section>
        </div>
      </div>
      <DfdSubmissionAnimation
        open={submissionAnimationOpen}
        protocol={dfd.numero_protocolo || `DFD-${dfd.id.slice(0, 8).toUpperCase()}`}
        onClose={() => setSubmissionAnimationOpen(false)}
      />
    </div>
  );
}

function MetaCard({
  icon: Icon,
  label,
  value,
  rightContent,
}: {
  icon: any;
  label: string;
  value: string;
  rightContent?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] p-3">
      <p className="text-xs font-semibold tracking-[0.03em] text-[#60748D]">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="inline-flex min-w-0 items-center gap-1.5 truncate text-[15px] font-semibold text-[#2F4157]">
          <Icon size={14} />
          <span className="truncate">{value}</span>
        </p>
        {rightContent || null}
      </div>
    </div>
  );
}

function SmallInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white p-2">
      <p className="text-[11px] font-semibold tracking-[0.03em] text-[#60748D]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[#2F4157]">{value}</p>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#D9E0E8] bg-white px-2.5 py-2 text-center">
      <p className="text-[10px] font-semibold tracking-[0.04em] text-[#60748D]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold leading-tight text-[#164073]">{value}</p>
    </div>
  );
}

function formatJustificationForDisplay(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withoutDistribution = raw.split(/Distribui[cç][aã]o por usu[aá]rio:/i)[0] || "";
  const withoutPercataLinks = withoutDistribution
    .replace(/https?:\/\/percata\.vercel\.app\/\S+/gi, "")
    .replace(/https?:\/\/localhost:\d+\/\S+/gi, "")
    .trim();
  return withoutPercataLinks;
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

function extractCollectiveDistribution(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/Distribui[cç][aã]o por usu[aá]rio:\s*([\s\S]+)$/i);
  return match?.[1]?.trim() || "";
}

function ProfileAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [broken, setBroken] = useState(false);

  if (!avatarUrl || broken) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D9E0E8] bg-[#E8EDF2] text-[10px] font-semibold uppercase text-[#164073]">
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={name}
      className="h-8 w-8 rounded-full border border-[#D9E0E8] object-cover"
      onError={() => setBroken(true)}
    />
  );
}

function ReadinessMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] p-3">
      <p className="text-xs font-semibold tracking-[0.03em] text-[#60748D]">{label}</p>
      <p className="mt-1 text-base font-semibold text-[#164073]">{value}</p>
    </div>
  );
}
