'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  Plus, 
  MagnifyingGlass, 
  Files, 
  Clock, 
  CheckCircle, 
  WarningCircle,
  CaretRight,
  DotsThreeVertical
} from '@phosphor-icons/react'
import Link from 'next/link'

export default function MinhasDFDs() {
  return (
    <div className="space-y-8">
      {/* Header com Ações */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-display text-3xl font-black text-[#4F378B] tracking-tight">MEUS PEDIDOS (DFD)</h1>
          <p className="text-black/40 text-sm font-medium">Acompanhe seus Documentos de Formalização de Demanda</p>
        </div>
        <Link href="/catalogo" className="btn-filled flex items-center gap-3">
          <Plus size={20} weight="bold" />
          Nova Demanda
        </Link>
      </div>

      {/* Toolbar de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-black/5 flex flex-wrap gap-4 items-center shadow-sm">
        <div className="relative flex-1 min-w-[300px]">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-black/20" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por protocolo ou objeto..." 
            className="w-full pl-10 pr-4 py-2 bg-black/5 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#4F378B]/10 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2">
           {['Todas', 'Rascunhos', 'Em Análise', 'Concluídas'].map((f, i) => (
             <button key={i} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${i === 0 ? 'bg-[#4F378B] text-white' : 'bg-black/5 text-black/40 hover:bg-black/10'}`}>
               {f}
             </button>
           ))}
        </div>
      </div>

      {/* Lista de DFDs */}
      <div className="grid grid-cols-1 gap-4">
        {[
          { id: '2027.0001.AS', objeto: 'Material de Laboratório para Pesquisas Genéticas', valor: 'R$ 15.400,00', status: 'Em Análise', cor: 'amber' },
          { id: '2027.0042.GE', objeto: 'Mobiliário Ergonômico - Bloco A (Reforma)', valor: 'R$ 42.000,00', status: 'Rascunho', cor: 'blue' },
          { id: '2027.0125.TI', objeto: 'Licenciamento de Software Adobe (UPE Geral)', valor: 'R$ 8.900,00', status: 'Concluída', cor: 'emerald' },
        ].map((dfd, i) => (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i}
            className="bg-white p-6 rounded-[28px] border border-black/5 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-6">
              <div className={`w-14 h-14 bg-${dfd.cor}-50 text-${dfd.cor}-600 rounded-2xl flex items-center justify-center`}>
                <Files size={28} weight="bold" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-black/20 font-mono tracking-widest uppercase">Protocolo: {dfd.id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-${dfd.cor}-100 text-${dfd.cor}-700`}>
                    {dfd.status}
                  </span>
                </div>
                <h3 className="font-bold text-[#1C1B1F] group-hover:text-[#4F378B] transition-colors">{dfd.objeto}</h3>
              </div>
            </div>

            <div className="flex items-center gap-12">
              <div className="text-right">
                <span className="block text-xs font-black text-black/30 uppercase tracking-tighter">Valor Estimado</span>
                <span className="text-lg font-black text-[#4F378B]">{dfd.valor}</span>
              </div>
              <div className="flex items-center gap-2">
                 <button className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-black/40 hover:bg-[#4F378B] hover:text-white transition-all">
                   <CaretRight size={20} weight="bold" />
                 </button>
                 <button className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-black/40 hover:bg-black/10 transition-all">
                   <DotsThreeVertical size={24} weight="bold" />
                 </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Empty State Mock */}
      <div className="mt-12 p-12 border-2 border-dashed border-black/5 rounded-[40px] flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center text-black/10">
          <Clock size={32} weight="bold" />
        </div>
        <div>
           <h3 className="font-bold text-black/40">Suas demandas salvas aparecem aqui</h3>
           <p className="text-sm text-black/20 font-medium">Use o catálogo para iniciar um novo planejamento de compras.</p>
        </div>
      </div>
    </div>
  )
}
