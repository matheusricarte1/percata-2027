"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Printer, DownloadSimple, SealCheck } from "@phosphor-icons/react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { resolveCampusBranding } from "@/lib/campus-branding";
import { buildDfdPrintExportCsv } from "@/lib/dfd-print-export";
import QRCode from "qrcode";

interface PrintItem {
  cod: string;
  desc: string;
  qtd: number;
  un: string;
  valor: number;
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
  gnd: string;
  itens: PrintItem[];
}

export default function DFDPrintPage() {
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

        const [profileResult, campusResult, itemsResult, signatureResult, deptResult, labResult, logsResult] =
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
          ]);

        if (profileResult.error) throw profileResult.error;
        if (campusResult.error) throw campusResult.error;
        if (itemsResult.error) throw itemsResult.error;
        if (deptResult.error) throw deptResult.error;
        if (labResult.error) throw labResult.error;
        if (logsResult.error) throw logsResult.error;

        const items = (itemsResult.data || []).map((item: any) => ({
          cod: item.codigo_tce ? `E-FISCO ${item.codigo_tce}` : "Sem código",
          desc: item.descricao || "Item sem descrição",
          qtd: Number(item.quantidade || 0),
          un: item.unidade_medida || "UN",
          valor: Number(item.valor_unitario_estimado || 0),
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
          gnd: gndPrincipal,
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

  const exportData = () => {
    if (!data) return;
    const csv = buildDfdPrintExportCsv(data);
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
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7FA]">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#5B6675]">
          Preparando documento de impressão...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7FA]">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#5B6675]">
          DFD não encontrada para impressão.
        </p>
      </div>
    );
  }

  const branding = resolveCampusBranding(data.campus || data.campusSigla);

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-[#F4F7FA] p-8 print:bg-white print:p-0">
      <div className="print:hidden flex gap-3">
        <button
          onClick={() => window.print()}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#164073] px-5 text-sm font-semibold text-white transition hover:bg-[#0F2E57]"
        >
          <Printer size={18} weight="fill" />
          Imprimir / Salvar PDF
        </button>
        <button
          onClick={exportData}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#D9E0E8] bg-white px-5 text-sm font-semibold text-[#3E4C5F] transition hover:bg-[#F4F7FA]"
        >
          <DownloadSimple size={18} />
          Exportar dados
        </button>
      </div>

      <div className="w-full max-w-[210mm] min-h-[297mm] border border-[#D9E0E8] bg-white p-[16mm] shadow-2xl print:border-none print:shadow-none">
        <header className="rounded-2xl border border-[#D9E0E8] bg-[#FAFBFC] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7D98B8]">
                Documento de Formalização de Demanda
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-[#164073]">
                {data.protocolo}
              </h1>
              <p className="text-xs text-[#5B6675]">{data.data}</p>
              <span className="inline-flex rounded-full bg-[#E8EDF2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#164073]">
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
                className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
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

        <section className="mt-5 rounded-2xl border border-[#D9E0E8] p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7D98B8]">
            Objeto da Contratação
          </h2>
          <p className="mt-2 text-base font-semibold text-[#164073]">{data.objeto}</p>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#7D98B8]">
            Justificativa da Necessidade
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[#3E4C5F]">{data.justificativa}</p>
        </section>

        <section className="mt-5 rounded-2xl border border-[#D9E0E8] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#E8EDF2] text-[#164073] uppercase tracking-[0.12em]">
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
                <tr key={`${item.cod}-${index}`} className="border-t border-[#E8EDF2] align-top">
                  <td className="px-3 py-3 font-semibold text-[#3E4C5F]">{item.cod}</td>
                  <td className="px-3 py-3 text-[#2E3A4A]">{item.desc}</td>
                  <td className="px-3 py-3 text-center text-[#2E3A4A]">{item.qtd}</td>
                  <td className="px-3 py-3 text-center text-[#2E3A4A]">{item.un}</td>
                  <td className="px-3 py-3 text-right text-[#2E3A4A]">
                    {item.valor.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-[#164073]">
                    {(item.qtd * item.valor).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-[#D9E0E8] bg-[#F4F7FA] px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5B6675]">
              GND predominante: {data.gnd}
            </span>
            <span className="text-lg font-semibold text-[#164073]">
              {total.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          </div>
        </section>

        <footer className="mt-8 grid grid-cols-[1fr_auto] gap-4 rounded-2xl border border-[#D9E0E8] bg-[#FAFBFC] p-4">
          <div>
            <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#164073]">
              <SealCheck size={14} />
              Validação de Integridade
            </p>
            <p className="mt-2 text-[11px] text-[#5B6675]">
              Este PDF foi emitido pelo PERCATA com assinatura criptográfica SHA-256.
            </p>
            <p className="mt-1 font-mono text-[10px] text-[#3E4C5F] break-all">
              {signature || "assinatura indisponível"}
            </p>
            <p className="mt-1 text-[10px] text-[#7D98B8]">
              Escaneie o QR Code para validar autenticidade no PERCATA.
            </p>
          </div>
          <div className="flex items-center justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code de verificação da DFD"
                className="h-[108px] w-[108px] rounded-md border border-[#D9E0E8] bg-white p-1"
              />
            ) : (
              <div className="flex h-[108px] w-[108px] items-center justify-center rounded-md border border-dashed border-[#D9E0E8] text-[10px] text-[#A7B1BD]">
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
    <div className="rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-[#2E3A4A]">{value}</p>
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
    <div className="flex items-center gap-3 rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] p-3">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-10 w-10 rounded-full border border-[#D9E0E8] object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8EDF2] text-xs font-semibold text-[#164073]">
          {initials}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">
          {title}
        </p>
        <p className="truncate text-sm font-medium text-[#2E3A4A]">{name}</p>
      </div>
    </div>
  );
}
