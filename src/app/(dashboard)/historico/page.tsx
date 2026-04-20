'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ClockCounterClockwise, 
  Funnel, 
  MagnifyingGlass, 
  CaretRight,
  Calendar,
  CurrencyCircleDollar,
  ListNumbers,
  ArrowUUpLeft,
  Files,
  Info
} from '@phosphor-icons/react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const YEARS = [2026, 2025, 2024]

const MOCK_HISTORICO = [
  {
    id: 'HIST-2026-042',
    ano: 2026,
    objeto: 'Aquisição de Material de Consumo para Laboratórios de Saúde',
    campus: 'Petrolina',
    valor: 45600.00,
    itens: 15,
    status: 'Finalizada/PCA'
  },
  {
    id: 'HIST-2025-115',
    ano: 2025,
    objeto: 'Contratação de Empresa para Manutenção de Ar-Condicionados',
    campus: 'Petrolina',
    valor: 12000.00,
    itens: 1,
    status: 'Concluída'
  },
  {
    id: 'HIST-2024-089',
    ano: 2024,
    objeto: 'Renovação de Cadeiras das Salas de Aula - Bloco A',
    campus: 'Ouricuri',
    valor: 89300.50,
    itens: 120,
    status: 'Concluída'
  }
]

export default function HistoricoPage() {
  const [selectedYear, setSelectedYear] = useState<number | 'todos'>('todos')
  const [search, setSearch] = useState('')

  const filteredData = MOCK_HISTORICO.filter(item => {
    const matchesYear = selectedYear === 'todos' || item.ano === selectedYear
    const matchesSearch = item.objeto.toLowerCase().includes(search.toLowerCase()) || item.id.toLowerCase().includes(search.toLowerCase())
    return matchesYear && matchesSearch
  })

  return (
    <div className="p-8 space-y-10 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="font-display text-4xl font-black text-[#1C1B1F] tracking-tighter italic uppercase">Histórico de Demandas</h1>
          <p className="text-[#625B71] text-sm font-medium flex items-center gap-2">
            <ClockCounterClockwise size={18} weight="bold" className="text-[#4F378B]" />
            Consulte o planejamento de anos anteriores (PCA 2024-2026)
          </p>
        </div>
      </div>

      {/* Toolbar de Controle */}
      <div className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm space-y-6">
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setSelectedYear('todos')}
            className={cn(
              "px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
              selectedYear === 'todos' ? "bg-[#1C1B1F] text-white shadow-lg" : "bg-[#F3EDF7] text-[#4F378B] hover:bg-[#EADDFF]"
            )}
          >
            Todos os Anos
          </button>
          {YEARS.map(year => (
            <button 
              key={year}
              onClick={() => setSelectedYear(year)}
              className={cn(
                "px-8 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
                selectedYear === year ? "bg-[#4F378B] text-white shadow-lg" : "bg-white border border-black/5 text-[#625B71] hover:border-[#4F378B]"
              )}
            >
              {year}
            </button>
          ))}
        </div>

        <div className="relative group">
          <MagnifyingGlass className="absolute left-5 top-1/2 -translate-y-1/2 text-[#4F378B]/40 group-focus-within:text-[#4F378B] transition-colors" size={22} weight="bold" />
          <input 
            type="text" 
            placeholder="Pesquise por objeto, campus ou código da DFD antiga..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-14 pr-6 py-4 rounded-2xl bg-[#F8F9FA] border-none focus:ring-2 focus:ring-[#EADDFF] transition-all font-medium"
          />
        </div>
      </div>

      {/* Lista de Itens do Histórico */}
      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredData.map((item, idx) => (
            <motion.div
              layout
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="group bg-white border border-black/5 rounded-[32px] p-8 flex flex-col md:flex-row gap-8 hover:shadow-xl hover:border-[#4F378B]/20 transition-all relative overflow-hidden"
            >
              {/* Badge de Ano - Estilo Pasta de Arquivo */}
              <div className="flex flex-col items-center justify-center bg-[#F3EDF7] w-24 h-24 rounded-2xl shrink-0 group-hover:bg-[#4F378B] transition-colors duration-500">
                <span className="text-[10px] font-black uppercase text-[#4F378B] group-hover:text-white/60 tracking-widest leading-none mb-1">ANO</span>
                <span className="text-2xl font-display font-black text-[#4F378B] group-hover:text-white leading-none">{item.ano}</span>
              </div>

              <div className="flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-mono text-xs font-bold text-[#4F378B]/40">{item.id}</span>
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                    <Calendar size={14} weight="bold" />
                    {item.status}
                  </div>
                </div>

                <h3 className="font-display font-black text-xl text-[#1C1B1F] tracking-tight leading-tight">
                  {item.objeto}
                </h3>

                <div className="flex flex-wrap gap-8 pt-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-black text-black/30 tracking-tighter flex items-center gap-1">
                      <CurrencyCircleDollar size={14} /> Valor Estimado
                    </span>
                    <span className="text-lg font-black text-[#1C1B1F]">
                      {item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-black text-black/30 tracking-tighter flex items-center gap-1">
                      <ListNumbers size={14} /> Qtd. Itens
                    </span>
                    <span className="text-lg font-black text-[#1C1B1F]">{item.itens}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-black text-black/30 tracking-tighter flex items-center gap-1">
                      <Info size={14} /> Campus
                    </span>
                    <span className="text-lg font-black text-[#1C1B1F]">{item.campus}</span>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex md:flex-col justify-end gap-3 pt-6 md:pt-0 border-t md:border-t-0 md:border-l border-black/5 md:pl-8">
                <button className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-[#F8F9FA] text-[#1C1B1F] rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#EADDFF] transition-all">
                  <Files size={20} weight="bold" />
                  Ver Itens
                </button>
                <button className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-[#1C1B1F] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#4F378B] shadow-lg shadow-black/10 transition-all">
                  <ArrowUUpLeft size={20} weight="bold" />
                  Repetir em 2027
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredData.length === 0 && (
          <div className="py-20 text-center">
            <h3 className="font-display font-black text-xl text-black/20 uppercase tracking-[0.2em]">Nenhum registro antigo encontrado</h3>
          </div>
        )}
      </div>

      {/* Nota de Compliance */}
      <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex gap-4 items-start">
        <Info size={24} weight="fill" className="text-amber-600 shrink-0" />
        <p className="text-xs font-medium text-amber-800 leading-relaxed uppercase tracking-tight">
          Os dados exibidos nesta tela foram migrados do sistema antigo e servem como **Referência de Planejamento**. Códigos de itens e regras de fiscalização podem ter sofrido alterações para o exercício de 2027 de acordo com a Lei 14.133.
        </p>
      </div>
    </div>
  )
}
