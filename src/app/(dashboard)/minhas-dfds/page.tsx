'use client'

import React, { useEffect, useState } from 'react'
import { 
  Funnel, 
  MagnifyingGlass, 
  CheckCircle, 
  Clock, 
  WarningCircle, 
  ArrowRight,
  FileText,
  Printer
} from '@phosphor-icons/react'
import { useUserStore } from '@/store/user'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function MinhasDFDsPage() {
  const { user } = useUserStore()
  const router = useRouter()
  const [dfds, setDfds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDFDs() {
      if (!user) return
      setLoading(true)
      const { data, error } = await supabase
        .from('dfds')
        .select('*')
        .eq('solicitante_id', user.id)
        .order('created_at', { ascending: false })
      
      if (data) setDfds(data)
      setLoading(false)
    }
    fetchDFDs()
  }, [user])

  const counts = {
    analise: dfds.filter(d => ['triagem', 'rascunho'].includes(d.status)).length,
    aprovada: dfds.filter(d => d.status === 'aprovada').length,
    ressalva: dfds.filter(d => d.status === 'devolvida').length
  }

  return (
    <div className="p-8 space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="font-display text-4xl font-extrabold text-[#1C1B1F] tracking-tight">
            Minhas DFDs
          </h1>
          <p className="text-[#625B71] font-medium opacity-80">
            Acompanhe o status das suas solicitações para o PCA 2027.
          </p>
        </div>

        <button 
          onClick={() => router.push('/catalogo')}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#6750A4] text-white font-bold shadow-lg shadow-[#6750A4]/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <FileText size={20} weight="bold" />
          Nova Solicitação
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatusCard icon={Clock} label="Em Triagem" count={counts.analise} color="amber" />
        <StatusCard icon={CheckCircle} label="Aprovadas" count={counts.aprovada} color="emerald" />
        <StatusCard icon={WarningCircle} label="Devolvidas" count={counts.ressalva} color="red" />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-black/5 flex flex-col md:flex-row gap-4 items-center justify-between bg-white/50">
           <div className="flex items-center gap-3 w-full md:w-auto">
              <h2 className="font-display text-xl font-bold text-[#1C1B1F]">Histórico</h2>
              <span className="px-3 py-1 rounded-full bg-[#EADDFF] text-[#21005D] text-[10px] font-black uppercase tracking-widest">
                 {dfds.length} Registros
              </span>
           </div>

           <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                 <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" size={18} />
                 <input 
                   type="text" 
                   placeholder="Buscar por protocolo ou objeto..." 
                   className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-black/5 border-none focus:ring-2 focus:ring-[#6750A4]/20 transition-all text-sm font-medium"
                 />
              </div>
           </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
           {loading ? (
             <div className="flex flex-col items-center justify-center p-20 gap-4">
                <div className="w-10 h-10 border-4 border-[#6750A4] border-t-transparent rounded-full animate-spin" />
                <p className="font-bold text-[#625B71]">Sincronizando com Supabase...</p>
             </div>
           ) : dfds.length === 0 ? (
              <div className="p-20 text-center space-y-4">
                 <div className="w-20 h-20 bg-black/5 rounded-full flex items-center justify-center mx-auto text-black/10">
                    <FileText size={40} />
                 </div>
                 <p className="font-bold text-black/30">Nenhuma solicitação encontrada para 2027.</p>
              </div>
           ) : (
             <table className="w-full text-left">
                <thead>
                   <tr className="bg-[#FBFAFD] text-[10px] font-black uppercase tracking-widest text-[#625B71]/60">
                      <th className="px-8 py-4">Protocolo / Data</th>
                      <th className="px-8 py-4">Objeto da Solicitação</th>
                      <th className="px-8 py-4 text-right">Valor Total</th>
                      <th className="px-8 py-4 text-center">Status</th>
                      <th className="px-8 py-4 text-right pr-12">Ações</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                   {dfds.map((dfd) => (
                      <tr key={dfd.id} className="hover:bg-[#F6F2F7] transition-all group">
                         <td className="px-8 py-6">
                            <div className="font-mono text-xs font-bold text-[#6750A4]">{dfd.numero_protocolo}</div>
                            <div className="text-[10px] text-black/40 font-bold mt-0.5">
                               {new Date(dfd.created_at).toLocaleDateString('pt-BR')}
                            </div>
                         </td>
                         <td className="px-8 py-6">
                            <div className="font-bold text-[#1C1B1F] group-hover:text-[#6750A4] transition-colors line-clamp-1">{dfd.objeto_contratacao}</div>
                            <p className="text-[9px] text-black/40 font-bold uppercase tracking-tighter">{dfd.campus}</p>
                         </td>
                         <td className="px-8 py-6 text-right">
                            <div className="font-display font-black text-[#1C1B1F]">
                               R$ {Number(dfd.valor_total_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                         </td>
                         <td className="px-8 py-6 text-center">
                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              dfd.status === 'aprovada' ? 'bg-emerald-100 text-emerald-800' :
                              dfd.status === 'devolvida' ? 'bg-red-100 text-red-800' :
                              ['triagem', 'rascunho'].includes(dfd.status) ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {dfd.status === 'triagem' ? 'Em Triagem' : dfd.status}
                            </span>
                         </td>
                         <td className="px-8 py-6 text-right pr-12">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                               <button 
                                 onClick={() => router.push(`/dfd/${dfd.id}/impressao`)}
                                 className="p-2 rounded-lg hover:bg-[#EADDFF] text-[#6750A4] transition-colors"
                               >
                                  <Printer size={20} weight="fill" />
                               </button>
                               <button className="p-2 rounded-lg hover:bg-black/5 text-black/60 transition-colors">
                                  <ArrowRight size={20} weight="bold" />
                               </button>
                            </div>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
           )}
        </div>
      </div>
    </div>
  )
}

function StatusCard({ icon: Icon, label, count, color }: { icon: any, label: string, count: number, color: string }) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700'
  }
  return (
    <div className="glass-card p-6 flex items-center justify-between group hover:translate-y-[-4px] transition-all">
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colors[color]} transition-transform group-hover:scale-110`}>
          <Icon size={32} weight="fill" />
        </div>
        <div className="space-y-0.5">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-black/40">{label}</p>
          <p className="font-display text-2xl font-black text-black/80">{count} Demandas</p>
        </div>
      </div>
    </div>
  )
}
