'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Printer, ArrowLeft } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

export default function DfdPdfPage() {
  const { id } = useParams()
  const [dfd, setDfd] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data: dfdData } = await supabase
        .from('dfds')
        .select('*, campi(nome, sigla), profiles:solicitante_id(full_name, email)')
        .eq('id', id)
        .single()
      
      const { data: itemsData } = await supabase
        .from('dfd_items')
        .select('*')
        .eq('dfd_id', id)
      
      setDfd(dfdData)
      setItems(itemsData || [])
      setLoading(false)
    }
    fetchData()
  }, [id])

  if (loading) return <div className="p-20 text-center font-bold">Gerando Documento...</div>

  return (
    <div className="bg-slate-50 min-h-screen p-0 md:p-10 flex flex-col items-center">
      <div className="w-full max-w-4xl flex justify-between mb-6 no-print">
         <Button variant="ghost" onClick={() => window.history.back()} className="font-bold">
            <ArrowLeft size={20} className="mr-2" /> Voltar
         </Button>
         <Button onClick={() => window.print()} className="bg-slate-900 text-white font-bold">
            <Printer size={20} className="mr-2" /> Imprimir / Salvar PDF
         </Button>
      </div>

      <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-[20mm] shadow-2xl print:shadow-none print:p-0">
        {/* Header Institucional */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-10">
           <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tighter">UNIVERSIDADE DE PERNAMBUCO</h1>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{dfd.campi?.nome || 'Campus Regional'}</p>
              <p className="text-xs font-medium text-slate-400">Sistema de Planejamento PERCATA 2027</p>
           </div>
           <div className="text-right">
              <div className="bg-slate-900 text-white px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest mb-2">
                 Documento Oficial
              </div>
              <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter">PROT: {dfd.id.slice(0, 8)}</p>
           </div>
        </div>

        {/* Título */}
        <div className="text-center mb-12">
           <h2 className="text-xl font-black uppercase tracking-tight">Documento de Formalização de Demanda (DFD)</h2>
           <p className="text-sm font-bold text-slate-400 mt-1 italic">Processo de Planejamento e Consolidação Anual</p>
        </div>

        {/* Dados Gerais */}
        <div className="grid grid-cols-2 gap-10 mb-12 text-sm">
           <div className="space-y-4">
              <div>
                 <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Objeto da Contratação</h4>
                 <p className="font-bold text-slate-800 leading-tight mt-1">{dfd.objeto_contratacao}</p>
              </div>
              <div>
                 <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Justificativa Estratégica</h4>
                 <p className="text-slate-600 mt-1 text-xs leading-relaxed">{dfd.justificativa_contratacao}</p>
              </div>
           </div>
           <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Data Prevista</h4>
                    <p className="font-bold text-slate-800 mt-1">{new Date(dfd.previsao_recebimento).toLocaleDateString('pt-BR')}</p>
                 </div>
                 <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Status Atual</h4>
                    <p className="font-bold text-emerald-600 uppercase mt-1">{dfd.status}</p>
                 </div>
              </div>
              <div>
                 <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Responsável</h4>
                 <p className="font-bold text-slate-800 mt-1 uppercase">{dfd.profiles?.full_name}</p>
                 <p className="text-xs text-slate-400">{dfd.profiles?.email}</p>
              </div>
           </div>
        </div>

        {/* Quadro de Itens */}
        <div className="mb-12">
           <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Detalhamento dos Itens</h4>
           <table className="w-full text-xs border-collapse">
              <thead>
                 <tr className="bg-slate-50 text-slate-400 uppercase text-[9px] font-black tracking-widest">
                    <th className="p-3 text-left border border-slate-100">Cód (SIAD)</th>
                    <th className="p-3 text-left border border-slate-100">Descrição do Item</th>
                    <th className="p-3 text-center border border-slate-100">Qtd</th>
                    <th className="p-3 text-right border border-slate-100">V. Unit</th>
                    <th className="p-3 text-right border border-slate-100">V. Total</th>
                 </tr>
              </thead>
              <tbody>
                 {items.map((item) => (
                    <tr key={item.id} className="text-slate-700">
                       <td className="p-3 border border-slate-100 font-mono font-bold text-[10px]">{item.codigo_tce}</td>
                       <td className="p-3 border border-slate-100 font-bold leading-tight uppercase text-[10px]">{item.descricao}</td>
                       <td className="p-3 border border-slate-100 text-center font-bold">{item.quantidade}</td>
                       <td className="p-3 border border-slate-100 text-right">R$ {Number(item.valor_unitario_estimado).toLocaleString('pt-BR')}</td>
                       <td className="p-3 border border-slate-100 text-right font-black">R$ {(item.quantidade * item.valor_unitario_estimado).toLocaleString('pt-BR')}</td>
                    </tr>
                 ))}
              </tbody>
              <tfoot>
                 <tr className="bg-slate-900 text-white font-black italic">
                    <td colSpan={4} className="p-3 text-right uppercase tracking-tighter">Valor Total da Demanda</td>
                    <td className="p-3 text-right text-lg">R$ {items.reduce((acc, i) => acc + (i.quantidade * i.valor_unitario_estimado), 0).toLocaleString('pt-BR')}</td>
                 </tr>
              </tfoot>
           </table>
        </div>

        {/* Justificativa de Quantidade */}
        <div className="mb-16 p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
           <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Diferencial de Quantitativo</h4>
           <p className="text-xs text-slate-500 leading-relaxed italic">
              {dfd.justificativa_quantidade || 'Memória de cálculo baseada na média de consumo histórico e previsão de novas turmas.'}
           </p>
        </div>

        {/* Assinaturas */}
        <div className="grid grid-cols-2 gap-20 pt-10 mt-auto">
           <div className="text-center border-t border-slate-300 pt-4">
              <p className="text-[10px] font-black uppercase tracking-widest">{dfd.profiles?.full_name}</p>
              <p className="text-[8px] text-slate-400 uppercase">Solicitante</p>
              <p className="text-[7px] font-mono text-slate-300 mt-2">HASH: {dfd.id.slice(0, 16)}...</p>
           </div>
           <div className="text-center border-t border-slate-300 pt-4">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-20">Assinatura da Chefia</p>
              <p className="text-[8px] text-slate-400 uppercase">Homologação Técnica</p>
           </div>
        </div>

        {/* Rodapé Administrativo */}
        <div className="mt-20 border-t border-slate-100 pt-6 flex justify-between items-center text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em]">
           <span>Emitido via PERCATA 2027</span>
           <span>Pág 01 de 01</span>
           <span className="font-mono">{new Date().toLocaleString('pt-BR')}</span>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          .bg-slate-50 { background: white !important; }
          .shadow-2xl { shadow: none !important; }
        }
      `}</style>
    </div>
  )
}
