'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Plus, 
  MagnifyingGlass, 
  Files, 
  Clock, 
  CheckCircle, 
  WarningCircle,
  CaretRight,
  DotsThreeVertical,
  PaperPlaneTilt,
  Buildings,
  CurrencyDollar
} from '@phosphor-icons/react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Skeleton, DfdCardSkeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function MinhasDFDs() {
  const router = useRouter()
  const [dfds, setDfds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('Todas')

  const fetchDfds = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('dfds')
        .select('*')
        .eq('solicitante_id', user.id)
        .order('created_at', { ascending: false })

      if (filter === 'Rascunhos') query = query.eq('status', 'rascunho')
      if (filter === 'Em Análise') query = query.eq('status', 'triagem')
      if (filter === 'Concluídas') query = query.eq('status', 'concluida')

      const { data, error } = await query

      if (error) throw error
      setDfds(data || [])
    } catch (error: any) {
      toast.error('Erro ao buscar suas DFDs: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDfds()
  }, [filter])

  const statusMap: any = {
    rascunho: { label: 'Rascunho', color: 'slate', icon: Clock },
    triagem: { label: 'Em Análise', color: 'blue', icon: PaperPlaneTilt },
    aprovada: { label: 'Homologada', color: 'emerald', icon: CheckCircle },
    devolvida: { label: 'Devolvida', color: 'amber', icon: WarningCircle },
    pactuando: { label: 'Pactuando', color: 'indigo', icon: Buildings },
    concluida: { label: 'Concluída', color: 'emerald', icon: CheckCircle }
  }

  return (
    <div className="space-y-8">
      {/* Header com Ações */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-display text-4xl font-black text-[#1A237E] italic tracking-tighter uppercase">MEUS PEDIDOS (DFD)</h1>
          <p className="text-black/40 text-sm font-medium">Acompanhe seu planejamento de compras para o PCA 2027</p>
        </div>
        <Link href="/catalogo" className="flex items-center gap-3 bg-[#1A237E] text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all">
          <Plus size={20} weight="bold" />
          Nova Demanda
        </Link>
      </div>

      {/* Toolbar de Filtros */}
      <div className="bg-white p-5 rounded-[32px] border border-black/5 flex flex-wrap gap-4 items-center shadow-sm">
        <div className="relative flex-1 min-w-[300px]">
          <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por protocolo ou objeto..." 
            className="w-full pl-12 pr-4 py-3 bg-black/5 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2">
           {['Todas', 'Rascunhos', 'Em Análise', 'Concluídas'].map((f) => (
             <button 
                key={f} 
                onClick={() => setFilter(f)}
                className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-[#1A237E] text-white shadow-lg' : 'bg-black/5 text-black/40 hover:bg-black/10'}`}
             >
               {f}
             </button>
           ))}
        </div>
      </div>

      {/* Lista de DFDs */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <DfdCardSkeleton key={i} />)}
          </div>
        ) : (
          dfds.map((dfd, i) => {
            const status = statusMap[dfd.status] || statusMap.rascunho
            return (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5, shadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
                key={dfd.id}
                onClick={() => router.push(`/dfd/${dfd.id}`)}
                className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-6">
                  <div className={`w-16 h-16 bg-${status.color}-50 text-${status.color}-600 rounded-3xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                    <Files size={32} weight="fill" className="opacity-40" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-black/20 font-mono tracking-widest uppercase italic">#{dfd.id.slice(0, 8)}</span>
                      <span className={`px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-${status.color}-100 text-${status.color}-700`}>
                        {status.label}
                      </span>
                    </div>
                    <h3 className="font-black text-slate-800 uppercase tracking-tight group-hover:text-[#1A237E] transition-colors">{dfd.objeto_contratacao}</h3>
                    <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest">Criada em {new Date(dfd.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-12">
                  <div className="text-right flex flex-col items-end">
                    <span className="flex items-center gap-1 text-[10px] font-black text-black/20 uppercase tracking-widest">
                       <CurrencyDollar size={14} weight="bold" /> Valor Estimado
                    </span>
                    <span className="text-xl font-display font-black text-[#1A237E]">
                       R$ {Number(dfd.valor_total_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center text-black/40 group-hover:bg-[#1A237E] group-hover:text-white transition-all shadow-sm">
                       <CaretRight size={24} weight="bold" />
                     </div>
                  </div>
                </div>
              </motion.div>
            )
          })
        )}

        {!loading && dfds.length === 0 && (
          <div className="mt-12 p-20 border-2 border-dashed border-black/5 rounded-[48px] flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-24 h-24 bg-black/5 rounded-full flex items-center justify-center text-black/5">
              <Files size={48} weight="fill" />
            </div>
            <div className="space-y-1">
               <h3 className="font-black text-xl text-black/40 uppercase italic tracking-tighter">Nenhum pedido encontrado</h3>
               <p className="text-sm text-black/20 font-bold uppercase tracking-widest">Você ainda não iniciou nenhum planejamento para o ciclo 2027.</p>
            </div>
            <Link href="/catalogo" className="bg-indigo-50 text-[#1A237E] px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-100 transition-all">
               Começar Agora
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

