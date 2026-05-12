"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ShellLoading } from "@/components/layout/ShellLoading";
import { getSafeUser, supabase } from "@/lib/supabase";
import { normalizeRole } from "@/lib/access";

export default function TriagemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRole] = useState<"chefia" | "superadmin" | null>(null);

  useEffect(() => {
    async function resolveRole() {
      const user = await getSafeUser();
      if (!user) {
        setRole("chefia");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const effectiveRole = normalizeRole(profile?.role, user.email);
      setRole(effectiveRole === "superadmin" ? "superadmin" : "chefia");
    }

    resolveRole().catch((error) => {
      console.error("Erro ao resolver layout da chefia:", error);
      setRole("chefia");
    });
  }, []);

  if (!role) {
    return <ShellLoading />;
  }

  return (
    <AppShell
      role={role}
      title={
        role === "superadmin"
          ? "Análise de Solicitações (Visão Superadmin)"
          : "Análise da Chefia"
      }
      titleClassName="text-[#164073]"
      searchPlaceholder="Buscar solicitações para análise..."
    >
      {children}
    </AppShell>
  );
}
