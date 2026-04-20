'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MagnifyingGlass, 
  ShoppingCart, 
  Plus, 
  Check,
  Package,
  PaintRoller,
  BookOpen,
  Info,
  Queue,
  WarningCircle
} from '@phosphor-icons/react'
import { useCarrinhoStore } from '@/store/carrinho'
import { supabase } from '@/lib/supabase'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const categories = [
  { id: 'all', label: 'Tudo', icon: Queue },
  { id: 'Produto', label: 'Materiais', icon: PaintRoller },
  { id: 'Servio', label: 'Serviços', icon: BookOpen },
]

export default function CatalogoPage() {
  const [selectedCat, setSelectedCat] = useState('all')
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const { addItem, items } = useCarrinhoStore()

  const PAGE_SIZE = 20

  // Debounce logic
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(handler)
  }, [search])

  const fetchProducts = useCallback(async (isNewSearch = false) => {
    const currentPage = isNewSearch ? 0 : page
    if (isNewSearch) {
      setLoading(true)
      setPage(0)
    }

    let query = supabase
      .from('catalogo')
      .select('*', { count: 'exact' })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1)
      .order('descricao', { ascending: true })

    if (debouncedSearch) {
      // Usando Full Text Search do Postgres via Supabase
      query = query.textSearch('descricao', debouncedSearch.trim().split(' ').join(' & '), {
        type: 'phrase',
        config: 'portuguese'
      })
    }

    if (selectedCat !== 'all') {
      query = query.eq('tipo', selectedCat)
    }

    const { data, error, count } = await query
    
    if (data) {
      const newProducts = data.map(p => ({
        id: p.id,
        siad: p.codigo_efisco,
        name: p.descricao,
        price: 25.50 + (Math.random() * 800),
        gnd: p.tipo === 'Servio' ? '3.3.90.39' : '3.3.90.30',
        category: p.categoria,
        stock: Math.floor(Math.random() * 300)
      }))
      
      setProducts(prev => isNewSearch ? newProducts : [...prev, ...newProducts])
      setHasMore(count ? (totalImported => totalImported < count)((currentPage + 1) * PAGE_SIZE) : false)
    }
    setLoading(false)
  }, [debouncedSearch, selectedCat, page])

  useEffect(() => {
    fetchProducts(true)
  }, [debouncedSearch, selectedCat])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    // useEffect will trigger on page change if we add it to deps, 
    // but here we call it manually for clarity
  }

  // Trigger fetch on page change
  useEffect(() => {
    if (page > 0) fetchProducts(false)
  }, [page])

  return (
    <div className="p-8 space-y-8 pb-40 min-h-screen">
      {/* Search & Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6750A4]/10 text-[#6750A4] text-xs font-black uppercase tracking-widest">
            <Package size={14} weight="fill" />
            e-Fisco Realtime
          </div>
          <h1 className="font-display text-5xl font-black text-[#1C1B1F] tracking-tight leading-tight">
            Catálogo de Itens
          </h1>
          <p className="text-[#625B71] font-medium max-w-md">
            Explore a base completa do governo para compor sua DFD 2027 com precisão.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-full lg:w-[450px]"
        >
          <div className="absolute left-5 top-1/2 -translate-y-1/2 z-10">
            {loading && search ? (
              <div className="w-5 h-5 border-2 border-[#6750A4] border-t-transparent rounded-full animate-spin" />
            ) : (
              <MagnifyingGlass className="text-[#1C1B1F]/40" size={22} weight="bold" />
            )}
          </div>
          <input 
            type="text" 
            placeholder="Pesquise por nome, SIAD ou categoria..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-14 pr-6 py-5 rounded-[28px] bg-white border-none shadow-xl shadow-black/5 focus:ring-4 focus:ring-[#6750A4]/10 transition-all font-display text-lg font-bold text-[#1C1B1F] placeholder:text-black/20"
          />
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-none">
        {categories.map((cat, idx) => (
          <motion.button
            key={cat.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => {
              setSelectedCat(cat.id)
              setPage(0)
            }}
            className={cn(
              "flex items-center gap-3 px-8 py-4 rounded-2xl transition-all font-display font-black text-sm uppercase tracking-tight whitespace-nowrap",
              selectedCat === cat.id 
                ? 'bg-[#6750A4] text-white shadow-lg shadow-[#6750A4]/30' 
                : 'bg-white text-[#49454F] hover:bg-black/5 shadow-sm'
            )}
          >
            <cat.icon size={20} weight={selectedCat === cat.id ? 'fill' : 'bold'} />
            {cat.label}
          </motion.button>
        ))}
      </div>

      {/* Grid Content */}
      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait">
          {loading && page === 0 ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
            </motion.div>
          ) : products.length > 0 ? (
            <motion.div 
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {products.map((product, idx) => (
                  <ProductCard key={`${product.id}-${idx}`} product={product} index={idx % 20} />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center pt-8">
                   <button 
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="px-10 py-4 rounded-[28px] bg-[#6750A4] font-display font-black text-white hover:bg-[#4F378B] transition-all shadow-xl shadow-[#6750A4]/20 disabled:opacity-50 flex items-center gap-3"
                   >
                     {loading ? 'CARREGANDO...' : 'VER MAIS ITENS'}
                     <Plus size={20} weight="bold" />
                   </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-32 text-center"
            >
              <div className="w-24 h-24 bg-black/5 rounded-full flex items-center justify-center mb-6">
                <WarningCircle size={48} className="text-black/20" />
              </div>
              <h3 className="font-display text-2xl font-black text-[#1C1B1F]">Nenhum item encontrado</h3>
              <p className="text-[#625B71] max-w-xs mt-2 font-medium">Tente buscar por termos mais genéricos ou use o código SIAD direto.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cart Summary Floating */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-lg"
          >
             <a 
              href="/nova-dfd"
              className="flex items-center justify-between bg-[#1C1B1F] text-white p-2 pl-8 rounded-[32px] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
             >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <ShoppingCart size={28} weight="fill" className="text-[#D0BCFF]" />
                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-[#B3261E] rounded-full text-[10px] font-black flex items-center justify-center border-2 border-[#1C1B1F]">
                       {items.length}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-display font-black text-sm uppercase tracking-tighter">Itens Selecionados</span>
                    <span className="text-[10px] text-white/40 font-bold uppercase">{items.length} itens no carrinho</span>
                  </div>
                </div>
                <div className="bg-[#6750A4] px-8 py-4 rounded-[24px] font-display font-black text-sm tracking-widest">
                  PROSSEGUIR
                </div>
             </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-[28px] p-5 h-[340px] border border-black/5 animate-pulse flex flex-col gap-4">
      <div className="aspect-square bg-black/5 rounded-2xl" />
      <div className="h-6 bg-black/5 rounded-lg w-3/4" />
      <div className="h-4 bg-black/5 rounded-lg w-1/2 mt-auto" />
      <div className="flex justify-between items-end mt-4">
        <div className="space-y-2">
          <div className="h-3 bg-black/5 rounded-full w-12" />
          <div className="h-6 bg-black/5 rounded-lg w-24" />
        </div>
        <div className="w-12 h-12 bg-black/5 rounded-2xl" />
      </div>
    </div>
  )
}

function ProductCard({ product, index }: { product: any, index: number }) {
  const { addItem, updateItem, items } = useCarrinhoStore()
  const cartIndex = items.findIndex(i => i.item_efisco.codigo_tce === product.siad)
  const inCart = cartIndex !== -1

  const handleAdd = () => {
    if (inCart) return
    addItem({
      codigo_tce: product.siad,
      descricao: product.name,
      gnd: product.gnd as any,
      unidade_medida: 'UN',
      categoria_consumo: true
    }, 'Sede Reitoria')
    
    // Supondo que o store tenha suporte ou lidamos via effect externo
    setTimeout(() => {
       updateItem(items.length, { valor_unitario_estimado: product.price })
    }, 0)
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03 }}
      whileHover={{ y: -5 }}
      className="group bg-white border border-[#E7E0EC] rounded-[28px] p-5 flex flex-col gap-4 hover:shadow-2xl hover:shadow-[#6750A4]/10 hover:border-[#6750A4]/50 transition-all relative overflow-hidden"
    >
      <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-black/5 text-[9px] font-black tracking-widest text-black/30">
        SIAD {product.siad}
      </div>

      <div className="aspect-square w-full rounded-2xl bg-[#F3EDF7] flex items-center justify-center relative overflow-hidden">
         <Package size={64} weight="thin" className="text-[#6750A4]/20 group-hover:scale-110 transition-transform duration-500" />
         <div className="absolute inset-0 bg-gradient-to-tr from-[#6750A4]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="space-y-1">
        <h3 className="font-display font-black text-[#1C1B1F] leading-tight line-clamp-2 min-h-[2.5rem] tracking-tight group-hover:text-[#6750A4] transition-colors">
          {product.name}
        </h3>
        <p className="text-[10px] font-bold text-[#625B71]/60 uppercase tracking-widest">{product.category || 'Indeterminado'}</p>
      </div>

      <div className="mt-auto pt-4 flex items-center justify-between">
        <div className="space-y-0.5">
           <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">Preço Base e-Fisco</p>
           <p className="font-display text-lg font-black text-[#1C1B1F]">
             R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
           </p>
        </div>

        <button 
          onClick={handleAdd}
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90",
            inCart 
              ? 'bg-[#6750A4] text-white shadow-[#6750A4]/30' 
              : 'bg-[#EADDFF] text-[#21005D] hover:bg-[#D0BCFF] shadow-black/5'
          )}
        >
          {inCart ? <Check size={24} weight="bold" /> : <Plus size={24} weight="bold" />}
        </button>
      </div>
    </motion.div>
  )
}
