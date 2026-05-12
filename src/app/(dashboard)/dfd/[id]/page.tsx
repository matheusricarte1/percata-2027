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
  WarningCircle,
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

type DfdStatus = "rascunho" | "triagem" | "aprovada" | "devolvida" | "pactuando" | "concluida";

type DfdDetails = {
  id: string;
  status: DfdStatus;
  created_at: string;
  numero_protocolo?: string | null;
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
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState<UserRole>("solicitante");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [markingKit, setMarkingKit] = useState(false);
  const [sendingToChefia, setSendingToChefia] = useState(false);
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
  const canSendToChefia =
    (dfd.status === "rascunho" || dfd.status === "devolvida") &&
    canSendDfdToChefia({
      currentUserId,
      solicitanteId: dfd.solicitante_id,
    });

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-5 pb-28 md:px-6">
      <header className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D9E0E8] bg-[#FAFBFC] text-[#3E4C5F] hover:bg-[#F4F7FA]"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="rounded-full bg-[#E8EDF2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#164073]">
                {dfd.numero_protocolo || `DFD-${dfd.id.slice(0, 8).toUpperCase()}`}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${status.className}`}
              >
                {status.label}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#164073]">
              {dfd.objeto_contratacao || "Demanda sem objeto informado"}
            </h1>
            <p className="mt-1 text-sm text-[#5B6675]">
              Protocolo de solicitação com rastreabilidade completa de itens e decisões.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canMarkAsKit && (
              <button
                type="button"
                onClick={handleMarkAsKit}
                disabled={markingKit}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#C7D7EA] bg-[#F7FBFF] px-4 text-[11px] font-semibold uppercase tracking-[0.11em] text-[#164073] hover:bg-[#EAF2FF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Package size={14} weight="bold" />
                {markingKit ? "Marcando..." : "Marcar como kit"}
              </button>
            )}
            {canSendToChefia && (
              <button
                type="button"
                onClick={handleSendToTriagem}
                disabled={sendingToChefia}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1F6F78] px-4 text-[11px] font-semibold uppercase tracking-[0.11em] text-white hover:bg-[#1C5A6B] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sendingToChefia ? (
                  <CircleNotch size={14} className="animate-spin" />
                ) : (
                  <PaperPlaneTilt size={14} weight="bold" />
                )}
                {sendingToChefia ? "Enviando..." : "Enviar para análise"}
              </button>
            )}
            {canDeleteDfdAsSuperadmin && (
              <button
                type="button"
                onClick={handleDeleteDfdAsSuperadmin}
                disabled={deletingDfd}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-[11px] font-semibold uppercase tracking-[0.11em] text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingDfd ? (
                  <CircleNotch size={14} className="animate-spin" />
                ) : (
                  <Trash size={14} weight="bold" />
                )}
                {deletingDfd ? "Excluindo..." : "Excluir DFD"}
              </button>
            )}
            {(dfd.status === "rascunho" || dfd.status === "devolvida") && !canSendToChefia && (
              <span className="inline-flex min-h-10 max-w-[260px] items-center rounded-xl border border-[#E8D7B7] bg-[#FFF8EA] px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A6424]">
                Somente quem criou a DFD pode enviar
              </span>
            )}
            <button
              type="button"
              onClick={() => router.push(`/dfd/${id}/impressao`)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#D9E0E8] bg-[#FAFBFC] text-[#3E4C5F] hover:bg-[#F4F7FA]"
              title="Imprimir DFD"
            >
              <Printer size={17} weight="fill" />
            </button>
            <button
              type="button"
              onClick={handleDownloadData}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#D9E0E8] bg-[#FAFBFC] text-[#3E4C5F] hover:bg-[#F4F7FA]"
              title="Baixar dados da DFD"
            >
              <DownloadSimple size={17} weight="bold" />
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
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

            <div className="mt-3 rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#7D98B8]">
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

          <section className="rounded-2xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E8EDF2] px-4 py-3">
              <h2 className="inline-flex items-center gap-2 text-base font-semibold text-[#164073]">
                <Package size={18} weight="fill" />
                Itens da DFD ({items.length})
              </h2>
              <p className="text-sm font-semibold text-[#164073]">{formatCurrency(totalGeral)}</p>
            </div>

            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <WarningCircle size={36} className="mx-auto text-[#A7B1BD]" />
                <p className="mt-2 text-sm font-medium text-[#5B6675]">Nenhum item vinculado.</p>
              </div>
            ) : (
              <div className="space-y-2 p-3">
                {items.map((item, index) => {
                  const qtd = Number(item.quantidade || 0);
                  const unit = Number(item.valor_unitario_estimado || 0);
                  const subtotal = qtd * unit;
                  return (
                    <article
                      key={item.id}
                      className="rounded-xl border border-[#E8EDF2] bg-[#FAFBFC] p-3"
                    >
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#E8EDF2] px-2 py-0.5 text-[10px] font-semibold text-[#164073]">
                              Item {index + 1}
                            </span>
                            {item.codigo_tce ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#5B6675]">
                                <Hash size={11} />
                                {item.codigo_tce}
                              </span>
                            ) : null}
                          </div>
                          <h3 className="mt-1 break-words text-sm font-semibold leading-snug text-[#164073]">
                            {item.descricao || "Descrição não informada"}
                          </h3>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-right">
                          <MetricChip label="Qtd." value={String(qtd)} />
                          <MetricChip label="Unitário" value={formatCurrency(unit)} />
                          <MetricChip label="Subtotal" value={formatCurrency(subtotal)} />
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <SmallInfo label="Local de uso" value={item.local_uso || "Não informado"} />
                        <SmallInfo label="Unidade" value={item.unidade_medida || "UN"} />
                      </div>

                      {item.justificativa_item ? (
                        <div className="mt-2 rounded-lg border border-[#D9E0E8] bg-white p-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">
                            Justificativa do item
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-xs text-[#5B6675]">{item.justificativa_item}</p>
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

        <div className="space-y-4">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm"
          >
            <h2 className="inline-flex items-center gap-2 text-base font-semibold text-[#164073]">
              <Clock size={18} weight="fill" />
              Histórico de tramitação
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#5B6675]">
              Acompanhe a sequência oficial de movimentações desta DFD.
            </p>
            <div className="mt-3">
              <DfdTimeline logs={logs} />
            </div>
          </motion.section>
        </div>
      </div>
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
    <div className="rounded-xl border border-[#E8EDF2] bg-[#FAFBFC] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="inline-flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-[#3E4C5F]">
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
    <div className="rounded-lg border border-[#E8EDF2] bg-white p-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-[#3E4C5F]">{value}</p>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#D9E0E8] bg-white px-2 py-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.11em] text-[#7D98B8]">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-[#164073]">{value}</p>
    </div>
  );
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
