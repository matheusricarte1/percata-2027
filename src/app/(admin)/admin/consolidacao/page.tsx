'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileSpreadsheet, 
  Funnel, 
  ChartPieSlice, 
  Buildings,
  ListNumbers,
  Star,
  CheckCircle,
  Hash,
  Download,
  TrendUp
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export default function ConsolidationPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterHighlight, setFilterHighlight] = useState(false)

  const fetchConsolidatedItems = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('dfd_items')
        .select(`
          *,
          dfds!inner(id, objeto_contratacao, status, campi(sigla), profiles(full_name))
        `)
        .eq('dfds.status', 'aprovada')
      
      if (error) throw error

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
    <div className="p-8 space-y-12 bg-[#FBFBFF] min-h-screen pb-40">
      {/* Dynamic Header Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-[#1A237E] p-10 rounded-[48px] text-white shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[320px]"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-white/10 to-transparent rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-[32px] flex items-center justify-center text-4xl shadow-inner border border-white/10 ring-8 ring-white/5">
              <FileSpreadsheet weight="duotone" />
            </div>
            <div className="space-y-1">
              <h1 className="font-display text-5xl font-black italic tracking-tighter uppercase leading-none">Consolidação</h1>
              <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.4em] ml-1">Painel Estratégico PCA 2027</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 relative z-10 items-end justify-between">
             <div className="space-y-4">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Dados Sincronizados</span>
                </div>
                <div className="flex gap-2">
                   <Button onClick={fetchConsolidatedItems} variant="ghost" className="bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl normal-case italic font-bold">
                      Atualizar Base
                   </Button>
                </div>
             </div>
             
             <Button onClick={exportCSV} className="rounded-full px-10 h-16 bg-white text-[#1A237E] font-black uppercase tracking-tight shadow-2xl shadow-indigo-900 group">
                <Download size={24} weight="bold" className="mr-2 group-hover:bounce" /> Exportar Dados
             </Button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-10 rounded-[48px] border border-black/5 shadow-xl flex flex-col justify-between"
        >
           <div className="space-y-2">
              <div className="flex items-center justify-between">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Budget Consolidado</span>
                 <TrendUp size={20} className="text-emerald-500" />
              </div>
              <h2 className="text-5xl font-display font-black text-[#1A237E] tracking-tighter">
                 R$ {totalValue.toLocaleString('pt-BR')}
              </h2>
           </div>

           <div className="space-y-6">
              <div className="h-[2px] bg-slate-50 w-full" />
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Total de Itens</p>
                    <p className="text-2xl font-black text-slate-800 italic">{items.length}</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Destaques</p>
                    <p className="text-2xl font-black text-amber-500 italic">{items.filter(i => i.is_highlight).length}</p>
                 </div>
              </div>
           </div>
        </motion.div>
      </div>

      {/* Modern Filter Toolbar */}
      <div className="flex justify-between items-center px-4">
         <div className="flex bg-white/50 backdrop-blur-md p-1.5 rounded-full border border-black/5 shadow-sm">
            <button 
              onClick={() => setFilterHighlight(false)}
              className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${!filterHighlight ? 'bg-[#1A237E] text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-800'}`}
            >
               Geral
            </button>
            <button 
              onClick={() => setFilterHighlight(true)}
              className={`flex items-center gap-2 px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${filterHighlight ? 'bg-amber-400 text-white shadow-lg shadow-amber-100' : 'text-slate-400 hover:text-amber-500'}`}
            >
               <Star weight="fill" size={14} /> Pareto Vips
            </button>
         </div>

         <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">
               <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
               <span className="text-[9px] font-black text-emerald-700 uppercase tracking-tighter">Ciclo Ativo: 2027</span>
            </div>
         </div>
      </div>

      {/* Professional Data Grid */}
      <div className="bg-white rounded-[60px] border border-black/5 shadow-2xl overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
               <thead>
                  <tr className="bg-slate-50/50 text-slate-400 uppercase text-[9px] font-black tracking-widest">
                     <th className="p-8 text-left border-b border-slate-50">Protocolo SIAD</th>
                     <th className="p-8 text-left border-b border-slate-50 w-1/3">Descrição do Item</th>
                     <th className="p-8 text-center border-b border-slate-50">Qtd Consolidada</th>
                     <th className="p-8 text-right border-b border-slate-50">Ticket Médio</th>
                     <th className="p-8 text-center border-b border-slate-50">Localidades</th>
                     <th className="p-8 text-right border-b border-slate-50">Status</th>
                  </tr>
               </thead>
               <tbody>
                  <AnimatePresence mode="popLayout">
                     {loading ? (
                        [...Array(5)].map((_, i) => (
                           <tr key={i}>
                              <td colSpan={6} className="p-4"><Skeleton className="h-20 w-full rounded-3xl" /></td>
                           </tr>
                        ))
                     ) : (
                        filteredItems.map((item, idx) => (
                           <motion.tr 
                             layout
                             initial={{ opacity: 0, scale: 0.98 }}
                             animate={{ opacity: 1, scale: 1 }}
                             exit={{ opacity: 0, scale: 0.95 }}
                             transition={{ duration: 0.2 }}
                             key={item.siad} 
                             className="group hover:bg-slate-50/50 transition-colors cursor-default"
                           >
                              <td className="p-8 border-b border-slate-50 font-mono font-black text-[#1A237E] opacity-30 text-xs">
                                 {item.siad}
                              </td>
                              <td className="p-8 border-b border-slate-50">
                                 <div className="space-y-1.5">
                                    <p className="font-bold text-slate-800 leading-tight group-hover:text-[#1A237E] transition-colors text-base">{item.descricao}</p>
                                    {item.is_highlight && (
                                       <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-amber-100/50">
                                          <Star weight="fill" size={12} /> Prioridade Estratégica
                                       </span>
                                    )}
                                 </div>
                              </td>
                              <td className="p-8 border-b border-slate-50 text-center">
                                 <span className="bg-slate-100 px-5 py-2 rounded-2xl inline-block font-black text-slate-600 text-lg">
                                    {item.quantidade_total}
                                 </span>
                              </td>
                              <td className="p-8 border-b border-slate-50 text-right">
                                 <div className="space-y-0.5">
                                    <p className="font-display font-black text-slate-900 text-xl">R$ {item.valor_total.toLocaleString('pt-BR')}</p>
                                    <p className="text-[8px] font-bold text-slate-300 uppercase">Valor Estimado</p>
                                 </div>
                              </td>
                              <td className="p-8 border-b border-slate-50 text-center">
                                 <div className="flex justify-center -space-x-3">
                                    {[...new Set(item.pedidos)].map((sigla, sIdx) => (
                                       <motion.div 
                                          whileHover={{ y: -10, zIndex: 10, scale: 1.2 }}
                                          key={sIdx} 
                                          className="w-10 h-10 rounded-2xl bg-white border-2 border-slate-50 flex items-center justify-center text-[10px] font-black text-[#1A237E] uppercase shadow-lg shadow-indigo-900/5 cursor-pointer transition-shadow"
                                          title={sigla}
                                       >
                                          {sigla}
                                       </motion.div>
                                    ))}
                                 </div>
                              </td>
                              <td className="p-8 border-b border-slate-50 text-right">
                                 <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.1em] shadow-sm border border-emerald-100">
                                    <CheckCircle weight="fill" size={16} /> Homologado
                                 </div>
                              </td>
                           </motion.tr>
                        ))
                     )}
                  </AnimatePresence>
               </tbody>
            </table>
         </div>
         
         {!loading && filteredItems.length === 0 && (
            <div className="py-32 text-center space-y-6 opacity-30">
               <ChartPieSlice size={80} weight="thin" className="mx-auto text-slate-400" />
               <div className="space-y-1">
                  <h3 className="font-display font-black text-2xl uppercase tracking-[0.2em]">Aguardando Fluxo</h3>
                  <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Nenhum item aprovado para este filtro hoje.</p>
               </div>
            </div>
         )}
      </div>
    </div>
  )
}
