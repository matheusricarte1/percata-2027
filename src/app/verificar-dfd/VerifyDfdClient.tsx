"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle } from "@/components/icons/phosphor/exports/CheckCircle";
import { SealWarning } from "@/components/icons/phosphor/exports/SealWarning";
import { ShieldCheck } from "@/components/icons/phosphor/exports/ShieldCheck";
import { SpinnerGap } from "@/components/icons/phosphor/exports/SpinnerGap";

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
    <main className="flex min-h-screen items-center justify-center bg-[var(--p-color-surface-muted)] p-5">
      <section className="w-full max-w-3xl overflow-hidden rounded-[24px] border border-[var(--p-color-info-border)] bg-white shadow-sm">
        <div className="bg-[var(--p-color-info-bg)] p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="type-kicker font-semibold uppercase tracking-[0.16em] text-[var(--p-color-brand-400)]">
                Validação pública
              </p>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--p-color-fg)] md:text-3xl">
                Autenticidade da DFD
              </h1>
              <p className="mt-1 max-w-xl text-sm font-medium text-[var(--p-color-fg-muted)]">
                Conferência criptográfica do documento emitido pelo PERCATA.
              </p>
            </div>
            <div
              className={`inline-flex h-12 items-center gap-2 rounded-2xl px-4 text-xs font-semibold uppercase tracking-[0.12em] ${
                loading
                  ? "border border-[var(--p-color-info-border)] bg-white text-[var(--p-color-brand-400)]"
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

        <div className="border-t border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-6 md:p-8">
          <div className="flex gap-3 rounded-[18px] border border-[var(--p-color-border-muted)] bg-white p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-500)]">
              <ShieldCheck size={22} weight="duotone" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--p-color-fg)]">
                {loading
                  ? "A assinatura está sendo conferida."
                  : valid
                    ? "A assinatura corresponde ao documento registrado."
                    : "A assinatura não corresponde a uma DFD válida."}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--p-color-fg-muted)]">
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
    <div className="rounded-[18px] border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] px-4 py-3">
      <p className="type-kicker font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--p-color-fg)]">{value}</p>
    </div>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return date.toLocaleString("pt-BR");
}
