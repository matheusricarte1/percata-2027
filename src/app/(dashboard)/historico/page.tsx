'use client'

import React, { useState } from 'react'
import { 
  ClockCounterClockwise, 
  MagnifyingGlass, 
  Funnel, 
  ArrowRight,
  Info,
  Selection,
  Database,
  Calendar,
  CurrencyDollar,
  Tag
} from '@phosphor-icons/react'

const historicoLegado = [
  { 
    codigo: 'DFD-2025-0011', 
    data: '02/09/2025', 
    objeto: 'SSD externo 1TB para cobertura fotográfica', 
    status: 'Concluído',
    valor: 500.00,
    solucao: 'Adquirir equipamentos de armazenamento periciais.',
    campus: 'Petrolina'
  },
  { 
    codigo: 'DFD-2025-0012', 
    data: '04/09/2025', 
    objeto: 'Aquisição de expositores temáticos para o HU', 
    status: 'Aprovado',
    valor: 3500.00,
    solucao: 'Mobiliário para exposição permanente de anatomia.',
    campus: 'Petrolina'
  },
  { 
    codigo: 'DFD-2025-0042', 
    data: '15/10/2025', 
    objeto: 'Microscópio Biológico Binocular', 
    status: 'Em Pactuação',
    valor: 18500.00,
    solucao: 'Modernização do Laboratório de Histologia UPE.',
    campus: 'Petrolina'
  },
  { 
    codigo: 'DFD-2025-0089', 
    data: '22/11/2025', 
    objeto: 'Servidor de Processamento GPU', 
    status: 'Em Pactuação',
    valor: 45000.00,
    solucao: 'Recursos para o núcleo de Inteligência Artificial.',
    campus: 'Petrolina'
  }
]

export default function HistoricoPage() {
  const [search, setSearch] = useState('')

  const filteredData = historicoLegado.filter(h => 
    h.objeto.toLowerCase().includes(search.toLowerCase()) || 
    h.codigo.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8 space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="font-display text-4xl font-extrabold text-[#1C1B1F] tracking-tight">
            Base Histórica 2025
          </h1>
          <p className="text-[#625B71] font-medium opacity-80 uppercase text-[10px] tracking-[2px] font-black">
            Dados importados da planilha PERCATALICITA
          </p>
        </div>

        <div className="flex gap-3">
           <div className="bg-[#E8F0FE] border border-[#1351B4]/10 p-4 rounded-3xl flex items-center gap-4">
              <Database size={24} weight="fill" className="text-[#1351B4]" />
              <div className="text-sm">
                <p className="font-black text-[#1351B4] leading-none uppercase text-[10px]">Total Pactuado</p>
                <p className="font-display font-black text-xl text-[#1C1B1F]">R$ 67.500</p>
              </div>
           </div>
        </div>
      </div>

      {/* Info Alert */}
      <div className="p-6 rounded-[32px] bg-[#6750A4]/5 border border-[#6750A4]/10 flex gap-5 items-start">
         <div className="w-12 h-12 rounded-2xl bg-[#6750A4] text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#6750A4]/20">
            <Info size={28} weight="fill" />
         </div>
         <div className="space-y-1">
            <h4 className="font-bold text-[#6750A4]">Transparência e Sigilo</h4>
            <p className="text-sm text-[#625B71] leading-relaxed font-medium">
               Você está acessando apenas as demandas vinculadas ao seu e-mail institucional. Itens em 
               <strong className="text-[#B3261E] ml-1">"Em Pactuação"</strong> representam solicitações que já estão na fase interna de licitação e não podem ser replicadas no PCA 2027 para evitar duplicidade orçamentária.
            </p>
         </div>
      </div>

      {/* Table Container */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-black/5 flex flex-col md:flex-row gap-6 items-center justify-between bg-white/50">
           <div className="relative w-full md:w-96">
              <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" size={18} />
              <input 
                type="text" 
                placeholder="Pesquisar nos registros de 2025..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-black/5 border-none focus:ring-2 focus:ring-[#6750A4]/20 transition-all text-sm font-semibold"
              />
           </div>
           <button className="flex items-center gap-2 px-5 py-3 rounded-xl bg-black/5 text-[#625B71] font-bold text-xs hover:bg-black/10 transition-all">
              <Funnel size={18} weight="bold" />
              FILTRAR POR STATUS
           </button>
        </div>

        <div className="overflow-x-auto">
           <table className="w-full text-left">
              <thead>
                 <tr className="bg-[#FBFAFD] text-[10px] font-black uppercase tracking-widest text-[#625B71]/60">
                    <th className="px-8 py-5">Código / Data</th>
                    <th className="px-8 py-5">Objeto & Justificativa 2025</th>
                    <th className="px-8 py-5 text-right">Valor</th>
                    <th className="px-8 py-5 text-center">Status Licitatório</th>
                    <th className="px-8 py-5 text-center">Ações</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                 {filteredData.map((h) => (
                    <tr key={h.codigo} className="group hover:bg-[#F6F2F7] transition-all">
                       <td className="px-8 py-6">
                          <div className="font-mono text-xs font-bold text-[#6750A4]">{h.codigo}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-black/30 font-bold mt-1">
                             <Calendar size={12} /> {h.data}
                          </div>
                       </td>
                       <td className="px-8 py-6 max-w-md">
                          <div className="font-bold text-[#1C1B1F] group-hover:text-[#6750A4] transition-colors">{h.objeto}</div>
                          <p className="text-[10px] text-black/40 font-medium leading-relaxed mt-1">{h.solucao}</p>
                       </td>
                       <td className="px-8 py-6 text-right">
                          <div className="flex flex-col items-end">
                             <span className="font-display font-black text-[#1C1B1F]">R$ {h.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                             <span className="text-[9px] font-black text-black/20 uppercase tracking-tighter">Estimado Final</span>
                          </div>
                       </td>
                       <td className="px-8 py-6 text-center">
                          {h.status === 'Em Pactuação' ? (
                             <div className="inline-flex flex-col items-center gap-1 animate-pulse">
                                <span className="px-4 py-1.5 rounded-full bg-[#B3261E] text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                   <ClockCounterClockwise size={12} weight="bold" />
                                   EM PACTUAÇÃO
                                </span>
                             </div>
                          ) : (
                             <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                h.status === 'Aprovado' ? 'bg-emerald-100 text-emerald-800' : 'bg-black/5 text-black/40'
                             }`}>
                                {h.status}
                             </span>
                          )}
                       </td>
                       <td className="px-8 py-6 text-center">
                          <button className="p-2.5 rounded-xl hover:bg-[#EADDFF] text-[#6750A4] transition-all opacity-0 group-hover:opacity-100">
                             <ArrowRight size={20} weight="bold" />
                          </button>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>

      <div className="flex justify-center items-center gap-2 text-[10px] font-black text-black/20 uppercase tracking-[2px]">
         <Selection size={16} />
         Dados Sincronizados com Base PERCATALICITA
      </div>
    </div>
  )
}
