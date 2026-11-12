"use client";

import { useEffect, useState } from "react";

import { getRouteLoadingLabel } from "@/lib/route-loading-label";

export function GlobalLoadingScreen() {
  const [label, setLabel] = useState("Carregando o PERCATA...");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setLabel(getRouteLoadingLabel(window.location.pathname));
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateReduceMotion = () => setReduceMotion(mediaQuery.matches);
    updateReduceMotion();
    mediaQuery.addEventListener("change", updateReduceMotion);
    return () => mediaQuery.removeEventListener("change", updateReduceMotion);
  }, []);

  const animationStyle = reduceMotion ? { animation: "none" } : undefined;

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_18%_18%,var(--p-color-warning-bg)_0%,var(--p-color-surface-soft)_58%,var(--p-color-info-bg)_100%)] flex items-center justify-center px-6 py-10 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none bg-[radial-gradient(circle,_var(--p-color-brand-700)_0.6px,transparent_0.6px)] [background-size:6px_6px]" />

      <div className="relative z-10 w-full max-w-[560px] flex flex-col items-center">
        <div className="relative h-[190px] w-full">
          <div className="absolute inset-x-[8%] bottom-10 h-[2px] bg-[var(--p-color-border)]/70" />

          <div
            className="absolute bottom-8 left-[calc(50%-116px)] h-3 w-24 rounded-full bg-[var(--p-color-border)]/70 blur-[5px] loading-sh1"
            style={animationStyle}
          />
          <div
            className="absolute bottom-8 left-[calc(50%+14px)] h-3 w-24 rounded-full bg-[var(--p-color-border)]/70 blur-[5px] loading-sh2"
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
          role="status"
          aria-live="polite"
          className="loading-message text-center text-xl sm:text-2xl leading-[1.35] font-semibold text-[var(--p-color-fg)] px-2"
        >
          {label}
        </p>

        <p className="mt-3 text-sm sm:text-sm text-[var(--p-color-fg-muted)] font-medium">
          Aguarde enquanto a seção é carregada.
        </p>

        <div className="mt-5 w-full max-w-[440px] h-[6px] rounded-full bg-black/10 overflow-hidden">
          <div
            className="loading-progress h-full rounded-full bg-gradient-to-r from-[var(--p-color-brand-400)] via-[var(--p-color-action)] to-[var(--p-color-collab)] relative"
            style={{ width: "100%", ...animationStyle }}
          >
            <span className="loading-progress-shimmer absolute inset-0" style={animationStyle} />
          </div>
        </div>

        <p className="mt-3 text-xs text-[var(--p-color-fg-subtle)] font-medium">
          Isso pode levar alguns segundos
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

