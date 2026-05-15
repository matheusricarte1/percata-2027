import Link from "next/link";

export default function AcessoBloqueadoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-gradient)] px-6 py-10">
      <section className="w-full max-w-xl rounded-[24px] border border-[#D9E0E8] bg-white p-8 text-center shadow-sm">
        <img
          src="/brands/percata-logo.png"
          alt="PERCATA"
          className="mx-auto mb-6 h-auto w-full max-w-[280px] object-contain"
        />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#164073] text-white">
          <span className="text-2xl font-bold">!</span>
        </div>
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#47739F]">
          Acesso temporariamente bloqueado
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[#17233C]">
          O sistema está restrito ao superadmin.
        </h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[#52627A]">
          A administração ativou um bloqueio global. Aguarde a liberação para
          voltar a acessar as telas internas do PERCATA.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#164073] px-5 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-[#0F2E57]"
        >
          Ir para login
        </Link>
      </section>
    </main>
  );
}
