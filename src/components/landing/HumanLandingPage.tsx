"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { ArrowRight } from "@/components/icons/phosphor/exports/ArrowRight";
import { BellRinging } from "@/components/icons/phosphor/exports/BellRinging";
import { ChartLineUp } from "@/components/icons/phosphor/exports/ChartLineUp";
import { CheckCircle } from "@/components/icons/phosphor/exports/CheckCircle";
import { ClipboardText } from "@/components/icons/phosphor/exports/ClipboardText";
import { Database } from "@/components/icons/phosphor/exports/Database";
import { Files } from "@/components/icons/phosphor/exports/Files";
import { FunnelSimple } from "@/components/icons/phosphor/exports/FunnelSimple";
import { GitBranch } from "@/components/icons/phosphor/exports/GitBranch";
import { MagnifyingGlass } from "@/components/icons/phosphor/exports/MagnifyingGlass";
import { PaperPlaneTilt } from "@/components/icons/phosphor/exports/PaperPlaneTilt";
import { SealCheck } from "@/components/icons/phosphor/exports/SealCheck";
import { ShieldCheck } from "@/components/icons/phosphor/exports/ShieldCheck";
import { StackSimple } from "@/components/icons/phosphor/exports/StackSimple";
import { UsersThree } from "@/components/icons/phosphor/exports/UsersThree";

function GoogleGIcon() {
  return (
    <img
      src="/brands/google-g-2025.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      className="h-5 w-5 object-contain sm:h-6 sm:w-6"
    />
  );
}

const FLOW_STEPS = [
  {
    title: "Planeje",
    description: "Defina problema, público atendido, resultado esperado e critérios mínimos antes de criar a DFD.",
    icon: ClipboardText,
    tone: {
      card: "border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)]",
      icon: "bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-600)]",
      number: "text-[#6F89AA]",
    },
  },
  {
    title: "Busque itens",
    description: "Pesquise referências e-Fisco, filtre materiais e serviços e reduza ambiguidade na escolha.",
    icon: MagnifyingGlass,
    tone: {
      card: "border-[#CFE4E6] bg-[#F4FBFB]",
      icon: "bg-[#E0F3F4] text-[#1D5A63]",
      number: "text-[#6E97A0]",
    },
  },
  {
    title: "Colabore",
    description: "Abra salas coletivas, receba contribuições do setor e preserve autoria das demandas.",
    icon: UsersThree,
    tone: {
      card: "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)]",
      icon: "bg-[#FBEADF] text-[#8B5A2B]",
      number: "text-[#B08456]",
    },
  },
  {
    title: "Revise",
    description: "Use checklists, alertas e resumos para corrigir lacunas antes de enviar.",
    icon: CheckCircle,
    tone: {
      card: "border-[#D6E4D9] bg-[#F6FBF7]",
      icon: "bg-[#E6F3E8] text-[#2C6A45]",
      number: "text-[#6D957B]",
    },
  },
  {
    title: "Envie",
    description: "Encaminhe para chefia e triagem com justificativa, itens, valores e contexto estruturados.",
    icon: PaperPlaneTilt,
    tone: {
      card: "border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)]",
      icon: "bg-[#DEEAF9] text-[var(--p-color-brand-600)]",
      number: "text-[#6D88AB]",
    },
  },
  {
    title: "Acompanhe",
    description: "Monitore status, devoluções, aprovações, notificações e histórico de cada documento.",
    icon: BellRinging,
    tone: {
      card: "border-[#D9E1EA] bg-[var(--p-color-surface-soft)]",
      icon: "bg-[#E9EEF4] text-[#50637C]",
      number: "text-[#7E91A8]",
    },
  },
];

const FUNCTION_MODULES = [
  {
    title: "Criação guiada de DFD",
    description:
      "Formulário orientado por etapas para registrar necessidade, justificativa, finalidade, local de uso, itens, quantidades e previsão de atendimento.",
    details: [
      "Rascunho visual com validações de preenchimento.",
      "Campos de diagnóstico para problema, beneficiários e resultado esperado.",
      "Resumo antes do envio para reduzir devoluções evitáveis.",
    ],
    icon: ClipboardText,
    tone: "action",
  },
  {
    title: "Catálogo e-Fisco assistido",
    description:
      "Busca de itens com leitura mais clara de descrição, natureza, classe de despesa e sinais fiscais relevantes para a montagem da demanda.",
    details: [
      "Busca textual com sinais de correspondência.",
      "Separação entre material, serviço, custeio e capital.",
      "Apoio visual para escolher item sem depender de tentativa e erro.",
    ],
    icon: Database,
    tone: "collab",
  },
  {
    title: "DFDs coletivas",
    description:
      "Salas de coautoria para demandas compartilhadas entre servidores, com escopo, contribuições, consolidação e conversão em DFD oficial.",
    details: [
      "Participação por setor com autoria preservada.",
      "Critérios do que entra e do que fica fora da sala.",
      "Consolidação pela chefia antes da formalização.",
    ],
    icon: UsersThree,
    tone: "success",
  },
  {
    title: "Triagem e priorização",
    description:
      "Painéis para chefia analisarem criticidade, prioridade, aderência ao planejamento e necessidade de ajustes antes do avanço.",
    details: [
      "Filas por status e pendência.",
      "Sinais de atenção para justificativa, quantidade e orçamento.",
      "Devolução orientada com rastreabilidade.",
    ],
    icon: FunnelSimple,
    tone: "warning",
  },
  {
    title: "Orçamento e consolidação",
    description:
      "Visão de valores, grupos de despesa, itens consolidados, outliers e recortes para apoiar decisões de planejamento.",
    details: [
      "KPI cards para volume, valor e risco.",
      "Agrupamento de itens semelhantes.",
      "Sinais para capital, custeio e divergência de preço.",
    ],
    icon: ChartLineUp,
    tone: "insight",
  },
  {
    title: "Histórico, verificação e auditoria",
    description:
      "Registro de movimentações, emissão de PDF, verificação pública por QR Code e trilha para acompanhar o ciclo completo.",
    details: [
      "Linha do tempo do documento.",
      "Assinatura e conferência pública.",
      "Histórico por ano, código e status.",
    ],
    icon: ShieldCheck,
    tone: "neutral",
  },
];

