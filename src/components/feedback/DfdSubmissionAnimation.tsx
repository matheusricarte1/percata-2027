"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import {
  ArrowRight,
  CheckCircle,
  FileText,
  PaperPlaneTilt,
  ShieldCheck,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type DfdSubmissionAnimationProps = {
  open: boolean;
  protocol?: string | null;
  onClose: () => void;
  primaryHref?: string;
};

const guidanceSteps = [
  {
    icon: FileText,
    label: "DFD registrada",
    description: "Os dados e itens foram preservados no protocolo.",
  },
  {
    icon: PaperPlaneTilt,
    label: "Enviada à chefia",
    description: "A DFD entrou na fila de análise responsável.",
  },
  {
    icon: ShieldCheck,
    label: "Acompanhe a decisão",
    description: "Você verá homologação ou devolução com orientação.",
  },
];

function motionDisabled() {
  if (typeof window === "undefined") return true;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const accountReduced = document.documentElement.dataset.reducedMotion === "1";
  const accountDisabled = document.documentElement.dataset.showAnimations === "0";
  return prefersReduced || accountReduced || accountDisabled;
}

export function DfdSubmissionAnimation({
  open,
  protocol,
  onClose,
  primaryHref = "/minhas-dfds",
}: DfdSubmissionAnimationProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!open) return;

    if (motionDisabled()) {
      gsap.set(panelRef.current, { clearProps: "all" });
      return;
    }

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

      timeline
        .fromTo(
          "[data-submission-shell]",
          { autoAlpha: 0, y: 22, scale: 0.985, filter: "blur(10px)" },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            duration: 0.42,
            clearProps: "filter,transform,opacity,visibility",
          },
        )
        .fromTo(
          imageRef.current,
          { autoAlpha: 0, y: 28, scale: 0.9, rotate: -2 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            rotate: 0,
            duration: 0.58,
            clearProps: "transform,opacity,visibility",
          },
          "-=0.2",
        )
        .fromTo(
          "[data-flight-dot]",
          { autoAlpha: 0, x: -42, y: 18, scale: 0.55 },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            scale: 1,
            duration: 0.42,
            stagger: 0.07,
            clearProps: "transform,opacity,visibility",
          },
          "-=0.34",
        )
        .fromTo(
          "[data-guidance-step]",
          { autoAlpha: 0, x: -16 },
          {
            autoAlpha: 1,
            x: 0,
            duration: 0.32,
            stagger: 0.1,
            clearProps: "transform,opacity,visibility",
          },
          "-=0.12",
        )
        .fromTo(
          "[data-submission-action]",
          { autoAlpha: 0, y: 12 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.28,
            stagger: 0.06,
            clearProps: "transform,opacity,visibility",
          },
          "-=0.05",
        );

      gsap.to(imageRef.current, {
        y: -7,
        duration: 2.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      gsap.to("[data-flight-dot]", {
        x: 10,
        duration: 1.8,
        repeat: -1,
        yoyo: true,
        stagger: 0.12,
        ease: "sine.inOut",
      });
    }, panelRef);

    return () => context.revert();
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-[#0B1628]/54 px-4 py-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dfd-submission-title"
        >
          <div
            ref={panelRef}
            data-submission-shell
            className="relative grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl lg:grid-cols-[1.08fr_0.92fr]"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D9E0E8] bg-white/90 text-[#3E4C5F] shadow-sm transition hover:bg-[#F4F7FA]"
              aria-label="Fechar confirmação de envio"
            >
              <X size={16} weight="bold" />
            </button>

            <div className="relative min-h-[430px] overflow-hidden bg-[#F4F8FC] p-6 sm:p-8">
              <div className="absolute left-8 top-8 h-28 w-28 rounded-full bg-[#C7D7EA]/45 blur-3xl" />
              <div className="absolute bottom-10 right-8 h-36 w-36 rounded-full bg-[#B7E3D7]/35 blur-3xl" />
              <div className="relative flex h-full flex-col justify-between gap-8">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#C7D7EA] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#164073]">
                    <CheckCircle size={14} weight="fill" />
                    Envio concluído
                  </span>
                  <h2
                    id="dfd-submission-title"
                    className="mt-4 max-w-xl font-display text-3xl font-semibold leading-tight tracking-tight text-[#10213A] sm:text-4xl"
                  >
                    Sua DFD foi enviada para análise da chefia.
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-[#52627A]">
                    O protocolo agora sai do rascunho e passa a ser acompanhado como
                    demanda em análise.
                  </p>
                </div>

                <div className="relative mx-auto flex w-full max-w-md items-center justify-center">
                  <div className="absolute left-8 right-8 top-1/2 h-px -translate-y-1/2 bg-[#C7D7EA]" />
                  {[0, 1, 2, 3].map((dot) => (
                    <span
                      key={dot}
                      data-flight-dot
                      className={cn(
                        "absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#1F6F78] shadow-[0_0_0_6px_rgba(31,111,120,0.11)]",
                        dot === 0 && "left-[13%]",
                        dot === 1 && "left-[31%]",
                        dot === 2 && "left-[50%]",
                        dot === 3 && "left-[70%]",
                      )}
                    />
                  ))}
                  <img
                    ref={imageRef}
                    src="/email/dfd-submitted.png"
                    alt="Ilustração de DFD enviada para análise"
                    className="relative z-[1] w-full max-w-[340px] drop-shadow-xl"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-6 p-6 sm:p-8">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#47739F]">
                  Próximos passos
                </p>
                {protocol ? (
                  <p className="mt-2 inline-flex rounded-full bg-[#E8EDF2] px-3 py-1 text-xs font-semibold text-[#164073]">
                    {protocol}
                  </p>
                ) : null}

                <div className="mt-5 space-y-4">
                  {guidanceSteps.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <div key={step.label} data-guidance-step className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#164073] text-white shadow-sm">
                            <Icon size={18} weight="bold" />
                          </span>
                          {index < guidanceSteps.length - 1 ? (
                            <span className="mt-2 h-8 w-px bg-[#D9E0E8]" />
                          ) : null}
                        </div>
                        <div className="pt-0.5">
                          <p className="text-sm font-semibold text-[#164073]">{step.label}</p>
                          <p className="mt-1 text-sm leading-6 text-[#5B6675]">{step.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  href={primaryHref}
                  data-submission-action
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#164073] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0F2E57]"
                >
                  Ver minhas DFDs
                  <ArrowRight size={16} weight="bold" />
                </Link>
                <button
                  type="button"
                  data-submission-action
                  onClick={onClose}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#C7D7EA] bg-white px-4 text-sm font-semibold text-[#164073] transition hover:bg-[#F4F7FA]"
                >
                  Continuar nesta tela
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
