'use client'

import React from 'react'
import { 
  MagnifyingGlass, 
  Funnel, 
  DownloadSimple, 
  CheckCircle, 
  XCircle,
  Eye,
  DotsThreeOutlineVertical,
  ChartPieSlice,
  Money,
  ArrowsClockwise
} from '@phosphor-icons/react'

const consolidationData = [
  { id: 'CON-001', item: 'Licenças Microsoft 365 Business', solicitantes: 12, quantidade: 48, valor: 'R$ 72.000,00', status: 'Em Análise', prioridade: 'Crítica' },
  { id: 'CON-002', item: 'Papel A4 - 500 folhas (Resma)', solicitantes: 45, quantidade: 1200, valor: 'R$ 38.400,00', status: 'Consolidado', prioridade: 'Alta' },
  { id: 'CON-003', item: 'Cadeiras Ergonômicas NR-17', solicitantes: 8, quantidade: 32, valor: 'R$ 28.800,00', status: 'Em Análise', prioridade: 'Média' },
  { id: 'CON-004', item: 'Notebooks i7 16GB RAM', solicitantes: 5, quantidade: 15, valor: 'R$ 105.000,00', status: 'Aguardando Cotação', prioridade: 'Crítica' },
  { id: 'CON-005', item: 'Serviço de Nuvem (Lote 01)', solicitantes: 1, quantidade: 12, valor: 'R$ 540.000,00', status: 'Em Pactuação', prioridade: 'Crítica' },
]

export default function PCAPlanningPage() {
  return (
    <div className="p-8 space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="font-display text-4xl font-extrabold text-[#1A237E] tracking-tight">
            Planejamento PCA 2027
          </h1>
          <p className="text-[#3F51B5] font-medium opacity-80">
            Consolidação de demandas e fechamento do Plano de Contratações Anual.
          </p>
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#3F51B5]/20 text-[#3F51B5] font-bold hover:bg-[#3F51B5]/5 transition-all">
            <DownloadSimple size={20} weight="bold" />
            Exportar PCA
          </button>
          <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1A237E] text-white font-bold shadow-lg shadow-[#1A237E]/20 hover:scale-[1.02] active:scale-95 transition-all">
            <CheckCircle size={20} weight="fill" />
            Publicar PCA Final
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard icon={Money} label="Orçamento Total" value="R$ 12.4M" color="indigo" />
        <MetricCard icon={ChartPieSlice} label="Demandas Consolidadas" value="1.242" color="blue" />
        <MetricCard icon={ArrowsClockwise} label="Em Análise" value="184" color="amber" />
        <MetricCard icon={CheckCircle} label="Pactuados" value="85%" color="emerald" />
      </div>

      {/* Consolidation Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-black/5 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <h2 className="font-display text-xl font-bold text-[#1A237E]">Itens Consolidados</h2>
            <span className="px-3 py-1 rounded-full bg-[#E8EAF6] text-[#1A237E] text-xs font-bold uppercase tracking-wider">
              {consolidationData.length} Itens
            </span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por item ou código..." 
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-black/5 border-none focus:ring-2 focus:ring-[#1A237E]/20 transition-all text-sm font-medium"
              />
            </div>
            <button className="p-2.5 rounded-xl bg-black/5 hover:bg-black/10 transition-all">
              <Funnel size={20} weight="bold" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#E8EAF6]/30 text-left">
                <th className="px-6 py-4 font-display text-xs font-bold uppercase tracking-widest text-[#1A237E]/60 text-center">ID</th>
                <th className="px-6 py-4 font-display text-xs font-bold uppercase tracking-widest text-[#1A237E]/60">Item / Descrição</th>
                <th className="px-6 py-4 font-display text-xs font-bold uppercase tracking-widest text-[#1A237E]/60 text-center">Solicitantes</th>
                <th className="px-6 py-4 font-display text-xs font-bold uppercase tracking-widest text-[#1A237E]/60 text-center">Qtde Total</th>
                <th className="px-6 py-4 font-display text-xs font-bold uppercase tracking-widest text-[#1A237E]/60 text-right">Estimativa</th>
                <th className="px-6 py-4 font-display text-xs font-bold uppercase tracking-widest text-[#1A237E]/60 text-center">Prioridade</th>
                <th className="px-6 py-4 font-display text-xs font-bold uppercase tracking-widest text-[#1A237E]/60 text-center">Status</th>
                <th className="px-6 py-4 font-display text-xs font-bold uppercase tracking-widest text-[#1A237E]/60 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {consolidationData.map((row) => (
                <tr key={row.id} className="hover:bg-[#E8EAF6]/20 transition-colors group">
                  <td className="px-6 py-5 text-center font-mono text-xs font-bold text-black/40">{row.id}</td>
                  <td className="px-6 py-5">
                    <div className="font-bold text-[#1A237E]">{row.item}</div>
                    <div className="text-[11px] text-black/40 font-medium tracking-tight">Código SIAD: 28392-1</div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="inline-flex -space-x-2">
                       {[...Array(3)].map((_, i) => (
                         <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-[#3F51B5] text-[8px] flex items-center justify-center font-bold text-white uppercase">US</div>
                       ))}
                       {row.solicitantes > 3 && (
                         <div className="w-6 h-6 rounded-full border-2 border-white bg-[#E8EAF6] text-[8px] flex items-center justify-center font-bold text-[#1A237E]">+{row.solicitantes - 3}</div>
                       )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center font-bold text-black/70">{row.quantidade} un</td>
                  <td className="px-6 py-5 text-right font-display font-bold text-[#1A237E]">{row.valor}</td>
                  <td className="px-6 py-5 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                      row.prioridade === 'Crítica' ? 'bg-red-100 text-red-700' : 
                      row.prioridade === 'Alta' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {row.prioridade}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="px-3 py-1 rounded-full bg-black/5 text-black/60 text-[10px] font-bold">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 rounded-lg bg-black/5 hover:bg-[#3F51B5] hover:text-white transition-all shadow-sm">
                        <Eye size={18} />
                      </button>
                      <button className="p-2 rounded-lg bg-black/5 hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                        <CheckCircle size={18} />
                      </button>
                      <button className="p-2 rounded-lg bg-black/5 hover:bg-red-600 hover:text-white transition-all shadow-sm">
                        <XCircle size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-[#1A237E]/10 text-[#1A237E]',
    blue: 'bg-[#3F51B5]/10 text-[#3F51B5]',
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700'
  }

  return (
    <div className="glass-card p-6 flex items-start justify-between group hover:translate-y-[-4px] transition-all cursor-default">
      <div className="space-y-4">
        <div className={`p-3 rounded-2xl ${colors[color] || colors.indigo} transition-colors group-hover:scale-110 duration-300`}>
          <Icon size={24} weight="fill" />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-black/40">{label}</p>
          <p className="font-display text-2xl font-black text-black/80">{value}</p>
        </div>
      </div>
      <div className="w-12 h-12 rounded-full border border-black/5 flex items-center justify-center opacity-40">
         <DotsThreeOutlineVertical size={16} weight="fill" />
      </div>
    </div>
  )
}
