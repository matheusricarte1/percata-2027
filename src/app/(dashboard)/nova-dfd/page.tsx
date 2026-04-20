'use client'

import React, { useState, useEffect } from 'react'
import { 
  Trash, 
  ChatTeardropDots, 
  CheckCircle, 
  ArrowLeft,
  XCircle,
  Package,
  Warning,
  Money,
  Paperclip,
  Check,
  Plus,
  Minus,
  Buildings,
  Calendar,
  FileText,
  ListChecks
} from '@phosphor-icons/react'
import { useCarrinhoStore } from '@/store/carrinho'
import { useUserStore } from '@/store/user'
import { useRouter } from 'next/navigation'
import { Campus, GND } from '@/types'
import { createDFDAction } from '@/app/actions/dfdActions'
import { toast } from 'sonner'

export default function NovaDFDPage() {
  const { items, removeItem, updateItem, clear } = useCarrinhoStore()
  const { user } = useUserStore()
  const router = useRouter()
  
  // Submission States
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [protocoloGerado, setProtocoloGerado] = useState('')

  // Global DFD Data
  const [objeto, setObjeto] = useState('')
  const [justificativaGeral, setJustificativaGeral] = useState('')
  const [campus, setCampus] = useState<Campus>('petrolina')
  const [previsao, setPrevisao] = useState('')

  const total = items.reduce((acc, item) => {
    return acc + (item.quantidade * (item.valor_unitario_estimado || 0))
  }, 0)

  // GND Validation
  const gndMisturado = items.length > 0 && new Set(items.map(i => i.item_efisco.gnd)).size > 1
  const canSubmit = items.length > 0 && objeto.length > 5 && justificativaGeral.length > 10 && previsao && !gndMisturado

  const handleSubmit = async () => {
    if (!canSubmit || !user) return
    setIsSubmitting(true)
    
    const result = await createDFDAction({
      objeto,
      justificativaGeral,
      campus,
      previsao,
      total,
      solicitante_id: user.id
    }, items)

    if (result.success) {
      setProtocoloGerado(result.protocol || '')
      setIsSubmitting(false)
      setSubmitted(true)
      clear()
      toast.success('DFD gerada com sucesso!')
      
      setTimeout(() => {
        router.push('/minhas-dfds')
      }, 3000)
    } else {
      setIsSubmitting(false)
      toast.error('Erro ao gerar DFD: ' + result.error)
    }
  }

  if (submitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
        <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 animate-in zoom-in duration-500">
           <Check size={48} weight="bold" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="font-display text-4xl font-black text-[#1C1B1F]">DFD Gerada com Sucesso!</h1>
          <p className="text-[#625B71] font-medium max-w-md mx-auto">
            Sua solicitação de protocolo <strong>{protocoloGerado}</strong> foi enviada para triagem da Chefia.
          </p>
        </div>
        <button 
          onClick={() => router.push('/minhas-dfds')}
          className="px-8 py-3 rounded-2xl bg-[#6750A4] text-white font-bold"
        >
          Visualizar Minhas DFDs
        </button>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8 pb-32 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-3 rounded-full hover:bg-black/5 transition-colors"
          >
            <ArrowLeft size={24} weight="bold" />
          </button>
          <div className="space-y-1">
            <h1 className="font-display text-4xl font-extrabold text-[#1C1B1F] tracking-tight">
              Gerar Nova DFD
            </h1>
            <p className="text-[#625B71] font-medium">
              Complete os dados institucionais para formalizar sua demanda.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Form Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Step 1: Global Info */}
          <div className="glass-card p-8 space-y-6">
             <h2 className="font-display text-xl font-bold text-[#1C1B1F] flex items-center gap-2 border-b border-black/5 pb-4">
                <FileText size={22} weight="fill" className="text-[#6750A4]" />
                Informações Institucionais
             </h2>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                   <label className="text-[10px] font-black text-black/40 uppercase tracking-widest px-1">Objeto da Contratação</label>
                   <input 
                    type="text" 
                    value={objeto}
                    onChange={(e) => setObjeto(e.target.value)}
                    placeholder="Ex: Aquisição de equipamentos de T.I. para o Setor Financeiro" 
                    className="w-full px-5 py-3.5 rounded-2xl bg-black/5 border-none focus:ring-2 focus:ring-[#6750A4]/20 transition-all font-medium"
                   />
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-black/40 uppercase tracking-widest px-1">Campus Requisitante</label>
                   <select 
                    value={campus}
                    onChange={(e) => setCampus(e.target.value as Campus)}
                    className="w-full px-5 py-3.5 rounded-2xl bg-black/5 border-none focus:ring-2 focus:ring-[#6750A4]/20 transition-all font-medium appearance-none"
                   >
                     <option value="petrolina">Campus Petrolina</option>
                     <option value="ouricuri">Campus Ouricuri</option>
                   </select>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-black/40 uppercase tracking-widest px-1">Previsão de Recebimento</label>
                   <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20" size={18} />
                      <input 
                        type="date" 
                        value={previsao}
                        onChange={(e) => setPrevisao(e.target.value)}
                        className="w-full pl-12 pr-5 py-3.5 rounded-2xl bg-black/5 border-none focus:ring-2 focus:ring-[#6750A4]/20 transition-all font-medium"
                      />
                   </div>
                </div>

                <div className="md:col-span-2 space-y-2">
                   <label className="text-[10px] font-black text-black/40 uppercase tracking-widest px-1">Justificativa da Contratação (Global)</label>
                   <textarea 
                    value={justificativaGeral}
                    onChange={(e) => setJustificativaGeral(e.target.value)}
                    placeholder="Descreva por que esta contratação é necessária para a instituição..." 
                    className="w-full px-5 py-4 rounded-2xl bg-black/5 border-none focus:ring-2 focus:ring-[#6750A4]/20 transition-all font-medium min-h-[120px]"
                   />
                   <p className="text-[10px] text-right text-black/30 font-medium">{justificativaGeral.length} caracteres (mínimo 10)</p>
                </div>
             </div>
          </div>

          {/* Step 2: Items Details */}
          <div className="glass-card overflow-hidden">
            <div className="p-6 bg-white/50 border-b border-black/5 flex justify-between items-center">
               <h2 className="font-display text-xl font-bold text-[#1C1B1F] flex items-center gap-2">
                 <Package size={22} weight="fill" className="text-[#6750A4]" />
                 Itens e Quantitativos 
                 <span className="text-black/30 font-medium text-sm ml-1">({items.length} itens)</span>
               </h2>
            </div>
            
            <div className="divide-y divide-black/5">
              {/* Batch Actions for Grouping */}
              {items.length > 1 && (
                <div className="p-4 bg-[#6750A4]/5 border-b border-black/5 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <ListChecks size={18} weight="fill" className="text-[#6750A4]" />
                      <span className="text-[10px] font-black text-[#6750A4] uppercase tracking-widest">Ações em Lote</span>
                   </div>
                   <button 
                    onClick={() => {
                      const majorJustification = items.find(i => i.justificativa_quantidade)?.justificativa_quantidade || ''
                      items.forEach((_, idx) => updateItem(idx, { justificativa_quantidade: majorJustification }))
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#6750A4]/20 text-[#6750A4] text-xs font-bold hover:bg-[#6750A4] hover:text-white transition-all shadow-sm"
                   >
                     AGRUPAR JUSTIFICATIVAS
                   </button>
                </div>
              )}

              {items.map((item, index) => (
                <div key={`${item.item_efisco.codigo_tce}-${index}`} className="p-8 space-y-6 hover:bg-black/[0.01] transition-colors group">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#F3EDF7] flex items-center justify-center flex-shrink-0 text-[#6750A4]/40">
                       <Package size={32} weight="thin" />
                    </div>
                    
                    <div className="flex-1 space-y-4">
                      {/* Name and Actions */}
                      <div className="flex justify-between items-start">
                        <div>
                           <h3 className="font-bold text-[#1C1B1F] text-lg">{item.item_efisco.descricao}</h3>
                           <p className="text-[10px] font-black text-black/30 uppercase tracking-widest mt-1">SIAD/TCE: {item.item_efisco.codigo_tce}</p>
                        </div>
                        <button 
                          onClick={() => removeItem(index)}
                          className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash size={20} weight="fill" />
                        </button>
                      </div>

                      {/* Config Row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-black/40 uppercase tracking-widest px-1">Quantidade</label>
                           <div className="flex items-center gap-4">
                              <button 
                                onClick={() => updateItem(index, { quantidade: Math.max(1, item.quantidade - 1) })}
                                className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center hover:bg-black/10 transition-all"
                              >
                                <Minus size={18} weight="bold" />
                              </button>
                              <span className="font-display text-xl font-black w-10 text-center">{item.quantidade}</span>
                              <button 
                                onClick={() => updateItem(index, { quantidade: item.quantidade + 1 })}
                                className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center hover:bg-black/10 transition-all"
                              >
                                <Plus size={18} weight="bold" />
                              </button>
                           </div>
                        </div>

                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-black/40 uppercase tracking-widest px-1">Valor Unitário Estimado</label>
                           <div className="relative">
                             <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-black/30">R$</span>
                             <input 
                              type="number" 
                              value={item.valor_unitario_estimado}
                              onChange={(e) => updateItem(index, { valor_unitario_estimado: parseFloat(e.target.value) || 0 })}
                              className="w-full pl-12 pr-4 py-3 rounded-xl bg-black/5 border-none font-display font-bold text-[#1C1B1F]"
                             />
                           </div>
                        </div>
                      </div>

                      {/* Item Justification */}
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-black/40 uppercase tracking-widest px-1">Justificativa da Quantidade (Obrigatória)</label>
                         <div className="relative">
                            <ChatTeardropDots className="absolute left-4 top-4 text-[#6750A4]/40" size={18} />
                            <textarea 
                              placeholder="Explique por que esta quantidade é necessária para o seu setor..."
                              value={item.justificativa_quantidade}
                              onChange={(e) => updateItem(index, { justificativa_quantidade: e.target.value })}
                              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-black/5 border-none focus:ring-2 focus:ring-[#6750A4]/20 transition-all text-sm min-h-[90px]"
                            />
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Totals & Submit */}
        <div className="space-y-6 lg:sticky lg:top-8">
           <div className="glass-card p-8 space-y-8 border-t-8 border-[#6750A4]">
              <h3 className="font-display text-xl font-bold text-[#1C1B1F]">Fechamento da DFD</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between text-sm font-medium text-[#625B71]">
                   <span>Total de Itens</span>
                   <span>{items.length}</span>
                </div>
                <div className="flex justify-between text-sm font-medium text-[#625B71]">
                   <span>Soma dos Quantitativos</span>
                   <span>{items.reduce((acc, i) => acc + i.quantidade, 0)} un</span>
                </div>
                <div className="h-[1px] bg-black/5 my-2" />
                <div className="flex justify-between items-end">
                   <div className="space-y-1">
                      <span className="text-[10px] font-black text-black/40 uppercase tracking-widest">Valor Global Estimado</span>
                      <p className="font-display text-3xl font-black text-[#1C1B1F]">
                         R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                   </div>
                </div>
              </div>

              <div className="space-y-4 p-5 rounded-2xl bg-amber-50 border border-amber-100">
                 <div className="flex items-start gap-3">
                    <Warning size={20} weight="fill" className="text-amber-600 mt-1" />
                    <p className="text-[11px] text-amber-900 leading-relaxed font-semibold">
                       A geração da DFD gerará um protocolo formal. Uma vez enviada, a edição dependerá de devolução pela Chefia.
                    </p>
                 </div>
              </div>

              {gndMisturado && (
                <div className="space-y-4 p-5 rounded-2xl bg-red-50 border border-red-100 mb-4 animate-bounce">
                   <div className="flex items-start gap-3">
                      <XCircle size={24} weight="fill" className="text-red-600 mt-1" />
                      <div>
                        <p className="text-sm text-red-900 font-bold">GNDs Misturados Detectados!</p>
                        <p className="text-[10px] text-red-800/70 leading-relaxed font-medium">
                           Uma DFD não pode conter itens de diferentes Grupos de Natureza de Despesa (ex: Material e Serviço no mesmo pedido). Separe-os em solicitações distintas.
                        </p>
                      </div>
                   </div>
                </div>
              )}

              <button 
                disabled={!canSubmit || isSubmitting}
                onClick={handleSubmit}
                className="w-full py-4 rounded-2xl bg-[#6750A4] text-white font-black text-lg shadow-xl shadow-[#6750A4]/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:grayscale disabled:scale-100 flex items-center justify-center gap-3 relative overflow-hidden"
              >
                {isSubmitting ? (
                   <>
                     <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                     PROCESSANDO...
                   </>
                ) : (
                   <>
                     GERAR DFD FORMAL
                     <CheckCircle size={24} weight="fill" />
                   </>
                )}
              </button>
              
              {!canSubmit && items.length > 0 && (
                <p className="text-[10px] text-center text-red-500 font-bold uppercase tracking-tight">
                  {gndMisturado ? 'Corrija os GNDs dos itens' : 'Preencha Objeto, Justificativa e Previsão'}
                </p>
              )}
           </div>

           <div className="p-6 rounded-3xl bg-blue-50 border border-blue-100 flex gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                 <Money size={24} weight="fill" />
              </div>
              <div>
                 <h4 className="font-bold text-blue-900 text-sm">GND Identificado</h4>
                 <p className="text-[10px] text-blue-800/60 leading-relaxed font-medium">
                    Com base no catálogo, esta DFD será classificada como <strong>3.3.90.30 - Material de Consumo</strong>.
                 </p>
              </div>
           </div>
        </div>

      </div>
    </div>
  )
}
