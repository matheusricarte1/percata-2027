'use client'

import React from 'react'
import { 
  Calendar, 
  Clock, 
  Warning, 
  CheckCircle, 
  Circle,
  Plus,
  Play,
  Stop,
  Gear,
  ChartLineUp,
  FileText
} from '@phosphor-icons/react'
import { Switch } from '@/components/ui/switch'

export default function CampanhasPage() {
  return (
    <div className="p-8 space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="font-display text-4xl font-extrabold text-[#1A237E] tracking-tight">
            Campanhas & Safras
          </h1>
          <p className="text-[#3F51B5] font-medium opacity-80">
            Gerencie as janelas de solicitação para o Plano de Contratações 2027.
          </p>
        </div>

        <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1A237E] text-white font-bold shadow-lg shadow-[#1A237E]/20 hover:scale-[1.02] active:scale-95 transition-all">
          <Plus size={20} weight="bold" />
          Nova Campanha
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Active Safra Controls */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-8 border-l-8 border-[#3F51B5] relative overflow-hidden">
            <div className="absolute right-0 top-0 p-10 opacity-5 pointer-events-none">
              <Calendar size={200} weight="fill" />
            </div>
            
            <div className="flex justify-between items-start relative z-10">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
                    Campanha Ativa
                  </span>
                  <span className="text-[#3F51B5] font-mono text-sm font-bold">Ref. 2027.1</span>
                </div>
                
                <h2 className="font-display text-3xl font-black text-[#1A237E]">
                  Safra de Planejamento 2027
                </h2>
                
                <div className="flex gap-8 py-2">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-white/50 border border-black/5">
                      <Calendar size={24} className="text-[#3F51B5]" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-black/40 uppercase">Início</p>
                      <p className="font-bold text-black/70">01 Mar, 2026</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-white/50 border border-black/5">
                      <Clock size={24} className="text-[#3F51B5]" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-black/40 uppercase">Término</p>
                      <p className="font-bold text-black/70">30 Abr, 2026</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-6">
                   <div className="space-y-1">
                      <p className="text-xs font-bold text-[#1A237E]">Status da Janela</p>
                      <div className="flex items-center gap-3 p-3 bg-[#E8EAF6] rounded-2xl border border-[#3F51B5]/10">
                        <span className="font-display text-sm font-black text-[#1A237E]">RECEBENDO SOLICITAÇÕES</span>
                        <Switch defaultChecked />
                      </div>
                   </div>
                   
                   <div className="space-y-1 flex-1">
                      <div className="flex justify-between text-[10px] font-black text-black/40 uppercase">
                        <span>Progresso do Prazo</span>
                        <span>45 dias restantes</span>
                      </div>
                      <div className="w-full h-3 bg-black/5 rounded-full overflow-hidden mt-1">
                        <div className="w-[65%] h-full bg-gradient-to-r from-[#3F51B5] to-[#1A237E]" />
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ConfigCard 
              icon={Gear} 
              title="Regras de Submissão" 
              desc="Limites de valor por DFD e campos obrigatórios para justificativa técnica."
              color="indigo"
            />
            <ConfigCard 
              icon={FileText} 
              title="Templates de ETP" 
              desc="Gerenciar modelos de Estudo Técnico Preliminar anexados às demandas."
              color="blue"
            />
            <ConfigCard 
              icon={ChartLineUp} 
              title="Metas Orçamentárias" 
              desc="Definir tetos globais por centro de custo para a safra atual."
              color="amber"
            />
            <ConfigCard 
              icon={Warning} 
              title="Alertas & Prazos" 
              desc="Configurar notificações automáticas para aprovações pendentes."
              color="red"
            />
          </div>
        </div>

        {/* Sidebar: Recent Safras History */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-display text-lg font-bold text-[#1A237E] mb-6 flex items-center gap-2">
              <Calendar size={22} weight="fill" />
              Histórico de Safras
            </h3>
            
            <div className="space-y-4">
              <SafraHistoryItem year="2026" status="Concluída" budget="R$ 10.2M" items="1.542" />
              <SafraHistoryItem year="2025" status="Concluída" budget="R$ 8.5M" items="1.120" />
              <SafraHistoryItem year="2024" status="Arquivada" budget="R$ 7.8M" items="980" />
            </div>
            
            <button className="w-full mt-6 py-3 rounded-xl border border-dashed border-[#3F51B5]/30 text-[#3F51B5] text-xs font-bold hover:bg-[#3F51B5]/5 transition-all">
              Ver Relatórios Completos
            </button>
          </div>

          <div className="glass-card p-6 bg-[#1A237E] text-white">
            <h3 className="font-display text-lg font-bold mb-4">Dica de Gestor</h3>
            <p className="text-white/70 text-sm leading-relaxed mb-4">
              A abertura antecipada da safra permite uma melhor cotação de preços e reduz o número de DFDs duplicadas no final do prazo.
            </p>
            <div className="flex items-center gap-2 text-white/50 text-[10px] font-bold uppercase tracking-widest">
               <Warning size={14} weight="fill" />
               Atenção aos prazos legais
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function ConfigCard({ icon: Icon, title, desc, color }: { icon: any, title: string, desc: string, color: string }) {
  return (
    <div className="glass-card p-6 hover:shadow-xl hover:translate-y-[-2px] transition-all cursor-pointer group">
      <div className={`w-12 h-12 rounded-2xl mb-4 flex items-center justify-center transition-transform group-hover:scale-110 ${
        color === 'indigo' ? 'bg-[#1A237E]/10 text-[#1A237E]' :
        color === 'blue' ? 'bg-blue-100 text-blue-600' :
        color === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
      }`}>
        <Icon size={24} weight="fill" />
      </div>
      <h4 className="font-display font-bold text-[#1A237E] mb-1">{title}</h4>
      <p className="text-xs text-black/50 leading-relaxed">{desc}</p>
    </div>
  )
}

function SafraHistoryItem({ year, status, budget, items }: { year: string, status: string, budget: string, items: string }) {
  return (
    <div className="p-4 rounded-2xl border border-black/5 hover:bg-[#E8EAF6]/30 transition-all cursor-pointer flex justify-between items-center group">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-display font-black text-[#1A237E]">{year}</span>
          <span className="px-2 py-0.5 rounded-full bg-black/5 text-[9px] font-bold text-black/40 uppercase">{status}</span>
        </div>
        <div className="text-[10px] font-medium text-black/40">
           {items} demandas • {budget}
        </div>
      </div>
      <div className="p-2 rounded-lg text-black/20 group-hover:bg-[#1A237E] group-hover:text-white transition-all">
        <Play size={14} weight="fill" />
      </div>
    </div>
  )
}
