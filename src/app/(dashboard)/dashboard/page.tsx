'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkle, 
  Plus, 
  Files, 
  ChartPieSlice, 
  Truck, 
  ArrowRight,
  CurrencyCircleDollar,
  UserCircle,
  TrendUp,
  Clock,
  Stack,
  ArrowClockwise,
  CaretRight,
  Buildings
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    pending: 0,
    approvedMonth: 0,
    budgetUsed: 0,
    userName: 'Servidor',
    legacyDfds: [] as any[]
  })

  const fetchStats = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const { data: dfds } = await supabase
        .from('dfds')
        .select('status, valor_total_estimado')
        .eq('solicitante_id', user.id)

      const pending = dfds?.filter(d => d.status === 'triagem' || d.status === 'rascunho').length || 0
      const approved = dfds?.filter(d => d.status === 'aprovada').length || 0
      const totalValue = dfds?.filter(d => d.status === 'aprovada').reduce((acc, d) => acc + Number(d.valor_total_estimado), 0) || 0

      const { data: legacy } = await supabase
        .from('historico_demandas')
        .select('*')
        .eq('solicitante_email', user.email)
        .limit(3)

      setStats({
        pending,
        approvedMonth: approved,
        budgetUsed: totalValue,
        userName: profile?.full_name?.split(' ')[0] || 'Servidor',
        legacyDfds: legacy || []
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  return (
    <div className="space-y-12 pb-20">
      {/* Premium Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-2"
        >
          <h1 className="font-display text-6xl font-black text-[#1A237E] tracking-tighter uppercase italic leading-none">
            Olá, {stats.userName}!
          </h1>
          <p className="text-slate-400 text-lg font-medium max-w-lg">
            Visão geral e monitoramento das suas demandas e saldo orçamentário no ciclo <span className="text-indigo-600 font-bold">PCA 2027</span>.
          </p>
        </motion.div>
        
        <motion.div 
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="hidden lg:flex items-center gap-4 bg-white p-4 rounded-[32px] border border-indigo-50 shadow-sm shadow-indigo-900/5 ring-1 ring-black/[0.02]"
        >
           <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <Clock size={24} weight="duotone" />
           </div>
           <div className="pr-4">
              <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] leading-none mb-1">Prazo de Submissão</p>
              <p className="text-sm font-bold text-[#1A237E]">Restam 12 dias úteis</p>
           </div>
        </motion.div>
      </div>

      {/* Hero Interactive Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#1A237E] to-[#0D1452] rounded-[60px] p-12 text-white relative overflow-hidden shadow-[0_48px_100px_-20px_rgba(26,35,126,0.3)] group"
      >
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500 rounded-full blur-[120px] -mr-40 -mt-40 opacity-20 group-hover:opacity-30 transition-opacity pointer-events-none" />
         <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-400 rounded-full blur-[100px] -ml-40 -mb-40 opacity-10 pointer-events-none" />
         
         <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 items-center gap-12">
            <div className="space-y-8">
               <div className="flex items-center gap-3 font-black uppercase text-[10px] tracking-[0.4em] bg-white/10 backdrop-blur-md w-fit px-5 py-2 rounded-full border border-white/10">
                  <Sparkle weight="fill" className="text-amber-400" /> Plantão Informativo PCA
               </div>
               <div className="space-y-4">
                  <h2 className="font-display text-5xl font-black leading-[1] italic uppercase tracking-tighter">
                     Otimize sua <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-indigo-400">Pactuação 2027</span>
                  </h2>
                  <p className="text-lg text-indigo-100/60 leading-relaxed max-w-lg font-medium pr-10">
                     O sistema de curadoria inteligente agora suporta agrupamento automático por classe e priorização por Pareto.
                  </p>
               </div>
               <div className="flex gap-4">
                 <Button onClick={() => router.push('/catalogo')} className="h-16 px-10 rounded-[28px] bg-white text-[#1A237E] font-black uppercase italic tracking-widest text-sm shadow-2xl shadow-indigo-900/40">
                    Começar Planejamento
                 </Button>
               </div>
            </div>
            
            <div className="hidden lg:flex justify-end">
               <div className="grid grid-cols-2 gap-4">
                  {[1,2,3,4].map(i => (
                    <motion.div 
                      key={i}
                      whileHover={{ scale: 1.05, rotate: i % 2 === 0 ? 2 : -2 }}
                      className="w-32 h-32 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] flex items-center justify-center"
                    >
                       <Stack size={40} className="text-white/20" weight="thin" />
                    </motion.div>
                  ))}
               </div>
            </div>
         </div>
      </motion.div>

      {/* Main High-Fidelity Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
         
         {/* Card 1: DFD Tracker */}
         <motion.div 
           whileHover={{ y: -8 }}
           className="bg-white p-10 rounded-[50px] border border-indigo-50 shadow-sm flex flex-col justify-between h-full group hover:shadow-2xl hover:border-indigo-100 transition-all cursor-default"
         >
            <div className="space-y-8">
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 group-hover:text-indigo-400 transition-colors">Portfólio Ativo</span>
                  <div className="w-16 h-16 rounded-[28px] bg-indigo-50 text-indigo-600 flex items-center justify-center ring-8 ring-indigo-50/50 shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                     <Files size={32} weight="duotone" />
                  </div>
               </div>
               <div className="space-y-1">
                  {loading ? <Skeleton className="h-14 w-24 rounded-2xl" /> : (
                    <div className="font-display text-6xl font-black text-[#1A237E] flex items-baseline gap-3 italic tracking-tighter">
                       {stats.pending} 
                       <span className="text-sm font-black text-slate-300 uppercase italic tracking-widest opacity-60">Demandas</span>
                    </div>
                  )}
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aguardando curadoria técnica</p>
               </div>
               
               <div className="bg-slate-50 p-6 rounded-[32px] border border-black/5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-0.5">Homologadas</span>
                    <span className="text-xl font-bold text-emerald-500">{stats.approvedMonth} <span className="text-xs opacity-40">Mês</span></span>
                  </div>
                  <div className="h-8 w-[1px] bg-slate-200" />
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-0.5">Devolvidas</span>
                    <span className="text-xl font-bold text-amber-500">02</span>
                  </div>
               </div>
            </div>
            <div className="pt-10 flex justify-end">
               <Button 
                onClick={() => router.push('/minhas-dfds')}
                variant="ghost" 
                className="h-14 px-8 rounded-full text-indigo-600 font-black uppercase text-[10px] tracking-[0.3em] hover:bg-indigo-50 border border-transparent hover:border-indigo-100"
               >
                  Ver Fluxo <CaretRight size={16} className="ml-2" weight="bold" />
               </Button>
            </div>
         </motion.div>

         {/* Card 2: Budget Control */}
         <motion.div 
           whileHover={{ y: -8 }}
           className="bg-white p-10 rounded-[50px] border border-emerald-50 shadow-sm flex flex-col justify-between h-full group hover:shadow-2xl hover:border-emerald-100 transition-all cursor-default"
         >
            <div className="space-y-8">
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 group-hover:text-emerald-500 transition-colors">Teto Orçamentário</span>
                  <div className="w-16 h-16 rounded-[28px] bg-emerald-50 text-emerald-600 flex items-center justify-center ring-8 ring-emerald-50/50 shadow-inner group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500">
                     <CurrencyCircleDollar size={32} weight="duotone" />
                  </div>
               </div>
               <div className="space-y-1">
                  {loading ? <Skeleton className="h-14 w-full rounded-2xl" /> : (
                    <div className="font-display text-5xl font-black text-[#004D40] italic tracking-tighter">
                       R$ {stats.budgetUsed.toLocaleString('pt-BR')}
                    </div>
                  )}
                  <p className="text-[10px] font-black text-emerald-600/40 uppercase tracking-widest">Impacto consolidado (Q1)</p>
               </div>
               
               <div className="space-y-4">
                  <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                     <span>Unidade: 25% Ocupado</span>
                     <span className="text-emerald-600 font-black italic">R$ 200k teto</span>
                  </div>
                  <div className="h-4 bg-slate-50 rounded-full overflow-hidden p-1 ring-1 ring-black/[0.03]">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '25%' }}
                      className="bg-emerald-500 h-full rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all duration-1000" 
                    />
                  </div>
               </div>
            </div>
            <div className="pt-10 flex justify-end">
               <Button 
                variant="ghost" 
                className="h-14 px-8 rounded-full text-emerald-600 font-black uppercase text-[10px] tracking-[0.3em] hover:bg-emerald-50 border border-transparent hover:border-emerald-100"
               >
                  Extrato LOA <CaretRight size={16} className="ml-2" weight="bold" />
               </Button>
            </div>
         </motion.div>

         {/* Card 3: Organizational Profile */}
         <motion.div 
           whileHover={{ y: -8 }}
           className="bg-[#1A237E] p-10 rounded-[50px] text-white flex flex-col justify-between h-full shadow-2xl relative overflow-hidden group"
         >
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-indigo-500 rounded-full blur-[80px] opacity-20 pointer-events-none" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-bl-[80px] pointer-events-none" />
            
            <div className="space-y-10 relative z-10">
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Identidade Lotação</span>
                  <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-indigo-200">
                     <Buildings size={28} weight="duotone" />
                  </div>
               </div>
               
               <div className="space-y-4">
                  <div className="space-y-2">
                     <p className="font-display text-4xl font-black italic uppercase tracking-tighter leading-none group-hover:scale-105 transition-transform origin-left duration-500">Campus <br/> Petrolina</p>
                     <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">Instituto Federal do Sertão PE</p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                     <span className="px-3 py-1 bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/5">Polo IV</span>
                     <span className="px-3 py-1 bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/5">Ativo</span>
                  </div>
               </div>
            </div>
            
            <Button className="w-full mt-10 h-16 bg-white/10 hover:bg-white/20 text-white rounded-[24px] text-[10px] font-black uppercase tracking-[0.3em] border border-white/5 transition-all shadow-xl group/btn">
               MUDAR PERFIL <ArrowClockwise size={18} className="ml-3 group-hover/btn:rotate-180 transition-transform duration-500" />
            </Button>
         </motion.div>

      </div>

      {/* Premium History Section - Legado 2025 */}
      <div className="pt-20 space-y-12">
         <motion.div 
           initial={{ opacity: 0, x: -10 }}
           animate={{ opacity: 1, x: 0 }}
           className="flex items-center justify-between"
         >
            <div className="flex items-center gap-6">
               <div className="w-3 h-10 bg-indigo-600 rounded-full"></div>
               <h3 className="font-display text-3xl font-black text-[#1A237E] uppercase italic tracking-tighter">Histórico PERCATA <span className="opacity-30">Legado</span></h3>
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Exibindo Ciclo 2025</span>
         </motion.div>
         
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <AnimatePresence>
               {loading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-44 rounded-[40px]" />) : 
                stats.legacyDfds.map((h, idx) => (
                  <motion.div 
                    key={h.id} 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    className="bg-white p-8 rounded-[48px] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all cursor-pointer group flex flex-col justify-between h-48"
                  >
                     <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1 overflow-hidden">
                           <p className="text-[10px] font-mono font-black text-indigo-400 bg-indigo-50 w-fit px-2 py-0.5 rounded uppercase tracking-widest mb-2 opacity-60">#{h.id.slice(0, 8)}</p>
                           <h4 className="font-black text-[#1A237E] uppercase tracking-tight text-base leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2">{h.objeto}</h4>
                        </div>
                        <div className="shrink-0">
                           <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                              <ArrowRight size={20} weight="bold" />
                           </div>
                        </div>
                     </div>
                     
                     <div className="flex justify-between items-end pt-6 border-t border-slate-50">
                        <div className="space-y-1">
                           <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest block">Data Original</span>
                           <span className="text-xs font-bold text-slate-500 uppercase">{new Date(h.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div className="text-right">
                           <p className="text-xl font-display font-black text-slate-800 italic leading-none mb-1">R$ {Number(h.valor_total || 0).toLocaleString('pt-BR')}</p>
                           <span className="inline-block px-3 py-1 bg-slate-100 text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-lg">
                              {h.status_final || 'FINALIZADO'}
                           </span>
                        </div>
                     </div>
                  </motion.div>
                ))}
               {!loading && stats.legacyDfds.length === 0 && (
                  <div className="col-span-full py-24 text-center opacity-10 border-[3px] border-dashed border-slate-200 rounded-[60px] flex flex-col items-center gap-6">
                     <Stack size={64} weight="thin" />
                     <p className="font-black uppercase tracking-[0.5em] text-xl">Arquivos Legados Indisponíveis</p>
                  </div>
               )}
            </AnimatePresence>
         </div>
      </div>
    </div>
  )
}
