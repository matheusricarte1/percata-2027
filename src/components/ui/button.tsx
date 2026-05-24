"use client";

import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const buttonVariants = cva(
  // O foco visível agora vem de tokens.css (regra global *:focus-visible).
  // Removida a duplicação de `focus-visible:ring-4 ring-primary/20` que competia
  // com o outline global + outline de Input, criando 3 anéis sobrepostos.
  "inline-flex shrink-0 items-center justify-center rounded-2xl text-sm font-semibold uppercase tracking-tight transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-white shadow-[var(--elevation-2)] hover:bg-[var(--upe-blue-deep)]",
        secondary:
          "bg-secondary text-white shadow-[var(--elevation-1)] hover:bg-[#4A4458]",
        outline:
          "border-2 border-black/5 bg-transparent text-slate-800 hover:border-primary/20 hover:bg-slate-50",
        ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
        destructive:
          "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
        success:
          "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100",
      },
      size: {
        default: "h-12 px-8 gap-3",
        sm: "h-10 px-6 gap-2 text-xs",
        lg: "h-14 px-10 gap-3 text-base font-semibold",
        icon: "size-12 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref">,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    // Respeita preferência de movimento. Hover/tap micro-animation só
    // ativos quando o usuário NÃO pediu redução. Caso contrário,
    // botão fica estático (mas mantém hover de cor via Tailwind).
    // Resolve violação WCAG 2.3.3 reportada na revisão dialética.
    const reduced = useReducedMotion();
    const hoverAnim = reduced
      ? undefined
      : {
          y: -2,
          scale: 1.02,
          boxShadow: variant === "ghost" ? "none" : "var(--elevation-3)",
        };
    const tapAnim = reduced ? undefined : { scale: 0.96, y: 1 };

    return (
      <motion.button
        ref={ref}
        whileHover={hoverAnim}
        whileTap={tapAnim}
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", stiffness: 400, damping: 17 }
        }
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
