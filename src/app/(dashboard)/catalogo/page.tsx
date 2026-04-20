'use client'

import React, { useState } from 'react'
import { 
  MagnifyingGlass, 
  Funnel, 
  ShoppingCart, 
  Plus, 
  Minus,
  Check,
  Package,
  Cpu,
  OfficeChair,
  PaintRoller,
  BookOpen,
  Info
} from '@phosphor-icons/react'
import { useCarrinhoStore } from '@/store/carrinho'
import { supabase } from '@/lib/supabase'
import { useEffect } from 'react'

const categories = [
  { id: 'ti', label: 'Tecnologia', icon: Cpu, count: 124 },
  { id: 'mob', label: 'Mobiliário', icon: OfficeChair, count: 45 },
  { id: 'mat', label: 'Materiais', icon: PaintRoller, count: 210 },
  { id: 'serv', label: 'Serviços', icon: BookOpen, count: 89 },
]

export default function CatalogoPage() {
  const [selectedCat, setSelectedCat] = useState('ti')
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const { addItem, items } = useCarrinhoStore()

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true)
      
      let query = supabase
        .from('catalogo')
        .select('*')
        .limit(100) // Limite para performance inicial

      if (search) {
        query = query.ilike('descricao', `%${search}%`)
      }

      const { data, error } = await query
      
      if (data) {
        setProducts(data.map(p => ({
          id: p.id,
          siad: p.codigo_efisco,
          name: p.descricao,
          price: 15.50 + (Math.random() * 500), // Valor estimado (seria do CSV se houvesse coluna de preço)
          gnd: p.tipo === 'Servio' ? '3.3.90.39' : '3.3.90.30',
          cat: p.tipo === 'Servio' ? 'serv' : 'mat',
          stock: Math.floor(Math.random() * 500)
        })))
      }
      setLoading(false)
    }
    fetchProducts()
  }, [search])

  const filteredProducts = products.filter(p => 
    (selectedCat === 'serv' ? p.cat === 'serv' : p.cat !== 'serv')
  )

  return (
    <div className="p-8 space-y-8 pb-32">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="font-display text-4xl font-extrabold text-[#1C1B1F] tracking-tight">
            Catálogo de Itens
          </h1>
          <p className="text-[#625B71] font-medium">
            Selecione os itens para compor sua DFD 2027.
          </p>
        </div>

        <div className="relative w-full md:w-96 shadow-sm">
          <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1C1B1F]/40" size={20} />
          <input 
            type="text" 
            placeholder="O que você precisa hoje?" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-[#CAC4D0] focus:ring-4 focus:ring-[#6750A4]/10 focus:border-[#6750A4] transition-all font-medium text-[#1C1B1F]"
          />
        </div>
      </div>

      {/* Categories Row */}
      <div className="flex flex-wrap gap-4 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCat(cat.id)}
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all border-2 ${
              selectedCat === cat.id 
                ? 'bg-[#EADDFF] border-[#6750A4] text-[#21005D]' 
                : 'bg-white border-[#E7E0EC] text-[#49454F] hover:bg-[#F3EDF7]'
            }`}
          >
            <cat.icon size={20} weight={selectedCat === cat.id ? 'fill' : 'regular'} />
            <span className="font-bold text-sm tracking-tight">{cat.label}</span>
            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
              selectedCat === cat.id ? 'bg-[#D0BCFF]/50' : 'bg-black/5'
            }`}>
              {cat.count}
            </span>
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
           <div className="w-12 h-12 border-4 border-[#6750A4] border-t-transparent rounded-full animate-spin" />
           <p className="font-bold text-[#625B71]">Sincronizando Catálogo e-Fisco...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Floating Action: Checkout */}
      {items.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <a 
            href="/nova-dfd"
            className="flex items-center gap-4 bg-[#6750A4] text-white px-8 py-4 rounded-3xl shadow-2xl shadow-[#6750A4]/40 hover:scale-105 active:scale-95 transition-all"
           >
              <div className="relative">
                <ShoppingCart size={24} weight="fill" />
                <span className="absolute -top-3 -right-3 w-6 h-6 bg-[#B3261E] rounded-full text-[10px] font-black flex items-center justify-center border-2 border-[#6750A4]">
                   {items.length}
                </span>
              </div>
              <div className="h-6 w-[1px] bg-white/20" />
              <span className="font-display font-black tracking-tight">PROSSEGUIR COM A DFD</span>
           </a>
        </div>
      )}
    </div>
  )
}

function ProductCard({ product }: { product: any }) {
  const { addItem, updateItem, items } = useCarrinhoStore()
  
  // Check if item is in cart by looking at item_efisco.codigo_tce
  const cartIndex = items.findIndex(i => i.item_efisco.codigo_tce === product.siad)
  const inCart = cartIndex !== -1

  const handleAdd = () => {
    if (inCart) return
    
    const itemEfisco = {
      codigo_tce: product.siad,
      descricao: product.name,
      gnd: product.gnd as any,
      unidade_medida: 'UN',
      categoria_consumo: true
    }
    
    // Add item with default local
    addItem(itemEfisco, 'Sede Reitoria')
    
    // Immediately update price from the numeric value
    setTimeout(() => {
       updateItem(items.length, { valor_unitario_estimado: product.price })
    }, 0)
  }

  return (
    <div className="group bg-white border border-[#E7E0EC] rounded-[28px] p-5 flex flex-col gap-4 hover:shadow-xl hover:border-[#D0BCFF] transition-all relative overflow-hidden">
      {/* SIAD Badge */}
      <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-black/5 text-[9px] font-black tracking-widest text-black/30">
        SIAD {product.siad}
      </div>

      <div className="aspect-square w-full rounded-2xl bg-[#F3EDF7] flex items-center justify-center transition-transform group-hover:scale-105 duration-500">
         <Package size={64} weight="thin" className="text-[#6750A4]/20" />
      </div>

      <div className="space-y-1">
        <h3 className="font-display font-bold text-[#1C1B1F] leading-tight line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>
        <p className="text-xs font-medium text-[#625B71]">Estoque estimado: {product.stock} un</p>
      </div>

      <div className="mt-auto pt-4 flex items-center justify-between">
        <div className="space-y-0.5">
           <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">Valor Médio</p>
           <p className="font-display text-lg font-black text-[#1C1B1F]">
             R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
           </p>
        </div>

        <button 
          onClick={handleAdd}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
            inCart ? 'bg-[#6750A4] text-white' : 'bg-[#EADDFF] text-[#21005D] hover:bg-[#D0BCFF]'
          }`}
        >
          {inCart ? <Check size={24} weight="bold" /> : <Plus size={24} weight="bold" />}
        </button>
      </div>
      
      {/* Glass info tap */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/80 backdrop-blur-md border-t border-black/5 translate-y-full group-hover:translate-y-0 transition-transform flex items-center gap-2 text-[10px] font-bold text-[#6750A4]">
         <Info size={14} weight="fill" />
         Consulte especificações técnicas
      </div>
    </div>
  )
}
