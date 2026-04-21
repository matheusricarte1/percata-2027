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
  Check
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

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
    <div className="p-8 space-y-8 bg-[#F5FBF9] min-h-screen">
      {/* Header Real-time */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[40px] border border-emerald-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full pointer-events-none opacity-50" />
        
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-16 h-16 bg-[#00695C] text-white rounded-2xl flex items-center justify-center text-3xl shadow-lg">
            <CheckCircle weight="fill" />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-black text-[#004D40] italic tracking-tighter uppercase">Triagem e Curadoria</h1>
            <p className="text-emerald-800/50 text-xs font-black uppercase tracking-widest">
               Análise Estratégica do Plano de Compras (PCA 2027)
            </p>
          </div>
        </div>
        
        <div className="flex gap-4 relative z-10 w-full md:w-auto">
            <div className="bg-emerald-50 px-6 py-4 rounded-3xl border border-emerald-100 flex-1 md:flex-none">
               <span className="text-[10px] font-black uppercase text-emerald-800/40 block mb-1">Aguardando Validação</span>
               <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-[#004D40]">{dfds.length}</span>
                  <span className="text-xs font-bold text-emerald-700/60 uppercase">DFDs</span>
               </div>
            </div>
            <Button onClick={fetchDfds} variant="outline" className="h-full px-6 rounded-3xl border-emerald-100 text-emerald-700 hover:bg-emerald-50 transition-all">
               <ArrowClockwise size={20} weight="bold" className={loading ? 'animate-spin' : ''} />
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
           <div className="flex items-center justify-between px-2">
             <h2 className="font-display font-black text-xl text-[#004D40] uppercase tracking-tight">Fila de Demandas Recebidas</h2>
             <div className="relative">
               <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-800/40" size={18} />
               <input 
                 type="text" 
                 placeholder="Pesquisar protocolo ou solicitante..." 
                 className="pl-10 pr-6 py-3 bg-white border border-emerald-100 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none w-64 transition-all focus:w-80"
               />
             </div>
           </div>

           <div className="grid grid-cols-1 gap-4">
             <AnimatePresence mode="popLayout text-center">
               {dfds.map((dfd, i) => (
                 <motion.div 
                   layout
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.95 }}
                   transition={{ duration: 0.2 }}
                   key={dfd.id} 
                   onClick={() => openDfd(dfd)}
                   className="bg-white p-6 rounded-[32px] border border-emerald-100 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all group cursor-pointer relative"
                 >
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                       <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-700 group-hover:bg-[#004D40] group-hover:text-white transition-all">
                         <UserCircle size={32} weight="duotone" />
                       </div>
                       <div className="space-y-1">
                         <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-black text-emerald-800/30 uppercase tracking-tighter">#{dfd.id.slice(0, 8)}</span>
                            <span className="w-1 h-1 bg-emerald-100 rounded-full" />
                            <span className="text-xs font-bold text-emerald-600">{new Date(dfd.created_at).toLocaleDateString('pt-BR')}</span>
                         </div>
                         <h3 className="font-black text-emerald-950 uppercase tracking-tight leading-none truncate max-w-[300px]">{dfd.profiles?.full_name || 'Servidor Desconhecido'}</h3>
                         <p className="text-xs text-emerald-800/50 font-medium italic truncate max-w-[400px]">{dfd.objeto_contratacao}</p>
                       </div>
                     </div>
                     <div className="flex items-center gap-6">
                        <div className="text-right">
                           <span className="block text-xl font-black text-emerald-900 leading-none">R$ {dfd.valor_total_estimado.toLocaleString('pt-BR')}</span>
                           <span className="text-[10px] font-black text-emerald-800/30 uppercase tracking-widest">Valor Estimado</span>
                        </div>
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
                          <ArrowRight size={20} weight="bold" />
                        </div>
                     </div>
                   </div>
                 </motion.div>
               ))}
               {dfds.length === 0 && !loading && (
                 <div className="py-20 text-center space-y-4 opacity-40">
                    <CheckCircle size={64} weight="thin" className="mx-auto text-emerald-900" />
                    <p className="font-display font-black text-xl text-emerald-900 uppercase">Tudo em dia!</p>
                    <p className="text-sm font-medium">Não há demandas pendentes na sua fila de triagem.</p>
                 </div>
               )}
             </AnimatePresence>
           </div>
        </div>

        {/* Sidebar Analítica Pareto */}
        <div className="space-y-6">
           <div className="bg-[#004D40] p-8 rounded-[40px] text-white space-y-8 shadow-2xl relative overflow-hidden">
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
              <div className="space-y-2">
                 <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Eficiência de Triagem</span>
                 <h3 className="text-3xl font-black italic tracking-tighter leading-none">Meta Semanal</h3>
              </div>
              <div className="space-y-4">
                 <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: '40%' }} 
                      className="bg-[#B2DFDB] h-full shadow-[0_0_10px_rgba(178,223,219,0.5)]" 
                    />
                 </div>
                 <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-80">
                    <span className="flex items-center gap-2"><Clock weight="bold" /> Restam 4 dias</span>
                    <span>4 / 10 Válidos</span>
                 </div>
              </div>
           </div>

           <div className="bg-white p-8 rounded-[40px] border border-emerald-100 space-y-6 shadow-sm">
              <h3 className="font-display font-black text-lg text-[#004D40] uppercase tracking-tight leading-none">Insights de Pareto</h3>
              <div className="space-y-4">
                 <div className="p-4 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-start gap-4">
                    <ChartBar size={24} weight="fill" className="text-emerald-700" />
                    <div>
                       <p className="text-xs font-black text-emerald-900 uppercase">Concentração de Valor</p>
                       <p className="text-[11px] text-emerald-800/60 font-medium leading-tight mt-1">20% das DFDs representam 78% do orçamento solicitado pela sua unidade.</p>
                    </div>
                 </div>
                 <div className="p-4 bg-amber-50 rounded-3xl border border-amber-100 flex items-start gap-4">
                    <WarningCircle size={24} weight="fill" className="text-amber-600" />
                    <div>
                       <p className="text-xs font-black text-amber-900 uppercase">Prazo Crítico</p>
                       <p className="text-[11px] text-amber-800/60 font-medium leading-tight mt-1">3 demandas estão paradas há mais de 48h sem primeira leitura.</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* MODAL DE CURADORIA E PARETO */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-none rounded-[48px] bg-[#F8FBF9]">
          <DialogHeader className="bg-[#004D40] text-white p-10 relative overflow-hidden rounded-t-[48px] border-none">
             <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-bl-[100px] pointer-events-none" />
             <div className="flex justify-between items-start relative z-10">
                <div className="space-y-2">
                   <div className="flex items-center gap-3">
                      <span className="bg-white/20 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Painel de Curadoria</span>
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                   </div>
                   <DialogTitle className="text-4xl font-black italic tracking-tighter uppercase leading-none">
                     {selectedDfd?.profiles?.full_name}
                   </DialogTitle>
                </div>
                <div className="text-right">
                   <div className="text-xs font-black text-white/40 uppercase tracking-widest">Protocolo</div>
                   <div className="text-2xl font-mono font-black italic">#{selectedDfd?.id.slice(0, 8)}</div>
                </div>
             </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-10 space-y-12">
            {/* Informações da DFD */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-xs font-black text-[#004D40] uppercase tracking-widest pl-2">
                    <Info size={18} weight="bold" /> Objeto e Justificativa do Pedido
                  </h4>
                  <div className="p-6 bg-white rounded-3xl border border-emerald-100 italic text-emerald-900 border-l-8 border-l-emerald-600 shadow-sm leading-relaxed text-sm">
                    "{selectedDfd?.objeto_contratacao}"
                  </div>
                  <div className="p-6 bg-white rounded-3xl border border-emerald-50 text-slate-500 text-sm leading-relaxed shadow-sm">
                    {selectedDfd?.justificativa_contratacao || 'Justificativa geral não preenchida.'}
                  </div>
               </div>

               {/* Pareto Dashboard Interno */}
               <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-xs font-black text-[#004D40] uppercase tracking-widest pl-2">
                    <Star size={18} weight="bold" /> Regra de Eleição (Pareto)
                  </h4>
                  <div className="bg-[#004D40] p-8 rounded-3xl text-white space-y-6 shadow-xl">
                     <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-emerald-200 uppercase tracking-widest">Cota de Destaque</span>
                        <span className="font-mono text-xl">{highlightsUsed} / {highlightLimit}</span>
                     </div>
                     <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-400 h-full transition-all duration-500" 
                          style={{ width: `${(highlightsUsed / highlightLimit) * 100}%` }} 
                        />
                     </div>
                     <p className="text-[10px] font-medium leading-relaxed italic text-emerald-100/60">
                        * Use seus "Selo de Destaque" nos 20% de itens que são o coração deste pedido. Isso prioriza a compra no setor central.
                     </p>
                  </div>
               </div>
            </div>

            {/* Listagem de Itens para Curadoria */}
            <div className="space-y-6">
               <h4 className="flex items-center gap-2 text-xs font-black text-[#004D40] uppercase tracking-widest pl-2 font-display">
                  <ChartBar size={18} weight="bold" /> Itens da Demanda - Curadoria Ativa
               </h4>
               <div className="space-y-4">
                  {items.map((item, idx) => (
                    <div 
                      key={item.id} 
                      className={`p-6 rounded-3xl border transition-all flex flex-col md:flex-row gap-6 items-center ${
                        item.is_highlight_item 
                          ? 'bg-amber-50 border-amber-200 shadow-lg shadow-amber-900/5' 
                          : 'bg-white border-emerald-50 hover:bg-emerald-50/50'
                      }`}
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                           <span className="text-[10px] font-mono font-black text-slate-300 uppercase">#{item.codigo_tce}</span>
                           <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded uppercase tracking-tighter">NI: {idx+1}</span>
                        </div>
                        <h5 className="font-bold text-slate-800 leading-tight">{item.descricao}</h5>
                        <div className="flex gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           <span className="flex items-center gap-1"><UserCircle size={14}/> Destino: {item.local_uso || 'Não indicado'}</span>
                           <a href={item.link_referencia} target="_blank" className="flex items-center gap-1 text-emerald-600 hover:underline"><ChatText size={14}/> Ver Referência</a>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 w-full md:w-auto">
                        <div className="flex flex-col gap-1 w-24">
                           <label className="text-[9px] font-black text-slate-400 uppercase text-center">Quantidade</label>
                           <input 
                             type="number" 
                             value={item.quantidade}
                             onChange={(e) => updateItemQty(item.id, Number(e.target.value))}
                             className="bg-white border border-slate-200 rounded-xl py-2 px-3 text-center font-black text-[#004D40] shadow-sm focus:ring-2 focus:ring-emerald-200 outline-none" 
                           />
                        </div>
                        
                        <div className="h-8 w-[1px] bg-slate-100 md:block hidden" />

                        <button 
                          onClick={() => toggleHighlight(item.id)}
                          className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all ${
                            item.is_highlight_item 
                              ? 'bg-amber-400 text-white shadow-xl shadow-amber-200 scale-110' 
                              : 'bg-slate-100 text-slate-300 hover:bg-amber-100 hover:text-amber-600'
                          }`}
                        >
                           <Star size={24} weight={item.is_highlight_item ? 'fill' : 'bold'} />
                           <span className="text-[7px] font-black uppercase tracking-tighter mt-1">{item.is_highlight_item ? 'DESTAQUE' : 'ELEGER'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* Ações de Triagem */}
            <div className="pt-10 border-t border-emerald-100 flex flex-col gap-6">
               <AnimatePresence>
                 {devolvendo && (
                   <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-3"
                   >
                     <label className="text-xs font-black text-red-600 uppercase tracking-widest ml-2 flex items-center gap-2">
                        <ChatText size={18} weight="bold" /> Motivo da Devolução técnica
                     </label>
                     <textarea 
                       value={devolucaoComment}
                       onChange={(e) => setDevolucaoComment(e.target.value)}
                       placeholder="Explique detalhadamente ao usuário o que precisa ser corrigido (preços, quantidades, links quebrados...)"
                       className="w-full bg-red-50 border-2 border-red-100 rounded-3xl p-6 text-red-900 font-medium text-sm outline-none focus:ring-4 focus:ring-red-500/10 placeholder:text-red-300 resize-none"
                       rows={4}
                     />
                   </motion.div>
                 )}
               </AnimatePresence>

               <div className="flex justify-end gap-4">
                  {!devolvendo ? (
                    <>
                      <Button 
                        variant="ghost" 
                        onClick={() => setDevolvendo(true)}
                        className="h-16 px-8 rounded-3xl text-red-600 font-black uppercase italic tracking-tight hover:bg-red-50"
                      >
                         <WarningCircle size={22} className="mr-2" weight="bold" /> Devolver para Correção
                      </Button>
                      <Button 
                        onClick={handleAprove}
                        className="h-16 px-12 rounded-3xl bg-[#00695C] hover:bg-[#004D40] text-white font-black uppercase italic tracking-tight text-lg shadow-2xl shadow-emerald-900/20"
                      >
                         <CheckCircle size={26} className="mr-2" weight="fill" /> Homologar Demanda
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        variant="outline" 
                        onClick={() => { setDevolvendo(false); setDevolucaoComment(''); }}
                        className="h-14 px-8 rounded-3xl border-slate-200 font-bold"
                      >
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleDevolve}
                        className="h-14 px-12 rounded-3xl bg-red-600 hover:bg-red-700 text-white font-black uppercase italic tracking-tight shadow-xl shadow-red-200"
                      >
                        Confirmar Devolução
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
