import { Suspense } from "react";
import { VerifyDfdClient } from "./VerifyDfdClient";

export default function VerificarDfdPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] p-5">
          <div className="rounded-[22px] border border-[#D6E3F2] bg-white px-6 py-5 text-sm font-semibold text-[#52627A] shadow-sm">
            Preparando validação...
          </div>
        </main>
      }
    >
      <VerifyDfdClient />
    </Suspense>
  );
}
