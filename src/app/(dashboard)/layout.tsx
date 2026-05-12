"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ShellLoading } from "@/components/layout/ShellLoading";
import { getSafeUser, supabase } from "@/lib/supabase";
import { normalizeRole } from "@/lib/access";

type DashboardRole = "solicitante" | "chefia" | "admin" | "superadmin";

const titles: Record<DashboardRole, string> = {
  solicitante: "Painel Unificado",
  chefia: "Painel Unificado",
  admin: "Painel Unificado",
  superadmin: "Painel Unificado",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<DashboardRole | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    async function getUser() {
      let shouldResolve = true;
      const user = await getSafeUser();
      if (!user) {
        setRole("solicitante");
        setResolved(true);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, campus_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error(
          "Erro ao buscar perfil para onboarding:",
          profileError.message,
        );
        setRole("solicitante");
        setResolved(true);
        return;
      }

      const profileRole = normalizeRole(profile?.role, user.email);

      if (
        (profileRole === "solicitante" ||
          profileRole === "chefia" ||
          profileRole === "superadmin") &&
        !profile?.campus_id &&
        window.location.pathname !== "/onboarding"
      ) {
        setRole(profileRole === "superadmin" ? "superadmin" : profileRole);
        router.replace("/onboarding");
        setResolved(true);
        shouldResolve = false;
        return;
      }

      if (profileRole === "superadmin") {
        setRole("superadmin");
      } else if (profileRole === "chefia") {
        setRole("chefia");
      } else if (profileRole === "admin") {
        setRole("admin");
      } else {
        setRole(profileRole);
      }

      if (shouldResolve) setResolved(true);
    }

    getUser().catch((error) => {
      console.error("Erro ao resolver layout do usuário:", error);
      setRole("solicitante");
      setResolved(true);
    });
  }, [router]);

  if (!resolved || !role) {
    return <ShellLoading />;
  }

  const isPrintContext =
    pathname?.includes("/impressao") || pathname?.endsWith("/pdf");

  if (isPrintContext) {
    return <>{children}</>;
  }

  return (
    <AppShell
      role={role}
      title={titles[role]}
      searchPlaceholder="Pesquisar no sistema..."
      titleClassName="text-[#164073]"
      showUnreadCount
    >
      {children}
    </AppShell>
  );
}
