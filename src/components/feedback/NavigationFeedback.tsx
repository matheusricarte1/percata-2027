"use client";

import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";

const SHOW_DELAY_MS = 140;
const FAILSAFE_MS = 5000;

function isPlainLeftClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function shouldTrackAnchor(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  const target = anchor.getAttribute("target");
  if (target && target !== "_self") return false;

  const url = new URL(anchor.href, window.location.href);
  const current = new URL(window.location.href);
  if (url.origin !== current.origin) return false;
  if (url.pathname === current.pathname && url.search === current.search) return false;

  return true;
}

export function NavigationFeedback() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const failsafeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    function clearTimer(ref: MutableRefObject<number | null>) {
      if (ref.current) {
        window.clearTimeout(ref.current);
        ref.current = null;
      }
    }

    function stop() {
      clearTimer(showTimerRef);
      clearTimer(failsafeTimerRef);
      hideTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        document.documentElement.removeAttribute("data-route-pending");
      }, 180);
    }

    stop();

    return () => {
      clearTimer(showTimerRef);
      clearTimer(hideTimerRef);
      clearTimer(failsafeTimerRef);
      document.documentElement.removeAttribute("data-route-pending");
    };
  }, [pathname]);

  useEffect(() => {
    function clearTimer(ref: MutableRefObject<number | null>) {
      if (ref.current) {
        window.clearTimeout(ref.current);
        ref.current = null;
      }
    }

    function begin() {
      clearTimer(hideTimerRef);
      clearTimer(showTimerRef);
      clearTimer(failsafeTimerRef);

      showTimerRef.current = window.setTimeout(() => {
        setVisible(true);
        document.documentElement.setAttribute("data-route-pending", "1");
      }, SHOW_DELAY_MS);

      failsafeTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        document.documentElement.removeAttribute("data-route-pending");
      }, FAILSAFE_MS);
    }

    function onClick(event: MouseEvent) {
      if (!isPlainLeftClick(event) || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || !shouldTrackAnchor(anchor)) return;
      begin();
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimer(showTimerRef);
      clearTimer(hideTimerRef);
      clearTimer(failsafeTimerRef);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible ? (
        <>
          <motion.div
            aria-hidden="true"
            className="fixed left-0 right-0 top-0 z-[120] h-1 overflow-hidden bg-[#C7D7EA]/55"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
          >
            <motion.div
              className="h-full w-[42%] rounded-r-full bg-gradient-to-r from-[#164073] via-[#2A7C8C] to-[#EC2029]"
              initial={{ x: "-110%" }}
              animate={reduceMotion ? { x: "20%" } : { x: ["-110%", "40%", "165%"] }}
              transition={
                reduceMotion
                  ? { duration: 0.01 }
                  : { duration: 1.25, repeat: Infinity, ease: [0.4, 0, 0.2, 1] }
              }
            />
          </motion.div>

          <motion.div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 right-5 z-[120] flex items-center gap-3 rounded-2xl border border-[#D9E0E8] bg-white/92 px-4 py-3 text-[#164073] shadow-[0_18px_45px_-24px_rgba(17,24,39,0.38)] backdrop-blur-xl"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8EDF2]">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em]">
              Abrindo tela
            </span>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
