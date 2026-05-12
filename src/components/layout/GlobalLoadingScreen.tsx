"use client";

import { useEffect, useRef, useState } from "react";

const MESSAGE_ROTATION_MS = 2200;

const LOADING_MESSAGES = [
  "Consolidando demandas e organizando aquisições...",
  "Sincronizando estoque e níveis de suprimento...",
  "Atualizando inventário e rastreando ativos...",
  "Orquestrando dados institucionais...",
  "Validando registros e fluxos acadêmicos...",
  "Indexando acervo e estruturando consultas...",
  "Estruturando dados científicos e acadêmicos...",
  "Preparando cenários de prática profissional...",
  "Organizando protocolos e recursos técnicos...",
  "Processando dados territoriais e geográficos...",
  "Correlacionando eventos e registros históricos...",
  "Loading language systems and structures...",
  "Cargando contenidos y estructuras del español...",
  "Processando estruturas e relações matemáticas...",
  "Analisando dados e perfis nutricionais...",
  "Modelando práticas e processos educacionais...",
  "Auditando e validando dados acadêmicos...",
  "Orquestrando ofertas e fluxos de cursos...",
  "Consolidando dados financeiros e orçamentários...",
  "Integrando dados de pesquisa e inovação...",
  "Conectando projetos à comunidade...",
  "Verificando consistência dos dados educacionais...",
  "Carregando panorama estratégico...",
  "Sincronizando apoio à gestão executiva...",
  "Organizando fluxos administrativos...",
  "Estruturando programas e linhas de pesquisa...",
  "Rastreando vínculos e atividades acadêmicas...",
  "Preparando interface de atendimento...",
  "Processando vínculos e dados funcionais...",
  "Calibrando ambientes e sistemas técnicos...",
  "Gerenciando fluxos e comunicações institucionais...",
  "Inicializando serviços e infraestrutura digital...",
  "Processando interações e reações bioquímicas...",
  "Analisando relações simbióticas...",
  "Integrando dados de saúde e desempenho funcional...",
  "Monitorando respostas fisiológicas...",
  "Analisando variáveis cardiopulmonares...",
  "Processando práticas e recursos linguísticos...",
  "Estruturando dados de educação alimentar e nutricional...",
  "Investigando diversidade e comportamento fúngico...",
  "Simulando sistemas físicos e energéticos...",
  "Analisando dinâmicas agrícolas e ambientais...",
  "Modelando indicadores de saúde populacional...",
  "Validando padrões e segurança alimentar...",
  "Investigando aspectos da saúde humana...",
  "Inicializando práticas terapêuticas...",
  "Processando protocolos clínicos...",
  "Integrando práticas avançadas de reabilitação...",
  "Analisando indicadores do estado nutricional...",
  "Explorando sistemas biológicos integrados...",
  "Processando dados espaciais e ambientais...",
  "Modelando processos em tecnologia de alimentos...",
  "Correlacionando estruturas anatômicas e patológicas...",
  "Monitorando conservação e biodiversidade...",
  "Desenvolvendo práticas inclusivas em educação...",
  "Analisando interações entre solo e ecossistemas...",
  "Desenvolvendo aplicações tecnológicas...",
  "Ampliando e analisando estruturas microscópicas...",
  "Decodificando estruturas e expressões genéticas...",
  "Aprimorando metodologias de ensino...",
  "Integrando território, ambiente e sociedade...",
  "Prospectando compostos bioativos...",
  "Investigando microrganismos e interações...",
  "Analisando processos psicológicos e educacionais...",
  "Quantificando desempenho e adaptação humana...",
  "Estudando regulação neural e metabólica...",
  "Inicializando ambientes computacionais...",
  "Interpretando processos históricos...",
  "Analisando movimento e função humana...",
  "Avaliando composição e qualidade de alimentos...",
  "Formando e integrando práticas docentes...",
  "Integrando dados do campus Petrolina...",
  "Conectando informações do campus Ouricuri...",
  "Alinhando dados institucionais em Pernambuco...",
  "Sincronizando atividades entre os campi...",
  "Integrando operações no Sertão do São Francisco...",
  "Conectando ensino, pesquisa e extensão...",
  "Articulando ações institucionais no território...",
  "Estruturando demandas regionais...",
];

function buildQueue(total: number, lastIndex: number): number[] {
  const pool: number[] = [];
  for (let i = 0; i < total; i += 1) {
    if (total > 1 && i === lastIndex) continue;
    pool.push(i);
  }

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    const temp = pool[i];
    pool[i] = pool[randomIndex];
    pool[randomIndex] = temp;
  }

  return pool;
}

