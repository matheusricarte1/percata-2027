import { Suspense } from "react";
import { VerifyDfdClient } from "./VerifyDfdClient";

export default function VerificarDfdPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--p-color-surface-muted)] p-5">
          <div className="rounded-[22px] border border-[var(--p-color-info-border)] bg-white px-6 py-5 text-sm font-semibold text-[var(--p-color-fg-muted)] shadow-sm">
            Preparando validação...
          </div>
        </main>
      }
    >
      <VerifyDfdClient />
    </Suspense>
  );
}