const ROLE_JOURNEYS = [
  {
    title: "Servidor solicitante",
    summary: "Sai do pedido solto para uma demanda contextualizada.",
    items: ["cria rascunhos", "busca itens", "anexa contexto", "acompanha devoluções"],
  },
  {
    title: "Chefia",
    summary: "Enxerga o que precisa revisar, consolidar e devolver.",
    items: ["triagem", "priorização", "coautoria", "aprovação com histórico"],
  },
  {
    title: "Administração",
    summary: "Acompanha ciclo, orçamento, catálogo e governança institucional.",
    items: ["consolidação", "relatórios", "usuários", "inteligência e-Fisco"],
  },
];

const GOVERNANCE_POINTS = [
  "DFDs com contexto, itens, valores, justificativa e status em um só percurso.",
  "Notificações e devoluções mais explícitas para reduzir retrabalho entre solicitante e chefia.",
  "Catálogo e-Fisco, natureza de despesa e agrupamentos tratados como parte da experiência, não como anexo mental.",
  "Histórico, PDF, QR Code e trilha de análise para sustentar conferência e prestação de contas.",
];

const PILLARS = [
  {
    title: "Menos confusão",
    description: "A interface deixa claro onde você está, o que já fez e o que ainda precisa revisar.",
  },
  {
    title: "Mais orientação",
    description: "Etapas, checklists, resumos e feedback visual ajudam a seguir com segurança.",
  },
  {
    title: "Mais colaboração",
    description: "Servidor, setor e chefia compartilham o processo com mais contexto e menos ruído.",
  },
];

const EXPERIENCES = [
  {
    title: "DFD individual",
    description: "Crie solicitações com contexto, justificativa e acompanhamento do que acontece depois.",
    imageSrc: "/guidance/dfd-draft-guidance.png",
  },
  {
    title: "DFDs coletivas",
    description: "Organize demandas compartilhadas do setor com participação visível e revisão conjunta.",
    imageSrc: "/guidance/collective-empty-room.png",
  },
  {
    title: "Catálogo e-Fisco",
    description: "Busque itens com apoio visual, menos ambiguidade e mais confiança na escolha.",
    imageSrc: "/guidance/catalog-no-results.png",
  },
  {
    title: "Acompanhamento",
    description: "Veja o que voltou para ajuste, o que está em análise e o que já avançou no fluxo.",
    imageSrc: "/guidance/notifications-empty.png",
  },
];

const KINETIC_TERMS = [
  "planejar",
  "catalogar",
  "coautorizar",
  "consolidar",
  "analisar",
  "auditar",
];

const LANDING_HEROES = [
  "/brands/landing-chatgpt-01.png",
  "/brands/landing-chatgpt-02.png",
  "/brands/landing-chatgpt-03.png",
  "/brands/landing-chatgpt-04.png",
  "/brands/landing-chatgpt-05.png",
];

const LANDING_NAV_ITEMS = [
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Funcionalidades", href: "#funcionalidades" },
  { label: "Perfis", href: "#perfis" },
  { label: "Institucional", href: "#institucional" },
];

const easeOut = [0.22, 1, 0.36, 1] as const;
const viewportOnce = { once: true, amount: 0.22 };

function revealMotion(delay = 0) {
  return {
    initial: { opacity: 0, y: 22, filter: "blur(8px)" },
    whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
    viewport: viewportOnce,
    transition: { duration: 0.62, delay, ease: easeOut },
  };
}

function reducedRevealMotion() {
  return {
    initial: { opacity: 0 },
    whileInView: { opacity: 1 },
    viewport: viewportOnce,
    transition: { duration: 0.2 },
  };
}

