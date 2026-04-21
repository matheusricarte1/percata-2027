'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  Calendar, 
  Clock, 
  ArrowRight, 
  NotePencil,
  CheckCircle,
  Warning,
  Lock,
  LockOpen,
  ChartLineUp
} from '@phosphor-icons/react'

export default function AdminCampanhas() {
  return (
    <div className="p-8 bg-[#F8F9FA] min-h-screen space-y-8 text-[#1C1B1F]">
      {/* Header Campanhas */}
      <div className="flex justify-between items-center">
        <div className="space-y-1">
           <h1 className="font-display text-3xl font-black text-[#1A237E] italic tracking-tighter uppercase">Cronograma PCA 2027</h1>
           <p className="text-black/40 text-sm font-medium">Gestão de janelas e janelas de planejamento de demanda</p>
        </div>
        <button className="btn-filled bg-[#1A237E] text-white flex items-center gap-3">
          <Calendar size={20} weight="bold" />
          Novo Ciclo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Ciclo Ativo */}
        <div className="bg-white rounded-[40px] p-10 border-2 border-[#1A237E]/10 shadow-xl shadow-[#1A237E]/5 space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#1A237E]/5 rounded-bl-[100px] -mr-10 -mt-10 translate-x-2 translate-y-2 opacity-50" />
          
          <div className="flex items-center gap-4">
             <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center shadow-inner">
               <LockOpen size={32} weight="fill" />
             </div>
             <div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-2 inline-block">Ciclo Aberto</span>
                <h2 className="text-2xl font-black text-[#1A237E] tracking-tight">PLANEJAMENTO PCA 2027</h2>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
             <div className="bg-[#F8F9FA] p-6 rounded-3xl space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-black/30">Início da Janela</span>
                <div className="flex items-center gap-3">
                   <Calendar className="text-[#1A237E]" size={20} />
                   <span className="font-black text-lg">01/03/2026</span>
                </div>
             </div>
             <div className="bg-[#F8F9FA] p-6 rounded-3xl space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-black/30">Prazo Final</span>
                <div className="flex items-center gap-3">
                   <Clock className="text-red-500" size={20} />
                   <span className="font-black text-lg text-red-500">30/05/2026</span>
                </div>
             </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-black/40 px-2">
                <span>Progresso Global de Submissão</span>
                <span>65%</span>
             </div>
             <div className="w-full h-4 bg-black/5 rounded-full overflow-hidden p-1 shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '65%' }}
                  className="h-full bg-gradient-to-r from-[#1A237E] to-[#448AFF] rounded-full"
                />
             </div>
          </div>

          <div className="flex gap-3">
             <button className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                Fechar Janela Agora
             </button>
             <button className="flex-1 py-4 bg-black/5 text-black/60 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black/10 transition-all">
                Editar Cronograma
             </button>
          </div>
        </div>

        {/* Fases do Calendário */}
        <div className="bg-[#1A237E] rounded-[40px] p-10 text-white space-y-8 shadow-2xl relative overflow-hidden">
          <ChartLineUp size={200} className="absolute -bottom-10 -right-10 opacity-5 rotate-12" weight="fill" />
          
          <h2 className="text-xl font-black uppercase tracking-tight italic">Fluxo de Planejamento</h2>
          
          <div className="space-y-4">
             <StepItem icon={NotePencil} label="Submissão de DFDs" status="concluido" />
             <StepItem icon={ChartLineUp} label="Consolidação e Triagem" status="ativo" />
             <StepItem icon={CheckCircle} label="Publicação do Calendário (UPE)" status="pendente" />
             <StepItem icon={ArrowRight} label="Envio PNCP / Compras.gov" status="pendente" />
          </div>

          <div className="bg-white/10 p-6 rounded-3xl border border-white/5 space-y-2">
             <div className="flex items-center gap-3">
                <Warning size={20} weight="fill" className="text-amber-400" />
                <span className="text-sm font-bold">Aviso aos Gestores</span>
             </div>
             <p className="text-white/60 text-xs leading-relaxed font-medium">A fase de consolidação inicia automaticamente em 10 dias. Certifique-se que todas as unidades já homologaram suas triagens.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StepItem({ icon: Icon, label, status }: any) {
  const configs: any = {
    concluido: { bg: 'bg-emerald-500/20 text-emerald-300', dot: 'bg-emerald-400' },
    ativo: { bg: 'bg-white text-[#1A237E]', dot: 'bg-red-500' },
    pendente: { bg: 'bg-white/5 text-white/30', dot: 'bg-white/10' }
  }

  return (
    <div className={`flex items-center justify-between p-4 rounded-2xl border ${status === 'ativo' ? 'border-white/20' : 'border-transparent'} ${configs[status].bg} transition-all`}>
       <div className="flex items-center gap-4">
          <div className="p-2 bg-black/10 rounded-lg">
             <Icon size={20} weight="bold" />
          </div>
          <span className="text-xs font-black uppercase tracking-widest">{label}</span>
       </div>
       <div className={`w-3 h-3 rounded-full ${configs[status].dot} ${status === 'ativo' ? 'animate-ping' : ''}`} />
    </div>
  )
}
