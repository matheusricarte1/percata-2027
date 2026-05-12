"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ShellLoading } from "@/components/layout/ShellLoading";
import { getSafeUser, supabase } from "@/lib/supabase";
import { normalizeRole } from "@/lib/access";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRole] = useState<"admin" | "superadmin" | null>(null);

  useEffect(() => {
    async function resolveRole() {
      const user = await getSafeUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const effectiveRole = normalizeRole(profile?.role, user.email);
      setRole(effectiveRole === "superadmin" ? "superadmin" : "admin");
    }

    resolveRole();
  }, []);

  if (!role) {
    return <ShellLoading />;
  }

  return (
    <AppShell
      role={role}
      title={
        role === "superadmin"
          ? "Painel Institucional (Superadmin)"
          : "Painel de Administração"
      }
      titleClassName="text-[#164073]"
      searchPlaceholder="Pesquisar informações gerais..."
    >
      {children}
    </AppShell>
  );
}
