'use client'

import React from 'react'
import { 
  Funnel, 
  MagnifyingGlass, 
  CheckCircle, 
  XCircle, 
  ChatTeardropText,
  Clock,
  User,
  ArrowRight,
  WarningCircle,
  FileText
} from '@phosphor-icons/react'

const pendingAprovals = [
  { id: 'DFD-2027-012', objeto: 'Modernização de Hardware Financeiro', solicitante: 'Mariana Silva', data: '12/04/2026', valor: 'R$ 8.500,00', campus: 'Petrolina', justificativa: 'Aquisição de notebooks para equipe de auditoria interna.', prioridade: 'Alta', itens: 3 },
  { id: 'DFD-2027-015', objeto: 'Mobiliário Ergonômico Setor A', solicitante: 'Felipe Souza', data: '14/04/2026', valor: 'R$ 3.200,00', campus: 'Ouricuri', justificativa: 'Troca de cadeiras baseada em laudo de SST.', prioridade: 'Média', itens: 5 },
  { id: 'DFD-2027-018', objeto: 'Infraestrutura de Rede Lab 04', solicitante: 'Carlos Oliveira', data: '15/04/2026', valor: 'R$ 12.000,00', campus: 'Petrolina', justificativa: 'Upgrade de switches para suporte a redes 10Gbps.', prioridade: 'Alta', itens: 2 },
]

export default function ChefiaAprovacoesPage() {
  return (
    <div className="p-8 space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="font-display text-4xl font-extrabold text-[#00695C] tracking-tight">
            Aprovações Pendentes
          </h1>
          <p className="text-[#004D40] font-medium opacity-80">
            Revise e delibere sobre as DFDs enviadas pela sua equipe de departamento.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-emerald-50 px-6 py-3 rounded-2xl border border-emerald-100">
          <div className="text-right">
            <p className="text-[10px] font-black text-emerald-800/60 uppercase">Total Aguardando</p>
            <p className="font-display font-black text-2xl text-[#00695C]">{pendingAprovals.length}</p>
          </div>
          <div className="w-[1px] h-10 bg-emerald-200 mx-2" />
          <CheckCircle size={32} weight="fill" className="text-emerald-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         {/* Filters Sidebar */}
         <div className="lg:col-span-1 space-y-6">
            <div className="glass-card p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-black/40 uppercase tracking-widest px-1">Buscar Demanda</label>
                <div className="relative">
                  <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" size={18} />
                  <input 
                    type="text" 
                    placeholder="Nome do item ou ID..." 
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-black/5 border-none focus:ring-2 focus:ring-[#00695C]/20 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="space-y-4">
                 <label className="text-[10px] font-black text-black/40 uppercase tracking-widest px-1">Status de Triagem</label>
                 <div className="space-y-2">
                    <FilterItem label="Aguardando Chefe" count={4} active />
                    <FilterItem label="Em Devolutiva" count={1} />
                    <FilterItem label="Concluídos" count={12} />
                 </div>
              </div>

              <div className="pt-4 border-top border-black/5">
                 <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-black/5 text-black/60 font-bold hover:bg-black/10 transition-all">
                    <Funnel size={18} weight="bold" />
                    Mais Filtros
                 </button>
              </div>
            </div>
         </div>

         {/* Approval Cards List */}
         <div className="lg:col-span-3 space-y-4">
            {pendingAprovals.map((dfd) => (
              <div key={dfd.id} className="glass-card hover:border-[#00695C]/30 transition-all group overflow-hidden border-l-4 border-l-amber-400">
                <div className="p-6 flex flex-col md:flex-row gap-6 items-start">
                  
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <span className="font-mono text-xs font-bold text-black/30 tracking-tight">{dfd.id}</span>
                         <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            dfd.prioridade === 'Alta' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                         }`}>
                           Prioridade {dfd.prioridade}
                         </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-black/30 uppercase">
                         <Clock size={14} weight="bold" />
                         Recebido em {dfd.data}
                      </div>
                    </div>

                    <div className="space-y-1">
                       <h3 className="font-display text-xl font-bold text-[#004D40] group-hover:text-[#00695C] transition-colors">{dfd.objeto}</h3>
                       <div className="flex items-center gap-4 text-sm font-medium text-black/50">
                          <div className="flex items-center gap-1.5">
                             <User size={16} weight="fill" />
                             {dfd.solicitante}
                          </div>
                          <div className="flex items-center gap-1.5">
                             <Buildings size={16} weight="fill" />
                             Campus {dfd.campus}
                          </div>
                       </div>
                    </div>

                    <div className="p-4 rounded-xl bg-black/5 border border-black/5 text-sm text-black/70 leading-relaxed italic">
                       "{dfd.justificativa}"
                    </div>
                  </div>

                  <div className="w-full md:w-64 space-y-4 pt-1">
                    <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                       <p className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1">Estimativa de Preço</p>
                       <p className="font-display text-2xl font-black text-[#00695C]">{dfd.valor}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                       <button className="flex items-center justify-center gap-2 py-3 rounded-xl border border-red-100 text-red-600 font-bold hover:bg-red-50 transition-all text-xs">
                          <XCircle size={18} weight="fill" />
                          Negar
                       </button>
                       <button className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00695C] text-white font-bold hover:bg-[#004D40] shadow-lg shadow-[#00695C]/20 transition-all text-xs">
                          <CheckCircle size={18} weight="fill" />
                          Aprovar
                       </button>
                    </div>

                    <button className="w-full flex items-center justify-center gap-2 py-2 text-[11px] font-bold text-[#00695C]/60 hover:text-[#00695C] transition-colors">
                       <ChatTeardropText size={16} weight="fill" />
                       Solicitar Devolutiva
                    </button>
                  </div>

                </div>
                
                {/* Footer details toggle */}
                <div className="px-6 py-3 bg-[#F5FBF9]/80 border-t border-black/5 flex justify-between items-center text-[10px] font-bold text-[#00695C]/60">
                   <div className="flex gap-4">
                      <span className="flex items-center gap-1"><FileText size={14} /> 2 Itens Adicionados</span>
                      <span className="flex items-center gap-1"><WarningCircle size={14} /> ETP Não Iniciado</span>
                   </div>
                   <button className="flex items-center gap-1 hover:text-[#00695C] transition-colors uppercase tracking-widest">
                      Ver detalhes da DFD <ArrowRight size={14} weight="bold" />
                   </button>
                </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  )
}

function FilterItem({ label, count, active }: { label: string, count: number, active?: boolean }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
      active ? 'bg-[#00695C] text-white shadow-lg' : 'hover:bg-black/5 text-black/60'
    }`}>
      <span className="text-sm font-bold">{label}</span>
      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
        active ? 'bg-white/20' : 'bg-black/5'
      }`}>
        {count}
      </span>
    </div>
  )
}
