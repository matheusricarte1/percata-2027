'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Package, 
  CheckCircle, 
  Tag, 
  Info,
  ShoppingCartSimple,
  X,
  CaretRight,
  CaretLeft,
  CircleNotch,
  CornersOut
} from '@phosphor-icons/react'
import { useCarrinhoStore } from '@/store/carrinho'

// --- 1. M3 Snackbar Component ---
function Snackbar({ message, isOpen, onClose }: any) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#1C1B1F] text-white px-6 py-3 rounded-xl shadow-level-3 flex items-center gap-4 z-[999]"
        >
          <span className="text-sm font-bold">{message}</span>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-all">
            <X size={16} weight="bold" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// --- 2. M3 Dialog (Modal de Detalhes) ---
function ItemDialog({ item, isOpen, onClose }: any) {
  if (!item) return null
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white w-full max-w-2xl rounded-[28px] overflow-hidden shadow-level-3 relative z-10"
          >
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                   <span className="chip">#ID {item.id.substring(0,8)}</span>
                   <h2 className="font-display font-black text-2xl text-[#1C1B1F] leading-tight">{item.descricao}</h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full"><X size={24} weight="bold" /></button>
              </div>

              <div className="divider-h" />

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-black/40">Especificações Técnicas</h4>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-xs font-bold text-black/60">
                      <Tag size={18} className="text-primary" /> Unidade: UNIDADE
                    </li>
                    <li className="flex items-center gap-3 text-xs font-bold text-black/60">
                      <Package size={18} className="text-primary" /> Categoria: {item.categoria || 'Geral'}
                    </li>
                  </ul>
                </div>
                <div className="bg-primary/5 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                   <Info size={32} weight="fill" className="text-primary" />
                   <p className="text-[10px] font-bold text-primary/60 uppercase tracking-tighter">O preço sugerido será inserido pelo usuário no DFD.</p>
                </div>
              </div>

              <button className="w-full btn-filled flex items-center justify-center gap-3 py-4">
                <ShoppingCartSimple size={24} weight="bold" />
                Adicionar ao Planejamento
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

const CATEGORIES = ["CONSTRUÇÃO", "LABORATÓRIO", "TI", "LIMPEZA", "ELÉTRICA", "SAÚDE", "MÓVEIS", "FERRAMENTAS"]

export default function CatalogMasterPage() {
  const [activeTab, setActiveTab] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState(null)
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false)
  const addItem = useCarrinhoStore(s => s.addItem)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="p-8 space-y-12 min-h-screen">
      {/* 1. CAROUSEL DE CATEGORIAS (M3 Tonal Chips) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-black/40">Categorias em Destaque</h2>
          <div className="flex gap-2">
             <button className="p-2 bg-white rounded-full border border-black/5 hover:bg-black/5 transition-all"><CaretLeft weight="bold" /></button>
             <button className="p-2 bg-white rounded-full border border-black/5 hover:bg-black/5 transition-all"><CaretRight weight="bold" /></button>
          </div>
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {CATEGORIES.map((cat, i) => (
            <button key={cat} className={cn(
              "px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all border",
              i === 0 ? "bg-primary text-white border-transparent" : "bg-white border-black/5 text-black/40 hover:border-primary/20"
            )}>
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* 2. TABS E BARRA DE FERRAMENTAS */}
      <section className="bg-white/50 backdrop-blur-md p-2 rounded-2xl flex items-center justify-between sticky top-20 z-30 border border-white shadow-level-1">
        <div className="flex gap-1">
          {['Todos', 'Sugeridos', 'Favoritos'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase())}
              className={cn(
                "px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                activeTab === tab.toLowerCase() ? "bg-[#1C1B1F] text-white" : "text-black/40 hover:bg-black/5"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="divider-v h-8 mx-4" />
        <div className="flex items-center gap-4 flex-1 px-4">
           {/* Chips de Filtro */}
           {['Ativo', 'Material'].map(f => (
             <span key={f} className="chip bg-primary/10 text-primary">
               {f} <X size={14} weight="bold" className="cursor-pointer" />
             </span>
           ))}
        </div>
      </section>

      {/* 3. GRID COM LOADING E CARDS AUDITADOS */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {loading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="card-outlined space-y-6 animate-pulse">
               <div className="h-6 w-20 bg-black/5 rounded-full" />
               <div className="h-24 bg-black/5 rounded-xl" />
               <div className="flex justify-between items-center pt-4">
                  <div className="h-4 w-16 bg-black/5 rounded-full" />
                  <div className="h-10 w-10 bg-black/5 rounded-xl" />
               </div>
            </div>
          ))
        ) : (
          [1,2,3,4,5,6,7,8].map(i => (
            <CardDemo key={i} onOpen={() => setSelectedItem({id: `ITEM-${i}`, descricao: `EQUIPAMENTO TÉCNICO DE LABORATÓRIO TIPO ${i} PARA PESQUISA DE ALTO DESEMPENHO`})} />
          ))
        )}
      </section>

      {/* COMPONENTES DE FEEDBACK E DIALOG */}
      <ItemDialog 
        item={selectedItem} 
        isOpen={!!selectedItem} 
        onClose={() => setSelectedItem(null)} 
      />
      
      <Snackbar 
        message="Item adicionado ao seu planejamento!" 
        isOpen={isSnackbarOpen} 
        onClose={() => setIsSnackbarOpen(false)} 
      />
    </div>
  )
}

function CardDemo({ onOpen }: any) {
  return (
    <motion.div 
      whileHover={{ y: -8, boxShadow: '0 12px 32px rgba(0,0,0,0.08)' }}
      className="card-elevated group"
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
           <span className="text-[10px] font-black text-black/30 font-mono tracking-widest">#CAT-45091</span>
           <div className="badge-dot" />
        </div>
        
        <h3 className="font-display font-black text-lg text-[#1C1B1F] tracking-tight leading-tight line-clamp-3 group-hover:text-primary transition-colors">
          CADEIRA ERGONÔMICA DE ESCRITÓRIO - TIPO DIRETOR COM APOIO LOMBAR E RODÍZIOS DE SILICONE
        </h3>

        <div className="flex items-center justify-between pt-4">
           <span className="chip">MARCENARIA</span>
           <div className="flex gap-2">
             <button onClick={onOpen} className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-black/40 hover:bg-black/10 transition-all">
               <CornersOut size={20} weight="bold" />
             </button>
             <button className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-110 active:scale-95 transition-all">
               <CheckCircle size={20} weight="fill" />
             </button>
           </div>
        </div>
      </div>
    </motion.div>
  )
}

function cn(...inputs: any) {
  return inputs.filter(Boolean).join(' ')
}
