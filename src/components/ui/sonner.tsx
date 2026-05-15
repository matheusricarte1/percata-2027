"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        duration: 4200,
        classNames: {
          toast:
            "cn-toast group rounded-2xl border border-[#D9E0E8] bg-white/95 text-[#2E3A4A] shadow-[0_18px_50px_-28px_rgba(17,24,39,0.45)] backdrop-blur-xl",
          title: "font-display text-sm font-semibold text-[var(--upe-blue-upe)]",
          description: "text-xs leading-5 text-[#5B6675]",
          actionButton:
            "rounded-xl bg-[var(--upe-blue-upe)] px-3 py-2 text-xs font-semibold text-white",
          cancelButton:
            "rounded-xl bg-[var(--upe-accent-washed-blue)] px-3 py-2 text-xs font-semibold text-[var(--upe-blue-upe)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
