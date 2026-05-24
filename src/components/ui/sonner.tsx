"use client";

import { useEffect, useState } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

/**
 * Toaster do PERCATA.
 *
 * Antes: usava `next-themes` para resolver o tema. Mas o resto do app
 * controla dark mode via `html[data-theme-mode="dark"]` (manipulado pelo
 * AppProviders via localStorage). Resultado: toast podia renderizar em
 * tema oposto à página.
 *
 * Agora: lê diretamente o dataset do <html>, com fallback para
 * `prefers-color-scheme`. Fonte única alinhada com tokens.css.
 *
 * Acessibilidade: o Sonner já injeta `role="status"`/`aria-live="polite"`
 * para success/info e `role="alert"`/`aria-live="assertive"` para warning/error.
 * Mantido `closeButton` para usuários com foco no teclado.
 *
 * Duração: erros recebem mais tempo na tela (8s) que info/success (4.2s)
 * — antes era 4.2s fixo para tudo, errors passavam despercebidos.
 */
const Toaster = (props: ToasterProps) => {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    function resolve(): "light" | "dark" {
      const ds = document.documentElement.dataset;
      if (ds.themeMode === "dark") return "dark";
      if (ds.themeMode === "light") return "light";
      try {
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
          return "dark";
        }
      } catch {}
      return "light";
    }
    setTheme(resolve());

    const observer = new MutationObserver(() => setTheme(resolve()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme-mode"],
    });

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(resolve());
    mq.addEventListener("change", onChange);

    return () => {
      observer.disconnect();
      mq.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      closeButton
      richColors={false}
      icons={{
        success: <CircleCheckIcon className="size-4" aria-hidden="true" />,
        info: <InfoIcon className="size-4" aria-hidden="true" />,
        warning: <TriangleAlertIcon className="size-4" aria-hidden="true" />,
        error: <OctagonXIcon className="size-4" aria-hidden="true" />,
        loading: (
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--p-radius-lg, var(--radius))",
        } as React.CSSProperties
      }
      toastOptions={{
        duration: 4200,
        classNames: {
          toast:
            "cn-toast group rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-bg)]/95 text-[var(--p-color-fg)] shadow-[var(--p-elevation-3)] backdrop-blur-xl",
          title:
            "font-display text-sm font-semibold text-[var(--p-color-brand-500)]",
          description:
            "text-xs leading-5 text-[var(--p-color-fg-muted)]",
          actionButton:
            "rounded-xl bg-[var(--p-color-action)] px-3 py-2 text-xs font-semibold text-[var(--p-color-action-fg)]",
          cancelButton:
            "rounded-xl bg-[var(--p-color-bg-muted)] px-3 py-2 text-xs font-semibold text-[var(--p-color-fg)]",
          error: "!duration-[8000ms]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
