"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CalendarBlank,
  CheckCircle,
  ClipboardText,
  Files,
  FunnelSimple,
  ListChecks,
  ShieldCheck,
  UsersThree,
} from "@phosphor-icons/react";

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
    description: "Defina a necessidade e organize o que precisa entrar no ciclo.",
    icon: ClipboardText,
    tone: {
      card: "border-[#D7E2EE] bg-[#F7FAFE]",
      icon: "bg-[#EAF2FF] text-[#173B69]",
      number: "text-[#6F89AA]",
    },
  },
  {
    title: "Busque itens",
    description: "Encontre referências no catálogo com mais clareza e menos tentativa e erro.",
    icon: ListChecks,
    tone: {
      card: "border-[#CFE4E6] bg-[#F4FBFB]",
      icon: "bg-[#E0F3F4] text-[#1D5A63]",
      number: "text-[#6E97A0]",
    },
  },
  {
    title: "Colabore",
    description: "Construa salas coletivas para demandas compartilhadas do setor.",
    icon: UsersThree,
    tone: {
      card: "border-[#F0DCC9] bg-[#FFF8F2]",
      icon: "bg-[#FBEADF] text-[#8B5A2B]",
      number: "text-[#B08456]",
    },
  },
  {
    title: "Revise",
    description: "Conferências, justificativas e sinais visuais ajudam antes do envio.",
    icon: CheckCircle,
    tone: {
      card: "border-[#D6E4D9] bg-[#F6FBF7]",
      icon: "bg-[#E6F3E8] text-[#2C6A45]",
      number: "text-[#6D957B]",
    },
  },
  {
    title: "Envie",
    description: "A DFD segue para análise com contexto mais organizado.",
    icon: FunnelSimple,
    tone: {
      card: "border-[#D7E2EE] bg-[#F4F8FD]",
      icon: "bg-[#DEEAF9] text-[#173B69]",
      number: "text-[#6D88AB]",
    },
  },
  {
    title: "Acompanhe",
    description: "Veja devoluções, aprovações e próximos passos sem perder o fio.",
    icon: CalendarBlank,
    tone: {
      card: "border-[#D9E1EA] bg-[#F8FAFC]",
      icon: "bg-[#E9EEF4] text-[#50637C]",
      number: "text-[#7E91A8]",
    },
  },
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

const LANDING_HEROES = [
  "/brands/dashboard-hero-petrolina-v3.png",
  "/brands/dashboard-hero-ouricuri-v3.png",
];

