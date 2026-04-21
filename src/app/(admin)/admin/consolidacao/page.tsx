'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  FileSpreadsheet, 
  Funnel, 
  ChartPieSlice, 
  Buildings,
  ListNumbers,
  Star,
  CheckCircle,
  Hash,
  Download
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function ConsolidationPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterHighlight, setFilterHighlight] = useState(false)

  const fetchConsolidatedItems = async () => {
    setLoading(true)
    try {
      // Busca todos os itens de DFDs que já foram aprovadas
      const { data, error } = await supabase
        .from('dfd_items')
        .select(`
          *,
          dfds!inner(id, objeto_contratacao, status, campi(sigla), profiles(full_name))
        `)
        .eq('dfds.status', 'aprovada')
      
      if (error) throw error

      // Agrupamento por SIAD para consolidar quantidades
      const consolidated: { [key: string]: any } = {}
      data?.forEach(item => {
        const key = item.codigo_tce
        if (!consolidated[key]) {
          consolidated[key] = {
            siad: key,
            descricao: item.descricao,
            quantidade_total: 0,
            valor_total: 0,
            pedidos: [],
            is_highlight: false
          }
        }
        consolidated[key].quantidade_total += item.quantidade
        consolidated[key].valor_total += (item.quantidade * item.valor_unitario_estimado)
        consolidated[key].pedidos.push(item.dfds.campi.sigla)
        if (item.is_highlight_item) consolidated[key].is_highlight = true
      })

      setItems(Object.values(consolidated))
    } catch (e: any) {
      toast.error('Erro ao consolidar: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConsolidatedItems()
  }, [])

  const exportCSV = () => {
    const headers = ['SIAD', 'Descrição', 'Quantidade Total', 'Valor Total Estimado', 'Unidades Solicitantes', 'Destaque Pareto']
    const rows = items.map(i => [
      i.siad,
      i.descricao,
      i.quantidade_total,
      i.valor_total.toFixed(2),
      [...new Set(i.pedidos)].join(', '),
      i.is_highlight ? 'SIM' : 'NÃO'
    ])

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `consolidacao_percata_2027_${new Date().toLocaleDateString()}.csv`)
    document.body.appendChild(link)
    link.click()
    toast.success('Arquivo CSV gerado com sucesso!')
  }

  const filteredItems = filterHighlight ? items.filter(i => i.is_highlight) : items
  const totalValue = filteredItems.reduce((acc, i) => acc + i.valor_total, 0)

  return (
    <div className="p-8 space-y-10 bg-slate-50 min-h-screen">
      {/* Header Admin */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-[#1A237E] p-10 rounded-[48px] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-bl-full pointer-events-none" />
        
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center text-3xl shadow-inner">
            <FileSpreadsheet weight="fill" />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-4xl font-black italic tracking-tighter uppercase">Consolidação PCA</h1>
            <p className="text-white/40 text-xs font-black uppercase tracking-[0.3em]">Gestão Centralizada de Demandas Homologadas</p>
          </div>
        </div>

        <div className="flex gap-4 relative z-10">
           <div className="bg-white/10 px-8 py-4 rounded-3xl backdrop-blur-md border border-white/5">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40 block mb-1">Montante Consolidado</span>
              <span className="text-3xl font-black tracking-tighter">R$ {totalValue.toLocaleString('pt-BR')}</span>
           </div>
           <Button onClick={exportCSV} className="h-full px-8 rounded-3xl bg-white text-[#1A237E] font-black uppercase tracking-tight hover:scale-105 transition-all shadow-xl">
              <Download size={22} weight="bold" className="mr-2" /> Exportar Planilha
           </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-full border border-slate-200 px-8">
         <div className="flex items-center gap-8">
            <button 
              onClick={() => setFilterHighlight(false)}
              className={`text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-full transition-all ${!filterHighlight ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900'}`}
            >
               Tudo ({items.length})
            </button>
            <button 
              onClick={() => setFilterHighlight(true)}
              className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-full transition-all ${filterHighlight ? 'bg-amber-400 text-white shadow-lg' : 'text-slate-400 hover:text-amber-500'}`}
            >
               <Star weight="fill" size={14} /> Somente Destaques ({items.filter(i => i.is_highlight).length})
            </button>
         </div>

         <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mr-2">Ciclo: PCA 2027</span>
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-600 uppercase">Em Aberto</span>
         </div>
      </div>

      {/* Tabela de Consolidação */}
      <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm">
         <table className="w-full text-sm border-collapse">
            <thead>
               <tr className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                  <th className="p-6 text-left border-b">SIAD</th>
                  <th className="p-6 text-left border-b w-1/3">Descrição Consolidada</th>
                  <th className="p-6 text-center border-b">Qtd Total</th>
                  <th className="p-6 text-right border-b">Consumo Estimado</th>
                  <th className="p-6 text-center border-b">Unidades</th>
                  <th className="p-6 text-right border-b">Status</th>
               </tr>
            </thead>
            <tbody>
               {filteredItems.map((item, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={item.siad} 
                    className="group hover:bg-slate-50 transition-colors"
                  >
                     <td className="p-6 border-b font-mono font-black text-[#1A237E] opacity-60">#{item.siad}</td>
                     <td className="p-6 border-b">
                        <div className="space-y-1">
                           <p className="font-bold text-slate-800 leading-tight group-hover:text-[#1A237E] transition-colors">{item.descricao}</p>
                           {item.is_highlight && (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-0.5 rounded-sm uppercase tracking-widest">
                                 <Star weight="fill" size={10} /> Destaque Estratégico
                              </span>
                           )}
                        </div>
                     </td>
                     <td className="p-6 border-b text-center">
                        <div className="bg-slate-100 px-3 py-1 rounded-xl inline-block font-black text-slate-600">
                           {item.quantidade_total}
                        </div>
                     </td>
                     <td className="p-6 border-b text-right font-black text-slate-900">
                        R$ {item.valor_total.toLocaleString('pt-BR')}
                     </td>
                     <td className="p-6 border-b text-center">
                        <div className="flex justify-center -space-x-2">
                           {[...new Set(item.pedidos)].map((sigla, sIdx) => (
                              <div key={sIdx} className="w-8 h-8 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-[8px] font-black text-white uppercase shadow-sm">
                                 {sigla}
                              </div>
                           ))}
                        </div>
                     </td>
                     <td className="p-6 border-b text-right">
                        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100">
                           <CheckCircle weight="fill" /> Homologado
                        </div>
                     </td>
                  </motion.tr>
               ))}
            </tbody>
         </table>
         
         {filteredItems.length === 0 && (
            <div className="py-20 text-center space-y-4 opacity-30">
               <ListNumbers size={64} weight="thin" className="mx-auto" />
               <p className="font-display font-black text-xl uppercase tracking-widest">Aguardando Aprovações</p>
               <p className="text-sm font-medium">Os itens aparecerão aqui à medida que as chefias homologarem as DFDs.</p>
            </div>
         )}
      </div>
    </div>
  )
}
