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
  WarningCircle,
  Hash
} from '@phosphor-icons/react'
import { toast } from 'sonner'
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
  { id: 'Serviço', label: 'Serviços', icon: BookOpen },
  { id: 'kits', label: 'Kits Prontos', icon: Package },
]

export default function CatalogoPage() {
  const [selectedCat, setSelectedCat] = useState('all')
  const [products, setProducts] = useState<any[]>([])
  const [kits, setKits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const { addItem, items } = useCarrinhoStore()
  useEffect(() => {
    async function fetchKits() {
      if (selectedCat === 'kits') {
        setLoading(true)
        const { data } = await supabase.from('kits').select('*')
        setKits(data || [])
        setLoading(false)
      }
    }
    fetchKits()
  }, [selectedCat])

  const addKitToCart = async (kitId: string) => {
    const { data: items } = await supabase
      .from('kit_items')
      .select('*, catalogo(*)')
      .eq('kit_id', kitId)
    
    if (items) {
      items.forEach(ki => {
        addItem({
          codigo_tce: ki.catalogo.codigo_efisco,
          descricao: ki.catalogo.descricao,
          gnd: ki.catalogo.tipo === 'Serviço' ? '3.3.90.39' : '3.3.90.30',
          unidade_medida: 'UN',
          categoria_consumo: true
        }, 'Kit Institucional')
      })
      toast.success(`${items.length} itens do kit adicionados ao carrinho!`)
    }
  }

  const PAGE_SIZE = 30

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

    // Chamando via RPC para suporte a Ranking por Relevância (ts_rank)
    const { data, error } = await supabase.rpc('buscar_catalogo_inteligente', {
      query_text: debouncedSearch.trim(),
      categoria_filtro: selectedCat,
      limit_val: PAGE_SIZE,
      offset_val: currentPage * PAGE_SIZE
    })

    if (data) {
      const newProducts = data.map((p: any) => ({
        id: p.id,
        siad: p.codigo_efisco,
        name: p.descricao,
        gnd: p.tipo === 'Serviço' ? '3.3.90.39' : '3.3.90.30',
        category: p.categoria,
        rank: p.rank
      }))
      
      setProducts(prev => isNewSearch ? newProducts : [...prev, ...newProducts])
      setHasMore(data.length === PAGE_SIZE)
    }
    setLoading(false)
  }, [debouncedSearch, selectedCat, page])

  useEffect(() => {
    fetchProducts(true)
  }, [debouncedSearch, selectedCat])

  useEffect(() => {
    if (page > 0) fetchProducts(false)
  }, [page])

  return (
    <div className="p-6 space-y-6 pb-40 min-h-screen bg-[#FBFBFF]">
      {/* Search & Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-1">
          <h1 className="font-display text-4xl font-black text-[#1C1B1F] tracking-tight">Catalogo e-Fisco</h1>
          <p className="text-[#625B71] text-sm font-medium">Priorizando os melhores resultados para você.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full lg:w-[400px]">
          <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1C1B1F]/40" size={20} weight="bold" />
          <input 
            type="text" 
            placeholder="Pesquise por nome ou SIAD..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-6 py-4 rounded-3xl bg-white border border-black/5 shadow-sm focus:ring-4 focus:ring-[#6750A4]/10 transition-all font-display text-base font-bold text-[#1C1B1F] placeholder:text-black/20"
          />
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setSelectedCat(cat.id); setPage(0); }}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-full transition-all font-display font-black text-xs uppercase tracking-wider",
              selectedCat === cat.id 
                ? 'bg-[#6750A4] text-white shadow-md' 
                : 'bg-white text-[#49454F] hover:bg-black/5 border border-black/5'
            )}
          >
            <cat.icon size={16} weight="bold" />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Masonry Layout Grid */}
      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait">
          {loading && page === 0 ? (
            <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-6 gap-4 space-y-4">
              {[...Array(12)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : selectedCat === 'kits' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {kits.map(kit => (
                 <motion.div 
                   key={kit.id} 
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="bg-white border-2 border-[#1A237E]/5 p-8 rounded-[40px] shadow-sm hover:shadow-xl hover:border-[#1A237E]/20 transition-all group shrink-0"
                 >
                    <div className="flex justify-between items-start mb-6">
                       <div className="w-14 h-14 bg-[#1A237E] text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Package size={28} weight="fill" />
                       </div>
                       <span className="bg-slate-100 text-slate-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{kit.categoria}</span>
                    </div>
                    <h3 className="text-xl font-black italic tracking-tighter uppercase text-[#1A237E] mb-2">{kit.nome}</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mb-8 line-clamp-3">
                       {kit.descricao || 'Este kit contém os itens essenciais homologados pela PROPLAN para esta atividade.'}
                    </p>
                    <Button 
                      onClick={() => addKitToCart(kit.id)}
                      className="w-full h-14 rounded-2xl bg-[#1A237E] text-white font-black uppercase italic tracking-tight hover:bg-[#1A237E]/90 shadow-xl shadow-indigo-100"
                    >
                       Adicionar Kit Completo
                    </Button>
                 </motion.div>
               ))}
            </div>
          ) : products.length > 0 ? (
            <div className="space-y-10">
              <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-6 gap-4 space-y-4">
                {products.map((product, idx) => (
                  <ProductCard key={`${product.id}-${idx}`} product={product} index={idx % 30} />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center pt-8">
                   <button 
                    onClick={() => setPage(p => p + 1)}
                    disabled={loading}
                    className="px-8 py-3 rounded-full bg-white border border-[#E7E0EC] font-display font-black text-xs tracking-widest text-[#6750A4] hover:bg-[#6750A4] hover:text-white transition-all shadow-sm"
                   >
                     {loading ? 'CARREGANDO...' : 'CARREGAR MAIS REGISTROS'}
                   </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <WarningCircle size={48} />
              <p className="font-display font-black text-xl mt-4">Nenhum resultado relevante</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Checkout */}
      {items.length > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs px-4">
             <a href="/nova-dfd" className="flex items-center justify-between bg-[#1C1B1F] text-white p-2 pl-6 rounded-full shadow-2xl hover:scale-105 transition-all">
                <div className="flex items-center gap-3">
                  <ShoppingCart size={22} weight="fill" className="text-[#D0BCFF]" />
                  <span className="font-display font-black text-xs uppercase tracking-tighter">{items.length} itens</span>
                </div>
                <div className="bg-[#6750A4] px-6 py-3 rounded-full font-display font-black text-[10px] tracking-widest">PROSSEGUIR</div>
             </a>
          </motion.div>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-3xl p-4 h-[120px] border border-black/5 animate-pulse flex flex-col gap-2 break-inside-avoid">
       <div className="h-3 bg-black/5 rounded-full w-1/2" />
       <div className="h-4 bg-black/5 rounded-xl w-full" />
       <div className="h-4 bg-black/5 rounded-xl w-3/4" />
    </div>
  )
}

function ProductCard({ product, index }: { product: any, index: number }) {
  const { addItem, items } = useCarrinhoStore()
  const inCart = items.some(i => i.item_efisco.codigo_tce === product.siad)

  const handleAdd = () => {
    if (inCart) return
    addItem({
      codigo_tce: product.siad,
      descricao: product.name,
      gnd: product.gnd as any,
      unidade_medida: 'UN',
      categoria_consumo: true
    }, 'Sede Reitoria')
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.01 }}
      className="break-inside-avoid mb-4 group bg-white border border-black/5 rounded-[28px] p-4 flex flex-col gap-3 hover:shadow-xl hover:border-[#6750A4]/30 transition-all relative"
    >
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F3EDF7] text-[9px] font-black tracking-tighter text-[#6750A4]">
            <Hash size={10} weight="bold" />
            {product.siad}
         </div>
         {product.rank > 0.05 && (
            <div className="px-2 py-0.5 rounded-md bg-[#6750A4]/10 text-[8px] font-black uppercase text-[#6750A4]">
              Relevante
            </div>
         )}
      </div>

      <h3 className="font-display font-black text-[#1C1B1F] leading-tight text-[11px] tracking-tight group-hover:text-[#6750A4] transition-colors overflow-hidden break-words">
        {product.name}
      </h3>

      <div className="flex justify-between items-center pt-2">
        <div className={cn(
           "text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm",
           product.gnd === '3.3.90.39' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
         )}>
           {product.gnd === '3.3.90.39' ? 'Serviço' : 'Material'}
         </div>
        
        <button 
          onClick={handleAdd}
          className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-90",
            inCart ? 'bg-[#6750A4] text-white' : 'bg-white border border-black/5 text-[#6750A4] hover:bg-[#F3EDF7]'
          )}
        >
          {inCart ? <Check size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
        </button>
      </div>
    </motion.div>
  )
}
