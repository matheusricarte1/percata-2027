'use client'

import React, { useState, useEffect } from 'react'
import { 
  Sparkle, 
  Plus, 
  Files, 
  ChartPieSlice, 
  Truck, 
  ArrowRight,
  CurrencyCircleDollar,
  UserCircle
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'

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

      // 1. Perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      // 2. DFDs do usuário
      const { data: dfds } = await supabase
        .from('dfds')
        .select('status, valor_total_estimado')
        .eq('solicitante_id', user.id)

      const pending = dfds?.filter(d => d.status === 'triagem' || d.status === 'rascunho').length || 0
      const approved = dfds?.filter(d => d.status === 'aprovada').length || 0
      const totalValue = dfds?.filter(d => d.status === 'aprovada').reduce((acc, d) => acc + Number(d.valor_total_estimado), 0) || 0

      // 3. Histórico Legado (2025)
      const { data: legacy } = await supabase
        .from('historico_demandas')
        .select('*')
        .eq('solicitante_email', user.email)
        .limit(2)

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
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Welcome Header */}
      <div className="space-y-1">
        <h1 className="font-display text-5xl font-black text-[#1A237E] tracking-tighter uppercase italic">
          Boas vindas, {stats.userName}!
        </h1>
        <p className="text-slate-400 text-lg font-medium">
          Acompanhamento estratégico do ciclo de planejamento PCA 2027.
        </p>
      </div>

      {/* Hero Carousel Area */}
      <div className="bg-[#1A237E] rounded-[48px] p-12 text-white relative overflow-hidden shadow-2xl shadow-indigo-100">
         <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-bl-full pointer-events-none" />
         <div className="relative z-10 max-w-2xl space-y-4">
            <div className="flex items-center gap-2 font-black uppercase text-[10px] tracking-[0.3em] bg-white/10 w-fit px-4 py-1 rounded-full">
               <Sparkle weight="fill" className="text-amber-400" /> Plantão PCA 2027
            </div>
            <h2 className="font-display text-4xl font-black leading-[1.1] italic uppercase">
               Nova rodada de pactuação está aberta!
            </h2>
            <p className="text-sm opacity-60 leading-relaxed max-w-lg font-medium">
               Sua unidade possui saldo orçamentário disponível para o Q1. Lembre-se de anexar as cotações obrigatórias para evitar devoluções pela chefia.
            </p>
            <div className="flex gap-2 pt-4">
               <div className="w-10 h-2 rounded-full bg-white transition-all shadow-lg shadow-white/20"></div>
               <div className="w-2 h-2 rounded-full bg-white/20"></div>
               <div className="w-2 h-2 rounded-full bg-white/20"></div>
            </div>
         </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
         
         {/* Card 1: Solicitações */}
         <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm flex flex-col justify-between h-full hover:shadow-xl transition-all border-b-4 border-b-blue-500">
            <div className="space-y-6">
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Minhas Demandas</span>
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                     <Files size={28} weight="fill" />
                  </div>
               </div>
               {loading ? <Skeleton className="h-10 w-20" /> : (
                 <div className="font-display text-5xl font-black text-slate-800 flex items-baseline gap-2 italic">
                    {stats.pending} <span className="text-sm font-black text-slate-300 uppercase italic">Em trânsito</span>
                 </div>
               )}
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 p-3 rounded-xl border border-black/5">
                  Homologadas este mês: <span className="text-emerald-500">{stats.approvedMonth}</span>
               </div>
            </div>
            <div className="pt-6 mt-4 flex justify-end">
               <button 
                 onClick={() => router.push('/minhas-dfds')}
                 className="text-xs font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 px-6 py-3 rounded-2xl transition-all"
               >
                  Ver Painel DFD
                  <ArrowRight size={16} className="inline ml-2" weight="bold" />
               </button>
            </div>
         </div>

         {/* Card 2: Orçamento */}
         <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm flex flex-col justify-between h-full hover:shadow-xl transition-all border-b-4 border-b-emerald-500">
            <div className="space-y-6">
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pactuação Financeira</span>
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
                     <CurrencyCircleDollar size={28} weight="fill" />
                  </div>
               </div>
               {loading ? <Skeleton className="h-10 w-32" /> : (
                 <div className="font-display text-4xl font-black text-slate-800 italic">
                    R$ {stats.budgetUsed.toLocaleString('pt-BR')}
                 </div>
               )}
               <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                     <span>Teto de Unidade (Q1)</span>
                     <span>Ocupado</span>
                  </div>
                  <Progress value={25} className="h-2 bg-slate-100" />
               </div>
            </div>
            <div className="pt-6 mt-4 flex justify-end">
               <button className="text-xs font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 px-6 py-3 rounded-2xl transition-all">
                  Detalhes LOA/PCA
               </button>
            </div>
         </div>

         {/* Card 3: Suporte */}
         <div className="bg-[#1A237E] p-8 rounded-[40px] text-white flex flex-col justify-between h-full shadow-2xl relative overflow-hidden">
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
            <div className="space-y-4">
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Status do Órgão</span>
                  <UserCircle size={32} weight="fill" className="opacity-20" />
               </div>
               <div className="space-y-1">
                  <p className="font-display text-2xl font-black italic uppercase italic tracking-tighter">Campus Petrolina</p>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Unidade solicitante ativa</p>
               </div>
            </div>
            <button className="w-full mt-8 flex items-center justify-center gap-2 py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
               Trocar Unidade Lotação
            </button>
         </div>

      </div>

      {/* Histórico Legado Real */}
      <div className="pt-10 space-y-6">
         <div className="flex items-center gap-4">
            <div className="w-2 h-8 bg-[#1A237E] rounded-full"></div>
            <h3 className="font-display text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Seu Histórico PERCATA (Legado 2025)</h3>
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loading ? [1, 2].map(i => <Skeleton key={i} className="h-32 rounded-[32px]" />) : 
             stats.legacyDfds.map(h => (
               <motion.div 
                 key={h.id} 
                 whileTap={{ scale: 0.98 }}
                 whileHover={{ y: -5 }}
                 className="bg-white p-6 rounded-[32px] border border-slate-200 border-dashed hover:border-solid hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
               >
                  <div className="flex justify-between items-start">
                     <div className="space-y-1">
                        <p className="text-[10px] font-mono font-black text-slate-300 uppercase tracking-widest">{h.id.slice(0,13)}</p>
                        <h4 className="font-black text-slate-700 uppercase tracking-tight text-sm leading-tight max-w-[250px]">{h.objeto}</h4>
                        <p className="text-[10px] font-bold text-slate-400">{new Date(h.created_at).toLocaleDateString('pt-BR')}</p>
                     </div>
                     <div className="text-right space-y-2">
                        <span className="inline-block px-3 py-1 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-red-200">
                           {h.status_final || 'FINALIZADO'}
                        </span>
                        <p className="text-lg font-display font-black text-slate-400 italic">R$ {Number(h.valor_total || 0).toLocaleString('pt-BR')}</p>
                     </div>
                  </div>
               </div>
            ))}
            {!loading && stats.legacyDfds.length === 0 && (
               <div className="col-span-2 py-20 text-center opacity-20 border-2 border-dashed border-slate-200 rounded-[48px]">
                  <p className="font-black uppercase tracking-[0.3em]">Nenhum registro legado encontrado</p>
               </div>
            )}
         </div>
      </div>
    </div>
  )
}

