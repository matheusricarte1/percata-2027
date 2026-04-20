'use client'

import React, { useState } from 'react'
import { 
  ChartBar, 
  Users, 
  FileText, 
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle,
  Warning,
  Coins,
  Buildings,
  ChartPieSlice,
  Gear,
  Funnel,
  DownloadSimple
} from '@phosphor-icons/react'
import { Switch } from '@/components/ui/switch'

export default function AdminDashboardPage() {
  const [isSafraOpen, setIsSafraOpen] = useState(true)

  return (
    <div className="p-8 space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h1 className="font-display text-4xl font-extrabold text-[#1A237E] tracking-tight">
            Dashboard Estratégico
          </h1>
          <p className="text-[#3F51B5] font-medium opacity-80">
            Visão consolidada do planejamento orçamentário e volume de demandas 2027.
          </p>
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#3F51B5]/20 text-[#3F51B5] font-bold hover:bg-[#3F51B5]/5 transition-all">
            <DownloadSimple size={20} weight="bold" />
            Relatório e-Fisco
          </button>
          <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1A237E] text-white font-bold shadow-lg shadow-[#1A237E]/20 hover:scale-[1.02] active:scale-95 transition-all">
            <Gear size={20} weight="fill" />
            Configurar PCA
          </button>
        </div>
      </div>

      {/* Control Banner */}
      <div className={`glass-card p-6 border-l-8 transition-colors ${
        isSafraOpen ? 'border-emerald-500 bg-emerald-50/20' : 'border-red-500 bg-red-50/20'
      }`}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              isSafraOpen ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
            }`}>
               {isSafraOpen ? <Clock size={32} weight="fill" /> : <Warning size={32} weight="fill" />}
            </div>
            <div className="space-y-1">
               <h3 className="font-display font-bold text-[#1A237E]">Janela de Solicitação: {isSafraOpen ? 'ABERTA' : 'FECHADA'}</h3>
               <p className="text-sm text-black/50 max-w-xl leading-snug">
                 {isSafraOpen 
                   ? 'O período de criação e submissão de DFDs está ativo para todos os campi e departamentos.' 
                   : 'O período está encerrado. Novos pedidos não podem ser criados, apenas triados e consolidados.'}
               </p>
            </div>
          </div>
          <div className="flex items-center gap-4 px-6 py-3 bg-white rounded-2xl border border-black/5 shadow-sm">
             <span className="text-[10px] font-black text-black/40 uppercase tracking-widest">Alterar Status</span>
             <Switch checked={isSafraOpen} onCheckedChange={setIsSafraOpen} />
          </div>
        </div>
      </div>

      {/* Core Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard icon={Coins} label="Investimento Total" value="R$ 1.2M" sub="+12.5% vs 2025" color="purple" />
        <MetricCard icon={FileText} label="Total de DFDs" value="342" sub="68% triadas" color="blue" />
        <MetricCard icon={Buildings} label="Unidades Ativas" value="22" sub="87% participação" color="indigo" />
        <MetricCard icon={CheckCircle} label="Eficiência Geral" value="94%" sub="Pactuação em dia" color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart View Placeholder */}
        <div className="glass-card p-8 space-y-6">
           <div className="flex justify-between items-center">
              <div>
                 <h3 className="font-display text-xl font-bold text-[#1A237E]">Distribuição por GND</h3>
                 <p className="text-xs text-black/40">Gasto planejado por Grupo de Natureza de Despesa</p>
              </div>
              <button className="p-2.5 rounded-xl bg-black/5 hover:bg-black/10 transition-all text-black/40">
                 <ChartPieSlice size={20} weight="fill" />
              </button>
           </div>
           
           <div className="space-y-6">
              <GNDBar label="3.3.90.30 - Material de Consumo" value="R$ 580.4k" percent={48} color="bg-indigo-600" />
              <GNDBar label="4.4.90.52 - Equipamentos Perm." value="R$ 320.1k" percent={27} color="bg-[#3F51B5]" />
              <GNDBar label="3.3.90.39 - Serv. Terceiros PJ" value="R$ 180.5k" percent={15} color="bg-amber-500" />
              <GNDBar label="3.3.90.36 - Serv. Terceiros PF" value="R$ 85.2k" percent={7} color="bg-purple-500" />
           </div>
        </div>

        {/* Recent Activity / Units */}
        <div className="glass-card overflow-hidden">
           <div className="p-6 border-b border-black/5 flex justify-between items-center bg-white/50">
              <h3 className="font-display font-bold text-[#1A237E]">Ranking de Demandas por Campus</h3>
              <button className="text-[10px] font-black text-[#3F51B5] uppercase hover:underline">Ver Todos</button>
           </div>
           <div className="divide-y divide-black/5">
              <UnitRow campus="Lab. Química - Petrolina" dfds={42} valor="R$ 210.000" status="90%" />
              <UnitRow campus="Secretaria - Ouricuri" dfds={28} valor="R$ 45.000" status="75%" />
              <UnitRow campus="Enfermagem - Petrolina" dfds={24} valor="R$ 132.000" status="40%" />
              <UnitRow campus="Biblioteca - Petrolina" dfds={12} valor="R$ 8.000" status="100%" />
           </div>
           <div className="p-6 bg-[#E8EAF6]/30 text-center">
              <button className="text-xs font-bold text-[#1A237E] flex items-center justify-center gap-2 w-full">
                 RELATÓRIO COMPLETO POR UNIDADE
                 <ArrowRight size={16} />
              </button>
           </div>
        </div>
      </div>

    </div>
  )
}

function MetricCard({ icon: Icon, label, value, sub, color }: { icon: any, label: string, value: string, sub: string, color: string }) {
  const colors: Record<string, string> = {
    purple: 'bg-purple-100 text-purple-600',
    blue: 'bg-blue-100 text-blue-600',
    indigo: 'bg-[#1A237E]/10 text-[#1A237E]',
    emerald: 'bg-emerald-100 text-emerald-600'
  }
  return (
    <div className="glass-card p-6 flex flex-col gap-4 hover:shadow-xl hover:translate-y-[-4px] transition-all group cursor-default">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colors[color]} group-hover:scale-110 transition-transform duration-300`}>
         <Icon size={24} weight="fill" />
      </div>
      <div>
         <p className="text-[10px] font-black text-black/30 uppercase tracking-widest leading-none mb-1">{label}</p>
         <p className="font-display text-3xl font-black text-[#1A237E]">{value}</p>
         <p className="text-[10px] font-bold text-black/40 mt-1 flex items-center gap-1">
            <TrendingUp size={12} weight="bold" className="text-emerald-500" />
            {sub}
         </p>
      </div>
    </div>
  )
}

