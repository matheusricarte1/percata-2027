"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Printer } from "@/components/icons/phosphor/exports/Printer";
import { ArrowLeft } from "@/components/icons/phosphor/exports/ArrowLeft";
import { SealCheck } from "@/components/icons/phosphor/exports/SealCheck";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { resolveCampusBranding } from "@/lib/campus-branding";
import { fetchActiveCycleYear } from "@/lib/cycle";
import {
  formatCollectiveJustificationText,
  formatParsedCollectiveDistribution,
  parseCollectiveDistributionText,
} from "@/lib/collective-dfd";
import {
  DFD_PLANNING_FIELD_LABELS,
  DFD_PLANNING_FIELD_ORDER,
  hasPlanningSubsidies,
  type DfdPlanningSubsidies,
} from "@/lib/dfd-planning";
import { AvatarStack } from "@/components/user/AvatarStack";
import QRCode from "qrcode";

type DfdRow = {
  id: string;
  numero_protocolo?: string | null;
  objeto_contratacao?: string | null;
  justificativa_contratacao?: string | null;
  justificativa_quantidade?: string | null;
  planning_subsidies?: DfdPlanningSubsidies | null;
  previsao_recebimento?: string | null;
  status?: string | null;
  origin_type?: string | null;
  collective_origin_room_title?: string | null;
  collective_origin_expense_class?: string | null;
  campus?: string | null;
  campus_id?: string | null;
  created_at?: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
  campi?: { nome?: string | null; sigla?: string | null } | null;
};

type CollectiveAuthor = {
  author_name_snapshot?: string | null;
  author_email_snapshot?: string | null;
  quantidade_total?: number | null;
  valor_total_estimado?: number | null;
};

