"use client";

import { useEffect, useRef, useState } from "react";
import { saveDfdDraftCartAction } from "@/app/actions/dfdDraftActions";
import { buildDfdDraftCartSaveInput } from "@/lib/dfd-draft-cart";
import { readDfdCartHydration } from "@/lib/dfd-cart-sync";
import { useCarrinhoStore } from "@/store/carrinho";
import { useSubmissionPolicy } from "@/lib/use-submission-policy";
import { usePathname } from "next/navigation";

const DEBOUNCE_MS = 900;

/**
 * Mantém uma cópia remota do carrinho independentemente da tela em que o
 * usuário esteja. Só começa após a hidratação do Zustand: isso impede que o
 * estado vazio inicial substitua um rascunho que ainda será restaurado.
 */
export function DfdCartDraftSynchronizer() {
  const pathname = usePathname() || "/";
  const workspace = ["/dashboard", "/catalogo", "/nova-dfd", "/dfd", "/minhas-dfds", "/dfds-coletivas", "/triagem", "/admin"].some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const { canCreate } = useSubmissionPolicy(undefined, workspace);
  const items = useCarrinhoStore((state) => state.items);
  const [hydrated, setHydrated] = useState(() => readDfdCartHydration(useCarrinhoStore.persist));
  const initializedRef = useRef(false);
  const lastSavedRef = useRef<string | null>(null);

  useEffect(() => {
    const persist = useCarrinhoStore.persist;
    if (!persist) return;
    if (readDfdCartHydration(persist)) {
      setHydrated(true);
      return;
    }
    return persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated || !canCreate) return;

    const cartItems = buildDfdDraftCartSaveInput(items);
    const fingerprint = JSON.stringify(cartItems);

    // O primeiro estado após hidratar pertence ao navegador atual. Não o
    // enviamos vazio, pois a tela do wizard pode restaurar o rascunho remoto.
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (cartItems.length === 0) {
        lastSavedRef.current = fingerprint;
        return;
      }
    }
    if (lastSavedRef.current === fingerprint || cartItems.length === 0) return;

    const timer = window.setTimeout(() => {
      void saveDfdDraftCartAction({ cartItems }).then((result) => {
        if (result.ok) lastSavedRef.current = fingerprint;
        // O wizard já apresenta erros de rascunho. Aqui preservamos o carrinho
        // local e tentamos novamente na próxima mudança, sem toasts invasivos.
      });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [hydrated, items, canCreate]);

  return null;
}
