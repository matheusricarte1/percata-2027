'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowRight, 
  ArrowLeft,
  CheckCircle,
  Package,
  Warning,
  Files,
  ChatText,
  Calendar,
  CurrencyDollar,
  Link as LinkIcon,
  MapPin,
  Buildings,
  Flask,
  Trash
} from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useCarrinhoStore } from '@/store/carrinho'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface DFDGroup {
  classe: string
  items: any[]
  formData: {
    objeto: string
    justificativa_contratacao: string
    justificativa_quantidade: string
    previsao_data: string
    unidade_id: string
    tipo_unidade: 'departamento' | 'laboratorio'
  }
}

export default function NovaDFD() {
  const router = useRouter()
  const { items, clearCarrinho, removeItem } = useCarrinhoStore()
  const [step, setStep] = useState(1)
  const [dfdGroups, setDfdGroups] = useState<DFDGroup[]>([])
  const [userUnits, setUserUnits] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // 1. Agrupamento Automático por Classe
  useEffect(() => {
    if (items.length > 0) {
      const groups: { [key: string]: any[] } = {}
      items.forEach(item => {
        const classe = item.item_efisco.classe || 'Material Diverso'
        if (!groups[classe]) groups[classe] = []
        groups[classe].push({
          ...item,
          quantidade: 1,
          valor_unitario: 0,
          justificativa_item: '',
          local_uso: '',
          link_referencia: ''
        })
      })

      setDfdGroups(Object.keys(groups).map(classe => ({
        classe,
        items: groups[classe],
        formData: {
          objeto: `Aquisição de ${classe}`,
          justificativa_contratacao: '',
          justificativa_quantidade: '',
          previsao_data: '',
          unidade_id: '',
          tipo_unidade: 'departamento'
        }
      })))
    } else {
       setDfdGroups([])
    }
  }, [items])

  // 2. Busca Unidades do Usuário
  useEffect(() => {
    async function getUnits() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('user_units')
          .select('*')
          .eq('user_id', user.id)
        
        if (data) {
           // Complementar com nomes (em uma app real faríamos um JOIN)
           const deptsIds = data.filter(u => u.unit_type === 'departamento').map(u => u.unit_id)
           const labsIds = data.filter(u => u.unit_type === 'laboratorio').map(u => u.unit_id)
           
           const { data: deptsData } = await supabase.from('departamentos').select('id, nome').in('id', deptsIds)
           const { data: labsData } = await supabase.from('laboratorios').select('id, nome').in('id', labsIds)

           const fullUnits = data.map(u => {
             const name = u.unit_type === 'departamento' 
               ? deptsData?.find(d => d.id === u.unit_id)?.nome 
               : labsData?.find(l => l.id === u.unit_id)?.nome
             return { ...u, nome: name || 'Unidade não encontrada' }
           })
           setUserUnits(fullUnits)
        }
      }
    }
    getUnits()
  }, [])

  const updateGroupForm = (index: number, field: string, value: any) => {
    const newGroups = [...dfdGroups]
    newGroups[index].formData = { ...newGroups[index].formData, [field]: value }
    setDfdGroups(newGroups)
  }

  const updateItem = (groupIndex: number, itemIndex: number, field: string, value: any) => {
    const newGroups = [...dfdGroups]
    newGroups[groupIndex].items[itemIndex] = { ...newGroups[groupIndex].items[itemIndex], [field]: value }
    setDfdGroups(newGroups)
  }

  const handleFinalize = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      // Busca perfil para campus_id
      const { data: profile } = await supabase.from('profiles').select('campus_id').eq('id', user.id).single()

      for (const group of dfdGroups) {
        // 1. Criar DFD
        const { data: dfd, error: dfdError } = await supabase
          .from('dfds')
          .insert({
            solicitante_id: user.id,
            campus_id: profile?.campus_id,
            unidade_id: group.formData.unidade_id,
            tipo_unidade: group.formData.tipo_unidade,
            objeto_contratacao: group.formData.objeto,
            justificativa_contratacao: group.formData.justificativa_contratacao,
            justificativa_quantidade: group.formData.justificativa_quantidade,
            previsao_recebimento: group.formData.previsao_data || null,
            status: 'rascunho'
          })
          .select()
          .single()

        if (dfdError) throw dfdError

        // 2. Criar Itens
        const itemsToInsert = group.items.map(item => ({
          dfd_id: dfd.id,
          codigo_tce: item.item_efisco.codigo_tce,
          descricao: item.item_efisco.descricao,
          quantidade: item.quantidade,
          valor_unitario_estimado: item.valor_unitario,
          justificativa_item: item.justificativa_item,
          local_uso: item.local_uso,
          link_referencia: item.link_referencia
        }))

        const { error: itemsError } = await supabase.from('dfd_items').insert(itemsToInsert)
        if (itemsError) throw itemsError
      }

      toast.success(`${dfdGroups.length} DFDs criadas com sucesso como rascunho!`)
      clearCarrinho()
      router.push('/dashboard')
    } catch (error: any) {
      toast.error('Erro ao finalizar DFDs: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-in fade-in">
        <Package size={80} weight="thin" className="text-slate-300 mb-6" />
        <h2 className="text-2xl font-black text-slate-800">Seu carrinho está vazio</h2>
        <p className="text-slate-500 mb-8">Selecione itens no catálogo para começar seu planejamento.</p>
        <Button onClick={() => router.push('/catalogo')} className="bg-[#1A237E] rounded-full px-8">
           Ir para o Catálogo
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-32">
      {/* Header Contextual */}
      <div className="space-y-2">
        <h1 className="font-display text-4xl font-black text-[#1A237E] tracking-tighter italic">CONFIGURAR DEMANDAS</h1>
        <p className="text-slate-400 font-medium">
          O sistema identificou <span className="text-[#1A237E] font-bold">{dfdGroups.length} categorias</span> de itens. 
          Preencha as justificativas para cada uma.
        </p>
      </div>

      {/* Accordion de DFDs Agrupadas */}
      <div className="space-y-6">
        {dfdGroups.map((group, gIdx) => (
          <motion.div 
            key={group.classe}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gIdx * 0.1 }}
            className="bg-white rounded-[40px] border border-black/5 shadow-xl overflow-hidden"
          >
            {/* Header da DFD */}
            <div className="p-8 bg-[#1A237E] text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                   <Files size={24} weight="fill" />
                </div>
                <div>
                   <h3 className="font-black italic text-lg uppercase tracking-tight">{group.classe}</h3>
                   <p className="text-white/60 text-xs font-bold">{group.items.length} itens no grupo</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-black opacity-40 uppercase tracking-widest">Valor Estimado</div>
                <div className="text-xl font-black tracking-tighter">
                  R$ {group.items.reduce((acc, i) => acc + (i.quantidade * i.valor_unitario), 0).toLocaleString('pt-BR')}
                </div>
              </div>
            </div>

            <div className="p-8 space-y-10">
              {/* Form de Cabeçalho */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                   <FormGroup label="Objeto da Contratação" icon={Files}>
                      <input 
                        type="text" 
                        value={group.formData.objeto}
                        onChange={(e) => updateGroupForm(gIdx, 'objeto', e.target.value)}
                        className="input-custom" 
                      />
                   </FormGroup>
                   <FormGroup label="Justificativa da Contratação" icon={ChatText}>
                      <textarea 
                        rows={3}
                        value={group.formData.justificativa_contratacao}
                        onChange={(e) => updateGroupForm(gIdx, 'justificativa_contratacao', e.target.value)}
                        placeholder="Por que sua unidade precisa destes itens este ano?"
                        className="input-custom resize-none" 
                      />
                   </FormGroup>
                </div>

                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <FormGroup label="Unidade Destino" icon={CheckCircle}>
                        <select 
                          value={group.formData.unidade_id}
                          onChange={(e) => {
                            const unit = userUnits.find(u => u.unit_id === e.target.value)
                            updateGroupForm(gIdx, 'unidade_id', e.target.value)
                            updateGroupForm(gIdx, 'tipo_unidade', unit?.unit_type)
                          }}
                          className="input-custom cursor-pointer"
                        >
                          <option value="">Selecione...</option>
                          {userUnits.map(u => (
                            <option key={u.id} value={u.unit_id}>
                              {u.unit_type === 'departamento' ? '🏢' : '🧪'} {u.nome}
                            </option>
                          ))}
                        </select>
                      </FormGroup>
                      <FormGroup label="Previsão de Uso" icon={Calendar}>
                        <input 
                          type="date" 
                          value={group.formData.previsao_data}
                          onChange={(e) => updateGroupForm(gIdx, 'previsao_data', e.target.value)}
                          className="input-custom" 
                        />
                      </FormGroup>
                   </div>
                   <FormGroup label="Justificativa de Quantidade" icon={Package}>
                      <textarea 
                        rows={3}
                        value={group.formData.justificativa_quantidade}
                        onChange={(e) => updateGroupForm(gIdx, 'justificativa_quantidade', e.target.value)}
                        placeholder="Como você calculou as quantidades para este grupo de itens?"
                        className="input-custom resize-none" 
                      />
                   </FormGroup>
                </div>
              </div>

              {/* Lista de Itens Detalhada */}
              <div className="space-y-4">
                 <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-6 bg-[#1A237E] rounded-full"></div>
                    <h4 className="font-display text-lg font-black uppercase text-slate-800 tracking-tight">Detalhes dos Itens</h4>
                 </div>

                 {group.items.map((item, iIdx) => (
                   <div key={item.id} className="p-6 rounded-[32px] bg-slate-50 border border-slate-100 space-y-6 relative group/item">
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover/item:opacity-100"
                      >
                         <Trash size={20} />
                      </button>

                      <div className="flex gap-4 items-start">
                         <div className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-mono font-black text-slate-400">
                            SIAD #{item.item_efisco.codigo_tce}
                         </div>
                         <h5 className="font-bold text-slate-800 text-sm leading-tight">{item.item_efisco.descricao}</h5>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400">Quantidade</label>
                            <input 
                              type="number" 
                              value={item.quantidade}
                              onChange={(e) => updateItem(gIdx, iIdx, 'quantidade', Number(e.target.value))}
                              className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-[#1A237E]/20" 
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400">Valor Unitário (Estimado)</label>
                            <div className="relative">
                               <CurrencyDollar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                               <input 
                                 type="number" 
                                 value={item.valor_unitario}
                                 onChange={(e) => updateItem(gIdx, iIdx, 'valor_unitario', Number(e.target.value))}
                                 className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-9 pr-4 font-bold outline-none focus:ring-2 focus:ring-[#1A237E]/20" 
                               />
                            </div>
                         </div>
                         <div className="md:col-span-2 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400">Link da Fonte de Preço</label>
                            <div className="relative">
                               <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                               <input 
                                 type="text" 
                                 value={item.link_referencia}
                                 onChange={(e) => updateItem(gIdx, iIdx, 'link_referencia', e.target.value)}
                                 placeholder="URL do Painel de Preços, Mercado Livre, etc"
                                 className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-9 pr-4 text-xs font-medium outline-none focus:ring-2 focus:ring-[#1A237E]/20" 
                               />
                            </div>
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400">Local de Uso (Sala/Lab)</label>
                            <div className="relative">
                               <MapPin className="absolute left-3 top-3 text-slate-300" size={18} />
                               <textarea 
                                 rows={1}
                                 value={item.local_uso}
                                 onChange={(e) => updateItem(gIdx, iIdx, 'local_uso', e.target.value)}
                                 className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-9 pr-4 text-xs font-medium outline-none focus:ring-2 focus:ring-[#1A237E]/20 resize-none" 
                               />
                            </div>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400">Justificativa Técnica do Item</label>
                            <div className="relative">
                               <Info className="absolute left-3 top-3 text-slate-300" size={18} />
                               <textarea 
                                 rows={1}
                                 value={item.justificativa_item}
                                 onChange={(e) => updateItem(gIdx, iIdx, 'justificativa_item', e.target.value)}
                                 placeholder="Por que este modelo/marca específico?"
                                 className="input-custom text-xs pl-9 resize-none !bg-white !border-slate-200" 
                               />
                            </div>
                         </div>
                      </div>
                   </div>
                 ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-white via-white to-transparent pointer-events-none">
         <div className="max-w-6xl mx-auto flex justify-end pointer-events-auto">
            <div className="bg-white p-2 rounded-full shadow-2xl border border-black/5 flex items-center gap-4">
               <div className="px-6 text-right">
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Total Geral do Ciclo</div>
                  <div className="text-2xl font-black text-[#1A237E] tracking-tighter">
                    R$ {dfdGroups.reduce((acc, g) => acc + g.items.reduce((iAcc, i) => iAcc + (i.quantidade * i.valor_unitario), 0), 0).toLocaleString('pt-BR')}
                  </div>
               </div>
               <Button 
                onClick={handleFinalize}
                disabled={loading}
                className="bg-[#1A237E] hover:bg-[#1A237E]/90 text-white rounded-full px-12 py-8 font-black uppercase italic tracking-tight text-lg shadow-xl shadow-indigo-200"
               >
                  {loading ? 'PROCESSANDO...' : 'FINALIZAR E SALVAR RASCUNHOS'}
               </Button>
            </div>
         </div>
      </div>
    </div>
  )
}

function FormGroup({ label, icon: Icon, children }: any) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[10px] font-black text-[#1A237E] uppercase tracking-widest ml-1 opacity-60">
        <Icon size={16} weight="bold" />
        {label}
      </label>
      {children}
    </div>
  )
}
