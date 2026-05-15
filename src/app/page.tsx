"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { getAuthCallbackUrl } from "@/lib/site-url";
import { getSafeUser, supabase } from "@/lib/supabase";

function GoogleGIcon() {
  return (
    <img
      src="/brands/google-g-2025.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      className="h-7 w-7 object-contain sm:h-8 sm:w-8"
    />
  );
}

export default function LandingPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [loadingGoogle, setLoadingGoogle] = React.useState(false);

  React.useEffect(() => {
    const checkUser = async () => {
      const user = await getSafeUser();
      if (user) {
        router.replace("/dashboard");
      }
    };
    checkUser();
  }, [router]);

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthCallbackUrl(window.location.origin),
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
    <main className="relative min-h-screen overflow-hidden bg-[#eef3f9] font-sans text-[#1e2430]">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 46% 30%, rgba(255,255,255,0.98) 0 18%, rgba(255,255,255,0.64) 34%, transparent 58%), linear-gradient(132deg, rgba(236,32,41,0.2) 0%, rgba(255,255,255,0.78) 38%, rgba(226,232,240,0.82) 72%, rgba(15,46,87,0.18) 100%)",
        }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute inset-[-24%] opacity-90 blur-[95px]"
        animate={reduceMotion ? undefined : { rotate: [0, 360] }}
        transition={{ duration: 46, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute left-[5%] top-[18%] h-[58%] w-[30%] rounded-full bg-[#ec2029]" />
        <div className="absolute bottom-[8%] right-[9%] h-[38%] w-[34%] rounded-full bg-[#0f2e57]" />
        <div className="absolute right-[26%] top-[5%] h-[30%] w-[32%] rounded-full bg-white" />
        <div className="absolute bottom-[20%] left-[36%] h-[28%] w-[34%] rounded-full bg-[#d9e4ef]" />
      </motion.div>

      <motion.div
        aria-hidden="true"
        className="absolute inset-[-30%] rounded-full opacity-45 blur-[130px]"
        animate={reduceMotion ? undefined : { rotate: [360, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 58, repeat: Infinity, ease: "linear" }}
        style={{
          background:
            "conic-gradient(from 45deg at 50% 50%, rgba(236,32,41,0.42), rgba(255,255,255,0.22), rgba(15,46,87,0.34), rgba(255,255,255,0.2), rgba(236,32,41,0.42))",
        }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute -left-[360px] -top-[190px] h-[1320px] w-[850px] rounded-full bg-[#ec2029]/95 blur-[26px] shadow-[100px_0_210px_rgba(236,32,41,0.38)]"
        animate={reduceMotion ? undefined : { x: [0, 18, 0], scale: [1, 1.025, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.img
        aria-hidden="true"
        src="/brands/percata-logo.png"
        alt=""
        className="absolute -left-[235px] top-[180px] h-[680px] w-auto opacity-[0.11] blur-[18px]"
        animate={reduceMotion ? undefined : { rotate: [-4, 5, -4], y: [0, -22, 0], opacity: [0.07, 0.12, 0.07] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute -right-[130px] -top-[190px] h-[940px] w-[1080px] rounded-full opacity-45 blur-[10px]"
        animate={reduceMotion ? undefined : { rotate: [0, 360], scale: [1, 1.03, 1] }}
        transition={{ duration: 68, repeat: Infinity, ease: "linear" }}
        style={{
          background:
            "repeating-radial-gradient(circle at center, rgba(255,255,255,0.6) 0 1px, transparent 1px 10px)",
          maskImage:
            "linear-gradient(120deg, transparent 0%, black 26%, black 75%, transparent 100%)",
        }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute -bottom-[370px] right-[-120px] h-[660px] w-[790px] rotate-[-20deg] rounded-tl-[100%] bg-[#0f2e57] blur-[34px] shadow-[-70px_-70px_180px_rgba(15,46,87,0.38)]"
        animate={reduceMotion ? undefined : { x: [0, -18, 0], y: [0, -18, 0], rotate: [-20, -13, -20] }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute -bottom-[210px] right-[90px] h-[560px] w-[1040px] rotate-[-18deg] rounded-tl-[100%] bg-white/78 blur-[28px] shadow-[0_-42px_110px_rgba(15,46,87,0.16)]"
        animate={reduceMotion ? undefined : { x: [0, 18, 0], y: [0, 12, 0], rotate: [-18, -24, -18] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute left-[22%] top-[19%] h-[410px] w-[470px] rounded-full bg-[#ec2029]/24 blur-[120px]"
        animate={reduceMotion ? undefined : { x: [0, 48, 0, -48, 0], y: [0, -34, -68, -34, 0], opacity: [0.32, 0.72, 0.44, 0.64, 0.32], scale: [1, 1.12, 1.04, 1.16, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute right-[16%] top-[8%] h-[390px] w-[470px] rounded-full bg-white/72 blur-[105px]"
        animate={reduceMotion ? undefined : { x: [0, -42, -84, -42, 0], y: [0, 28, 0, -28, 0], opacity: [0.5, 0.9, 0.62, 0.82, 0.5] }}
        transition={{ duration: 21, repeat: Infinity, ease: "easeInOut" }}
      />

      <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
        <div className="flex w-full max-w-[650px] flex-col items-center gap-10 sm:gap-12">
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.82, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex min-h-[390px] w-full flex-col items-center justify-center overflow-hidden rounded-[22px] border border-white/80 bg-white/64 px-8 py-10 shadow-[0_46px_130px_rgba(30,36,48,0.27),0_18px_52px_rgba(236,32,41,0.13),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-2xl sm:min-h-[430px] sm:px-14 sm:py-12"
          >
            <motion.div
              aria-hidden="true"
              className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[#ec2029]/18 blur-3xl"
              animate={reduceMotion ? undefined : { scale: [1, 1.2, 1], opacity: [0.35, 0.65, 0.35] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              aria-hidden="true"
              className="absolute -bottom-28 right-8 h-64 w-80 rounded-full bg-[#164073]/12 blur-3xl"
              animate={reduceMotion ? undefined : { x: [0, -16, 0], opacity: [0.3, 0.58, 0.3] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              aria-hidden="true"
              className="absolute -right-32 top-20 h-20 w-[520px] rotate-[-18deg] bg-white/55 blur-2xl"
              animate={reduceMotion ? undefined : { x: [0, -42, 0], opacity: [0.18, 0.46, 0.18] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.img
              src="/brands/percata-logo.png"
              alt="PERCATA - Sistema de Planejamento e Administração"
              className="relative z-10 h-auto w-full max-w-[470px] object-contain drop-shadow-[0_20px_34px_rgba(30,36,48,0.12)]"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ delay: 0.16, duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
            />

            <motion.button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loadingGoogle}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              whileHover={reduceMotion ? undefined : { y: -4, scale: 1.012 }}
              whileTap={reduceMotion ? undefined : { y: 0, scale: 0.99 }}
              transition={{ delay: 0.28, duration: 0.56, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 mt-14 flex h-[70px] w-full max-w-[500px] items-center justify-center gap-4 rounded-[12px] border border-[#DADCE0] bg-white/92 text-[18px] font-semibold text-[#202124] shadow-[0_18px_38px_rgba(30,36,48,0.2),0_4px_12px_rgba(30,36,48,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-md outline-none transition-colors hover:bg-white focus-visible:ring-4 focus-visible:ring-[#164073]/30 disabled:cursor-wait disabled:opacity-75 sm:mt-16 sm:h-[76px] sm:gap-7 sm:text-[24px]"
            >
              <GoogleGIcon />
              <span className="whitespace-nowrap">{loadingGoogle ? "Conectando..." : "Entrar com Google"}</span>
            </motion.button>
          </motion.div>

          <motion.img
            src="/brands/upe-wordmark-login.png"
            alt="Universidade de Pernambuco"
            className="h-auto w-[310px] max-w-[82vw] object-contain mix-blend-multiply drop-shadow-[0_12px_22px_rgba(30,36,48,0.13)]"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </section>
    </main>
  );
}