function GNDBar({ label, value, percent, color }: { label: string, value: string, percent: number, color: string }) {
  return (
    <div className="space-y-2">
       <div className="flex justify-between text-xs font-bold text-black/70">
          <span>{label}</span>
          <span>{value} <span className="text-black/30 ml-1">({percent}%)</span></span>
       </div>
       <div className="w-full h-2.5 bg-black/5 rounded-full overflow-hidden">
          <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
       </div>
    </div>
  )
}

function UnitRow({ campus, dfds, valor, status }: { campus: string, dfds: number, valor: string, status: string }) {
  return (
    <div className="px-6 py-4 flex items-center justify-between hover:bg-black/[0.02] transition-colors">
       <div className="space-y-0.5">
          <p className="font-bold text-black/80 text-sm">{campus}</p>
          <p className="text-[10px] font-bold text-black/30 uppercase tracking-tight">{dfds} DFDs • {valor}</p>
       </div>
       <div className="flex flex-col items-end gap-1 w-24">
          <span className="text-[9px] font-black text-black/40 uppercase tracking-tighter">{status} Triado</span>
          <div className="w-full h-1 bg-black/5 rounded-full overflow-hidden">
             <div className="bg-[#3F51B5] h-full" style={{ width: status }} />
          </div>
       </div>
    </div>
  )
}
