"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle,
  SealWarning,
  ShieldCheck,
  SpinnerGap,
} from "@phosphor-icons/react";

type VerifyPayload = {
  valid: boolean;
  id?: string;
  numeroProtocolo?: string | null;
  status?: string | null;
  updatedAt?: string | null;
  checkedAt?: string;
  error?: string;
};

export function VerifyDfdClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const sig = searchParams.get("sig") || "";
  const [payload, setPayload] = useState<VerifyPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function verify() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/dfd/verify?id=${encodeURIComponent(id)}&sig=${encodeURIComponent(sig)}`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as VerifyPayload;
        if (!alive) return;
        setPayload(result);
      } catch (error: any) {
        if (!alive) return;
        setPayload({
          valid: false,
          error: error?.message || "Não foi possível validar o documento.",
        });
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (!id || !sig) {
      setPayload({
        valid: false,
        error: "QR Code incompleto. Reemita o documento no PERCATA.",
      });
      setLoading(false);
      return;
    }

    verify();
    return () => {
      alive = false;
    };
  }, [id, sig]);

  const valid = Boolean(payload?.valid);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] p-5">
      <section className="w-full max-w-3xl overflow-hidden rounded-[24px] border border-[#C7D7EA] bg-white shadow-sm">
        <div className="bg-[#F7FBFF] p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#47739F]">
                Validação pública
              </p>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-[#17233C] md:text-3xl">
                Autenticidade da DFD
              </h1>
              <p className="mt-1 max-w-xl text-sm font-medium text-[#52627A]">
                Conferência criptográfica do documento emitido pelo PERCATA.
              </p>
            </div>
            <div
              className={`inline-flex h-12 items-center gap-2 rounded-2xl px-4 text-xs font-semibold uppercase tracking-[0.12em] ${
                loading
                  ? "border border-[#D6E3F2] bg-white text-[#47739F]"
                  : valid
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {loading ? (
                <SpinnerGap size={18} className="animate-spin" />
              ) : valid ? (
                <CheckCircle size={18} weight="fill" />
              ) : (
                <SealWarning size={18} weight="fill" />
              )}
              {loading ? "Verificando" : valid ? "Documento válido" : "Validação recusada"}
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 md:p-8">
          <Info label="Protocolo" value={payload?.numeroProtocolo || payload?.id || "Não informado"} />
          <Info label="Status" value={payload?.status || "Não informado"} />
          <Info label="Atualizado em" value={formatDate(payload?.updatedAt)} />
          <Info label="Verificado em" value={formatDate(payload?.checkedAt)} />
        </div>

        <div className="border-t border-[#E1E8F0] bg-[#FAFBFC] p-6 md:p-8">
          <div className="flex gap-3 rounded-[18px] border border-[#E1E8F0] bg-white p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EDF4FB] text-[#164073]">
              <ShieldCheck size={22} weight="duotone" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#17233C]">
                {loading
                  ? "A assinatura está sendo conferida."
                  : valid
                    ? "A assinatura corresponde ao documento registrado."
                    : "A assinatura não corresponde a uma DFD válida."}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#52627A]">
                {payload?.error ||
                  "Qualquer alteração no documento, nos itens ou no status invalida a assinatura apresentada no QR Code."}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#E1E8F0] bg-[#FAFBFC] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7D98B8]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[#17233C]">{value}</p>
    </div>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return date.toLocaleString("pt-BR");
}
