"use client";

import React from "react";
import {
  ArrowRight,
  Lightning,
  TreeStructure,
  ShieldChevron,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { getSafeUser, supabase } from "@/lib/supabase";
import { fetchActiveCycleYear } from "@/lib/cycle";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function GoogleGIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v4.17h5.92c-.24 1.34-1.6 3.92-5.92 3.92-3.56 0-6.46-2.95-6.46-6.59S8.44 5.1 12 5.1c2.03 0 3.39.86 4.16 1.6l2.83-2.74C17.18 2.29 14.84 1.2 12 1.2 6.94 1.2 2.84 5.3 2.84 10.37S6.94 19.54 12 19.54c6.93 0 9.16-4.86 9.16-7.38 0-.5-.05-.86-.12-1.23H12z"
      />
      <path
        fill="#34A853"
        d="M3.92 6.74l3.42 2.51C8.26 7.23 9.97 5.1 12 5.1c2.03 0 3.39.86 4.16 1.6l2.83-2.74C17.18 2.29 14.84 1.2 12 1.2 8.38 1.2 5.23 3.26 3.92 6.74z"
      />
      <path
        fill="#FBBC05"
        d="M12 19.54c2.77 0 5.1-.92 6.8-2.64l-3.14-2.57c-.84.6-1.97 1.02-3.66 1.02-3.52 0-6.4-2.95-6.4-6.58 0-.78.14-1.53.4-2.22L2.5 3.95A9.18 9.18 0 0 0 1.84 10.37c0 5.07 4.1 9.17 10.16 9.17z"
      />
      <path
        fill="#4285F4"
        d="M21.16 12.16c0-.61-.05-1.05-.12-1.48H12v3.7h5.92c-.28 1.38-1.13 2.44-2.26 3.01l3.14 2.57c1.83-1.69 2.89-4.18 2.89-7.8z"
      />
    </svg>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [loadingGoogle, setLoadingGoogle] = React.useState(false);
  const [cycleYear, setCycleYear] = React.useState<number>(new Date().getFullYear());

  React.useEffect(() => {
    const checkUser = async () => {
      const user = await getSafeUser();
      if (user) {
        router.replace("/dashboard");
      }
    };
    checkUser();
  }, [router]);

  React.useEffect(() => {
    let alive = true;
    async function loadCycleYear() {
      try {
        const year = await fetchActiveCycleYear();
        if (alive) setCycleYear(year);
      } catch {
        // fallback local year
      }
    }
    loadCycleYear();
    return () => {
      alive = false;
    };
  }, []);

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: "select_account consent",
        },
      },
    });
    if (error) {
      toast.error("Falha ao iniciar login Google: " + error.message);
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row overflow-hidden font-sans selection:bg-upe-accent-washed-blue/40 selection:text-upe-blue-deep">
      <div className="md:w-[55%] bg-[#164073] relative flex flex-col justify-center p-12 lg:p-24 overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full pointer-events-none">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{ duration: 10, repeat: Infinity }}
            className="absolute -top-20 -right-20 w-[600px] h-[600px] bg-upe-blue-medium rounded-full blur-[150px]"
          />
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.05, 0.1, 0.05],
            }}
            transition={{ duration: 15, repeat: Infinity, delay: 2 }}
            className="absolute -bottom-40 -left-20 w-[800px] h-[800px] bg-amber-400 rounded-full blur-[200px]"
          />
        </div>

        <div className="relative z-10 space-y-12">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-6"
          >
            <div className="w-20 h-20 bg-white rounded-[32px] flex items-center justify-center shadow-2xl text-[#164073] rotate-3 hover:rotate-0 transition-transform duration-500">
              <Lightning size={48} weight="fill" />
            </div>
            <div className="space-y-1">
              <h1 className="font-display text-6xl font-semibold text-white tracking-tighter">
                PERCATA
              </h1>
              <div className="flex items-center gap-2">
                <span className="h-[2px] w-8 bg-upe-blue-medium rounded-full" />
                <span className="text-[11px] font-semibold tracking-[0.6em] text-upe-accent-washed-blue uppercase">
                  Ciclo {cycleYear}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-8 max-w-xl"
          >
            <h2 className="font-display text-6xl font-semibold text-white leading-[1] uppercase tracking-tighter">
              Planejamento <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-upe-accent-washed-blue to-upe-blue-medium">
                Institucional
              </span>{" "}
              <br />
              Redefinido.
            </h2>
            <p className="text-upe-accent-washed-blue/80 text-xl font-medium leading-relaxed pr-10">
              Uma plataforma simples para registrar necessidades de ensino,
              pesquisa e extensão, com organização e transparência.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex gap-16 pt-12 border-t border-white/5"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <ShieldChevron
                  size={24}
                  weight="duotone"
                  className="text-upe-blue-gray-blue"
                />
                <p className="text-3xl font-semibold text-white tracking-tighter">
                  100%
                </p>
              </div>
              <p className="text-[10px] font-semibold text-upe-accent-washed-blue uppercase tracking-widest leading-none">
                Transparência (Lei 14.133)
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <TreeStructure
                  size={24}
                  weight="duotone"
                  className="text-upe-blue-gray-blue"
                />
                <p className="text-3xl font-semibold text-white tracking-tighter">
                  PCA
                </p>
              </div>
              <p className="text-[10px] font-semibold text-upe-accent-washed-blue uppercase tracking-widest leading-none">
                Fluxo Organizado
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="md:w-[45%] bg-white flex flex-col justify-center p-8 lg:p-24 relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full mx-auto space-y-10"
        >
          <div className="space-y-4">
            <h3 className="font-display text-4xl font-semibold text-[#164073] uppercase tracking-tighter leading-none">
              Acesso Seguro
            </h3>
            <p className="text-slate-500 text-base font-medium leading-relaxed">
              O acesso ao PERCATA é exclusivo via Google institucional.
            </p>
          </div>

          <div className="rounded-[24px] border border-[#D9E0E8] bg-[#FAFBFC] p-5 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#164073]">
              Regras de acesso
            </p>
            <ul className="space-y-2 text-sm text-[#3E4C5F]">
              <li>1. E-mails `@upe.br` são permitidos automaticamente.</li>
              <li>
                2. E-mails externos só entram se estiverem cadastrados na lista
                institucional.
              </li>
              <li>3. Não há login por senha neste ambiente.</li>
            </ul>
          </div>

          <Button
            onClick={handleGoogleLogin}
            disabled={loadingGoogle}
            variant="outline"
            className="w-full h-14 rounded-xl border border-[#DADCE0] bg-white text-[#3C4043] font-medium text-base hover:bg-[#F8F9FA] hover:border-[#DADCE0] shadow-none"
          >
            <span className="mr-3 inline-flex items-center">
              <GoogleGIcon />
            </span>
            <span className="flex-1 text-center">
              {loadingGoogle
                ? "Conectando com Google..."
                : "Sign in with Google"}
            </span>
            <ArrowRight
              size={18}
              weight="bold"
              className="ml-3 text-[#5F6368] opacity-80"
            />
          </Button>

          <p className="text-[11px] text-center text-slate-400 font-semibold leading-relaxed px-4 uppercase tracking-tight">
            Todo acesso é validado por domínio institucional e por lista de
            autorização do sistema.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
