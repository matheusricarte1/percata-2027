'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowRight,
  User,
  Wallet,
  ChartBar,
  MagnifyingGlass,
  ArrowClockwise,
  Pencil,
  Star,
  WarningCircle,
  ChatText,
  Info,
  UserCircle,
  Handshake,
  Check,
  TrendUp,
  Buildings,
  Stack
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface DFD {
  id: string
  numero_protocolo: string
  objeto_contratacao: string
  status: string
  valor_total_estimado: number
  created_at: string
  profiles: {
    full_name: string
    email: string
  }
}

export default function TriagemPage() {
  const [dfds, setDfds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDfd, setSelectedDfd] = useState<any | null>(null)
  const [items, setItems] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [devolucaoComment, setDevolucaoComment] = useState('')
  const [devolvendo, setDevolvendo] = useState(false)

  const fetchDfds = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Busca quais unidades o usuário chefia
      const { data: units } = await supabase
        .from('user_units')
        .select('unit_id')
        .eq('user_id', user.id)
        .eq('role_in_unit', 'chefia')
      
      const unitIds = units?.map(u => u.unit_id) || []

      // Busca DFDs enviadas para essas unidades
      const { data, error } = await supabase
        .from('dfds')
        .select(`
          *,
          profiles:solicitante_id (full_name, email)
        `)
        .in('unidade_id', unitIds)
        .eq('status', 'triagem')
        .order('created_at', { ascending: false })

      if (error) throw error
      setDfds(data || [])
    } catch (e: any) {
      toast.error('Erro ao carregar demandas: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDfds()
  }, [])

  const openDfd = async (dfd: any) => {
    setSelectedDfd(dfd)
    const { data } = await supabase
      .from('dfd_items')
      .select('*')
      .eq('dfd_id', dfd.id)
    
    setItems(data || [])
    setDialogOpen(true)
  }

  const updateItemQty = (id: string, qty: number) => {
    setItems(items.map(item => item.id === id ? { ...item, quantidade: qty } : item))
  }

  const toggleHighlight = (id: string) => {
    const currentHighlights = items.filter(i => i.is_highlight_item).length
    const limit = Math.ceil(items.length * 0.2) // Regra de Pareto: 20%

    setItems(items.map(item => {
      if (item.id === id) {
        if (!item.is_highlight_item && currentHighlights >= limit) {
          toast.warning(`Limite de Pareto atingido! Você só pode destacar ${limit} itens (20%).`)
          return item
        }
        return { ...item, is_highlight_item: !item.is_highlight_item }
      }
      return item
    }))
  }

  const handleAprove = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Atualiza os itens com as modificações da chefia
      for (const item of items) {
        await supabase
          .from('dfd_items')
          .update({ 
            quantidade: item.quantidade,
            is_highlight_item: item.is_highlight_item
          })
          .eq('id', item.id)
      }

      // 2. Aprova a DFD
      const { error: dfdError } = await supabase
        .from('dfds')
        .update({ status: 'aprovada' })
        .eq('id', selectedDfd.id)

      if (dfdError) throw dfdError

      // 3. Registra log com o usuário que aprovou
      await supabase.from('dfd_logs').insert({
        dfd_id: selectedDfd.id,
        user_id: user.id,
        action: 'aprovada',
        details: 'Demanda homologada pela chefia da unidade.'
      })
      
      toast.success('Demanda aprovada e homologada!')
      setDialogOpen(false)
      fetchDfds()
    } catch (e: any) {
      toast.error('Erro ao aprovar: ' + e.message)
    }
  }

  const handleDevolve = async () => {
    if (!devolucaoComment) {
      toast.error('Por favor, insira o motivo da devolução.')
      setDevolvendo(true)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error: dfdError } = await supabase
        .from('dfds')
        .update({ status: 'devolvida' })
        .eq('id', selectedDfd.id)

      if (dfdError) throw dfdError

      // Registra log com o comentário de devolução
      await supabase.from('dfd_logs').insert({
        dfd_id: selectedDfd.id,
        user_id: user.id,
        action: 'devolvida',
        details: devolucaoComment
      })

      toast.info('Demanda devolvida para correção.')
      setDialogOpen(false)
      setDevolvendo(false)
      setDevolucaoComment('')
      fetchDfds()
    } catch (e: any) {
      toast.error('Erro ao devolver: ' + e.message)
    }
  }

  const highlightsUsed = items.filter(i => i.is_highlight_item).length
  const highlightLimit = Math.ceil(items.length * 0.2)

  return (
    <div className="p-8 space-y-12 bg-[#F6FBF9] min-h-screen pb-40">
      {/* Bento Header Chefia */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 bg-[#004D40] p-10 rounded-[48px] text-white shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[280px]"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-[32px] flex items-center justify-center text-4xl shadow-inner border border-white/10 ring-8 ring-white/5 text-emerald-300">
              <CheckCircle weight="duotone" />
            </div>
            <div className="space-y-1">
              <h1 className="font-display text-5xl font-black italic tracking-tighter uppercase leading-none">Curadoria</h1>
              <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.4em] ml-1">Análise Estratégica Chefia</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 relative z-10 items-end justify-between">
             <div className="space-y-4">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Demandas em Fila</span>
                </div>
                <div className="flex gap-2">
                   <Button onClick={fetchDfds} variant="ghost" className="bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl normal-case italic font-bold">
                      <ArrowClockwise className={loading ? 'animate-spin' : ''} weight="bold" /> Atualizar
                   </Button>
                </div>
             </div>
             
             <div className="bg-emerald-800/40 px-10 py-5 rounded-[32px] backdrop-blur-md border border-white/5 text-right">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">Aguardando Triagem</span>
                <span className="text-4xl font-black tracking-tighter">{dfds.length} <span className="text-sm italic opacity-40">Pendentes</span></span>
             </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-10 rounded-[48px] border border-emerald-100 shadow-xl flex flex-col justify-between"
        >
           <div className="space-y-2">
              <div className="flex items-center justify-between">
                 <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800/40">Status de Aprovação</span>
                 <TrendUp size={20} className="text-emerald-500" />
              </div>
              <h2 className="text-5xl font-display font-black text-[#004D40] tracking-tighter italic">
                 Metas PCA
              </h2>
           </div>

           <div className="space-y-4">
              <div className="w-full bg-slate-50 h-3 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: '40%' }} 
                  className="bg-emerald-500 h-full shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-emerald-900/40">
                <span className="flex items-center gap-2"><Clock weight="bold" /> Restam 12 dias</span>
                <span>Progr. 40%</span>
              </div>
           </div>
        </motion.div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
           <div className="flex items-center justify-between px-4">
              <h2 className="font-display font-black text-2xl text-[#004D40] uppercase tracking-tight italic">Fila de Recebimento</h2>
              <div className="relative group">
                <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-[#004D40]/30 group-focus-within:text-[#004D40] transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Pesquisar..." 
                  className="pl-12 pr-6 py-3.5 bg-white border border-emerald-50 rounded-2xl text-xs font-bold focus:ring-8 focus:ring-emerald-500/5 outline-none w-64 transition-all focus:w-80 shadow-sm"
                />
              </div>
           </div>

           <div className="grid grid-cols-1 gap-4">
              <AnimatePresence mode="popLayout">
                {loading ? (
                   [...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-[40px]" />)
                ) : (
                  dfds.map((dfd, i) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ 
                        type: 'spring',
                        damping: 25,
                        stiffness: 300,
                        delay: i * 0.05 
                      }}
                      key={dfd.id} 
                      onClick={() => openDfd(dfd)}
                      className="bg-white p-6 rounded-[40px] border border-emerald-50 shadow-sm hover:shadow-2xl hover:border-emerald-200 transition-all group cursor-pointer relative flex items-center justify-between"
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-emerald-50 rounded-[28px] flex items-center justify-center text-emerald-700 group-hover:bg-[#004D40] group-hover:text-emerald-100 transition-all duration-300 ring-4 ring-transparent group-hover:ring-emerald-100/50">
                          <UserCircle size={40} weight="duotone" />
                        </div>
                        <div className="space-y-1.5 text-left">
                          <div className="flex items-center gap-3">
                             <span className="text-[10px] font-mono font-black text-emerald-800/20 uppercase tracking-tighter bg-emerald-50 px-2 py-0.5 rounded">#{dfd.id.slice(0, 8)}</span>
                             <span className="text-[10px] font-black text-emerald-600/50 uppercase tracking-widest">{new Date(dfd.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <h3 className="font-black text-[#004D40] text-lg uppercase tracking-tight leading-none group-hover:text-emerald-700 transition-colors">{dfd.profiles?.full_name}</h3>
                          <p className="text-xs text-slate-400 font-medium italic truncate max-w-[300px]">{dfd.objeto_contratacao}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-12">
                         <div className="text-right flex flex-col items-end">
                            <span className="text-2xl font-display font-black text-[#004D40] tracking-tighter">
                               R$ {Number(dfd.valor_total_estimado || 0).toLocaleString('pt-BR')}
                            </span>
                            <span className="text-[9px] font-black text-emerald-800/30 uppercase tracking-[0.2em]">Estimativa Financeira</span>
                         </div>
                         <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:translate-x-2 transition-all duration-300 group-hover:bg-[#004D40] group-hover:text-white">
                           <ArrowRight size={24} weight="bold" />
                         </div>
                      </div>
                    </motion.div>
                  ))
                )}
                {dfds.length === 0 && !loading && (
                   <div className="py-32 text-center space-y-6 opacity-20">
                      <CheckCircle size={80} weight="thin" className="mx-auto text-[#004D40]" />
                      <div className="space-y-1">
                         <h3 className="font-display font-black text-2xl text-[#004D40] uppercase tracking-tighter">Limpo e Finalizado</h3>
                         <p className="text-sm font-bold uppercase tracking-widest italic">Nenhuma demanda aguardando triagem no momento.</p>
                      </div>
                   </div>
                )}
              </AnimatePresence>
           </div>
        </div>

        {/* Sidebar Insights */}
        <div className="space-y-8">
           <div className="bg-white p-10 rounded-[50px] border border-emerald-100 space-y-8 shadow-sm">
              <div className="flex items-center gap-3">
                 <Stack size={24} weight="fill" className="text-emerald-500" />
                 <h3 className="font-display font-black text-xl text-[#004D40] uppercase tracking-tight italic">Insights Pareto</h3>
              </div>
              <div className="space-y-5">
                 <div className="p-6 bg-emerald-50 rounded-[32px] border border-emerald-100/50 space-y-2 group hover:bg-emerald-100/30 transition-all cursor-default">
                    <div className="flex items-center gap-2 mb-1">
                       <ChartBar size={20} weight="fill" className="text-emerald-700" />
                       <p className="text-xs font-black text-emerald-900 uppercase">Concentração</p>
                    </div>
                    <p className="text-[11px] text-emerald-800/60 font-medium leading-relaxed">20% das DFDs representam 78% do orçamento solicitado pela sua unidade.</p>
                 </div>
                 <div className="p-6 bg-amber-50 rounded-[32px] border border-amber-100/50 space-y-2 group hover:bg-amber-100/30 transition-all cursor-default">
                    <div className="flex items-center gap-2 mb-1">
                       <WarningCircle size={20} weight="fill" className="text-amber-600" />
                       <p className="text-xs font-black text-amber-900 uppercase">Eficiência</p>
                    </div>
                    <p className="text-[11px] text-emerald-800/60 font-medium leading-relaxed">Leitura média de 36h após submissão. Ideal é reduzir para 24h.</p>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* PARETO CURATION DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-7xl h-[95vh] flex flex-col p-0 gap-0 overflow-hidden border-none rounded-[60px] bg-[#F8FBF9] shadow-2xl">
          <DialogHeader className="bg-[#004D40] text-white p-12 relative overflow-hidden rounded-t-[60px] border-none min-h-[220px] flex flex-col justify-center">
             <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
             <div className="flex justify-between items-center relative z-10">
                <div className="space-y-3">
                   <div className="flex items-center gap-4">
                      <span className="bg-white/10 backdrop-blur-md px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/10">Curadoria Ativa</span>
                      <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                   </div>
                   <DialogTitle className="text-5xl font-black italic tracking-tighter uppercase leading-none text-white overflow-hidden text-ellipsis whitespace-nowrap max-w-[800px]">
                     {selectedDfd?.profiles?.full_name}
                   </DialogTitle>
                </div>
                <div className="bg-white/10 p-6 rounded-[32px] border border-white/5 backdrop-blur-md text-right">
                   <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-1">Cota Pareto PCA</div>
                   <div className="flex items-baseline gap-2">
                       <span className={cn("text-4xl font-black italic", highlightsUsed < highlightLimit ? 'text-emerald-300' : 'text-amber-400')}>
                          {highlightsUsed}
                       </span>
                       <span className="text-lg font-bold opacity-30 text-white leading-none">/ {highlightLimit}</span>
                   </div>
                </div>
             </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-12 space-y-16">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
               <div className="lg:col-span-2 space-y-6">
                  <h4 className="flex items-center gap-3 text-xs font-black text-[#004D40] uppercase tracking-[0.3em] pl-2 font-display">
                    <Info size={22} weight="duotone" className="text-emerald-500" /> Justificativa Técnica
                  </h4>
                  <div className="bg-white rounded-[40px] border border-emerald-50 p-10 space-y-8 shadow-sm">
                     <div className="relative">
                        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-emerald-500 rounded-full opacity-30" />
                        <p className="text-xl font-bold text-slate-800 leading-relaxed italic pr-6 group">
                           "{selectedDfd?.objeto_contratacao}"
                        </p>
                     </div>
                     <p className="text-sm text-slate-500 leading-relaxed font-medium bg-slate-50/50 p-8 rounded-[32px] border border-black/[0.02]">
                        {selectedDfd?.justificativa_contratacao || 'Aguardando detalhamento técnico.'}
                     </p>
                  </div>
               </div>

               <div className="space-y-6">
                  <h4 className="flex items-center gap-3 text-xs font-black text-[#004D40] uppercase tracking-[0.3em] pl-2 font-display">
                    <Star size={22} weight="duotone" className="text-amber-500" /> Selo Estratégico
                  </h4>
                  <div className="bg-[#004D40] p-10 rounded-[40px] text-white space-y-8 shadow-2xl shadow-emerald-950/20 relative group">
                     <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-400/10 rounded-full blur-3xl" />
                     <div className="space-y-4 relative z-10">
                        <div className="flex justify-between items-end">
                           <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">Utilização do Pareto</span>
                           <span className="text-2xl font-black italic tracking-tighter opacity-80">{Math.round((highlightsUsed / highlightLimit) * 100)}%</span>
                        </div>
                        <div className="h-4 bg-white/5 rounded-full overflow-hidden p-1">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${(highlightsUsed / highlightLimit) * 100}%` }}
                             className={cn("h-full rounded-full shadow-lg", highlightsUsed < highlightLimit ? 'bg-emerald-400' : 'bg-amber-400')} 
                             transition={{ type: 'spring', damping: 20 }}
                           />
                        </div>
                     </div>
                     <p className="text-[11px] font-medium leading-relaxed italic text-emerald-100/40 relative z-10 bg-black/10 p-5 rounded-2xl border border-white/5">
                        Eleja os itens fundamentais (20%) que garantem a operação da unidade. Demandas eleitas como destaque são priorizadas na consolidação orçamentária do PCA.
                     </p>
                  </div>
               </div>
            </div>

            <div className="space-y-8">
               <div className="flex justify-between items-center px-4">
                  <h4 className="flex items-center gap-3 text-xs font-black text-[#004D40] uppercase tracking-[0.3em] font-display">
                    <Stack size={22} weight="duotone" className="text-emerald-500" /> Curadoria de Itens ({items.length})
                  </h4>
               </div>
               <div className="grid grid-cols-1 gap-6">
                  {items.map((item, idx) => (
                    <motion.div 
                      key={item.id} 
                      layout
                      className={cn(
                        "p-8 rounded-[40px] border transition-all flex flex-col md:flex-row gap-10 items-center",
                        item.is_highlight_item 
                          ? 'bg-amber-50/50 border-amber-200 shadow-xl shadow-amber-900/5 ring-4 ring-amber-100/50' 
                          : 'bg-white border-emerald-50 hover:border-emerald-100 shadow-sm'
                      )}
                    >
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-4">
                           <span className="text-[10px] font-black text-slate-300 font-mono tracking-tighter uppercase p-2 bg-slate-50 rounded-xl border border-black/[0.03]">#{item.codigo_tce}</span>
                           <span className="text-[10px] font-black px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full uppercase tracking-widest border border-emerald-100/50">Item de Linha {idx+1}</span>
                        </div>
                        <h5 className="font-bold text-slate-800 text-xl leading-tight tracking-tight">{item.descricao}</h5>
                        <div className="flex flex-wrap gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                           <span className="flex items-center gap-2 pr-6 border-r border-slate-100"><Buildings size={16} weight="bold" className="text-emerald-600/40" /> Local: {item.local_uso || 'Setor Padrão'}</span>
                           <a href={item.link_referencia} target="_blank" className="flex items-center gap-2 text-[#004D40] hover:text-emerald-700 transition-all font-black decoration-emerald-500 underline underline-offset-4"><ChatText size={16} /> Ver Referência Técnica</a>
                        </div>
                      </div>

                      <div className="flex items-center gap-10 w-full md:w-auto shrink-0">
                        <div className="flex flex-col gap-2 w-32">
                           <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Quantidade</label>
                           <input 
                             type="number" 
                             value={item.quantidade}
                             onChange={(e) => updateItemQty(item.id, Number(e.target.value))}
                             className="bg-[#F8FBF9] border-2 border-emerald-50 rounded-2xl py-4 px-4 text-center font-black text-2xl text-[#004D40] shadow-inner focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500/20 outline-none transition-all" 
                           />
                        </div>
                        
                        <div className="h-14 w-[1px] bg-slate-100 md:block hidden" />

                        <button 
                          onClick={() => toggleHighlight(item.id)}
                          className={cn(
                             "w-20 h-20 rounded-[32px] flex flex-col items-center justify-center transition-all duration-300 relative group",
                             item.is_highlight_item 
                               ? 'bg-amber-400 text-white shadow-2xl shadow-amber-400/40 ring-8 ring-amber-100 scale-110' 
                               : 'bg-slate-50 text-slate-200 hover:bg-amber-50 hover:text-amber-400 hover:scale-105'
                          )}
                        >
                           <Star size={32} weight={item.is_highlight_item ? 'fill' : 'bold'} />
                           <span className="text-[7px] font-black uppercase tracking-[0.2em] mt-1.5 opacity-60">VIP PCA</span>
                           {item.is_highlight_item && (
                              <motion.div 
                                layoutId="star-aura" 
                                className="absolute inset-0 rounded-[32px] bg-amber-400 blur-xl opacity-20 pointer-events-none" 
                              />
                           )}
                        </button>
                      </div>
                    </motion.div>
                  ))}
               </div>
            </div>

            <div className="pt-20 border-t border-emerald-100 flex flex-col gap-10 pb-10">
               <AnimatePresence>
                 {devolvendo && (
                   <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-4"
                   >
                     <label className="text-xs font-black text-red-600 uppercase tracking-widest ml-4 flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                        Parecer Técnico para Correção
                     </label>
                     <textarea 
                       value={devolucaoComment}
                       onChange={(e) => setDevolucaoComment(e.target.value)}
                       placeholder="Explique ao solicitante as inconsistências detectadas..."
                       className="w-full bg-red-50 border-2 border-red-100 rounded-[40px] p-10 text-red-950 font-medium text-lg outline-none focus:ring-12 focus:ring-red-500/5 placeholder:text-red-200 resize-none shadow-inner"
                       rows={5}
                     />
                   </motion.div>
                 )}
               </AnimatePresence>

               <div className="flex justify-end items-center gap-8 px-4">
                  {!devolvendo ? (
                    <>
                      <Button 
                        variant="ghost" 
                        onClick={() => setDevolvendo(true)}
                        className="h-20 px-10 rounded-[28px] text-red-600 font-black uppercase italic tracking-widest hover:bg-red-50"
                      >
                         <WarningCircle size={24} className="mr-3" weight="bold" /> Devolver para Ajuste
                      </Button>
                      <Button 
                        onClick={handleAprove}
                        className="h-20 px-16 rounded-[28px] bg-[#004D40] hover:bg-[#00382F] text-white font-black uppercase italic tracking-widest text-xl shadow-2xl shadow-emerald-950/20 group"
                      >
                         <CheckCircle size={32} className="mr-4 group-hover:scale-125 transition-transform" weight="fill" /> Homologar Demanda
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        variant="outline" 
                        onClick={() => { setDevolvendo(false); setDevolucaoComment(''); }}
                        className="h-16 px-10 rounded-[24px] border-slate-200 font-black uppercase italic tracking-widest text-slate-400"
                      >
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleDevolve}
                        className="h-16 px-16 rounded-[24px] bg-red-600 hover:bg-red-700 text-white font-black uppercase italic tracking-widest shadow-2xl shadow-red-500/20"
                      >
                        Confirmar Rejeição
                      </Button>
                    </>
                  )}
               </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FormGroup({ label, icon: Icon, children }: any) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[10px] font-black text-[#004D40] uppercase tracking-widest ml-1 opacity-60">
        <Icon size={16} weight="bold" />
        {label}
      </label>
      {children}
    </div>
  )
}
