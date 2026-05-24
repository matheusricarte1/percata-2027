"use client";

import { useEffect, useState } from "react";

/**
 * useReducedMotion — fonte única de verdade para preferência de movimento.
 *
 * Antes desta consolidação, 3 fontes coexistiam sem precedência definida:
 *   - `prefers-reduced-motion` (sistema)
 *   - `html[data-reduced-motion="1"]` (preferência do usuário em settings)
 *   - `html[data-show-animations="0"]` (toggle "desativar animações")
 *   - `useReducedMotion()` do framer-motion (só checa sistema)
 *
 * Resultado: alguns componentes (NavigationFeedback, Button) animavam mesmo
 * com reduced-motion ativo. Outros (ghost cards do onboarding) animavam
 * em loop infinito ignorando tudo.
 *
 * Esta função define **precedência única**:
 *   prefere desativar > prefere ativar.
 *   ATIVO se QUALQUER UM dos três fica verdadeiro.
 *
 * Drop-in replacement para framer-motion useReducedMotion(); retorna
 * boolean (true = reduzido).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return computeReduced();
  });

  useEffect(() => {
    function update() {
      setReduced(computeReduced());
    }
    update();

    // Sistema operacional.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", update);

    // Mudanças no dataset do <html> (settings do usuário).
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-reduced-motion", "data-show-animations"],
    });

    // Evento custom emitido pelo settings provider (AppProviders.tsx).
    window.addEventListener("percata:user-settings-changed", update);

    return () => {
      mq.removeEventListener("change", update);
      observer.disconnect();
      window.removeEventListener("percata:user-settings-changed", update);
    };
  }, []);

  return reduced;
}

function computeReduced(): boolean {
  if (typeof window === "undefined") return false;
  const ds = document.documentElement.dataset;
  if (ds.reducedMotion === "1") return true;
  if (ds.showAnimations === "0") return true;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return true;
    }
  } catch {
    // matchMedia ausente em ambientes muito antigos.
  }
  return false;
}

/**
 * Helper para passar props a `motion.*` do framer-motion respeitando
 * a preferência.
 *
 *   const reduced = useReducedMotion();
 *   <motion.div {...motionProps(reduced, { animate: {x: [0, -4, 0], opacity:[0,1,0]}, transition:{repeat:Infinity}})} />
 *
 * Se reduzido, todas as animações viram "nada" (initial=false, sem animate,
 * sem transition).
 */
export function motionProps<T extends Record<string, unknown>>(
  reduced: boolean,
  full: T,
): T | { initial: false } {
  if (!reduced) return full;
  return { initial: false };
}
