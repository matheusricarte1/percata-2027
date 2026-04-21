'use client'

import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-2xl text-sm font-black uppercase tracking-tight italic transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-40 focus-visible:ring-4 focus-visible:ring-primary/20",
  {
    variants: {
      variant: {
        default: "bg-primary text-white shadow-[var(--elevation-2)] hover:bg-[#3B2868]",
        secondary: "bg-secondary text-white shadow-[var(--elevation-1)] hover:bg-[#4A4458]",
        outline: "border-2 border-black/5 bg-transparent text-slate-800 hover:border-primary/20 hover:bg-slate-50",
        ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
        destructive: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
        success: "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100",
      },
      size: {
        default: "h-12 px-8 gap-3",
        sm: "h-10 px-6 gap-2 text-xs",
        lg: "h-14 px-10 gap-3 text-base font-black",
        icon: "size-12 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref">,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ 
          y: -2, 
          scale: 1.02,
          boxShadow: variant === 'ghost' ? 'none' : 'var(--elevation-3)' 
        }}
        whileTap={{ scale: 0.96, y: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 400, 
          damping: 17 
        }}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
