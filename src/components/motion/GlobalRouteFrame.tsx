"use client";

import { type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const APP_SHELL_PREFIXES = [
  "/admin",
  "/catalogo",
  "/chefia",
  "/configuracoes",
  "/dashboard",
  "/dfd",
  "/dfds-coletivas",
  "/historico",
  "/minhas-dfds",
  "/nova-dfd",
  "/triagem",
];

function isShellRoute(pathname: string) {
  return APP_SHELL_PREFIXES.some((prefix) => {
    if (pathname === prefix) return true;
    return pathname.startsWith(`${prefix}/`);
  });
}

export function GlobalRouteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const reduceMotion = useReducedMotion();

  if (isShellRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        data-animate-page
        data-animate-auto
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

