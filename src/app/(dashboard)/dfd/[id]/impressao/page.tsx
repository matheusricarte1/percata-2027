"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Printer } from "@/components/icons/phosphor/exports/Printer";
import { DownloadSimple } from "@/components/icons/phosphor/exports/DownloadSimple";
import { SealCheck } from "@/components/icons/phosphor/exports/SealCheck";
import { X } from "@/components/icons/phosphor/exports/X";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { resolveCampusBranding } from "@/lib/campus-branding";
import { buildDfdPrintExportCsv } from "@/lib/dfd-print-export";
import {
  formatCollectiveJustificationText,
  formatParsedCollectiveDistribution,
  parseCollectiveDistributionText,
  type ParsedCollectiveContributor,
} from "@/lib/collective-dfd";
import {
  DFD_PLANNING_FIELD_LABELS,
  DFD_PLANNING_FIELD_ORDER,
  hasPlanningSubsidies,
  type DfdPlanningSubsidies,
} from "@/lib/dfd-planning";
import { AvatarStack } from "@/components/user/AvatarStack";
import QRCode from "qrcode";

interface PrintItem {
  cod: string;
  desc: string;
  qtd: number;
  un: string;
  valor: number;
  gnd?: string;
  natureza?: string;
  localUso?: string;
  justificativa?: string;
  linkReferencia?: string;
  distribuicaoUsuarios: ParsedCollectiveContributor[];
}

interface PrintAuthor {
  nome: string;
  email: string;
  quantidadeTotal: number;
  valorTotalEstimado: number;
}

interface PrintData {
  id: string;
  protocolo: string;
  data: string;
  status: string;
  solicitante: string;
  solicitanteAvatar: string;
  email: string;
  aprovador: string;
  aprovadorAvatar: string;
  setor: string;
  campus: string;
  campusSigla: string;
  objeto: string;
  justificativa: string;
  planning_subsidies?: DfdPlanningSubsidies | null;
  gnd: string;
  origem?: string;
  salaColetiva?: string;
  coautores?: string;
  coautoresDetalhados: PrintAuthor[];
  itens: PrintItem[];
}