export function HumanLandingPage({
  loadingGoogle,
  onGoogleLogin,
}: {
  loadingGoogle: boolean;
  onGoogleLogin: () => Promise<void> | void;
}) {
  const reduceMotion = useReducedMotion();
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const heroRef = useRef<HTMLElement | null>(null);
  const flowRef = useRef<HTMLElement | null>(null);
  const functionsRef = useRef<HTMLElement | null>(null);
  const experiencesRef = useRef<HTMLElement | null>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothPointerX = useSpring(pointerX, { stiffness: 80, damping: 24, mass: 0.4 });
  const smoothPointerY = useSpring(pointerY, { stiffness: 80, damping: 24, mass: 0.4 });
  const heroMediaX = useTransform(smoothPointerX, [-1, 1], reduceMotion ? [0, 0] : [-18, 18]);
  const heroMediaY = useTransform(smoothPointerY, [-1, 1], reduceMotion ? [0, 0] : [-10, 10]);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroImageScrollY = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0, 210]);
  const heroContentScrollY = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0, -86]);
  const heroBackdropScale = useTransform(heroScroll, [0, 1], reduceMotion ? [1, 1] : [1, 1.14]);
  const headlineScale = useTransform(heroScroll, [0, 1], reduceMotion ? [1, 1] : [1, 0.955]);
  const headlineOpacity = useTransform(heroScroll, [0, 0.72, 1], [1, 0.9, 0.62]);
  const headlineLineOneX = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0, -30]);
  const headlineLineTwoX = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0, 22]);
  const headlineLineThreeX = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0, -16]);
  const headlineLineOneY = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0, -10]);
  const headlineLineTwoY = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0, -24]);
  const headlineLineThreeY = useTransform(heroScroll, [0, 1], reduceMotion ? [0, 0] : [0, -38]);
  const { scrollYProgress: flowScroll } = useScroll({
    target: flowRef,
    offset: ["start end", "end start"],
  });
  const { scrollYProgress: functionsScroll } = useScroll({
    target: functionsRef,
    offset: ["start end", "end start"],
  });
  const { scrollYProgress: experiencesScroll } = useScroll({
    target: experiencesRef,
    offset: ["start end", "end start"],
  });
  const flowAccentY = useTransform(flowScroll, [0, 1], reduceMotion ? [0, 0] : [110, -120]);
  const flowGridY = useTransform(flowScroll, [0, 1], reduceMotion ? [0, 0] : [24, -30]);
  const functionAccentY = useTransform(functionsScroll, [0, 1], reduceMotion ? [0, 0] : [150, -130]);
  const functionGridY = useTransform(functionsScroll, [0, 1], reduceMotion ? [0, 0] : [36, -56]);
  const experienceAccentY = useTransform(experiencesScroll, [0, 1], reduceMotion ? [0, 0] : [120, -150]);
  const experienceGridY = useTransform(experiencesScroll, [0, 1], reduceMotion ? [0, 0] : [42, -42]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveHeroIndex((current) => (current + 1) % LANDING_HEROES.length);
    }, 6200);

    return () => window.clearInterval(intervalId);
  }, []);

  function handleHeroPointerMove(event: PointerEvent<HTMLElement>) {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - rect.left) / rect.width - 0.5) * 2);
    pointerY.set(((event.clientY - rect.top) / rect.height - 0.5) * 2);
  }

  function handleHeroPointerLeave() {
    pointerX.set(0);
    pointerY.set(0);
  }

  return (
    <main className="relative bg-white text-[var(--p-color-fg-strong)]">
      <header className="sticky top-0 z-50 border-b border-[var(--p-color-surface-subtle)] bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-6 py-4 md:px-8 lg:px-10">
          <Link href="#inicio" className="flex items-center gap-3">
            <img
              src="/brands/percata-logo.png"
              alt="Percata"
              className="h-7 w-auto object-contain sm:h-8"
            />
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--p-color-fg-subtle)] sm:inline">
              Gestão de demandas
            </span>
          </Link>

          <nav className="hidden items-center gap-1 xl:flex" aria-label="Seções da landing">
            {LANDING_NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-muted)] hover:bg-[var(--p-color-info-bg)] hover:text-[var(--p-color-brand-600)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <Link
              href="/verificar-dfd"
              className="hidden h-11 items-center rounded-full border border-[var(--p-color-border)] bg-white px-4 text-sm font-semibold text-[var(--p-color-brand-600)] shadow-sm hover:bg-[var(--p-color-info-bg)] sm:inline-flex"
            >
              Verificar DFD
            </Link>
            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={loadingGoogle}
              className="relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-full bg-[var(--p-color-brand-600)] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(23,59,105,0.16)] hover:-translate-y-0.5 hover:bg-[var(--p-color-brand-700)] disabled:cursor-wait disabled:opacity-70"
            >
              <GoogleGIcon />
              <span className="relative">{loadingGoogle ? "Conectando..." : "Entrar"}</span>
            </button>
          </div>
        </div>
      </header>

      <section
        ref={heroRef}
        id="inicio"
        data-motion-static
        onPointerMove={handleHeroPointerMove}
        onPointerLeave={handleHeroPointerLeave}
        className="relative overflow-hidden border-b border-[var(--p-color-surface-subtle)] bg-white"
      >
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(243,208,190,0.28),transparent_34%),radial-gradient(circle_at_78%_16%,rgba(199,215,234,0.65),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f8fbff_72%,#ffffff_100%)]"
          style={{ scale: heroBackdropScale }}
        />
        <motion.div
          className="absolute inset-y-0 right-0 hidden w-[56%] md:block"
          style={{ x: heroMediaX, y: heroImageScrollY }}
        >
          <motion.div style={{ y: heroMediaY }} className="absolute inset-0">
            {LANDING_HEROES.map((heroSrc, index) => (
              <motion.img
                key={heroSrc}
                src={heroSrc}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover object-center"
                animate={{
                  opacity: activeHeroIndex === index ? 0.95 : 0,
                  scale:
                    activeHeroIndex === index
                      ? [1.075, 1.02, 1.07]
                      : 1.09,
                  x:
                    activeHeroIndex === index
                      ? [10, -9, 8]
                      : 20,
                  y: activeHeroIndex === index ? [0, -3, 0] : 0,
                  filter: activeHeroIndex === index ? "blur(0px)" : "blur(5px)",
                }}
                transition={{
                  opacity: {
                    duration: reduceMotion ? 0.2 : 1.1,
                    ease: easeOut,
                  },
                  scale: {
                    duration: reduceMotion ? 0.2 : 6.4,
                    repeat: activeHeroIndex === index && !reduceMotion ? Infinity : 0,
                    repeatType: "mirror",
                    ease: "easeInOut",
                  },
                  x: {
                    duration: reduceMotion ? 0.2 : 7.2,
                    repeat: activeHeroIndex === index && !reduceMotion ? Infinity : 0,
                    repeatType: "mirror",
                    ease: "easeInOut",
                  },
                  y: {
                    duration: reduceMotion ? 0.2 : 6.8,
                    repeat: activeHeroIndex === index && !reduceMotion ? Infinity : 0,
                    repeatType: "mirror",
                    ease: "easeInOut",
                  },
                  filter: {
                    duration: reduceMotion ? 0.2 : 0.9,
                    ease: easeOut,
                  },
                }}
                style={{
                  maskImage:
                    "linear-gradient(to left, rgba(0,0,0,1) 60%, rgba(0,0,0,0.1) 88%, rgba(0,0,0,0) 100%)",
                }}
              />
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          className="relative mx-auto flex min-h-[680px] w-full max-w-[1280px] flex-col justify-center px-6 py-10 md:px-8 lg:min-h-[760px] lg:px-10"
          style={{ y: heroContentScrollY }}
        >
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeOut }}
            className="max-w-[620px]"
          >
            <img
              src="/brands/percata-logo.png"
              alt="Percata"
              className="h-auto w-[220px] max-w-[68vw] object-contain"
            />
            <motion.h1
              className="mt-6 overflow-visible font-display text-[34px] font-semibold leading-[1.04] text-[var(--p-color-brand-600)] sm:text-[38px] md:text-[50px]"
              style={{ scale: headlineScale, opacity: headlineOpacity, transformOrigin: "left center" }}
              aria-label="DFDs, catálogo, coautoria e análise em um fluxo mais claro"
            >
              <motion.span
                className="block"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.58, ease: easeOut }}
                style={{ x: headlineLineOneX, y: headlineLineOneY }}
              >
                DFDs, catálogo,
              </motion.span>
              <motion.span
                className="block"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.58, delay: 0.08, ease: easeOut }}
                style={{ x: headlineLineTwoX, y: headlineLineTwoY }}
              >
                coautoria e análise
              </motion.span>
              <motion.span
                className="block"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.58, delay: 0.16, ease: easeOut }}
                style={{ x: headlineLineThreeX, y: headlineLineThreeY }}
              >
                em um fluxo mais claro
              </motion.span>
            </motion.h1>
            <p className="mt-4 max-w-[560px] text-base leading-7 text-[var(--p-color-fg-muted)]">
              O Percata ajuda servidores, chefias e administração a criar demandas, buscar itens,
              organizar pedidos, acompanhar decisões e manter rastreabilidade do ciclo institucional.
            </p>

            <KineticWordRail reduceMotion={Boolean(reduceMotion)} />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <motion.button
                type="button"
                onClick={onGoogleLogin}
                disabled={loadingGoogle}
                whileHover={reduceMotion ? undefined : { y: -2 }}
                whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                className="relative inline-flex h-12 items-center justify-center gap-3 overflow-hidden rounded-xl bg-[var(--p-color-brand-600)] px-5 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(23,59,105,0.18)] hover:bg-[var(--p-color-brand-700)] disabled:cursor-wait disabled:opacity-70"
              >
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-y-0 -left-16 w-12 skew-x-[-18deg] bg-white/18"
                  animate={reduceMotion ? undefined : { x: [0, 360] }}
                  transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 2.2 }}
                />
                <GoogleGIcon />
                <span className="relative">{loadingGoogle ? "Conectando..." : "Entrar com Google"}</span>
              </motion.button>

              <Link
                href="#como-funciona"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--p-color-border)] bg-white px-5 text-sm font-semibold text-[var(--p-color-brand-600)] shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--p-color-info-bg)] hover:shadow-[0_14px_34px_rgba(23,59,105,0.12)]"
              >
                Entender como funciona
                <ArrowRight size={16} weight="bold" className="transition group-hover:translate-x-1" />
              </Link>
            </div>

            <motion.div
              aria-hidden="true"
              className="mt-8 block overflow-hidden rounded-[26px] border border-[var(--p-color-border)] bg-[var(--p-color-info-bg)] p-3 shadow-sm md:hidden"
              animate={reduceMotion ? undefined : { y: [0, -5, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="relative aspect-[16/10] overflow-hidden rounded-[20px] bg-white">
                {LANDING_HEROES.slice(0, 3).map((heroSrc, index) => (
                  <motion.img
                    key={`mobile-${heroSrc}`}
                    src={heroSrc}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    animate={{
                      opacity: activeHeroIndex % 3 === index ? 1 : 0,
                      scale: activeHeroIndex % 3 === index ? [1.06, 1.01, 1.05] : 1.08,
                    }}
                    transition={{ duration: 1, ease: easeOut }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            aria-hidden="true"
            className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 text-[var(--p-color-fg-subtle)] md:block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.4 }}
          >
            <span className="relative block h-10 w-6 rounded-full border border-[var(--p-color-info-border)] bg-white/70 shadow-sm">
              <motion.span
                className="absolute left-1/2 top-2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--p-color-brand-600)]"
                animate={reduceMotion ? undefined : { y: [0, 14, 0], opacity: [1, 0.45, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />
            </span>
          </motion.div>
        </motion.div>
      </section>

      <section
        ref={flowRef}
        data-motion-static
        id="como-funciona"
        className="relative scroll-mt-24 overflow-hidden border-b border-[var(--p-color-surface-subtle)] bg-[var(--p-color-info-bg)] lg:scroll-mt-28"
      >
        <motion.div
          aria-hidden="true"
          className="absolute -right-24 top-10 h-72 w-72 rounded-full border border-[#CFE4E6] bg-[#E6F5F4]/70 shadow-[0_40px_110px_rgba(31,111,120,0.12)]"
          style={{ y: flowAccentY }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute -left-20 bottom-8 h-52 w-52 rounded-[46px] border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)]/80 shadow-[0_34px_90px_rgba(139,90,43,0.12)]"
          style={{ y: flowGridY }}
        />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 py-16 md:px-8 lg:px-10">
          <div className="max-w-[760px]">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--p-color-brand-600)] md:text-4xl">
              Um fluxo inteiro que fica mais fácil de entender
            </h2>
            <p className="mt-3 text-base leading-7 text-[var(--p-color-fg-muted)]">
              O sistema acompanha desde a definição da demanda até o envio e o acompanhamento da análise.
            </p>
          </div>

          <motion.div
            className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-6"
            style={{ y: flowGridY }}
          >
            {FLOW_STEPS.map((step, index) => (
              <FlowStep
                key={step.title}
                index={index + 1}
                title={step.title}
                description={step.description}
                icon={<step.icon size={18} weight="bold" />}
                tone={step.tone}
              />
            ))}
          </motion.div>
        </div>
      </section>

      <section
        ref={functionsRef}
        data-motion-static
        id="funcionalidades"
        className="relative scroll-mt-24 overflow-hidden border-b border-[var(--p-color-surface-subtle)] bg-white lg:scroll-mt-28"
      >
        <motion.div
          aria-hidden="true"
          className="absolute left-[44%] top-10 hidden h-[540px] w-[540px] -translate-x-1/2 rounded-full border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)]/70 shadow-[0_48px_140px_rgba(23,59,105,0.08)] lg:block"
          style={{ y: functionAccentY }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute right-8 top-24 hidden w-[260px] rounded-[28px] border border-[var(--p-color-surface-subtle)] bg-white/80 p-4 shadow-[0_30px_90px_rgba(23,59,105,0.13)] backdrop-blur lg:block"
          style={{ y: functionGridY }}
          animate={reduceMotion ? undefined : { rotate: [-1, 1, -1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        >
          <p className="text-xs font-semibold uppercase text-[var(--p-color-fg-subtle)]">Módulos integrados</p>
          <div className="mt-4 grid gap-2">
            {["DFD", "Catálogo", "Triagem"].map((label, index) => (
              <motion.div
                key={label}
                className="flex items-center justify-between rounded-2xl border border-[var(--p-color-surface-subtle)] bg-[var(--p-color-info-bg)] px-3 py-2 text-xs font-semibold text-[var(--p-color-brand-600)]"
                animate={reduceMotion ? undefined : { x: [0, index % 2 ? -5 : 5, 0] }}
                transition={{ duration: 3.6 + index, repeat: Infinity, ease: "easeInOut" }}
              >
                <span>{label}</span>
                <span className="h-2 w-2 rounded-full bg-[#2C6A45]" />
              </motion.div>
            ))}
          </div>
        </motion.div>
        <div className="relative mx-auto w-full max-w-[1280px] px-6 py-16 md:px-8 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
            <div className="lg:sticky lg:top-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--p-color-fg-subtle)]">
                Funções do sistema
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--p-color-brand-600)] md:text-4xl">
                O Percata não é só uma tela de preenchimento
              </h2>
              <p className="mt-4 max-w-[520px] text-base leading-8 text-[var(--p-color-fg-muted)]">
                Criação de DFD, catálogo, coautoria, triagem, orçamento, histórico e governança
                trabalham juntos para preservar o contexto da demanda.
              </p>
              <div className="mt-6 grid gap-3">
                {PILLARS.map((pillar) => (
                  <div key={pillar.title} className="rounded-[18px] border border-[var(--p-color-surface-subtle)] bg-[#FBFCFE] px-4 py-3">
                    <p className="font-display text-base font-semibold tracking-tight text-[var(--p-color-brand-600)]">{pillar.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--p-color-fg-muted)]">{pillar.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <motion.div
              className="grid gap-5 md:grid-cols-2"
              style={{ y: functionGridY }}
            >
              {FUNCTION_MODULES.map((module) => (
                <FunctionModuleCard key={module.title} {...module} />
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <section data-motion-static id="perfis" className="scroll-mt-24 border-b border-[var(--p-color-surface-subtle)] bg-[var(--p-color-info-bg)] lg:scroll-mt-28">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-16 md:px-8 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--p-color-fg-subtle)]">
                Jornada por perfil
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--p-color-brand-600)] md:text-4xl">
                Cada perfil vê o processo pelo que precisa resolver
              </h2>
              <p className="mt-4 max-w-[560px] text-base leading-8 text-[var(--p-color-fg-muted)]">
                A experiência não depende de memorizar regras administrativas. Ela organiza as ações,
                pendências e decisões em painéis próprios para solicitante, chefia e administração.
              </p>
            </div>

            <div className="grid gap-4">
              {ROLE_JOURNEYS.map((journey, index) => (
                <RoleJourneyCard key={journey.title} index={index + 1} {...journey} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        ref={experiencesRef}
        data-motion-static
        id="experiencias"
        className="relative scroll-mt-24 overflow-hidden border-b border-[var(--p-color-surface-subtle)] bg-[#FBFCFE] lg:scroll-mt-28"
      >
        <motion.div
          aria-hidden="true"
          className="absolute -right-16 top-16 h-64 w-64 rounded-[58px] border border-[var(--p-color-insight-border)] bg-[#FAF7FF]/80 shadow-[0_34px_100px_rgba(122,95,180,0.12)]"
          style={{ y: experienceAccentY }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute left-10 bottom-12 hidden h-36 w-36 rounded-full border border-[var(--p-color-border)] bg-white/85 shadow-[0_30px_85px_rgba(23,59,105,0.11)] md:block"
          style={{ y: experienceGridY }}
        />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 py-16 md:px-8 lg:px-10">
          <div className="max-w-[720px]">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--p-color-brand-600)] md:text-4xl">
              O Percata em uso, com telas que explicam o trabalho
            </h2>
            <p className="mt-3 text-base leading-7 text-[var(--p-color-fg-muted)]">
              Cada tela mostra o estado atual, a próxima ação e o contexto necessário para decidir com segurança.
            </p>
          </div>

          <motion.div
            className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4"
            style={{ y: experienceGridY }}
          >
            {EXPERIENCES.map((experience) => (
              <ExperienceCard key={experience.title} {...experience} />
            ))}
          </motion.div>
        </div>
      </section>

      <section data-motion-static id="institucional" className="scroll-mt-24 border-b border-[var(--p-color-surface-subtle)] bg-white lg:scroll-mt-28">
        <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-6 py-16 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--p-color-brand-600)] md:text-4xl">
              Seriedade institucional sem cara de sistema frio
            </h2>
            <p className="mt-4 max-w-[560px] text-base leading-8 text-[var(--p-color-fg-muted)]">
              O Percata foi pensado para apoiar a organização administrativa, a colaboração entre setores,
              a análise de chefias e a conferência pública de documentos com mais rastreabilidade.
            </p>
            <div className="mt-8 grid gap-3">
              {GOVERNANCE_POINTS.map((point) => (
                <TrustPoint key={point}>{point}</TrustPoint>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-[28px] border border-[var(--p-color-surface-subtle)] bg-[var(--p-color-info-bg)] p-8 shadow-sm">
            <div>
              <img
                src="/brands/upe-logo-color.png"
                alt="Universidade de Pernambuco"
                className="h-auto w-[220px] object-contain"
              />
              <p className="mt-6 text-sm leading-7 text-[var(--p-color-fg-muted)]">
                O sistema organiza demandas, colaboração, análise e evidências em uma experiência mais compreensível para o ciclo institucional.
              </p>
            </div>

            <div className="mt-8 grid gap-3">
              <div className="rounded-[22px] bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3 text-[var(--p-color-brand-600)]">
                  <ShieldCheck size={22} weight="duotone" />
                  <h3 className="font-display text-xl font-semibold tracking-tight">
                    Menos portal. Mais companhia durante o processo.
                  </h3>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniProof icon={<GitBranch size={18} weight="bold" />} label="Fluxo rastreável" value="status, devolução e histórico" />
                <MiniProof icon={<StackSimple size={18} weight="bold" />} label="Base organizada" value="itens, valores e contexto" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section data-motion-static className="bg-[var(--p-color-brand-600)] text-white">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-16 md:px-8 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-[700px]">
              <img
                src="/brands/upe-logo-monochrome-positive.png"
                alt="Universidade de Pernambuco"
                className="h-auto w-[180px] object-contain opacity-95"
              />
              <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight md:text-4xl">
                Entre quando quiser. O caminho continua mais claro lá dentro.
              </h2>
              <p className="mt-4 text-base leading-8 text-white/82">
                Servidores e chefias encontram no Percata um fluxo mais guiado para construir, revisar e acompanhar DFDs com mais confiança.
              </p>
            </div>

            <motion.button
              type="button"
              onClick={onGoogleLogin}
              disabled={loadingGoogle}
              whileHover={reduceMotion ? undefined : { y: -2 }}
              whileTap={reduceMotion ? undefined : { scale: 0.99 }}
              className="relative inline-flex h-14 items-center justify-center gap-3 overflow-hidden rounded-2xl bg-white px-6 text-sm font-semibold text-[var(--p-color-brand-600)] shadow-sm hover:bg-[var(--p-color-info-bg)] disabled:cursor-wait disabled:opacity-70"
            >
              <motion.span
                aria-hidden="true"
                className="absolute inset-y-0 -left-16 w-12 skew-x-[-18deg] bg-[var(--p-color-brand-600)]/10"
                animate={reduceMotion ? undefined : { x: [0, 320] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 2.1 }}
              />
              <GoogleGIcon />
              <span className="relative">{loadingGoogle ? "Conectando..." : "Entrar com Google"}</span>
            </motion.button>
          </div>
        </div>
      </section>
    </main>
  );
}

function KineticWordRail({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="mt-4 max-w-[560px] overflow-hidden rounded-[18px] border border-[var(--p-color-border)] bg-white/76 p-1.5 shadow-[0_16px_44px_rgba(23,59,105,0.08)] backdrop-blur">
      <motion.div
        className="flex w-max gap-2"
        animate={reduceMotion ? undefined : { x: ["0%", "-50%"] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      >
        {[...KINETIC_TERMS, ...KINETIC_TERMS].map((term, index) => (
          <motion.span
            key={`${term}-${index}`}
            className="inline-flex h-8 items-center rounded-xl border border-[var(--p-color-surface-subtle)] bg-[var(--p-color-info-bg)] px-3 type-kicker font-semibold uppercase tracking-[0.16em] text-[var(--p-color-brand-600)]"
            animate={
              reduceMotion
                ? undefined
                : {
                    y: index % 2 === 0 ? [0, -2, 0] : [0, 2, 0],
                    opacity: [0.78, 1, 0.78],
                  }
            }
            transition={{
              duration: 3.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: (index % KINETIC_TERMS.length) * 0.08,
            }}
          >
            {term}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}

function FlowStep({
  index,
  title,
  description,
  icon,
  tone,
}: {
  index: number;
  title: string;
  description: string;
  icon: ReactNode;
  tone: {
    card: string;
    icon: string;
    number: string;
  };
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      {...(reduceMotion ? reducedRevealMotion() : revealMotion(index * 0.04))}
      whileHover={reduceMotion ? undefined : { y: -6, rotateX: 1.5 }}
      transition={{ duration: 0.22, ease: easeOut }}
      className={`rounded-[22px] border p-5 shadow-sm transition-colors hover:shadow-[0_18px_45px_rgba(23,59,105,0.10)] ${tone.card}`}
    >
      <div className="flex items-center justify-between">
        <motion.span
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone.icon}`}
          animate={reduceMotion ? undefined : { y: [0, -2, 0] }}
          transition={{ duration: 3.4 + index * 0.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {icon}
        </motion.span>
        <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${tone.number}`}>
          {String(index).padStart(2, "0")}
        </span>
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold tracking-tight text-[var(--p-color-brand-600)]">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-7 text-[var(--p-color-fg-muted)]">{description}</p>
    </motion.div>
  );
}

function toneClasses(tone: string) {
  if (tone === "action") {
    return {
      card: "border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)]",
      icon: "bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-600)]",
      chip: "border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-600)]",
    };
  }
  if (tone === "collab") {
    return {
      card: "border-[#CFE4E6] bg-[#F4FBFB]",
      icon: "bg-[#E0F3F4] text-[#1D5A63]",
      chip: "border-[var(--p-color-collab-border)] bg-[var(--p-color-collab-bg)] text-[var(--p-color-collab)]",
    };
  }
  if (tone === "success") {
    return {
      card: "border-[#D6E4D9] bg-[#F6FBF7]",
      icon: "bg-[#E6F3E8] text-[#2C6A45]",
      chip: "border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]",
    };
  }
  if (tone === "warning") {
    return {
      card: "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)]",
      icon: "bg-[#FBEADF] text-[#8B5A2B]",
      chip: "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]",
    };
  }
  if (tone === "insight") {
    return {
      card: "border-[var(--p-color-insight-border)] bg-[var(--p-color-insight-bg)]",
      icon: "bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]",
      chip: "border-[var(--p-color-insight-border)] bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]",
    };
  }
  return {
    card: "border-[#D9E1EA] bg-[var(--p-color-surface-soft)]",
    icon: "bg-[#E9EEF4] text-[#50637C]",
    chip: "border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] text-[var(--p-color-fg-muted)]",
  };
}

function FunctionModuleCard({
  title,
  description,
  details,
  icon: Icon,
  tone,
}: {
  title: string;
  description: string;
  details: string[];
  icon: typeof ClipboardText;
  tone: string;
}) {
  const classes = toneClasses(tone);
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      {...(reduceMotion ? reducedRevealMotion() : revealMotion())}
      whileHover={reduceMotion ? undefined : { y: -7, scale: 1.01 }}
      transition={{ duration: 0.22, ease: easeOut }}
      className={`rounded-[24px] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(22,64,115,0.10)] ${classes.card}`}
    >
      <div className="flex items-start justify-between gap-4">
        <motion.span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${classes.icon}`}
          whileHover={reduceMotion ? undefined : { rotate: -4, scale: 1.05 }}
        >
          <Icon size={22} weight="duotone" />
        </motion.span>
        <span className={`rounded-full border px-3 py-1 type-kicker font-semibold uppercase tracking-[0.14em] ${classes.chip}`}>
          Função
        </span>
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold tracking-tight text-[var(--p-color-brand-600)]">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-[var(--p-color-fg-muted)]">{description}</p>
      <div className="mt-5 grid gap-2">
        {details.map((detail) => (
          <div key={detail} className="flex gap-2 rounded-2xl bg-white/72 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <SealCheck size={16} weight="bold" className="mt-0.5 shrink-0 text-[var(--p-color-brand-600)]" />
            <p className="text-xs leading-5 text-[#4E5B6B]">{detail}</p>
          </div>
        ))}
      </div>
    </motion.article>
  );
}

function RoleJourneyCard({
  index,
  title,
  summary,
  items,
}: {
  index: number;
  title: string;
  summary: string;
  items: string[];
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.article
      {...(reduceMotion ? reducedRevealMotion() : revealMotion(index * 0.05))}
      whileHover={reduceMotion ? undefined : { x: 4, y: -3 }}
      transition={{ duration: 0.22, ease: easeOut }}
      className="rounded-[24px] border border-[var(--p-color-border)] bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--p-color-fg-subtle)]">
            Perfil {String(index).padStart(2, "0")}
          </p>
          <h3 className="mt-2 font-display text-xl font-semibold tracking-tight text-[var(--p-color-brand-600)]">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-7 text-[var(--p-color-fg-muted)]">{summary}</p>
        </div>
        <motion.span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-600)]"
          animate={reduceMotion ? undefined : { rotate: [0, 2, -2, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <UsersThree size={20} weight="duotone" />
        </motion.span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-[var(--p-color-border)] bg-[var(--p-color-info-bg)] px-3 py-1 text-xs font-semibold text-[var(--p-color-fg-muted)]"
          >
            {item}
          </span>
        ))}
      </div>
    </motion.article>
  );
}

function ExperienceCard({
  title,
  description,
  imageSrc,
}: {
  title: string;
  description: string;
  imageSrc: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.article
      {...(reduceMotion ? reducedRevealMotion() : revealMotion())}
      whileHover={reduceMotion ? undefined : { y: -6 }}
      transition={{ duration: 0.22, ease: easeOut }}
      className="overflow-hidden rounded-[24px] border border-[var(--p-color-surface-subtle)] bg-white shadow-sm"
    >
      <div className="border-b border-[#EEF2F6] bg-[#FBFCFE] p-4">
        <motion.img
          src={imageSrc}
          alt=""
          aria-hidden="true"
          className="aspect-[16/10] w-full object-contain"
          whileHover={reduceMotion ? undefined : { scale: 1.04, y: -2 }}
          transition={{ duration: 0.25, ease: easeOut }}
        />
      </div>
      <div className="p-5">
        <h3 className="font-display text-xl font-semibold tracking-tight text-[var(--p-color-brand-600)]">
          {title}
        </h3>
        <p className="mt-3 text-sm leading-7 text-[var(--p-color-fg-muted)]">{description}</p>
      </div>
    </motion.article>
  );
}

function MiniProof({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      {...(reduceMotion ? reducedRevealMotion() : revealMotion())}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      className="rounded-[18px] border border-[var(--p-color-surface-subtle)] bg-white px-4 py-4 shadow-sm"
    >
      <div className="flex items-center gap-2 text-[var(--p-color-brand-600)]">
        {icon}
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--p-color-fg-muted)]">{value}</p>
    </motion.div>
  );
}

function TrustPoint({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      {...(reduceMotion ? reducedRevealMotion() : revealMotion())}
      whileHover={reduceMotion ? undefined : { x: 4 }}
      className="flex items-start gap-3 rounded-[20px] border border-[var(--p-color-surface-subtle)] bg-[#FBFCFE] px-4 py-4"
    >
      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-600)]">
        <Files size={16} weight="bold" />
      </span>
      <p className="text-sm leading-7 text-[var(--p-color-fg-muted)]">{children}</p>
    </motion.div>
  );
}
