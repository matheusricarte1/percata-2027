'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  Wallet, 
  TrendUp, 
  TrendDown, 
  Warning, 
  CheckCircle,
  ChartPie,
  ArrowUpRight,
  ArrowDownRight
} from '@phosphor-icons/react'

export default function OrcamentoSetorial() {
  return (
    <div className="p-8 bg-[#F5FBF9] min-h-screen space-y-8">
      {/* Header Orçamento */}
      <div className="flex justify-between items-center bg-white p-8 rounded-[40px] border border-emerald-100 shadow-sm">
        <div className="space-y-1">
          <h1 className="font-display text-4xl font-black text-[#004D40] italic tracking-tighter uppercase">Gestão Orçamentária</h1>
          <p className="text-emerald-800/50 text-sm font-medium">Controle de limites e disponibilidade para o PCA 2027</p>
        </div>
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center text-3xl shadow-inner">
           <Wallet weight="fill" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BudgetCard label="Custeio Disponível" value="R$ 850.000,00" sub="Limite total do setor" type="normal" />
        <BudgetCard label="Planejado p/ 2027" value="R$ 452.300,00" sub="Demandas em triagem" type="warning" />
        <BudgetCard label="Saldo Residual" value="R$ 397.700,00" sub="Disponibilidade para novas DFDs" type="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Distribuição por GND */}
        <div className="bg-white rounded-[40px] p-10 border border-emerald-100 shadow-sm space-y-8">
           <div className="flex items-center justify-between">
              <h2 className="font-display font-black text-xl text-[#004D40] uppercase tracking-tight italic">Consumo por Natureza</h2>
              <ChartPie size={24} weight="bold" className="text-emerald-300" />
           </div>

           <div className="space-y-6">
              <GNDProgress label="33.90.30 - Material de Consumo" percent={45} valor="R$ 210.000" />
              <GNDProgress label="33.90.39 - Serviços de Terceiros" percent={30} valor="R$ 150.000" />
              <GNDProgress label="44.90.52 - Equipamentos & Permanente" percent={20} valor="R$ 92.300" />
           </div>
        </div>

        {/* Alertas e Recomendações */}
        <div className="lg:col-span-2 bg-[#004D40] rounded-[40px] p-10 text-white space-y-8 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-bl-[200px] -mr-20 -mt-20 pointer-events-none" />
           
           <h2 className="text-2xl font-black uppercase tracking-tight italic">Alertas Operacionais</h2>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/10 p-6 rounded-3xl border border-white/10 space-y-4">
                 <div className="w-10 h-10 bg-amber-400/20 text-amber-400 rounded-xl flex items-center justify-center">
                    <Warning size={24} weight="fill" />
                 </div>
                 <h3 className="font-bold text-lg">Consumo Acelerado</h3>
                 <p className="text-white/60 text-xs leading-relaxed font-medium">O campus Garanhuns já atingiu 85% do limite de custeio previsto para laboratório no primeiro semestre.</p>
              </div>

              <div className="bg-white/10 p-6 rounded-3xl border border-white/10 space-y-4">
                 <div className="w-10 h-10 bg-emerald-400/20 text-emerald-400 rounded-xl flex items-center justify-center">
                    <CheckCircle size={24} weight="fill" />
                 </div>
                 <h3 className="font-bold text-lg">Planejamento Saudável</h3>
                 <p className="text-white/60 text-xs leading-relaxed font-medium">As submissões de mobiliário estão 15% abaixo da média histórica, garantindo folga orçamentária.</p>
              </div>
           </div>

           <div className="pt-6 border-t border-white/5">
              <button className="flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] bg-white text-[#004D40] px-8 py-4 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all">
                 Visualizar Extrato Detalhado <ArrowUpRight weight="bold" />
              </button>
           </div>
        </div>
      </div>
    </div>
  )
}

function BudgetCard({ label, value, sub, type }: any) {
  const configs: any = {
    normal: 'bg-white text-[#004D40]',
    warning: 'bg-white border-2 border-amber-400/20 text-amber-600',
    success: 'bg-[#B2DFDB] text-[#004D40]'
  }
  return (
    <div className={`p-8 rounded-[32px] shadow-sm flex flex-col items-center text-center space-y-1 ${configs[type]}`}>
       <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{label}</span>
       <h2 className="text-2xl font-black">{value}</h2>
       <p className="text-[10px] font-bold opacity-30">{sub}</p>
    </div>
  )
}

function GNDProgress({ label, percent, valor }: any) {
  return (
    <div className="space-y-2">
       <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
          <span className="text-emerald-950/40">{label}</span>
          <span className="text-emerald-700">{valor} ({percent}%)</span>
       </div>
       <div className="w-full h-3 bg-emerald-50 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            className="h-full bg-emerald-500 rounded-full"
          />
       </div>
    </div>
  )
}
