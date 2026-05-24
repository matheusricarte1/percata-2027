"use client";

import { useEffect, useRef } from "react";

/**
 * useFocusTrap — confina o foco do teclado dentro de um container enquanto
 * estiver aberto. Restaura o foco para o elemento ativo anterior ao fechar.
 *
 * Conformidade: WCAG 2.1.2 (No Keyboard Trap) ao contrário — aqui *queremos*
 * trap, porque é um modal/dialog. Combinado com Escape para fechar (responsabilidade
 * do componente Dialog), satisfaz 2.4.3 (Focus Order).
 *
 * Uso:
 *   const ref = useFocusTrap<HTMLDivElement>(open);
 *   return <div ref={ref} role="dialog" aria-modal="true">...</div>;
 *
 * Detalhes:
 *   - Foco inicial vai para [data-autofocus] dentro do container, ou ao
 *     primeiro elemento focável, ou ao próprio container.
 *   - Tab/Shift+Tab loopa entre o primeiro e o último focável.
 *   - Ao fechar (open=false), restaura para o elemento que tinha foco
 *     antes do trap, se ainda existir no DOM.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]:not([tabindex="-1"])',
].join(", ");

function getFocusable(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  return Array.from(nodes).filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    const rect = el.getBoundingClientRect();
    // Elementos ocultos por CSS (display:none) têm rect zerado.
    return rect.width > 0 || rect.height > 0;
  });
}

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Foco inicial.
    const autoFocus = container.querySelector<HTMLElement>("[data-autofocus]");
    const focusables = getFocusable(container);
    const initial = autoFocus || focusables[0] || container;
    // tabIndex=-1 no container caso não tenha focusable interno; ainda assim
    // o container recebe foco para que Escape funcione.
    if (initial === container && container.tabIndex < 0) {
      container.tabIndex = -1;
    }
    // requestAnimationFrame evita race com animações de open do componente.
    requestAnimationFrame(() => initial?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const current = ref.current;
      if (!current) return;
      const list = getFocusable(current);
      if (list.length === 0) {
        event.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (activeEl === first || !current.contains(activeEl)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (activeEl === last || !current.contains(activeEl)) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const prev = previouslyFocusedRef.current;
      if (prev && document.contains(prev)) {
        // setTimeout 0 deixa o React desmontar o container antes do foco voltar.
        setTimeout(() => prev.focus({ preventScroll: true }), 0);
      }
      previouslyFocusedRef.current = null;
    };
  }, [active]);

  return ref;
}
