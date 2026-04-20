'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MagnifyingGlass, 
  Package, 
  Funnel, 
  CheckCircle, 
  Plus, 
  X, 
  CaretDown, 
  DotsThreeVertical,
  Export,
  Trash,
  ArrowsLeftRight,
  List,
  SquaresFour,
  Bell
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { useCarrinhoStore } from '@/store/carrinho'

export default function CatalogoTecnicoPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  // -- Filtros Dinâmicos --
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  
  const addItem = useCarrinhoStore(s => s.addItem)

  const fetchItems = async () => {
    setLoading(true)
    let query = supabase.from('catalogo_efisco').select('*')
    
    if (search) {
      query = query.textSearch('descricao_fts', search.split(' ').join(' & '))
    }
    
    const { data, error } = await query.limit(50)
    if (!error && data) setItems(data)
    setLoading(false)
  }

  useEffect(() => {
    const timer = setTimeout(fetchItems, 500)
    return () => clearTimeout(timer)
  }, [search])

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const selectedItems = useMemo(() => items.filter(item => selectedIds.includes(item.id)), [items, selectedIds])

  return (
    <div className="flex h-screen bg-[#FBFBFF] overflow-hidden">
      
      {/* 1. SIDEBAR DE FILTROS (ESQUERDA) */}
      <aside className="w-64 bg-white border-r border-black/5 flex flex-col p-6 space-y-8 overflow-y-auto shrink-0">
        <h2 className="font-display font-black text-xl tracking-tight uppercase italic">Filtros</h2>
        
        <div className="space-y-6">
          {/* Categoria: MATERIAIS */}
          <FilterSection title="MATERIAIS" count="65.432">
            <FilterOption label="Construção" count="22.101" />
            <FilterOption label="Hidráulica" count="15.800" />
            <FilterOption label="Elétrica" count="10.543" />
            <FilterOption label="Outros" count="16.308" />
          </FilterSection>

          {/* Categoria: SERVIÇOS */}
          <FilterSection title="SERVIÇOS" count="84.568">
            <FilterOption label="Manutenção" count="28.901" />
            <FilterOption label="Projetos" count="19.452" />
            <FilterOption label="Limpeza" count="15.203" />
            <FilterOption label="Outros" count="21.012" />
          </FilterSection>

          {/* Categoria: STATUS */}
          <FilterSection title="STATUS">
            <FilterOption label="Ativo" count="5.200" active />
            <FilterOption label="Em Processo" count="3.452" />
            <FilterOption label="Inativo" count="110" />
          </FilterSection>
        </div>

        <button className="mt-8 w-full py-3 bg-[#F3EDF7] text-[#4F378B] rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#EADDFF] transition-all">
          Limpar Filtros
        </button>
      </aside>

      {/* 2. ÁREA CENTRAL (CONTEÚDO) */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Header Superior Interno */}
        <header className="h-[120px] bg-white border-b border-black/5 px-8 flex flex-col justify-center space-y-4 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-black text-[#1C1B1F] tracking-tighter">Dashboard do Solicitante</h1>
            
            {/* Search Bar Estilo Print */}
            <div className="flex-1 max-w-2xl mx-12 relative">
              <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" size={20} />
              <input 
                type="text" 
                placeholder="Pesquisar e filtrar (ex: aço, manutenção, ID)..." 
                className="w-full bg-[#F8F9FA] border-none rounded-full py-3 pl-12 pr-6 text-sm font-medium focus:ring-2 focus:ring-[#EADDFF]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-4">
              <button className="p-2 text-black/40 hover:text-red-500 relative transition-all">
                <Bell size={24} weight="bold" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
              </button>
              <div className="w-10 h-10 rounded-full bg-[#EADDFF] border border-[#4F378B]/20 overflow-hidden flex items-center justify-center font-black text-[#4F378B]">
                MR
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-black/40">
            <span>Filtros ativos:</span>
            <span className="bg-[#EADDFF] text-[#4F378B] px-3 py-1 rounded-full flex items-center gap-2">
              MATERIAIS - Construção <X size={12} weight="bold" />
            </span>
            <span className="bg-[#F3EDF7] text-[#4F378B] px-3 py-1 rounded-full flex items-center gap-2">
              Status - Ativo <X size={12} weight="bold" />
            </span>
          </div>
        </header>

        {/* Grade de Itens */}
        <div className="flex-1 p-8 overflow-y-auto no-scrollbar pb-32">
          <div className="flex items-center justify-between mb-8">
            <span className="text-sm font-bold text-black/50 tracking-tight">Exibindo 1-50 de 22.101 Resultados</span>
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-black/5">
              <button className="p-2 bg-[#EADDFF] text-[#4F378B] rounded-lg shadow-inner"><SquaresFour size={20} weight="fill" /></button>
              <button className="p-2 text-black/20 hover:text-[#4F378B]"><List size={20} weight="bold" /></button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {loading ? (
              Array(12).fill(0).map((_, i) => <div key={i} className="h-64 bg-black/5 animate-pulse rounded-[24px]" />)
            ) : (
              items.map((item) => (
                <CardItem 
                  key={item.id} 
                  item={item} 
                  isSelected={selectedIds.includes(item.id)}
                  onToggle={() => toggleSelection(item.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Paginação Estilo Print */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-8 py-3 rounded-full border border-black/5 shadow-2xl flex items-center gap-6 z-30">
          <span className="text-[10px] font-black uppercase tracking-widest text-black/40">Página doc:</span>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 10].map(p => (
              <button key={p} className={cn("w-8 h-8 rounded-full text-xs font-black transition-all", p === 1 ? "bg-[#4F378B] text-white" : "hover:bg-black/5 text-black/40")}>{p}</button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase text-black/40">Ir para página</span>
            <input type="text" defaultValue="1" className="w-10 h-10 border border-black/5 rounded-xl text-center font-black text-sm" />
          </div>
        </div>
      </main>

      {/* 3. PAINEL DE AÇÕES EM LOTE (DIREITA) */}
      <aside className="w-[340px] bg-white border-l border-black/5 flex flex-col p-6 shrink-0 h-full overflow-hidden">
        <div className="flex items-center justify-between mb-8 group cursor-pointer">
          <h2 className="font-display font-black text-lg tracking-tight uppercase">Painel de Ações em Lote</h2>
          <CaretDown size={20} weight="bold" className="text-black/30" />
        </div>

        <div className="mb-6">
          <h3 className="font-display font-black text-2xl tracking-tighter text-[#1C1B1F] mb-6">{selectedIds.length} Itens Selecionados</h3>
          
          <div className="space-y-3">
            <button 
              disabled={selectedIds.length === 0}
              className="w-full py-4 bg-[#4F378B] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-[#4F378B]/20 disabled:opacity-30 disabled:shadow-none hover:bg-[#3d296e] transition-all"
            >
              Adicionar Seleção ao Carrinho
            </button>
            <button className="w-full py-3 bg-[#F3EDF7] text-[#4F378B] rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#EADDFF] border border-transparent hover:border-[#4F378B]/20 transition-all">
              Exportar Especificações (PDF/CSV)
            </button>
            <button className="w-full py-3 bg-white text-black/60 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black/5 border border-black/5 transition-all">
              Mudar Categoria
            </button>
            <button className="w-full py-3 bg-white text-red-600/60 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 border border-black/5 transition-all">
              Remover do Catálogo
            </button>
          </div>
        </div>

        {/* Lista Lateral de Itens Selecionados */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-12">
          <AnimatePresence>
            {selectedItems.map((item) => (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={item.id} 
                className="group flex gap-4 p-4 bg-[#F8F9FA] rounded-2xl relative border border-transparent hover:border-[#4F378B]/10 transition-all"
              >
                <div className="w-16 h-16 bg-white rounded-xl shrink-0 flex items-center justify-center p-2 shadow-sm border border-black/5">
                   <Package size={32} weight="light" className="opacity-20" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-[#4F378B] uppercase tracking-widest line-clamp-3 leading-tight">
                    {item.descricao.split('-')[0].trim().toUpperCase()}
                  </p>
                  <p className="text-[10px] text-black/50 font-medium line-clamp-2 mt-1">
                    {item.descricao.split('-').slice(1).join('-').trim()}
                  </p>
                </div>
                <button onClick={() => toggleSelection(item.id)} className="absolute top-2 right-2 text-black/10 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                  <X size={16} weight="bold" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {selectedIds.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 opacity-10">
              <Package size={64} weight="thin" />
              <p className="text-xs font-black uppercase tracking-tighter mt-4">Nenhum item selecionado</p>
            </div>
          )}
        </div>
      </aside>

    </div>
  )
}

function FilterSection({ title, count, children }: any) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[#625B71] group cursor-pointer">
        <div className="flex items-center gap-2">
          <CaretDown size={14} weight="bold" className="transition-transform group-hover:scale-110" />
          <span className="font-black text-[11px] uppercase tracking-widest">{title}</span>
        </div>
        {count && <span className="text-[10px] font-bold opacity-40">({count})</span>}
      </div>
      <div className="pl-5 space-y-2">
        {children}
      </div>
    </div>
  )
}

function FilterOption({ label, count, active }: any) {
  return (
    <label className="flex items-center justify-between group cursor-pointer py-1">
      <div className="flex items-center gap-3">
        <input 
          type="checkbox" 
          defaultChecked={active}
          className="w-4 h-4 rounded-md border-black/10 text-[#4F378B] focus:ring-[#EADDFF]" 
        />
        <span className={cn("text-xs font-medium transition-colors", active ? "text-[#4F378B] font-bold" : "text-black/50 group-hover:text-black")}>{label}</span>
      </div>
      <span className="text-[10px] font-bold text-black/20 group-hover:text-black/40 transition-colors">({count})</span>
    </label>
  )
}

function CardItem({ item, isSelected, onToggle }: any) {
  const parts = item.descricao.split('-')
  const destaque = parts[0].trim()
  const resto = parts.slice(1).join('-').trim()
  const efisco = item.id_efisco || item.id.substring(0, 8)

  return (
    <motion.div 
      whileHover={{ y: -4, shadow: '0 12px 30px rgba(0,0,0,0.06)' }}
      className={cn(
        "bg-white border p-6 rounded-[24px] flex flex-col justify-between transition-all duration-300 relative group overflow-hidden",
        isSelected ? "border-[#4F378B] bg-[#FBFBFF] ring-2 ring-[#4F378B]/10" : "border-black/5"
      )}
    >
      <div className="space-y-4">
        {/* Top Indicators */}
        <div className="flex items-center justify-between">
          <span className="px-3 py-1 bg-[#F8F9FA] rounded-full text-[10px] font-mono font-bold text-black/30 group-hover:text-[#4F378B] transition-colors">#{efisco}</span>
          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Ativo
          </span>
        </div>

        {/* Descrição em Bloco */}
        <div className="space-y-2">
          <h3 className="font-display font-black text-base text-[#1C1B1F] tracking-tight leading-tight line-clamp-4">
            <span className="text-[#4F378B] block mb-1 text-[11px] uppercase tracking-widest opacity-80">{destaque}</span>
            {resto}
          </h3>
        </div>
      </div>

      {/* Botões Inferiores */}
      <div className="mt-8 pt-6 border-t border-black/5 flex items-center justify-between">
        <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
          {item.categoria?.toUpperCase() || 'SERVIÇO'}
        </span>
        
        <button 
          onClick={onToggle}
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95",
            isSelected ? "bg-[#4F378B] text-white" : "bg-[#F3EDF7] text-[#4F378B] hover:bg-[#EADDFF]"
          )}
        >
          {isSelected ? <CheckCircle size={20} weight="fill" /> : <Plus size={20} weight="bold" />}
        </button>
      </div>
    </motion.div>
  )
}

function cn(...inputs: any) {
  return twMerge(clsx(inputs))
}

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
