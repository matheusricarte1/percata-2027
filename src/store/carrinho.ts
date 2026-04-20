// ============================================================
// PERCATA 2027 — Zustand Store: Carrinho de Demandas
// Gerencia estado local antes de gerar a DFD
// ============================================================

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CarrinhoItem, ItemEfisco } from '@/types'

interface CarrinhoStore {
  items: CarrinhoItem[]
  // Adicionar item ao carrinho
  addItem: (item: ItemEfisco, localDeUso: string) => void
  // Atualizar campos de um item (qtd, valor, link, justificativa)
  updateItem: (index: number, patch: Partial<CarrinhoItem>) => void
  // Remover item
  removeItem: (index: number) => void
  // Limpar carrinho
  clear: () => void
  // Total estimado
  total: () => number
  // Agrupa itens por local_de_uso (para gerar DFDs separadas no checkout)
  groupByLocal: () => Record<string, CarrinhoItem[]>
}

export const useCarrinhoStore = create<CarrinhoStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item, localDeUso) =>
        set((state) => ({
          items: [
            ...state.items,
            {
              item_efisco: item,
              quantidade: 1,
              valor_unitario_estimado: 0,
              link_referencia: '',
              justificativa_quantidade: '',
              local_de_uso: localDeUso,
            },
          ],
        })),

      updateItem: (index, patch) =>
        set((state) => {
          const updated = [...state.items]
          updated[index] = { ...updated[index], ...patch }
          return { items: updated }
        }),

      removeItem: (index) =>
        set((state) => ({
          items: state.items.filter((_, i) => i !== index),
        })),

      clear: () => set({ items: [] }),

      total: () =>
        get().items.reduce(
          (acc, item) =>
            acc + item.quantidade * item.valor_unitario_estimado,
          0
        ),

      groupByLocal: () => {
        const grouped: Record<string, CarrinhoItem[]> = {}
        for (const item of get().items) {
          const key = item.local_de_uso || '_sem_local'
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(item)
        }
        return grouped
      },
    }),
    { name: 'percata-carrinho' }
  )
)
