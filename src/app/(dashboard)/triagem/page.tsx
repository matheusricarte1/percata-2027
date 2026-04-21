'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowRight,
  User,
  Wallet,
  ChartBar,
  MagnifyingGlass
} from '@phosphor-icons/react'

export default function ChefiaDashboard() {
  return (
    <div className="p-8 space-y-8 bg-[#F5FBF9] min-h-screen">
      {/* Header Chefia */}
      <div className="flex justify-between items-center bg-white p-8 rounded-[32px] border border-emerald-100 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-[#B2DFDB] text-[#00695C] rounded-2xl flex items-center justify-center text-3xl shadow-sm">
            <CheckCircle weight="fill" />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-black text-[#004D40] italic tracking-tighter">TRIAGEM DE SETOR</h1>
            <p className="text-emerald-800/50 text-sm font-medium uppercase tracking-widest font-black">Homologação de Demandas (PCA 2027)</p>
          </div>
        </div>
        <div className="bg-emerald-50 px-6 py-3 rounded-2xl border border-emerald-100">
           <span className="text-[10px] font-black uppercase text-emerald-800/40 block mb-1">Saldo Estimado Planejado</span>
           <span className="text-2xl font-black text-[#004D40]">R$ 145.800,25</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Fila de Aprovação */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="font-display font-black text-xl text-[#004D40] uppercase tracking-tight">Pendentes de Validação</h2>
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-800/40" size={18} />
              <input 
                type="text" 
                placeholder="Filtrar solicitante..." 
                className="pl-10 pr-4 py-2 bg-white border border-emerald-100 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-200 outline-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            {[
              { solicitante: 'João Silva', objeto: 'Material Elétrico para Laboratório', valor: 'R$ 12.400,00', data: 'há 1 dia', status: 'Pendente' },
              { solicitante: 'Maria Oliveira', objeto: 'Mobiliário de Escritório (Novas Salas)', valor: 'R$ 45.000,00', data: 'há 2 dias', status: 'Pendente' },
              { solicitante: 'Carlos Souza', objeto: 'Reagentes Químicos (Semestre 2027.1)', valor: 'R$ 8.900,00', data: 'há 3 dias', status: 'Pendente' }
            ].map((item, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={i} 
                className="bg-white p-6 rounded-[28px] border border-emerald-100 shadow-sm hover:shadow-md transition-all group group cursor-pointer overflow-hidden relative"
              >
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-700">
                      <User size={24} weight="bold" />
                    </div>
                    <div>
                      <h3 className="font-bold text-emerald-950">{item.solicitante}</h3>
                      <p className="text-xs text-emerald-800/50 font-medium">{item.objeto}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                       <span className="block text-lg font-black text-emerald-900 leading-none">{item.valor}</span>
                       <span className="text-[10px] font-bold text-emerald-800/40 uppercase">{item.data}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <button className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                         <CheckCircle size={22} weight="bold" />
                       </button>
                       <button className="w-10 h-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm">
                         <XCircle size={22} weight="bold" />
                       </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Sidebar Informativa / Resumo */}
        <div className="space-y-6">
          <div className="bg-[#004D40] p-8 rounded-[32px] text-white space-y-6 shadow-xl">
             <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Meta de Envio (Setor)</span>
                <h3 className="text-2xl font-black italic">65% Concluído</h3>
             </div>
             <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div className="bg-[#B2DFDB] h-full w-[65%]" />
             </div>
             <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-2"><Clock weight="bold" /> Faltam 12 dias</span>
                <span>8 / 12 Usuários</span>
             </div>
          </div>

          <div className="bg-white p-6 rounded-[28px] border border-emerald-100 space-y-4">
             <h3 className="font-display font-black text-lg text-[#004D40] uppercase tracking-tight">Atalhos do Gestor</h3>
             <div className="grid grid-cols-1 gap-2">
                <button className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl text-[#004D40] font-black text-[10px] uppercase tracking-widest hover:bg-[#B2DFDB] transition-all">
                   <div className="flex items-center gap-3">
                     <ChartBar size={20} weight="bold" />
                     <span>Analítico Setorial</span>
                   </div>
                   <ArrowRight weight="bold" />
                </button>
                <button className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl text-[#004D40] font-black text-[10px] uppercase tracking-widest hover:bg-[#B2DFDB] transition-all">
                   <div className="flex items-center gap-3">
                     <Wallet size={20} weight="bold" />
                     <span>Limites de Custeio</span>
                   </div>
                   <ArrowRight weight="bold" />
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
