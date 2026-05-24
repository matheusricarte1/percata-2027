"use client";

import React, { useState, useEffect, useCallback } from "react";
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
} from "@phosphor-icons/react";
import { useRouter, useParams } from "next/navigation";
import { getSafeUser, supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
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

      <header className="rounded-2xl border border-[#D5E1F0] bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.06)] md:p-6">
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
              <h1 className="text-3xl font-bold tracking-tight text-[#0D2A62] md:text-4xl">
                {dfd.numero_protocolo || `DFD #${dfd.id.slice(0, 8).toUpperCase()}`}
              </h1>
              <span className={`rounded-full px-4 py-1 text-sm font-semibold ${status.className}`}>
                {status.label}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-lg text-[#8BA0BC]">
              <p className="inline-flex items-center gap-2 text-lg font-semibold text-[#244D87]">
                <Buildings size={24} />
                <span className="text-xl">{campusLabel}</span>
              </p>
              <span>|</span>
              <p className="inline-flex items-center gap-2 text-lg font-semibold text-[#244D87]">
                <CalendarBlank size={24} />
                <span className="text-xl">Ciclo: {String(dfd.exercicio || 2027)}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
              <button
                type="button"
                onClick={() => router.push("/minhas-dfds")}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#BFD4F2] bg-white px-4 text-sm font-semibold text-[#1B57E0] hover:bg-[#F3F8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B57E0]/30"
              >
                <PencilSimpleLine size={18} />
                Editar
            </button>
            {canSendToChefia ? (
              <button
                type="button"
                onClick={handleSendToTriagem}
                disabled={sendingToChefia}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1656E8] px-4 text-sm font-semibold text-white hover:bg-[#1147C2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1656E8]/40 disabled:cursor-not-allowed disabled:opacity-70"
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
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#BFD4F2] bg-white px-4 text-sm font-semibold text-[#1B57E0] hover:bg-[#F3F8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B57E0]/30"
            >
              <Printer size={18} weight="fill" />
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={handleDownloadData}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#BFD4F2] bg-white text-[#1B57E0] hover:bg-[#F3F8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B57E0]/30"
              aria-label="Mais opções"
            >
              <DotsThreeVertical size={18} weight="bold" />
            </button>
            {canMarkAsKit ? (
            <button
              type="button"
              onClick={handleMarkAsKit}
              disabled={markingKit}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#BFD4F2] bg-white px-4 text-sm font-semibold text-[#1B57E0] hover:bg-[#F3F8FF] disabled:opacity-60"
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
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
                {deletingDfd ? <CircleNotch size={16} className="animate-spin" /> : <Trash size={16} weight="bold" />}
                Excluir
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-[#D5E1F0] bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetaCard
            icon={User}
            label={requesterLabel}
            value={requesterValue}
            tone="blue"
            rightContent={
              <ProfileAvatar
                name={requesterAvatarName}
                avatarUrl={dfd.profiles?.avatar_url || null}
              />
            }
          />
          <MetaCard icon={MapPin} label="Local de uso" value={dfd.unidade_nome || "Não informado"} tone="violet" />
          <MetaCard
            icon={ShieldCheck}
            label="Responsável pela análise"
            value={dfd.analysis_unidade_nome || dfd.unidade_nome || "Não informado"}
            tone="violet"
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
          <div className="mt-4 rounded-xl border border-[#D6E2F0] bg-[#F7FAFF] p-4">
            <p className="text-sm font-semibold text-[#214A81]">
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
                    className="inline-flex items-center rounded-full border border-[#C5D8F1] bg-white px-3 py-1 text-xs font-medium text-[#34506F]"
                  >
                    {name} • {Number(author.quantidade_total || 0)} un.
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-[#D5E1F0] bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
            <h2 className="inline-flex items-center gap-2 text-xl font-bold text-[#0D2A62]">
              <FileText size={30} weight="fill" />
              Justificativa da DFD
            </h2>
            <div className="mt-4 rounded-xl border border-[#C9DAF4] bg-[#F6FAFF] p-5">
              <p className="whitespace-pre-wrap text-base leading-relaxed text-[#1F3B63]">
                {dfd.justificativa_contratacao || "Sem justificativa registrada para esta solicitação."}
              </p>
              {dfd.analysis_routing_reason ? (
                <p className="mt-4 rounded-lg border border-[#D9E0E8] bg-white px-3 py-2 text-sm font-semibold text-[#3E4C5F]">
                  Roteamento da chefia: {dfd.analysis_routing_reason}
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-[#D5E1F0] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between border-b border-[#E2ECF7] px-5 py-4">
              <h2 className="inline-flex items-center gap-2 text-xl font-bold text-[#0D2A62]">
                <Package size={30} weight="fill" />
                Itens da DFD
                <span className="rounded-full bg-[#E8F0FF] px-3 py-1 text-sm font-semibold text-[#1B57E0]">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </span>
              </h2>
              <p className="text-xl font-bold text-[#1656E8]">{formatCurrency(totalGeral)}</p>
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
                    <article
                      key={item.id}
                      className="rounded-xl border border-[#D7E2F1] bg-[#FCFEFF] p-4 shadow-sm"
                    >
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#1B57E0] text-xl font-bold text-white">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div>
                              <p className="text-sm text-[#60748D]">Código</p>
                              <p className="text-xl font-bold text-[#0D2A62]">#{item.codigo_tce || "N/A"}</p>
                            </div>
                          </div>
                          <h3 className="mt-3 break-words text-lg font-semibold leading-[1.5] text-[#112F62] [overflow-wrap:anywhere]">
                            {formatCatalogDescription(item.descricao)}
                          </h3>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <MetricChip label="QTD." value={String(qtd)} />
                          <MetricChip label="Valor unitário" value={formatCurrency(unit)} />
                          <MetricChip label="Subtotal" value={formatCurrency(subtotal)} />
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
                        <SmallInfo label="Local de uso" value={item.local_uso || "Não informado"} />
                        <SmallInfo label="Unidade" value={item.unidade_medida || "UN"} />
                        <SmallInfo label="GND" value={item.gnd || "Não informado"} />
                      </div>

                      {justificationText ? (
                        <div className="mt-3 rounded-lg border border-[#D9E0E8] bg-white p-3">
                          <p className="text-sm font-semibold tracking-[0.03em] text-[#5A7596]">
                            Justificativa do item
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#5B6675]">
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
                          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#1B57E0] hover:underline"
                        >
                          <Paperclip size={14} />
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

        <section className="rounded-2xl border border-[#D5E1F0] bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.05)] lg:sticky lg:top-4 lg:h-fit">
          <h2 className="inline-flex items-center gap-2 text-xl font-bold text-[#0D2A62]">
            <Clock size={30} weight="fill" />
            Histórico de tramitação
          </h2>
          <p className="mt-2 text-base leading-6 text-[#38567F]">
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
                        <p className="text-base font-bold text-[#123B6B]">{meta.label}</p>
                        {isLatest ? (
                          <span className="rounded-full bg-[#E4EEFF] px-2 py-0.5 text-xs font-bold text-[#1B57E0]">
                            ATUAL
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-[#405B7E]">
                        {entry.details || "Movimentação registrada automaticamente pelo sistema."}
                      </p>
                      <p className="mt-2 text-sm font-medium text-[#5E7695]">
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
            onClick={() => router.push("/historico")}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#BFD4F2] bg-white text-base font-semibold text-[#1B57E0] hover:bg-[#F3F8FF]"
          >
            <ListBullets size={18} />
            Ver todas as movimentações
          </button>
        </section>
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
      <p className="text-sm font-medium tracking-[0.02em] opacity-85">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="inline-flex min-w-0 items-start gap-2 text-lg font-semibold leading-tight">
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
      <p className="text-base font-semibold opacity-95">{label}</p>
      <p className="mt-1 text-2xl font-bold leading-tight">{value}</p>
    </div>
  );
}

function SmallInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#D7E2F1] bg-[#F8FBFF] px-3 py-2.5">
      <p className="text-sm font-medium text-[#60748D]">{label}</p>
      <p className="mt-1 text-lg font-semibold leading-tight text-[#1E3E6A]">{value}</p>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#D7E2F1] bg-[#F3F8FF] px-3 py-3 text-center">
      <p className="text-sm font-semibold text-[#60748D]">{label}</p>
      <p className="mt-1 break-words text-xl font-bold leading-tight text-[#124078]">{value}</p>
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

function ProfileAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [broken, setBroken] = useState(false);

  if (!avatarUrl || broken) {
      return (
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D2DEF0] bg-white text-sm font-semibold uppercase text-[#164073]">
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={name}
      className="h-11 w-11 rounded-full border border-[#D2DEF0] object-cover"
      onError={() => setBroken(true)}
    />
  );
}
