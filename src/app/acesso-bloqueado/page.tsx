import Link from "next/link";

export default function AcessoBloqueadoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-gradient)] px-6 py-10">
      <section className="w-full max-w-xl rounded-[24px] border border-[var(--p-color-border)] bg-white p-8 text-center shadow-sm">
        <img
          src="/brands/percata-logo.png"
          alt="PERCATA"
          className="mx-auto mb-6 h-auto w-full max-w-[280px] object-contain"
        />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--p-color-brand-500)] text-white">
          <span className="text-2xl font-bold">!</span>
        </div>
        <p className="mt-6 type-caption font-semibold uppercase tracking-[0.16em] text-[var(--p-color-brand-400)]">
          Acesso temporariamente bloqueado
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[var(--p-color-fg)]">
          O sistema está restrito ao superadmin.
        </h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[var(--p-color-fg-muted)]">
          A administração ativou um bloqueio global. Aguarde a liberação para
          voltar a acessar as telas internas do PERCATA.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[var(--p-color-brand-500)] px-5 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-[var(--p-color-brand-600)]"
        >
          Ir para login
        </Link>
      </section>
    </main>
  );
}
