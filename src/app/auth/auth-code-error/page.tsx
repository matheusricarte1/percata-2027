"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Warning } from "@/components/icons/phosphor/exports/Warning";
import { ArrowLeft } from "@/components/icons/phosphor/exports/ArrowLeft";
import { House } from "@/components/icons/phosphor/exports/House";

export default function AuthErrorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = String(searchParams.get("error") || "").trim();
  const customMessage = errorParam || null;

  return (
    <div className="min-h-screen bg-[var(--p-color-surface)] flex items-center justify-center p-6">
      <div className="max-w-md w-full glass-card p-10 text-center space-y-6 shadow-2xl">
        <img
          src="/brands/percata-logo.png"
          alt="PERCATA"
          className="mx-auto h-auto w-full max-w-[260px] object-contain"
        />
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-inner">
          <Warning size={40} weight="fill" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-[var(--p-color-fg-strong)]">
            Ops! Erro na Autenticação
          </h1>
          <p className="text-[var(--p-color-fg-muted)] text-sm leading-relaxed">
            {customMessage ||
              "Houve um problema ao processar seu login com o Google. Isso pode acontecer por causa de cookies bloqueados ou expiração da sessão."}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => router.push("/login")}
            className="w-full py-4 rounded-2xl bg-[var(--p-color-brand-400)] text-white font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"
          >
            <ArrowLeft size={20} weight="bold" />
            Tentar Novamente
          </button>

          <button
            onClick={() => router.push("/")}
            className="w-full py-4 rounded-2xl bg-black/5 text-black/60 font-bold flex items-center justify-center gap-2 hover:bg-black/10 transition-all"
          >
            <House size={20} weight="bold" />
            Ir para Início
          </button>
        </div>

        <p className="type-kicker text-black/20 font-semibold uppercase tracking-widest pt-4">
          Token detectado, mas não processado.
        </p>
      </div>
    </div>
  );
}
