'use client'

import React, { useState, useEffect } from 'react'
import { 
  ArrowLeft, 
  Printer, 
  DownloadSimple, 
  ChatTeardropDots, 
  CheckCircle, 
  XCircle,
  FileText,
  Package,
  User,
  Clock,
  DotsThreeVertical,
  Paperclip,
  ShareFat,
  Buildings,
  WarningCircle,
  ShieldCheck,
  Hash,
  PaperPlaneTilt
} from '@phosphor-icons/react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DfdTimeline } from '@/components/dfd/DfdTimeline'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'

export default function DFDDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [dfd, setDfd] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Busca Cabeçalho da DFD com Perfil e Campus
      const { data: dfdData, error: dfdError } = await supabase
        .from('dfds')
        .select(`
          *,
          profiles:solicitante_id (full_name, email),
          campi:campus_id (nome, sigla)
        `)
        .eq('id', id)
        .single()

      if (dfdError) throw dfdError
      setDfd(dfdData)

      // 2. Busca Itens da DFD
      const { data: itemsData, error: itemsError } = await supabase
        .from('dfd_items')
        .select('*')
        .eq('dfd_id', id)
      
      if (itemsError) throw itemsError
      setItems(itemsData || [])

      // 3. Busca Histórico (Logs)
      const { data: logsData, error: logsError } = await supabase
        .from('dfd_logs')
        .select('*')
        .eq('dfd_id', id)
        .order('created_at', { ascending: false })
      
      if (logsError) throw logsError
      setLogs(logsData || [])

    } catch (error: any) {
      toast.error('Erro ao carregar DFD: ' + error.message)
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendToTriagem = async () => {
    try {
      const { error } = await supabase
        .from('dfds')
        .update({ status: 'triagem' })
        .eq('id', id)

      if (error) throw error

      toast.success('DFD enviada para análise da chefia com sucesso!')
      fetchData() // Atualiza os dados para refletir o novo status e logs
    } catch (error: any) {
      toast.error('Erro ao enviar DFD: ' + error.message)
    }
  }

  useEffect(() => {
    if (id) fetchData()
  }, [id])

  if (loading) {
    return (
      <div className="p-8 space-y-8 max-w-5xl mx-auto animate-pulse">
        <Skeleton className="h-12 w-48 rounded-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full rounded-[48px]" />
            <Skeleton className="h-96 w-full rounded-[48px]" />
          </div>
          <Skeleton className="h-full w-full rounded-[48px]" />
        </div>
      </div>
    )
  }

  if (!dfd) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <XCircle size={64} weight="thin" className="text-red-300" />
        <h2 className="text-2xl font-black text-slate-800 uppercase">DFD não encontrada</h2>
        <p className="text-slate-500">O protocolo solicitado não existe ou você não tem permissão para acessá-lo.</p>
        <button onClick={() => router.back()} className="text-indigo-600 font-bold hover:underline">Voltar para o Painel</button>
      </div>
    )
  }

  const statusColors: any = {
    rascunho: 'bg-slate-100 text-slate-600',
    triagem: 'bg-blue-100 text-blue-600',
    aprovada: 'bg-emerald-100 text-emerald-600',
    devolvida: 'bg-amber-100 text-amber-600',
    pactuando: 'bg-indigo-100 text-indigo-600'
  }

  return (
    <div className="p-8 space-y-8 pb-32 max-w-5xl mx-auto">
      {/* Header Contextual */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-black/5 shadow-sm hover:bg-slate-50 transition-all"
          >
            <ArrowLeft size={22} weight="bold" />
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-extrabold text-[#1C1B1F] tracking-tighter uppercase italic">
                Protocolo #{dfd.id.slice(0, 8)}
              </h1>
              <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusColors[dfd.status] || 'bg-slate-100 text-slate-600'}`}>
                {dfd.status}
              </span>
            </div>
            <p className="text-[#625B71] font-medium text-sm">Escopo: {dfd.objeto_contratacao}</p>
          </div>
        </div>

        <div className="flex gap-2">
           {dfd.status === 'rascunho' && (
             <button 
               onClick={handleSendToTriagem}
               className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 hover:scale-[1.02] active:scale-95 transition-all"
             >
                <PaperPlaneTilt size={18} weight="bold" />
                ENVIAR PARA ANÁLISE
             </button>
           )}
           <button 
             onClick={() => router.push(`/dfd/${id}/impressao`)}
             className="w-12 h-12 flex items-center justify-center rounded-xl bg-white border border-black/5 hover:bg-black/5 transition-all text-black/60 shadow-sm"
           >
              <Printer size={22} weight="fill" />
           </button>
           <button className="w-12 h-12 flex items-center justify-center rounded-xl bg-white border border-black/5 hover:bg-black/5 transition-all text-black/60 shadow-sm">
              <DownloadSimple size={22} weight="bold" />
           </button>
           <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1A237E] text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 hover:scale-[1.02] active:scale-95 transition-all">
              AÇÕES
              <DotsThreeVertical size={18} weight="bold" />
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Lado Esquerdo: Detalhes e Itens */}
        <div className="lg:col-span-2 space-y-8">
           
           {/* Card 1: Informações Gerais */}
           <div className="bg-white rounded-[40px] p-10 border border-black/5 shadow-sm space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full opacity-40 pointer-events-none" />
              
              <h3 className="font-display text-xl font-black text-[#1A237E] flex items-center gap-3 uppercase tracking-tight">
                 <FileText size={24} weight="fill" className="text-[#1A237E]" />
                 Contexto da Demanda
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <InfoItem icon={User} label="Solicitante Responsável" value={dfd.profiles?.full_name || 'Desconhecido'} />
                 <InfoItem icon={Buildings} label="Campus Vinculado" value={dfd.campi?.nome || 'Não informado'} />
                 <InfoItem icon={Clock} label="Data de Registro" value={new Date(dfd.created_at).toLocaleDateString('pt-BR')} />
                 <InfoItem icon={ShieldCheck} label="Exercício PCA" value="2027" />

                 <div className="md:col-span-2 space-y-3">
                    <p className="text-[10px] font-black text-black/30 uppercase tracking-[0.2em] ml-1">Justificativa da Contratação</p>
                    <div className="text-sm text-slate-600 leading-relaxed font-medium bg-slate-50 p-6 rounded-3xl border border-black/5 italic border-l-4 border-l-[#1A237E]">
                       "{dfd.justificativa_contratacao || 'Nenhuma justificativa detalhada foi fornecida pelo solicitante.'}"
                    </div>
                 </div>
              </div>
           </div>

           {/* Card 2: Lista de Itens */}
           <div className="bg-white rounded-[40px] border border-black/5 shadow-sm overflow-hidden flex flex-col">
              <div className="p-8 border-b border-black/5 bg-white flex justify-between items-center">
                 <h3 className="font-display text-xl font-black text-[#1A237E] flex items-center gap-3 uppercase tracking-tight">
                    <Package size={24} weight="fill" className="text-[#1A237E]" />
                    Itens Consolidados ({items.length})
                 </h3>
              </div>

              <div className="divide-y divide-black/5">
                 {items.map((item, idx) => (
                    <div key={item.id} className="p-8 flex flex-col md:flex-row gap-8 hover:bg-slate-50/50 transition-colors group">
                       <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-all">
                          <Package size={32} />
                       </div>
                       <div className="flex-1 space-y-4">
                          <div className="flex justify-between items-start">
                             <div className="space-y-1">
                                <h4 className="font-black text-slate-800 leading-tight uppercase tracking-tight">{item.descricao}</h4>
                                <div className="flex items-center gap-2">
                                   <span className="flex items-center gap-1 text-[10px] font-mono font-black text-black/20 uppercase tracking-tighter bg-black/5 px-2 py-0.5 rounded">
                                      <Hash size={12} weight="bold" />
                                      {item.codigo_tce}
                                   </span>
                                   <span className="text-[10px] font-bold text-indigo-400 uppercase">NI: {idx + 1}</span>
                                </div>
                             </div>
                             <div className="text-right">
                                <p className="font-display font-black text-xl text-[#1A237E]">
                                  R$ {Number(item.valor_unitario_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">Qtd: {item.quantidade}</p>
                             </div>
                          </div>
                          
                          {item.justificativa_item && (
                            <p className="text-xs text-slate-500 leading-relaxed bg-white border border-black/5 p-4 rounded-2xl italic">
                               <ChatTeardropDots size={14} className="inline mr-2 text-indigo-300" weight="fill" />
                               {item.justificativa_item}
                            </p>
                          )}
                          
                          <div className="flex gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                             <span className="flex items-center gap-1.5"><Buildings size={14} weight="fill" /> Local: {item.local_uso || 'Sede'}</span>
                             {item.link_referencia && (
                               <a href={item.link_referencia} target="_blank" className="flex items-center gap-1.5 text-indigo-500 hover:underline">
                                 <Paperclip size={14} weight="bold" /> Referência Técnica
                               </a>
                             )}
                          </div>
                       </div>
                    </div>
                 ))}
              </div>

              {items.length === 0 && (
                <div className="py-20 text-center opacity-30">
                  <WarningCircle size={48} className="mx-auto" />
                  <p className="font-black uppercase tracking-widest mt-2">Nenhum item vinculado</p>
                </div>
              )}

              <div className="p-10 bg-indigo-50/30 border-t border-black/5 flex justify-between items-center">
                 <span className="text-black/40 font-black uppercase text-[10px] tracking-[0.3em]">Total Geral Estimado</span>
                 <span className="text-3xl font-display font-black text-[#1A237E]">
                   R$ {items.reduce((acc, i) => acc + (i.quantidade * i.valor_unitario_estimado), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                 </span>
              </div>
           </div>
        </div>

        {/* Lado Direito: Histórico e Ações */}
        <div className="space-y-8">
           <div className="bg-white p-8 rounded-[40px] border border-black/5 shadow-sm space-y-8">
              <h3 className="font-display text-lg font-black text-[#1A237E] uppercase tracking-tight flex items-center gap-2">
                <Clock size={22} weight="fill" /> 
                Histórico de Tramitação
              </h3>
              
              <DfdTimeline logs={logs} />

              {logs.length === 0 && (
                <p className="text-center text-xs font-bold text-slate-300 pt-10">Aguardando primeira ação de sistema...</p>
              )}
           </div>

           <div className="bg-[#1A237E] p-8 rounded-[40px] text-white space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
              <h3 className="font-display font-black text-lg uppercase tracking-tight">Suporte Técnico</h3>
              <p className="text-xs text-white/60 font-medium leading-relaxed">
                Tem dúvidas sobre o preenchimento ou sobre a devolutiva técnica recebida? Entre em contato com a PROPLAN Central.
              </p>
              <button className="w-full flex items-center justify-center gap-2 py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-xs font-black uppercase tracking-widest transition-all">
                 <ChatTeardropDots size={20} weight="fill" />
                 Iniciar Protocolo Ajuda
              </button>
           </div>
        </div>

      </div>
    </div>
  )
}

function InfoItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="space-y-2">
       <p className="text-[10px] font-black text-black/30 uppercase tracking-[0.2em] ml-1">{label}</p>
       <div className="flex items-center gap-3 font-bold text-[#1C1B1F] bg-white border border-black/5 p-4 rounded-2xl shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
             <Icon size={18} weight="fill" />
          </div>
          <span className="text-sm font-black text-slate-700">{value}</span>
       </div>
    </div>
  )
}
>
    </div>
  )
}
