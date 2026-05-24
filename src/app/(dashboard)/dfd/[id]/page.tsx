"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Printer,
  XCircle,
  CircleNotch,
  FileText,
  Package,
  User,
  Clock,
  Paperclip,
  Buildings,
  ShieldCheck,
  PaperPlaneTilt,
  Trash,
  CaretRight,
  House,
  DotsThreeVertical,
  CalendarBlank,
  PencilSimpleLine,
  MapPin,
  ListBullets,
  UsersThree,
} from "@phosphor-icons/react";
import { useRouter, useParams } from "next/navigation";
import { getSafeUser, supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { normalizeRole, type UserRole } from "@/lib/access";
import { canSendDfdToChefia } from "@/lib/dfd-send-permissions";
import { buildDfdPrintExportCsv } from "@/lib/dfd-print-export";
import { DfdSubmissionAnimation } from "@/components/feedback/DfdSubmissionAnimation";
import { useReducedMotion, motionProps } from "@/lib/use-reduced-motion";
import { CategoryAvatar } from "@/components/user/CategoryAvatar";

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
  analysis_responsavel_nome?: string | null;
  analysis_responsavel_avatar_url?: string | null;
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

const STATUS_META: Record<DfdStatus, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-[#E8EDF2] text-[#3E4C5F]" },
  triagem: { label: "Em análise", className: "bg-[#DCEAF0] text-[#1C5A6B]" },
  aprovada: { label: "Homologada", className: "bg-[#E7F0EA] text-[#5F735C]" },
  devolvida: { label: "Devolvida", className: "bg-[#FFF3E6] text-[#B9895A]" },
  pactuando: { label: "Pactuação", className: "bg-[#E8EDF2] text-[#2D5D94]" },
  concluida: { label: "Concluída", className: "bg-[#E7F0EA] text-[#5F735C]" },
};

export default function DfdDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const reducedMotion = useReducedMotion();

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
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);

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
      <nav className="flex items-center gap-2 text-sm font-medium text-[#466188]">
        <button type="button" onClick={() => router.push("/dashboard")} className="inline-flex items-center gap-1.5 hover:text-[#1B57E0]">
          <House size={14} />
          Início
        </button>
        <CaretRight size={12} className="text-[#8BA0BC]" />
        <button type="button" onClick={() => router.push("/minhas-dfds")} className="hover:text-[#1B57E0]">
          DFDs
        </button>
        <CaretRight size={12} className="text-[#8BA0BC]" />
        <span className="text-[#2A4267]">Detalhes da DFD</span>
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
                onClick={() => router.back()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D7E2F0] bg-[#F7FAFF] text-[#36557F] hover:bg-[#EDF3FD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B57E0]/30"
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
              <button
                type="button"
                onClick={() => router.push("/minhas-dfds")}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--semantic-action-border)] bg-white px-4 text-sm font-semibold text-[var(--semantic-action)] hover:bg-[var(--semantic-action-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-action)]/30"
              >
                <PencilSimpleLine size={18} />
                Editar
            </button>
            {canSendToChefia ? (
              <button
                type="button"
                onClick={handleSendToTriagem}
                disabled={sendingToChefia}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--semantic-action)] px-4 text-sm font-semibold text-white hover:bg-[var(--semantic-action-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-action)]/40 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sendingToChefia ? <CircleNotch size={18} className="animate-spin" /> : <PaperPlaneTilt size={18} />}
                {sendingToChefia ? "Enviando..." : "Enviar para análise"}
              </button>
            ) : isEditablePhase ? (
              <span className="inline-flex h-12 items-center rounded-xl border border-[#E8D7B7] bg-[#FFF8EA] px-4 text-sm font-semibold text-[#8A6424]">
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
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--semantic-action-border)] bg-white text-[var(--semantic-action)] hover:bg-[var(--semantic-action-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-action)]/30"
              aria-label="Mais opções"
            >
              <DotsThreeVertical size={18} weight="bold" />
            </button>
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
              dfd.analysis_responsavel_nome ? (
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
            <div className="mt-2 flex flex-wrap gap-2">
              {collectiveAuthors.map((author) => {
                const name = String(
                  author.author_name_snapshot ||
                    author.author_email_snapshot ||
                    author.contribution_user_id ||
                    "Participante",
                ).trim();
                return (
                  <span
                    key={author.contribution_user_id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--semantic-action-border)] bg-white px-3 py-1 text-xs font-medium text-[var(--semantic-text)]"
                  >
                    <UsersThree size={12} className="text-[var(--semantic-collab)]" />
                    {name} • {Number(author.quantidade_total || 0)} un.
                  </span>
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
                <p className="mt-2 text-sm font-medium text-[#5B6675]">Nenhum item vinculado.</p>
              </div>
            ) : (
              <div className="space-y-4 p-4">
                {items.map((item, index) => {
                  const qtd = Number(item.quantidade || 0);
                  const unit = Number(item.valor_unitario_estimado || 0);
                  const subtotal = qtd * unit;
                  const justificationText = formatJustificationForDisplay(item.justificativa_item);
                  const distributionText = extractCollectiveDistribution(item.justificativa_item);
                  return (
                    <motion.article
                      {...motionProps(reducedMotion, {
                        initial: { opacity: 0, y: 16, scale: 0.992 },
                        animate: { opacity: 1, y: 0, scale: 1 },
                        transition: { duration: 0.34, delay: Math.min(index * 0.04, 0.22) },
                      })}
                      whileHover={reducedMotion ? undefined : { y: -4, boxShadow: "0 16px 28px rgba(23,35,60,0.12)" }}
                      key={item.id}
                      className="rounded-xl border border-[var(--semantic-neutral-border)] bg-[#FCFEFF] p-4 shadow-sm"
                    >
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--semantic-action)] to-[#1B57E0] text-lg font-bold text-white shadow-md">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm text-[var(--semantic-text-muted)]">Código</p>
                            <p className="truncate text-2xl font-bold tracking-tight text-[var(--semantic-action)]">
                              #{item.codigo_tce || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-xl border border-[var(--semantic-action-border)] bg-gradient-to-r from-white to-[var(--semantic-action-soft)] px-3 py-2.5">
                          <p className="text-sm font-semibold uppercase tracking-[0.03em] text-[var(--semantic-action)]">
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
                          <h3 className="break-words text-lg font-semibold leading-[1.45] text-[var(--semantic-text)] [overflow-wrap:anywhere]">
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
                          <SmallInfo label="GND" value={item.gnd || "Não informado"} />
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
                          <p className="mt-1 break-words text-sm font-semibold text-[#3E4C5F]">{distributionText}</p>
                        </div>
                      ) : null}

                      {item.link_referencia ? (
                        <a
                          href={item.link_referencia}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--semantic-action-border)] bg-white px-4 text-sm font-semibold text-[var(--semantic-action)] hover:bg-[var(--semantic-action-soft)]"
                        >
                          <Paperclip size={16} />
                          Abrir referência técnica
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
            <div className="mt-4 rounded-xl border border-dashed border-[#C9DAF4] bg-[#F6FAFF] px-4 py-8 text-center text-sm text-[#60748D]">
              Ainda não há movimentações registradas.
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {timelineEntries.map((entry, index) => {
                const meta = getTimelineMeta(entry.action);
                const isLatest = index === 0;
                return (
                  <div key={entry.id || `${entry.action}-${entry.created_at}-${index}`} className="relative flex gap-3">
                    {index < timelineEntries.length - 1 ? (
                      <span className="absolute left-[10px] top-8 h-[calc(100%-8px)] w-px bg-[#BFD4F2]" />
                    ) : null}
                    <span className={`z-10 mt-1 h-5 w-5 rounded-full border-4 ${meta.dot}`} />
                    <div className={`flex-1 rounded-xl border px-4 py-3 ${isLatest ? "border-[#BFD4F2] bg-[#F5F9FF]" : "border-[#E1EAF6] bg-white"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-[var(--semantic-action)]">{meta.label}</p>
                        {isLatest ? (
                          <span className="rounded-full bg-[#E4EEFF] px-2 py-0.5 text-xs font-bold text-[#1B57E0]">
                            ATUAL
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-[var(--semantic-text-muted)]">
                        {entry.details || "Movimentação registrada automaticamente pelo sistema."}
                      </p>
                      <p className="mt-2 text-sm font-medium text-[var(--semantic-text-muted)]">
                        {formatTimelineDate(entry.created_at)}
                        {entry.actor_name ? ` • ${entry.actor_name}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
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
                      <p className="mt-1 text-sm text-[var(--semantic-text-muted)]">
                        {entry.details || "Movimentação registrada automaticamente pelo sistema."}
                      </p>
                      <p className="mt-1 text-xs font-medium text-[var(--semantic-text-muted)]">
                        {formatTimelineDate(entry.created_at)}
                        {entry.actor_name ? ` • ${entry.actor_name}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
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
    blue: "border-[#CFE0F8] bg-[#F5F9FF] text-[#21508F]",
    teal: "border-[#CBEAE9] bg-[#F2FBFB] text-[#1F7478]",
    violet: "border-[#E2D7F7] bg-[#FAF7FF] text-[#6D4CC4]",
    amber: "border-[#F5E3BC] bg-[#FFF9EE] text-[#A36B16]",
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
    <div className={`rounded-xl border border-[#79B3F8] bg-gradient-to-r from-[#0F97E7] via-[#33A1F0] to-[#3F6DEB] p-4 text-white ${className || ""}`}>
      <p className="text-sm font-semibold opacity-95">{label}</p>
      <p className="mt-1 text-xl font-bold leading-tight">{value}</p>
    </div>
  );
}

function SmallInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#D7E2F1] bg-[#F8FBFF] px-3 py-2.5">
      <p className="text-xs font-medium text-[#60748D]">{label}</p>
      <p className="mt-1 text-base font-semibold leading-tight text-[#1E3E6A]">{value}</p>
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.03em] text-[var(--semantic-text-muted)]">
          {label}
        </p>
        <p className="mt-1 break-words text-2xl font-bold leading-tight text-[var(--semantic-action)]">
          {value}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-xl border border-[#D7E2F1] bg-[#F3F8FF] px-3 py-3 text-center">
      <p className="text-xs font-semibold text-[#60748D]">{label}</p>
      <p className="mt-1 break-words text-lg font-bold leading-tight text-[#124078]">{value}</p>
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

function getTimelineMeta(action: string) {
  const map: Record<string, { label: string; dot: string }> = {
    rascunho: { label: "Rascunho criado", dot: "border-[#BFD4F2] bg-[#1B57E0]" },
    triagem: { label: "DFD criada", dot: "border-[#BFE8EB] bg-[#16A0AA]" },
    aprovada: { label: "DFD aprovada", dot: "border-[#D8E6CB] bg-[#5F9B47]" },
    devolvida: { label: "DFD devolvida", dot: "border-[#F7D6B7] bg-[#D7812F]" },
    pactuando: { label: "Em pactuação", dot: "border-[#D9CCFF] bg-[#7650E6]" },
    concluida: { label: "Processo concluído", dot: "border-[#CFE6DE] bg-[#5F735C]" },
  };
  return map[action] || { label: "Início do processo", dot: "border-[#D9CCFF] bg-[#7650E6]" };
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