export function GlobalLoadingScreen() {
  const [index, setIndex] = useState(0);
  const [messageTick, setMessageTick] = useState(1);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [mounted, setMounted] = useState(false);
  const queueRef = useRef<number[]>([]);
  const lastIndexRef = useRef(index);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateReduceMotion = () => setReduceMotion(mediaQuery.matches);
    updateReduceMotion();
    mediaQuery.addEventListener("change", updateReduceMotion);
    return () => mediaQuery.removeEventListener("change", updateReduceMotion);
  }, []);

  useEffect(() => {
    const tick = () => {
      if (queueRef.current.length === 0) {
        queueRef.current = buildQueue(LOADING_MESSAGES.length, lastIndexRef.current);
      }

      const nextIndex = queueRef.current.pop();
      if (typeof nextIndex !== "number") return;

      lastIndexRef.current = nextIndex;
      setIndex(nextIndex);
      setMessageTick((prev) => prev + 1);
    };

    const timer = window.setInterval(tick, MESSAGE_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, []);

  const animationStyle = reduceMotion ? { animation: "none" } : undefined;
  const moduleTotal = 12;
  const moduleStep = ((messageTick - 1) % moduleTotal) + 1;
  const progressPercent = Math.round((moduleStep / moduleTotal) * 100);

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_18%_18%,#fff9ec_0%,#f7edd9_60%,#eddcc0_100%)] flex items-center justify-center px-6 py-10 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none bg-[radial-gradient(circle,_#000_0.6px,transparent_0.6px)] [background-size:6px_6px]" />

      <div className="relative z-10 w-full max-w-[560px] flex flex-col items-center">
        <div className="relative h-[190px] w-full">
          <div className="absolute inset-x-[8%] bottom-10 h-[2px] bg-black/12" />

          <div
            className="absolute bottom-8 left-[calc(50%-116px)] h-3 w-24 rounded-full bg-black/12 blur-[5px] loading-sh1"
            style={animationStyle}
          />
          <div
            className="absolute bottom-8 left-[calc(50%+14px)] h-3 w-24 rounded-full bg-black/12 blur-[5px] loading-sh2"
            style={animationStyle}
          />

          <div
            className="absolute bottom-10 left-[calc(50%-160px)] h-[80px] w-[160px] drop-shadow-[0_10px_8px_rgba(0,0,0,0.12)] loading-sandal-1"
            style={animationStyle}
          >
            <img
              src="/sandalia.png"
              alt=""
              aria-hidden="true"
              className="h-full w-full object-contain"
              draggable={false}
            />
          </div>

          <div
            className="absolute bottom-10 left-[calc(50%)] h-[80px] w-[160px] drop-shadow-[0_10px_8px_rgba(0,0,0,0.12)] loading-sandal-2"
            style={animationStyle}
          >
            <img
              src="/sandalia.png"
              alt=""
              aria-hidden="true"
              className="h-full w-full object-contain"
              draggable={false}
            />
          </div>
        </div>

        <p
          key={mounted ? index : "initial"}
          suppressHydrationWarning
          className="loading-message text-center text-[20px] sm:text-[22px] leading-[1.35] font-semibold text-upe-neutral-dark-graphite px-2"
        >
          {LOADING_MESSAGES[mounted ? index : 0]}
        </p>

        <p className="mt-3 text-sm sm:text-[15px] text-upe-neutral-dark-slate-gray/90 font-medium">
          Processando {moduleStep} de {moduleTotal} módulos
        </p>

        <div className="mt-5 w-full max-w-[440px] h-[6px] rounded-full bg-black/10 overflow-hidden">
          <div
            className="loading-progress h-full rounded-full bg-gradient-to-r from-upe-blue-medium via-upe-blue-upe to-upe-blue-gray-blue relative"
            style={{ width: `${progressPercent}%`, ...animationStyle }}
          >
            <span className="loading-progress-shimmer absolute inset-0" style={animationStyle} />
          </div>
        </div>

        <p className="mt-3 text-[12px] text-upe-neutral-dark-slate-gray/75 font-medium">
          ⏳ Isso pode levar alguns segundos
        </p>
      </div>

      <style jsx>{`
        .loading-sandal-1 {
          transform-origin: 22% 78%;
          animation: step1 1.4s infinite cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 2;
        }

        .loading-sandal-2 {
          transform-origin: 22% 78%;
          animation: step2 1.4s infinite cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 1;
        }

        .loading-sh1 {
          animation: shadow1 1.4s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }

        .loading-sh2 {
          animation: shadow2 1.4s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }

        .loading-message {
          animation: fadeIn 260ms ease-out;
        }

        .loading-progress {
          transition: width 520ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        .loading-progress-shimmer {
          background: linear-gradient(
            100deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.35) 45%,
            rgba(255, 255, 255, 0) 85%
          );
          transform: translateX(-110%);
          animation: shimmer 1.4s infinite linear;
        }

        @keyframes step1 {
          0%,
          100% {
            transform: translateX(0) translateY(0) rotate(0deg) scale(1);
          }
          24% {
            transform: translateX(18px) translateY(-12px) rotate(-6deg) scale(0.99);
          }
          50% {
            transform: translateX(34px) translateY(0) rotate(0deg) scale(1);
          }
          74% {
            transform: translateX(26px) translateY(2px) rotate(1deg) scale(1.01);
          }
        }

        @keyframes step2 {
          0%,
          100% {
            transform: translateX(0) translateY(0) rotate(0deg) scale(1);
          }
          24% {
            transform: translateX(-4px) translateY(2px) rotate(1deg) scale(1.01);
          }
          50% {
            transform: translateX(0) translateY(0) rotate(0deg) scale(1);
          }
          74% {
            transform: translateX(18px) translateY(-12px) rotate(-6deg) scale(0.99);
          }
        }

        @keyframes shadow1 {
          0%,
          100% {
            transform: scaleX(1);
            opacity: 0.16;
          }
          20% {
            transform: scaleX(0.76);
            opacity: 0.08;
          }
          50% {
            transform: scaleX(1.02);
            opacity: 0.16;
          }
          70% {
            transform: scaleX(1);
            opacity: 0.14;
          }
        }

        @keyframes shadow2 {
          0%,
          100% {
            transform: scaleX(1);
            opacity: 0.15;
          }
          20% {
            transform: scaleX(1);
            opacity: 0.13;
          }
          50% {
            transform: scaleX(1.02);
            opacity: 0.15;
          }
          70% {
            transform: scaleX(0.76);
            opacity: 0.08;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shimmer {
          from {
            transform: translateX(-110%);
          }
          to {
            transform: translateX(220%);
          }
        }
      `}</style>
    </div>
  );
}