export function HumanLandingPage({
  loadingGoogle,
  onGoogleLogin,
}: {
  loadingGoogle: boolean;
  onGoogleLogin: () => Promise<void> | void;
}) {
  const reduceMotion = useReducedMotion();
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveHeroIndex((current) => (current + 1) % LANDING_HEROES.length);
    }, 6200);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <main className="bg-white text-[#1E2430]" data-animate-page data-animate-auto>
      <section className="relative overflow-hidden border-b border-[#E8EDF2] bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(243,208,190,0.28),transparent_34%),radial-gradient(circle_at_78%_16%,rgba(199,215,234,0.65),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f8fbff_72%,#ffffff_100%)]" />
        <div className="absolute inset-y-0 right-0 hidden w-[56%] md:block">
          {LANDING_HEROES.map((heroSrc, index) => (
            <motion.img
              key={heroSrc}
              src={heroSrc}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover object-center"
              animate={{
                opacity: activeHeroIndex === index ? 0.95 : 0,
                scale: activeHeroIndex === index ? 1.01 : 1.06,
                x: activeHeroIndex === index ? 0 : 16,
                filter: activeHeroIndex === index ? "blur(0px)" : "blur(5px)",
              }}
              transition={{
                duration: reduceMotion ? 0.2 : 1.9,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                maskImage:
                  "linear-gradient(to left, rgba(0,0,0,1) 60%, rgba(0,0,0,0.1) 88%, rgba(0,0,0,0) 100%)",
              }}
            />
          ))}
        </div>

        <div className="relative mx-auto flex min-h-[90vh] w-full max-w-[1280px] flex-col justify-center px-6 py-16 md:px-8 lg:px-10">
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[620px]"
          >
            <img
              src="/brands/percata-logo.png"
              alt="Percata"
              className="h-auto w-[260px] max-w-[68vw] object-contain"
            />
            <h1 className="mt-8 font-display text-[42px] font-semibold leading-[1.02] tracking-tight text-[#173B69] md:text-[58px]">
              Um jeito mais humano de construir, revisar e acompanhar DFDs
            </h1>
            <p className="mt-5 max-w-[560px] text-base leading-8 text-[#566273] md:text-lg">
              O Percata ajuda servidores e chefias a organizar demandas com mais clareza,
              menos ruído e mais sensação de acompanhamento ao longo de cada etapa.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <motion.button
                type="button"
                onClick={onGoogleLogin}
                disabled={loadingGoogle}
                whileHover={reduceMotion ? undefined : { y: -2 }}
                whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#173B69] px-6 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(23,59,105,0.18)] hover:bg-[#102B4A] disabled:cursor-wait disabled:opacity-70"
              >
                <GoogleGIcon />
                {loadingGoogle ? "Conectando..." : "Entrar com Google"}
              </motion.button>

              <Link
                href="#como-funciona"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-[#D7E2EE] bg-white px-6 text-sm font-semibold text-[#173B69] shadow-sm hover:bg-[#F8FBFF]"
              >
                Entender como funciona
                <ArrowRight size={16} weight="bold" />
              </Link>
            </div>
          </motion.div>

          <div
            className="mt-14 grid gap-4 md:mt-16 md:max-w-[760px] md:grid-cols-2"
            data-animate-stagger
          >
            <RolePanel
              tone="blue"
              title="Para quem cria a DFD"
              body="Entenda o que preencher, monte sua solicitação com apoio visual e acompanhe os retornos sem perder o fio do processo."
            />
            <RolePanel
              tone="warm"
              title="Para quem revisa e decide"
              body="Consolide, acompanhe e avalie com mais contexto, mais visibilidade do fluxo e menos ruído operacional."
            />
          </div>
        </div>
      </section>

      <section
        id="como-funciona"
        className="border-b border-[#E8EDF2] bg-[#F8FBFF]"
      >
        <div className="mx-auto w-full max-w-[1280px] px-6 py-16 md:px-8 lg:px-10">
          <div className="max-w-[760px]">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[#173B69] md:text-4xl">
              Um fluxo inteiro que fica mais fácil de entender
            </h2>
            <p className="mt-3 text-base leading-7 text-[#566273]">
              O sistema acompanha desde a definição da demanda até o envio e o acompanhamento da análise.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-6" data-animate-stagger>
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
          </div>
        </div>
      </section>

      <section className="border-b border-[#E8EDF2] bg-white">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-16 md:px-8 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-[#173B69] md:text-4xl">
                O objetivo nao e só preencher. E seguir com mais segurança.
              </h2>
              <p className="mt-4 max-w-[520px] text-base leading-8 text-[#566273]">
                Humanizar o Percata significa orientar melhor, responder melhor e reduzir a tensão visual e operacional ao longo do processo.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3" data-animate-stagger>
              {PILLARS.map((pillar) => (
                <div
                  key={pillar.title}
                  className="rounded-[22px] border border-[#E8EDF2] bg-[#FBFDFC] p-5 shadow-sm"
                >
                  <h3 className="font-display text-xl font-semibold tracking-tight text-[#173B69]">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[#566273]">{pillar.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#E8EDF2] bg-[#FBFCFE]">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-16 md:px-8 lg:px-10">
          <div className="max-w-[720px]">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[#173B69] md:text-4xl">
              O Percata em uso, de forma concreta
            </h2>
            <p className="mt-3 text-base leading-7 text-[#566273]">
              O sistema organiza a experiência individual, a colaboração do setor, a busca no catálogo e o acompanhamento da análise.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4" data-animate-stagger>
            {EXPERIENCES.map((experience) => (
              <ExperienceCard key={experience.title} {...experience} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#E8EDF2] bg-white">
        <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-6 py-16 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[#173B69] md:text-4xl">
              Seriedade institucional sem cara de sistema frio
            </h2>
            <p className="mt-4 max-w-[560px] text-base leading-8 text-[#566273]">
              O Percata foi pensado para apoiar a organização administrativa, a colaboração entre setores e a análise de chefias com mais rastreabilidade e menos desgaste.
            </p>
            <div className="mt-8 grid gap-3">
              <TrustPoint>Fluxos mais claros para quem solicita e para quem revisa.</TrustPoint>
              <TrustPoint>Mais visibilidade do processo sem exigir que o usuário memorize etapas.</TrustPoint>
              <TrustPoint>Uma base mais legível para decisões, devoluções e acompanhamento institucional.</TrustPoint>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-[28px] border border-[#E8EDF2] bg-[#F8FBFF] p-8 shadow-sm">
            <div>
              <img
                src="/brands/upe-logo-color.png"
                alt="Universidade de Pernambuco"
                className="h-auto w-[220px] object-contain"
              />
              <p className="mt-6 text-sm leading-7 text-[#566273]">
                O sistema organiza demandas, colaboração e análise em uma experiência mais compreensível para o ciclo institucional.
              </p>
            </div>

            <div className="mt-8 rounded-[22px] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-[#173B69]">
                <ShieldCheck size={22} weight="duotone" />
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  Menos portal. Mais companhia durante o processo.
                </h3>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#173B69] text-white">
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
              className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-white px-6 text-sm font-semibold text-[#173B69] shadow-sm hover:bg-[#F8FBFF] disabled:cursor-wait disabled:opacity-70"
            >
              <GoogleGIcon />
              {loadingGoogle ? "Conectando..." : "Entrar com Google"}
            </motion.button>
          </div>
        </div>
      </section>
    </main>
  );
}

function RolePanel({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "blue" | "warm";
}) {
  return (
    <div
      data-animate-item
      className={
        tone === "warm"
          ? "rounded-[24px] border border-[#F0D3C0] bg-[#FFF7F1] p-5 shadow-sm"
          : "rounded-[24px] border border-[#D7E2EE] bg-white/92 p-5 shadow-sm"
      }
    >
      <h3 className="font-display text-xl font-semibold tracking-tight text-[#173B69]">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[#566273]">{body}</p>
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
  return (
    <div
      data-animate-item
      className={`rounded-[22px] border p-5 shadow-sm transition-colors ${tone.card}`}
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone.icon}`}>
          {icon}
        </span>
        <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${tone.number}`}>
          {String(index).padStart(2, "0")}
        </span>
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold tracking-tight text-[#173B69]">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-7 text-[#566273]">{description}</p>
    </div>
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
  return (
    <article
      data-animate-item
      className="overflow-hidden rounded-[24px] border border-[#E8EDF2] bg-white shadow-sm"
    >
      <div className="border-b border-[#EEF2F6] bg-[#FBFCFE] p-4">
        <img
          src={imageSrc}
          alt=""
          aria-hidden="true"
          className="aspect-[16/10] w-full object-contain"
        />
      </div>
      <div className="p-5">
        <h3 className="font-display text-xl font-semibold tracking-tight text-[#173B69]">
          {title}
        </h3>
        <p className="mt-3 text-sm leading-7 text-[#566273]">{description}</p>
      </div>
    </article>
  );
}

function TrustPoint({ children }: { children: ReactNode }) {
  return (
    <div
      data-animate-item
      className="flex items-start gap-3 rounded-[20px] border border-[#E8EDF2] bg-[#FBFCFE] px-4 py-4"
    >
      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#173B69]">
        <Files size={16} weight="bold" />
      </span>
      <p className="text-sm leading-7 text-[#566273]">{children}</p>
    </div>
  );
}