export default function DfdPdfPage() {
  const { id } = useParams<{ id: string }>();
  const [dfd, setDfd] = useState<DfdRow | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [signature, setSignature] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [setorNome, setSetorNome] = useState("");
  const [cycleYear, setCycleYear] = useState<number>(new Date().getFullYear());
  const [collectiveAuthors, setCollectiveAuthors] = useState<CollectiveAuthor[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: rawDfdData, error: dfdError } = await supabase
          .from("dfds")
          .select("*")
          .eq("id", id)
          .single();

        if (dfdError) throw dfdError;

        const [profileResult, campusResult, signatureResult, deptResult, labResult, authorsResult] = await Promise.all([
          rawDfdData?.solicitante_id
            ? supabase
                .from("profiles")
                .select("full_name, email")
                .eq("id", rawDfdData.solicitante_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null } as any),
          rawDfdData?.campus_id
            ? supabase
                .from("campi")
                .select("nome, sigla")
                .eq("id", rawDfdData.campus_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null } as any),
          fetch(`/api/dfd/signature?id=${encodeURIComponent(String(id || ""))}`).then(async (res) => {
            const payload = await res.json().catch(() => null);
            if (!res.ok) {
              return { error: payload?.error || "Não foi possível gerar a assinatura da DFD." };
            }
            return payload;
          }),
          rawDfdData?.unidade_id
            ? supabase
                .from("departamentos")
                .select("nome")
                .eq("id", rawDfdData.unidade_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null } as any),
          rawDfdData?.unidade_id
            ? supabase
                .from("laboratorios")
                .select("nome")
                .eq("id", rawDfdData.unidade_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null } as any),
          rawDfdData?.origin_type === "collective"
            ? supabase
                .from("dfd_collective_dfd_authors")
                .select("author_name_snapshot,author_email_snapshot,quantidade_total,valor_total_estimado")
                .eq("dfd_id", id)
                .order("valor_total_estimado", { ascending: false })
            : Promise.resolve({ data: [], error: null } as any),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (campusResult.error) throw campusResult.error;
        if (deptResult.error) throw deptResult.error;
        if (labResult.error) throw labResult.error;
        if (authorsResult.error) throw authorsResult.error;

        const dfdData: DfdRow = {
          ...rawDfdData,
          profiles: profileResult.data || null,
          campi: campusResult.data || null,
        };

        const { data: itemsData, error: itemsError } = await supabase
          .from("dfd_items")
          .select("*")
          .eq("dfd_id", id);

        if (itemsError) throw itemsError;

        setDfd(dfdData);
        setItems(itemsData || []);
        setCollectiveAuthors((authorsResult.data || []) as CollectiveAuthor[]);
        setSetorNome(
          deptResult.data?.nome ||
            labResult.data?.nome ||
            rawDfdData?.local_de_uso ||
            itemsData?.find((item: any) => item.local_uso)?.local_uso ||
            "",
        );

        const sig = String(signatureResult?.signature || "");
        setSignature(sig);
        try {
          const year = await fetchActiveCycleYear();
          setCycleYear(year);
        } catch {
          // fallback local year
        }

        const verificationUrl = String(signatureResult?.verificationUrl || "");
        if (sig && verificationUrl) {
          const qr = await QRCode.toDataURL(verificationUrl, {
            width: 104,
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
        toast.error("Erro ao carregar PDF da DFD: " + error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const total = useMemo(
    () =>
      items.reduce(
        (acc, item) => acc + Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0),
        0,
      ),
    [items],
  );

  if (loading || !dfd) {
    return (
      <div className="p-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-muted)]">
          Gerando documento...
        </p>
      </div>
    );
  }

  const campusName = dfd.campi?.nome || dfd.campi?.sigla || dfd.campus || "Campus UPE";
  const branding = resolveCampusBranding(campusName);

  return (
    <div className="min-h-screen bg-[var(--p-color-surface-muted)] p-0 md:p-8 flex flex-col items-center">
      <div className="no-print mb-4 flex w-full max-w-5xl justify-between">
        <Button variant="ghost" onClick={() => window.history.back()} className="font-semibold">
          <ArrowLeft size={18} className="mr-2" /> Voltar
        </Button>
        <Button onClick={() => window.print()} className="bg-[var(--p-color-brand-500)] text-white font-semibold hover:bg-[var(--p-color-brand-600)]">
          <Printer size={18} className="mr-2" /> Imprimir / Salvar PDF
        </Button>
      </div>

      <div className="w-full max-w-[210mm] min-h-[297mm] bg-white p-[16mm] shadow-2xl print:shadow-none print:p-0">
        <header className="rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="type-kicker font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">
                PERCATA
              </p>
              <p className="mt-1 type-caption font-semibold uppercase tracking-[0.12em] text-[var(--p-color-brand-500)]">
                Ciclo {cycleYear}
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-[var(--p-color-brand-500)]">
                {dfd.numero_protocolo || `DFD-${String(dfd.id).slice(0, 8).toUpperCase()}`}
              </h1>
              <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
                {dfd.created_at
                  ? new Date(dfd.created_at).toLocaleDateString("pt-BR")
                  : "Data não informada"}
              </p>
            </div>
            <img
              src={branding.logoSrc}
              alt={branding.label}
              className="h-[52px] w-auto object-contain"
            />
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-4">
          <SmallInfo label="Solicitante" value={dfd.profiles?.full_name || "Não informado"} />
          <SmallInfo label="E-mail" value={dfd.profiles?.email || "Não informado"} />
          <SmallInfo label="Campus" value={campusName} />
          <SmallInfo label="Setor / Local de uso" value={setorNome || "Não informado"} />
          <SmallInfo
            label="Previsão de recebimento"
            value={
              dfd.previsao_recebimento
                ? new Date(dfd.previsao_recebimento).toLocaleDateString("pt-BR")
                : "Não informada"
            }
          />
        </section>

        {dfd.origin_type === "collective" ? (
          <section className="mt-5 rounded-2xl border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-color-brand-500)]">
              Coautoria coletiva
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <SmallInfo label="Origem" value="DFD coletiva convertida" />
              <SmallInfo label="Sala coletiva" value={dfd.collective_origin_room_title || "Não informada"} />
            </div>
            {collectiveAuthors.length > 0 ? (
              <>
                <AvatarStack
                  members={collectiveAuthors.map((author, index) => ({
                    id: author.author_email_snapshot || `${author.author_name_snapshot}-${index}`,
                    name:
                      author.author_name_snapshot ||
                      author.author_email_snapshot ||
                      "Autor não identificado",
                    email: author.author_email_snapshot || null,
                    avatarUrl: null,
                  }))}
                  total={collectiveAuthors.length}
                  label={`${collectiveAuthors.length} coautor(es) preservados`}
                  size="sm"
                  className="mt-3"
                />
                <div className="mt-3 overflow-hidden rounded-xl border border-[var(--p-color-border)] bg-white">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[var(--p-color-surface-subtle)] text-[var(--p-color-brand-500)] uppercase tracking-[0.12em]">
                        <th className="p-2 text-left">Usuário</th>
                        <th className="p-2 text-left">E-mail</th>
                        <th className="p-2 text-center">Qtd.</th>
                        <th className="p-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collectiveAuthors.map((author, index) => (
                        <tr key={`${author.author_email_snapshot}-${index}`} className="border-t border-[var(--p-color-surface-subtle)]">
                          <td className="p-2 font-medium text-[var(--p-color-fg-default)]">
                            {author.author_name_snapshot || author.author_email_snapshot || "Autor não identificado"}
                          </td>
                          <td className="p-2 text-[var(--p-color-fg-muted)]">{author.author_email_snapshot || "Não informado"}</td>
                          <td className="p-2 text-center">{Number(author.quantidade_total || 0)}</td>
                          <td className="p-2 text-right text-[var(--p-color-brand-500)]">
                            {Number(author.valor_total_estimado || 0).toLocaleString("pt-BR", {
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

        <section className="mt-5 rounded-2xl border border-[var(--p-color-border)] p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">
            Objeto da Contratação
          </h2>
          <p className="mt-2 text-base font-semibold text-[var(--p-color-brand-500)]">
            {dfd.objeto_contratacao || "Sem objeto informado"}
          </p>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">
            Justificativa
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--p-color-fg-muted)]">
            {dfd.justificativa_contratacao || "Sem justificativa cadastrada."}
          </p>
        </section>

        {hasPlanningSubsidies(dfd.planning_subsidies) ? (
          <section className="mt-5 rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">
              Complementos do planejamento
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3">
              {DFD_PLANNING_FIELD_ORDER.map((field) => {
                const text = String(dfd.planning_subsidies?.[field] || "").trim();
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
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-left">Descrição</th>
                <th className="p-2 text-center">Qtd</th>
                <th className="p-2 text-right">Unitário</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const distribution = parseCollectiveDistributionText(item.justificativa_item);
                const itemJustification = formatCollectiveJustificationText(item.justificativa_item);
                const gnd = String(item.gnd || item.gnd_derivado || "").trim();
                const natureza = String(item.codigo_natureza_despesa || "").trim();
                return (
                  <tr key={item.id} className="border-t border-[var(--p-color-surface-subtle)] align-top">
                    <td className="p-2 font-mono type-caption">{item.codigo_tce || "-"}</td>
                    <td className="p-2 text-[var(--p-color-fg-default)]">
                      <p>{item.descricao}</p>
                      <div className="mt-2 grid gap-1 type-kicker leading-relaxed text-[var(--p-color-fg-muted)]">
                        {gnd || natureza ? (
                          <p>
                            <span className="font-semibold uppercase text-[var(--p-color-brand-500)]">Natureza/GND:</span>{" "}
                            {[natureza, gnd].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                        {item.local_uso ? (
                          <p>
                            <span className="font-semibold uppercase text-[var(--p-color-brand-500)]">Local:</span>{" "}
                            {item.local_uso}
                          </p>
                        ) : null}
                        {itemJustification ? (
                          <p className="whitespace-pre-wrap">
                            <span className="font-semibold uppercase text-[var(--p-color-brand-500)]">Justificativa:</span>{" "}
                            {itemJustification}
                          </p>
                        ) : null}
                        {distribution.length > 0 ? (
                          <p>
                            <span className="font-semibold uppercase text-[var(--p-color-brand-500)]">
                              Distribuição por usuário:
                            </span>{" "}
                            {formatParsedCollectiveDistribution(distribution)}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-2 text-center">{item.quantidade}</td>
                    <td className="p-2 text-right">
                      {Number(item.valor_unitario_estimado || 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="p-2 text-right font-semibold text-[var(--p-color-brand-500)]">
                      {(
                        Number(item.quantidade || 0) *
                        Number(item.valor_unitario_estimado || 0)
                      ).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex justify-between border-t border-[var(--p-color-border)] bg-[var(--p-color-surface-muted)] p-3">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-muted)]">
              Valor Total da Demanda
            </span>
            <span className="text-lg font-semibold text-[var(--p-color-brand-500)]">
              {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] p-4 flex items-center justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--p-color-brand-500)]">
              <SealCheck size={14} />
              Assinatura criptográfica
            </p>
            <p className="mt-1 type-kicker text-[var(--p-color-fg-muted)] break-all">
              {signature || "assinatura indisponível"}
            </p>
          </div>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code de verificação de autenticidade"
              className="h-[104px] w-[104px] rounded-md border border-[var(--p-color-border)] bg-white p-1"
            />
          ) : null}
        </section>
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

function SmallInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] px-3 py-2">
      <p className="type-kicker font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-[var(--p-color-fg-default)]">{value}</p>
    </div>
  );
}
