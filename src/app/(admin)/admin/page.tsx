'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  Files, 
  CheckCircle, 
  ChartLineUp, 
  Package, 
  Warning,
  ArrowRight,
  Bell
} from '@phosphor-icons/react'

export default function AdminDashboard() {
  return (
    <div className="p-8 space-y-8 bg-[#F8F9FA] min-h-screen">
      {/* Header Admin */}
      <div className="flex justify-between items-center bg-white p-6 rounded-[24px] shadow-sm border border-black/5">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-black text-[#1A237E] italic tracking-tighter">PAINEL PROPLAN</h1>
          <p className="text-black/50 text-sm font-medium">Gestão Estratégica do PCA 2027</p>
        </div>
        <div className="flex items-center gap-4">
           <button className="p-3 bg-red-50 text-red-600 rounded-full relative">
             <Bell size={24} weight="bold" />
             <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
           </button>
           <div className="flex flex-col items-end">
             <span className="font-bold text-[#1A237E]">Matheus Ricarte</span>
             <span className="text-[10px] font-black uppercase text-red-600 tracking-widest bg-red-50 px-2 rounded-full">Administrador</span>
           </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard icon={Files} label="Total de DFDs" value="1.248" color="blue" />
        <StatCard icon={Warning} label="Pendentes PROPLAN" value="156" color="amber" />
        <StatCard icon={CheckCircle} label="Consolidadas" value="842" color="emerald" />
        <StatCard icon={Users} label="Usuários Ativos" value="482" color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Triagem Urgente */}
        <div className="lg:col-span-2 bg-white rounded-[32px] p-8 border border-black/5 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="font-display font-black text-xl text-[#1A237E] uppercase tracking-tight">Triagem Urgente</h2>
            <button className="text-xs font-black uppercase tracking-widest text-[#1A237E] hover:underline flex items-center gap-2">
              Ver Todas <ArrowRight weight="bold" />
            </button>
          </div>

          <div className="space-y-4">
            {[
              { id: 'DFD-2027-001', objeto: 'Aquisição de Ar Condicionados (Campus Salgueiro)', data: 'há 2 horas', status: 'Aguarda PROPLAN' },
              { id: 'DFD-2027-024', objeto: 'Serviço de Nuvem AWS (Núcleo de TI)', data: 'há 4 horas', status: 'Aguarda PROPLAN' },
              { id: 'DFD-2027-035', objeto: 'Materiais de Limpeza (Campus Garanhuns)', data: 'há 6 horas', status: 'Aguarda PROPLAN' }
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-[#F8F9FA] rounded-2xl hover:bg-[#E8EAF6] transition-all cursor-pointer border border-transparent hover:border-[#1A237E]/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-[#1A237E] shadow-sm">
                    <Files size={24} weight="bold" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-[#1A237E]/40">{item.id}</span>
                    <h3 className="font-bold text-sm text-[#1C1B1F] line-clamp-1">{item.objeto}</h3>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] font-bold text-black/30 mb-1">{item.data}</span>
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest">{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Atividade Recente */}
        <div className="bg-white rounded-[32px] p-8 border border-black/5 shadow-sm space-y-6">
          <h2 className="font-display font-black text-xl text-[#1A237E] uppercase tracking-tight text-center">Controle de PCA</h2>
          <div className="space-y-6">
             <div className="p-6 bg-[#1A237E] rounded-[24px] text-white space-y-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Fase Atual</span>
                <h3 className="text-2xl font-black italic">Consolidação</h3>
                <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                   <div className="bg-white h-full w-[65%]" />
                </div>
                <div className="flex justify-between text-[10px] font-black opacity-60">
                   <span>INÍCIO: JAN</span>
                   <span>FIM: MAIO</span>
                </div>
             </div>

             <div className="flex flex-col gap-3">
               <AdminActionBtn icon={ChartLineUp} label="Relatório Comparativo" color="blue" />
               <AdminActionBtn icon={Package} label="Normalizar Catálogo" color="purple" />
               <AdminActionBtn icon={Users} label="Gestão de Delegados" color="emerald" />
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    purple: 'bg-purple-50 text-purple-700'
  }
  return (
    <div className="bg-white p-6 rounded-[28px] border border-black/5 shadow-sm flex items-center gap-4">
      <div className={`w-14 h-14 ${colors[color]} rounded-2xl flex items-center justify-center shrink-0 shadow-sm`}>
        <Icon size={28} weight="fill" />
      </div>
      <div>
        <span className="text-[10px] font-black uppercase text-black/30 tracking-widest">{label}</span>
        <h4 className="text-2xl font-black text-[#1C1B1F] tracking-tighter leading-none">{value}</h4>
      </div>
    </div>
  )
}

function AdminActionBtn({ icon: Icon, label, color }: any) {
  return (
    <button className="flex items-center justify-between w-full p-4 bg-[#F8F9FA] rounded-2xl group hover:bg-[#1A237E] transition-all duration-300">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg group-hover:bg-white/10 group-hover:text-white transition-colors">
          <Icon size={20} weight="bold" />
        </div>
        <span className="text-xs font-black uppercase text-[#1C1B1F]/60 group-hover:text-white tracking-widest transition-colors">{label}</span>
      </div>
      <ArrowRight weight="bold" className="text-[#1A237E] group-hover:text-white transition-colors" />
    </button>
  )
}