export default function DFDPrintPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id || "";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PrintData | null>(null);
  const [signature, setSignature] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    const fetchPrintData = async () => {
      if (!id) return;
      setLoading(true);

      try {
        const { data: dfdData, error: dfdError } = await supabase
          .from("dfds")
          .select("*")
          .eq("id", id)
          .single();

        if (dfdError) throw dfdError;

        const [profileResult, campusResult, itemsResult, signatureResult, deptResult, labResult, logsResult, authorsResult] =
          await Promise.all([
            dfdData?.solicitante_id
              ? supabase
                  .from("profiles")
                  .select("full_name,email,avatar_url")
                  .eq("id", dfdData.solicitante_id)
                  .maybeSingle()
              : Promise.resolve({ data: null, error: null } as const),
            dfdData?.campus_id
              ? supabase
                  .from("campi")
                  .select("nome, sigla")
                  .eq("id", dfdData.campus_id)
                  .maybeSingle()
              : Promise.resolve({ data: null, error: null } as const),
            supabase.from("dfd_items").select("*").eq("dfd_id", id),
            fetch(`/api/dfd/signature?id=${encodeURIComponent(id)}`).then(async (res) => {
              const payload = await res.json().catch(() => null);
              if (!res.ok) {
                return { error: payload?.error || "Não foi possível gerar a assinatura da DFD." };
              }
              return payload;
            }),
            dfdData?.unidade_id
              ? supabase
                  .from("departamentos")
                  .select("nome")
                  .eq("id", dfdData.unidade_id)
                  .maybeSingle()
              : Promise.resolve({ data: null, error: null } as const),
            dfdData?.unidade_id
              ? supabase
                  .from("laboratorios")
                  .select("nome")
                  .eq("id", dfdData.unidade_id)
                  .maybeSingle()
              : Promise.resolve({ data: null, error: null } as const),
            supabase
              .from("dfd_logs")
              .select("user_id,action,created_at")
              .eq("dfd_id", id)
              .not("user_id", "is", null)
              .order("created_at", { ascending: false }),
            dfdData?.origin_type === "collective"
              ? supabase
                  .from("dfd_collective_dfd_authors")
                  .select("author_name_snapshot,author_email_snapshot,quantidade_total,valor_total_estimado")
                  .eq("dfd_id", id)
                  .order("valor_total_estimado", { ascending: false })
              : Promise.resolve({ data: [], error: null } as const),
          ]);

        if (profileResult.error) throw profileResult.error;
        if (campusResult.error) throw campusResult.error;
        if (itemsResult.error) throw itemsResult.error;
        if (deptResult.error) throw deptResult.error;
        if (labResult.error) throw labResult.error;
        if (logsResult.error) throw logsResult.error;
        if (authorsResult.error) throw authorsResult.error;

        const items = (itemsResult.data || []).map((item: any) => ({
          cod: item.codigo_tce ? `E-FISCO ${item.codigo_tce}` : "Sem código",
          desc: item.descricao || "Item sem descrição",
          qtd: Number(item.quantidade || 0),
          un: item.unidade_medida || "UN",
          valor: Number(item.valor_unitario_estimado || 0),
          gnd: String(item.gnd || item.gnd_derivado || "").trim(),
          natureza: String(item.codigo_natureza_despesa || "").trim(),
          localUso: String(item.local_uso || "").trim(),
          justificativa: formatCollectiveJustificationText(item.justificativa_item),
          linkReferencia: String(item.link_referencia || "").trim(),
          distribuicaoUsuarios: parseCollectiveDistributionText(item.justificativa_item),
        }));

        const gndCounter = new Map<string, number>();
        (itemsResult.data || []).forEach((item: any) => {
          const key = String(item.gnd || item.gnd_principal || "").trim();
          if (!key) return;
          gndCounter.set(key, (gndCounter.get(key) || 0) + 1);
        });
        const gndPrincipal =
          [...gndCounter.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
          "Não informado";

        const createdAt = dfdData?.created_at
          ? new Date(dfdData.created_at)
          : null;

        const campusNome = campusResult.data?.nome || campusResult.data?.sigla || "N/D";
        const campusSigla = String(campusResult.data?.sigla || "").trim();

        const setorNome =
          deptResult.data?.nome ||
          labResult.data?.nome ||
          dfdData?.local_de_uso ||
          (itemsResult.data || []).find((item: any) => item.local_uso)?.local_uso ||
          "SETOR NÃO INFORMADO";

        const approvalActions = ["aprovada", "homologacao", "concluida"];
        const approverLog =
          (logsResult.data || []).find((log: any) => approvalActions.includes(String(log.action || "").toLowerCase())) ||
          (logsResult.data || [])[0];

        let approverName = "Aguardando homologação";
        let approverAvatar = "";
        if (approverLog?.user_id) {
          const { data: approverProfile } = await supabase
            .from("profiles")
            .select("full_name,avatar_url")
            .eq("id", approverLog.user_id)
            .maybeSingle();
          approverName = approverProfile?.full_name || approverName;
          approverAvatar = approverProfile?.avatar_url || "";
        }

        const normalizedData: PrintData = {
          id: String(dfdData?.id || id),
          protocolo:
            dfdData?.numero_protocolo || `DFD-${id.slice(0, 8).toUpperCase()}`,
          data: createdAt
            ? createdAt.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : "Data não informada",
          status: String(dfdData?.status || "rascunho"),
          solicitante: profileResult.data?.full_name || "SOLICITANTE NÃO INFORMADO",
          solicitanteAvatar: profileResult.data?.avatar_url || "",
          email: profileResult.data?.email || "sem-email@upe.br",
          aprovador: approverName,
          aprovadorAvatar: approverAvatar,
          setor: setorNome,
          campus: campusNome,
          campusSigla,
          objeto: dfdData?.objeto_contratacao || "Objeto não informado",
          justificativa:
            dfdData?.justificativa_contratacao ||
            "Sem justificativa cadastrada para esta demanda.",
          planning_subsidies: dfdData?.planning_subsidies || {},
          gnd: gndPrincipal,
          origem:
            dfdData?.origin_type === "collective"
              ? "DFD coletiva convertida"
              : "DFD individual",
          salaColetiva: dfdData?.collective_origin_room_title || "",
          coautores: (authorsResult.data || [])
            .map((author: any) => {
              const name = String(
                author.author_name_snapshot || author.author_email_snapshot || "Autor não identificado",
              ).trim();
              return `${name} (qtd ${Number(author.quantidade_total || 0)})`;
            })
            .join("; "),
          coautoresDetalhados: (authorsResult.data || []).map((author: any) => ({
            nome: String(
              author.author_name_snapshot || author.author_email_snapshot || "Autor não identificado",
            ).trim(),
            email: String(author.author_email_snapshot || "").trim(),
            quantidadeTotal: Number(author.quantidade_total || 0),
            valorTotalEstimado: Number(author.valor_total_estimado || 0),
          })),
          itens: items,
        };
        setData(normalizedData);

        const sig = String(signatureResult?.signature || "");
        setSignature(sig);

        const verificationUrl = String(signatureResult?.verificationUrl || "");
        if (sig && verificationUrl) {
          const qr = await QRCode.toDataURL(verificationUrl, {
            width: 108,
            margin: 1,
            color: { dark: "#164073", light: "#FFFFFF" },
          });
          setQrDataUrl(qr);
        } else if (signatureResult?.error) {
          toast.error(`Erro na assinatura da DFD: ${signatureResult.error}`);
          setQrDataUrl("");
        } else {
          setQrDataUrl("");
        }
      } catch (error: any) {
        toast.error("Erro ao montar impressão da DFD: " + error.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPrintData();
  }, [id]);

  const total = useMemo(
    () => (data ? data.itens.reduce((acc, item) => acc + item.qtd * item.valor, 0) : 0),
    [data],
  );

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/minhas-dfds");
  };

  const exportData = () => {
    if (!data) return;
    const csv = buildDfdPrintExportCsv({
      ...data,
      sala_coletiva: data.salaColetiva,
      coautores_detalhados: data.coautoresDetalhados.map((author) => ({
        nome: author.nome,
        email: author.email,
        quantidade_total: author.quantidadeTotal,
        valor_total_estimado: author.valorTotalEstimado,
      })),
      itens: data.itens.map((item) => ({
        cod: item.cod,
        desc: item.desc,
        qtd: item.qtd,
        un: item.un,
        valor: item.valor,
        gnd: item.gnd,
        natureza: item.natureza,
        local_uso: item.localUso,
        justificativa_item: item.justificativa,
        link_referencia: item.linkReferencia,
        distribuicao_usuarios: formatParsedCollectiveDistribution(item.distribuicaoUsuarios),
        distribuicao_usuarios_json:
          item.distribuicaoUsuarios.length > 0
            ? JSON.stringify(item.distribuicaoUsuarios)
            : "",
      })),
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.protocolo || "dfd"}_dados.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Dados da DFD exportados em CSV.");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--p-color-surface-muted)]">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-muted)]">
          Preparando documento de impressão...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--p-color-surface-muted)]">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-muted)]">
          DFD não encontrada para impressão.
        </p>
      </div>
    );
  }

  const branding = resolveCampusBranding(data.campus || data.campusSigla);

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-[var(--p-color-surface-muted)] p-8 print:bg-white print:p-0">
      <div className="print:hidden flex gap-3">
        <button
          onClick={handleBack}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--p-color-border)] bg-white px-4 text-sm font-semibold text-[var(--p-color-fg-muted)] transition hover:bg-[var(--p-color-surface-muted)]"
          aria-label="Voltar para a tela anterior"
        >
          <X size={16} weight="bold" />
          Voltar
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--p-color-brand-500)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--p-color-brand-600)]"
        >
          <Printer size={18} weight="fill" />
          Imprimir / Salvar PDF
        </button>
        <button
          onClick={exportData}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--p-color-border)] bg-white px-5 text-sm font-semibold text-[var(--p-color-fg-muted)] transition hover:bg-[var(--p-color-surface-muted)]"
        >
          <DownloadSimple size={18} />
          Exportar dados
        </button>
      </div>

      <div className="w-full max-w-[210mm] min-h-[297mm] border border-[var(--p-color-border)] bg-white p-[16mm] shadow-2xl print:border-none print:shadow-none">
        <header className="rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="type-kicker font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">
                Documento de Formalização de Demanda
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--p-color-brand-500)]">
                {data.protocolo}
              </h1>
              <p className="text-xs text-[var(--p-color-fg-muted)]">{data.data}</p>
              <span className="inline-flex rounded-full bg-[var(--p-color-surface-subtle)] px-3 py-1 type-kicker font-semibold uppercase tracking-[0.12em] text-[var(--p-color-brand-500)]">
                Status Atual: {data.status}
              </span>
            </div>

            <div className="flex flex-col items-end gap-2">
              <img
                src={branding.logoSrc}
                alt={branding.label}
                className="h-[52px] w-auto object-contain"
              />
              <span
                className="rounded-full px-3 py-1 type-kicker font-semibold uppercase tracking-[0.12em]"
                style={{ backgroundColor: branding.accentSoft, color: branding.accent }}
              >
                {data.campus}
              </span>
            </div>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <InfoCard label="Solicitante" value={data.solicitante} />
          <InfoCard label="E-mail" value={data.email} />
          <InfoCard label="Setor / Lotação" value={data.setor} />
          <InfoCard label="Campus" value={data.campus} />
        </section>

        <section className="mt-4 grid grid-cols-2 gap-4">
          <AvatarCard
            title="Solicitante"
            name={data.solicitante}
            avatarUrl={data.solicitanteAvatar}
          />
          <AvatarCard
            title="Responsável pela homologação"
            name={data.aprovador}
            avatarUrl={data.aprovadorAvatar}
          />
        </section>

        <section className="mt-5 rounded-2xl border border-[var(--p-color-border)] p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">
            Objeto da Contratação
          </h2>
          <p className="mt-2 text-base font-semibold text-[var(--p-color-brand-500)]">{data.objeto}</p>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">
            Justificativa da Necessidade
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--p-color-fg-muted)]">{data.justificativa}</p>
        </section>

        {data.origem === "DFD coletiva convertida" ? (
          <section className="mt-5 rounded-2xl border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-color-brand-500)]">
              Coautoria coletiva
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <InfoCard label="Origem" value={data.origem} />
              <InfoCard label="Sala coletiva" value={data.salaColetiva || "Não informada"} />
            </div>
            {data.coautoresDetalhados.length > 0 ? (
              <>
                <AvatarStack
                  members={data.coautoresDetalhados.map((author, index) => ({
                    id: author.email || `${author.nome}-${index}`,
                    name: author.nome,
                    email: author.email || null,
                    avatarUrl: null,
                  }))}
                  total={data.coautoresDetalhados.length}
                  label={`${data.coautoresDetalhados.length} coautor(es) preservados`}
                  size="sm"
                  className="mt-3"
                />
                <div className="mt-3 overflow-hidden rounded-xl border border-[var(--p-color-border)] bg-white">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[var(--p-color-surface-subtle)] text-[var(--p-color-brand-500)] uppercase tracking-[0.12em]">
                        <th className="px-3 py-2 text-left">Usuário</th>
                        <th className="px-3 py-2 text-left">E-mail</th>
                        <th className="px-3 py-2 text-center">Qtd.</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.coautoresDetalhados.map((author, index) => (
                        <tr key={`${author.email}-${index}`} className="border-t border-[var(--p-color-surface-subtle)]">
                          <td className="px-3 py-2 font-medium text-[var(--p-color-fg-default)]">{author.nome}</td>
                          <td className="px-3 py-2 text-[var(--p-color-fg-muted)]">{author.email || "Não informado"}</td>
                          <td className="px-3 py-2 text-center text-[var(--p-color-fg-default)]">{author.quantidadeTotal}</td>
                          <td className="px-3 py-2 text-right text-[var(--p-color-brand-500)]">
                            {author.valorTotalEstimado.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {hasPlanningSubsidies(data.planning_subsidies) ? (
          <section className="mt-5 rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">
              Complementos do planejamento
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3">
              {DFD_PLANNING_FIELD_ORDER.map((field) => {
                const text = String(data.planning_subsidies?.[field] || "").trim();
                if (!text) return null;
                return (
                  <div key={field} className="rounded-xl border border-[var(--p-color-border)] bg-white px-3 py-2">
                    <p className="type-kicker font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">
                      {DFD_PLANNING_FIELD_LABELS[field]}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--p-color-fg-muted)]">
                      {text}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="mt-5 rounded-2xl border border-[var(--p-color-border)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--p-color-surface-subtle)] text-[var(--p-color-brand-500)] uppercase tracking-[0.12em]">
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-center">Qtd</th>
                <th className="px-3 py-2 text-center">Un</th>
                <th className="px-3 py-2 text-right">Unitário</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.itens.map((item, index) => (
                <tr key={`${item.cod}-${index}`} className="border-t border-[var(--p-color-surface-subtle)] align-top">
                  <td className="px-3 py-3 font-semibold text-[var(--p-color-fg-muted)]">{item.cod}</td>
                  <td className="px-3 py-3 text-[var(--p-color-fg-default)]">
                    <p>{item.desc}</p>
                    <div className="mt-2 grid gap-1 type-kicker leading-relaxed text-[var(--p-color-fg-muted)]">
                      {item.gnd || item.natureza ? (
                        <p>
                          <span className="font-semibold uppercase text-[var(--p-color-brand-500)]">Natureza/GND:</span>{" "}
                          {[item.natureza, item.gnd].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                      {item.localUso ? (
                        <p>
                          <span className="font-semibold uppercase text-[var(--p-color-brand-500)]">Local:</span>{" "}
                          {item.localUso}
                        </p>
                      ) : null}
                      {item.justificativa ? (
                        <p className="whitespace-pre-wrap">
                          <span className="font-semibold uppercase text-[var(--p-color-brand-500)]">Justificativa:</span>{" "}
                          {item.justificativa}
                        </p>
                      ) : null}
                      {item.distribuicaoUsuarios.length > 0 ? (
                        <p>
                          <span className="font-semibold uppercase text-[var(--p-color-brand-500)]">
                            Distribuição por usuário:
                          </span>{" "}
                          {formatParsedCollectiveDistribution(item.distribuicaoUsuarios)}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-[var(--p-color-fg-default)]">{item.qtd}</td>
                  <td className="px-3 py-3 text-center text-[var(--p-color-fg-default)]">{item.un}</td>
                  <td className="px-3 py-3 text-right text-[var(--p-color-fg-default)]">
                    {item.valor.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-[var(--p-color-brand-500)]">
                    {(item.qtd * item.valor).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-[var(--p-color-border)] bg-[var(--p-color-surface-muted)] px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-muted)]">
              GND predominante: {data.gnd}
            </span>
            <span className="text-lg font-semibold text-[var(--p-color-brand-500)]">
              {total.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          </div>
        </section>

        <footer className="mt-8 grid grid-cols-[1fr_auto] gap-4 rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] p-4">
          <div>
            <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-color-brand-500)]">
              <SealCheck size={14} />
              Validação de Integridade
            </p>
            <p className="mt-2 type-caption text-[var(--p-color-fg-muted)]">
              Este PDF foi emitido pelo PERCATA com assinatura criptográfica SHA-256.
            </p>
            <p className="mt-1 font-mono type-kicker text-[var(--p-color-fg-muted)] break-all">
              {signature || "assinatura indisponível"}
            </p>
            <p className="mt-1 type-kicker text-[var(--p-color-fg-subtle)]">
              Escaneie o QR Code para validar autenticidade no PERCATA.
            </p>
          </div>
          <div className="flex items-center justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code de verificação da DFD"
                className="h-[108px] w-[108px] rounded-md border border-[var(--p-color-border)] bg-white p-1"
              />
            ) : (
              <div className="flex h-[108px] w-[108px] items-center justify-center rounded-md border border-dashed border-[var(--p-color-border)] type-kicker text-[var(--p-color-border-strong)]">
                QR indisponível
              </div>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] px-3 py-2">
      <p className="type-kicker font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-[var(--p-color-fg-default)]">{value}</p>
    </div>
  );
}

function AvatarCard({
  title,
  name,
  avatarUrl,
}: {
  title: string;
  name: string;
  avatarUrl?: string;
}) {
  const initials = String(name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] p-3">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-10 w-10 rounded-full border border-[var(--p-color-border)] object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--p-color-surface-subtle)] text-xs font-semibold text-[var(--p-color-brand-500)]">
          {initials}
        </div>
      )}
      <div className="min-w-0">
        <p className="type-kicker font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">
          {title}
        </p>
        <p className="truncate text-sm font-medium text-[var(--p-color-fg-default)]">{name}</p>
      </div>
    </div>
  );
}
