'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MagnifyingGlass, 
  ShoppingCart, 
  Plus, 
  Check,
  Package,
  PaintRoller,
  BookOpen,
  Queue,
  WarningCircle,
  CaretLeft,
  CaretRight
} from '@phosphor-icons/react'
import { useCarrinhoStore } from '@/store/carrinho'
import { supabase } from '@/lib/supabase'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Categorias extraídas dinamicamente + fixas
const mainCategories = [
  { id: 'all', label: 'Tudo', icon: Queue },
  { id: 'Produto', label: 'Materiais (Geral)', icon: PaintRoller },
  { id: 'Serviço', label: 'Serviços (Geral)', icon: BookOpen },
  { id: 'TABELA ORSE', label: 'Tabela ORSE' },
  { id: 'LIVRO', label: 'Livros' },
  { id: 'TABELA SINAPI', label: 'Tabela SINAPI' },
  { id: 'TI-SOFTWARE', label: 'Software/TI' },
  { id: 'SERVICO DE CAPACITACAO DE PESSOAL', label: 'Capacitação' },
  { id: 'ASSENTAMENTO ELETRICO', label: 'Elétrica' },
  { id: 'SERVICO DE CONFECCAO DE IMPRESSOS', label: 'Gráfica' },
  { id: 'LICENCA DE USO DE SOFTWARE', label: 'Licenças SW' },
  { id: 'SERVICO DE ALIMENTACAO', label: 'Alimentação' },
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
  const scrollRef = useRef<HTMLDivElement>(null)

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

    const { data, error } = await supabase.rpc('buscar_catalogo_inteligente', {
      query_text: debouncedSearch.trim(),
      categoria_filtro: selectedCat,
      limit_val: PAGE_SIZE,
      offset_val: currentPage * PAGE_SIZE
    })

    if (error) {
      console.error('❌ Erro na busca:', error.message)
      setHasMore(false)
    }

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
    } else {
      if (isNewSearch) setProducts([])
      setHasMore(false)
    }
    setLoading(false)
  }, [debouncedSearch, selectedCat, page])

  useEffect(() => {
    fetchProducts(true)
  }, [debouncedSearch, selectedCat])

  useEffect(() => {
    if (page > 0) fetchProducts(false)
  }, [page])

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current
      const scrollTo = direction === 'left' ? scrollLeft - 300 : scrollLeft + 300
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' })
    }
  }

  return (
    <div className="p-6 space-y-8 pb-40 min-h-screen bg-[#FBFBFF]">
      {/* Header & Search */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-1">
          <h1 className="font-display text-4xl font-black text-[#1C1B1F] tracking-tighter italic uppercase">Catálogo 2027</h1>
          <p className="text-[#625B71] text-sm font-medium">Pesquisa técnica avançada com ranking de relevância.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full lg:w-[450px]">
          <MagnifyingGlass className="absolute left-5 top-1/2 -translate-y-1/2 text-[#6750A4]" size={22} weight="bold" />
          <input 
            type="text" 
            placeholder="O que você precisa hoje?" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-14 pr-6 py-5 rounded-[32px] bg-white border-2 border-[#6750A4]/10 shadow-xl shadow-[#6750A4]/5 focus:border-[#6750A4] focus:ring-0 transition-all font-display text-base font-bold text-[#1C1B1F]"
          />
        </motion.div>
      </div>

      {/* Category Carousel */}
      <div className="relative group">
        <div className="flex items-center gap-2">
          <button onClick={() => scroll('left')} className="p-2 rounded-full bg-white shadow-md border border-black/5 hover:bg-[#F3EDF7] transition-colors">
            <CaretLeft size={20} weight="bold" />
          </button>
          
          <div 
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-none py-4 px-2 no-scrollbar scroll-smooth"
          >
            {mainCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCat(cat.id); setPage(0); }}
                className={cn(
                  "flex-shrink-0 flex items-center gap-3 px-6 py-3 rounded-2xl transition-all font-display font-black text-xs uppercase tracking-widest border-2",
                  selectedCat === cat.id 
                    ? 'bg-[#6750A4] border-[#6750A4] text-white shadow-lg scale-105' 
                    : 'bg-white border-[#E7E0EC] text-[#49454F] hover:border-[#6750A4]/50'
                )}
              >
                {cat.icon && <cat.icon size={18} weight="bold" />}
                {cat.label}
              </button>
            ))}
          </div>

          <button onClick={() => scroll('right')} className="p-2 rounded-full bg-white shadow-md border border-black/5 hover:bg-[#F3EDF7] transition-colors">
            <CaretRight size={20} weight="bold" />
          </button>
        </div>
      </div>

      {/* Grid View */}
      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait">
          {loading && page === 0 ? (
            <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-6 gap-6 space-y-6">
              {[...Array(12)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : products.length > 0 ? (
            <div className="space-y-12">
              <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-6 gap-6 space-y-6">
                {products.map((product, idx) => (
                  <ProductCard key={`${product.id}-${idx}`} product={product} index={idx % 30} />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center pt-8">
                   <button 
                    onClick={() => setPage(p => p + 1)}
                    disabled={loading}
                    className="px-12 py-4 rounded-full bg-[#1C1B1F] text-white font-display font-black text-xs tracking-[0.2em] hover:bg-[#6750A4] transition-all shadow-xl active:scale-95"
                   >
                     {loading ? 'PROCESSANDO...' : 'CARREGAR MAIS ITENS'}
                   </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-24 h-24 bg-[#F3EDF7] rounded-full flex items-center justify-center mb-6">
                <WarningCircle size={48} className="text-[#6750A4]" weight="bold" />
              </div>
              <h2 className="font-display font-black text-2xl text-[#1C1B1F]">Nenhum item encontrado</h2>
              <p className="text-[#625B71] mt-2">Tente ajustar seus filtros ou termos de pesquisa.</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Cart Summary */}
      {items.length > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-6">
             <a href="/nova-dfd" className="flex items-center justify-between bg-[#1C1B1F] text-white p-3 pl-8 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all border-b-4 border-[#6750A4]">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <ShoppingCart size={24} weight="fill" className="text-[#D0BCFF]" />
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-[#6750A4] text-white text-[10px] flex items-center justify-center rounded-full font-black border-2 border-[#1C1B1F]">{items.length}</span>
                  </div>
                  <span className="font-display font-black text-xs uppercase tracking-widest">Ver Carrinho</span>
                </div>
                <div className="bg-[#6750A4] px-8 py-3 rounded-full font-display font-black text-[11px] tracking-widest uppercase">Avançar</div>
             </a>
          </motion.div>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-[32px] p-6 h-[180px] border border-black/5 animate-pulse flex flex-col gap-4 break-inside-avoid">
       <div className="h-4 bg-black/5 rounded-full w-1/3" />
       <div className="h-8 bg-black/5 rounded-2xl w-full" />
       <div className="h-4 bg-black/5 rounded-full w-2/3" />
    </div>
  )
}

function ProductCard({ product, index }: { product: any, index: number }) {
  const { addItem, items } = useCarrinhoStore()
  const inCart = items.some(i => i.item_efisco.codigo_tce === product.siad)

  // Lógica de destaque no nome: separar no primeiro hífen
  const nameParts = product.name.split(' - ')
  const mainName = nameParts[0]
  const subDescription = nameParts.slice(1).join(' - ')

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className="break-inside-avoid mb-6 group bg-white border-2 border-[#E7E0EC] rounded-[32px] p-6 flex flex-col gap-4 hover:shadow-2xl hover:border-[#6750A4] transition-all relative overflow-hidden"
    >
      {/* Background Micro-Gradient */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#6750A4]/10 to-transparent -mr-16 -mt-16 rounded-full group-hover:scale-150 transition-transform duration-700" />

      <div className="flex items-center justify-between relative z-10">
         <div className="flex flex-col">
            <span className="text-[8px] font-black text-[#6750A4] uppercase tracking-tighter">e-Fisco</span>
            <span className="text-[11px] font-display font-black text-[#1C1B1F] tracking-tight">{product.siad || 'SEM CÓDIGO'}</span>
         </div>
         {product.rank > 0.05 && (
            <div className="px-2.5 py-1 rounded-lg bg-[#6750A4] text-[8px] font-black uppercase text-white tracking-widest shadow-lg shadow-[#6750A4]/20">
              Top Match
            </div>
         )}
      </div>

      <div className="space-y-1 relative z-10">
         <h3 className="font-display font-black text-[#1C1B1F] leading-[1.1] text-[15px] tracking-tight group-hover:text-[#6750A4] transition-colors">
           {mainName}
         </h3>
         {subDescription && (
            <p className="text-[11px] font-medium text-[#625B71] leading-snug line-clamp-4">
              {subDescription}
            </p>
         )}
      </div>

      <div className="flex justify-between items-center pt-4 mt-auto border-t border-[#E7E0EC] relative z-10">
        <div className={cn(
           "text-[8px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-xl border",
           product.gnd === '3.3.90.39' 
            ? 'bg-amber-50 text-amber-700 border-amber-200' 
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
         )}>
           {product.gnd === '3.3.90.39' ? 'Serviço' : 'Material'}
         </div>
        
        <button 
          onClick={handleAdd}
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90",
            inCart 
              ? 'bg-[#6750A4] text-white shadow-[#6750A4]/30' 
              : 'bg-white border-2 border-[#E7E0EC] text-[#6750A4] hover:bg-[#F3EDF7] hover:border-[#6750A4]'
          )}
        >
          {inCart ? <Check size={20} weight="bold" /> : <Plus size={20} weight="bold" />}
        </button>
      </div>
    </motion.div>
  )
}
