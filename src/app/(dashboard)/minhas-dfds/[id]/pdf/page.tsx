"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Printer, ArrowLeft, SealCheck } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { resolveCampusBranding } from "@/lib/campus-branding";
import { fetchActiveCycleYear } from "@/lib/cycle";
import QRCode from "qrcode";

type DfdRow = {
  id: string;
  numero_protocolo?: string | null;
  objeto_contratacao?: string | null;
  justificativa_contratacao?: string | null;
  justificativa_quantidade?: string | null;
  previsao_recebimento?: string | null;
  status?: string | null;
  campus?: string | null;
  campus_id?: string | null;
  created_at?: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
  campi?: { nome?: string | null; sigla?: string | null } | null;
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

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: rawDfdData, error: dfdError } = await supabase
          .from("dfds")
          .select("*")
          .eq("id", id)
          .single();

        if (dfdError) throw dfdError;

        const [profileResult, campusResult, signatureResult, deptResult, labResult] = await Promise.all([
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
        ]);

        if (profileResult.error) throw profileResult.error;
        if (campusResult.error) throw campusResult.error;
        if (deptResult.error) throw deptResult.error;
        if (labResult.error) throw labResult.error;

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
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#5B6675]">
          Gerando documento...
        </p>
      </div>
    );
  }

  const campusName = dfd.campi?.nome || dfd.campi?.sigla || dfd.campus || "Campus UPE";
  const branding = resolveCampusBranding(campusName);

  return (
    <div className="min-h-screen bg-[#F4F7FA] p-0 md:p-8 flex flex-col items-center">
      <div className="no-print mb-4 flex w-full max-w-5xl justify-between">
        <Button variant="ghost" onClick={() => window.history.back()} className="font-semibold">
          <ArrowLeft size={18} className="mr-2" /> Voltar
        </Button>
        <Button onClick={() => window.print()} className="bg-[#164073] text-white font-semibold hover:bg-[#0F2E57]">
          <Printer size={18} className="mr-2" /> Imprimir / Salvar PDF
        </Button>
      </div>

      <div className="w-full max-w-[210mm] min-h-[297mm] bg-white p-[16mm] shadow-2xl print:shadow-none print:p-0">
        <header className="rounded-2xl border border-[#D9E0E8] bg-[#FAFBFC] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7D98B8]">
                PERCATA
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#164073]">
                Ciclo {cycleYear}
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-[#164073]">
                {dfd.numero_protocolo || `DFD-${String(dfd.id).slice(0, 8).toUpperCase()}`}
              </h1>
              <p className="mt-1 text-xs text-[#5B6675]">
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

        <section className="mt-5 rounded-2xl border border-[#D9E0E8] p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7D98B8]">
            Objeto da Contratação
          </h2>
          <p className="mt-2 text-base font-semibold text-[#164073]">
            {dfd.objeto_contratacao || "Sem objeto informado"}
          </p>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#7D98B8]">
            Justificativa
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[#3E4C5F]">
            {dfd.justificativa_contratacao || "Sem justificativa cadastrada."}
          </p>
        </section>

        <section className="mt-5 rounded-2xl border border-[#D9E0E8] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#E8EDF2] text-[#164073] uppercase tracking-[0.12em]">
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-left">Descrição</th>
                <th className="p-2 text-center">Qtd</th>
                <th className="p-2 text-right">Unitário</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-[#E8EDF2]">
                  <td className="p-2 font-mono text-[11px]">{item.codigo_tce || "-"}</td>
                  <td className="p-2 text-[#2E3A4A]">{item.descricao}</td>
                  <td className="p-2 text-center">{item.quantidade}</td>
                  <td className="p-2 text-right">
                    {Number(item.valor_unitario_estimado || 0).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                  <td className="p-2 text-right font-semibold text-[#164073]">
                    {(
                      Number(item.quantidade || 0) *
                      Number(item.valor_unitario_estimado || 0)
                    ).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between border-t border-[#D9E0E8] bg-[#F4F7FA] p-3">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5B6675]">
              Valor Total da Demanda
            </span>
            <span className="text-lg font-semibold text-[#164073]">
              {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-[#D9E0E8] bg-[#FAFBFC] p-4 flex items-center justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#164073]">
              <SealCheck size={14} />
              Assinatura criptográfica
            </p>
            <p className="mt-1 text-[10px] text-[#5B6675] break-all">
              {signature || "assinatura indisponível"}
            </p>
          </div>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code de verificação de autenticidade"
              className="h-[104px] w-[104px] rounded-md border border-[#D9E0E8] bg-white p-1"
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
    <div className="rounded-xl border border-[#D9E0E8] bg-[#FAFBFC] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7D98B8]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-[#2E3A4A]">{value}</p>
    </div>
  );
}
