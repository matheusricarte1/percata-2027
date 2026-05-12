// ============================================================
// PERCATA — Zustand Store: Carrinho de Demandas
// Gerencia estado local antes de gerar a DFD
// ============================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CarrinhoItem, ItemEfisco } from "@/types";

type CarrinhoEntry = CarrinhoItem & { uid: string };

interface CarrinhoStore {
  items: CarrinhoEntry[];
  // Adicionar item ao carrinho
  addItem: (
    item: ItemEfisco,
    localDeUso: string,
    defaults?: Partial<Omit<CarrinhoEntry, "uid" | "item_efisco" | "local_de_uso">>,
  ) => void;
  // Atualizar campos de um item (qtd, valor, link, justificativa)
  updateItem: (index: number, patch: Partial<CarrinhoEntry>) => void;
  // Remover item
  removeItem: (uid: string) => void;
  // Limpar carrinho
  clear: () => void;
  clearCarrinho: () => void;
  // Total estimado
  total: () => number;
  // Agrupa itens por local_de_uso (para gerar DFDs separadas no checkout)
  groupByLocal: () => Record<string, CarrinhoEntry[]>;
}

export const useCarrinhoStore = create<CarrinhoStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item, localDeUso, defaults) =>
        set((state) => ({
          items: [
            ...state.items,
            {
              uid:
                typeof crypto !== "undefined" && crypto.randomUUID
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              item_efisco: item,
              quantidade: Math.max(1, Number(defaults?.quantidade || 1)),
              valor_unitario_estimado: Number(defaults?.valor_unitario_estimado || 0),
              link_referencia: String(defaults?.link_referencia || ""),
              justificativa_item: String(defaults?.justificativa_item || ""),
              justificativa_quantidade: String(defaults?.justificativa_quantidade || ""),
              local_de_uso: localDeUso,
              source_kit_id: defaults?.source_kit_id,
              source_kit_nome: defaults?.source_kit_nome,
              source_kit_descricao: defaults?.source_kit_descricao,
            },
          ],
        })),

      updateItem: (index, patch) =>
        set((state) => {
          const updated = [...state.items];
          updated[index] = { ...updated[index], ...patch };
          return { items: updated };
        }),

      removeItem: (uid) =>
        set((state) => ({
          items: state.items.filter((item) => item.uid !== uid),
        })),

      clear: () => set({ items: [] }),
      clearCarrinho: () => set({ items: [] }),

      total: () =>
        get().items.reduce(
          (acc, item) => acc + item.quantidade * item.valor_unitario_estimado,
          0,
        ),

      groupByLocal: () => {
        const grouped: Record<string, CarrinhoEntry[]> = {};
        for (const item of get().items) {
          const key = item.local_de_uso || "_sem_local";
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(item);
        }
        return grouped;
      },
    }),
    {
      name: "percata-carrinho",
      version: 2,
      migrate: (persistedState: any) => {
        if (!persistedState?.items) return persistedState;

        return {
          ...persistedState,
          items: persistedState.items.map((item: CarrinhoEntry) =>
            item.uid
              ? item
              : {
                  ...item,
                  uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                },
          ),
        };
      },
    },
  ),
);
