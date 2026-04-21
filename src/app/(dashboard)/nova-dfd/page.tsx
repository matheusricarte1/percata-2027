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
  Trash,
  Info,
  ShoppingCartSimple,
  CaretRight,
  CaretLeft,
  TrendUp
} from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useCarrinhoStore } from '@/store/carrinho'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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

  useEffect(() => {
    if (items.length > 0) {
      const groups: { [key: string]: any[] } = {}
      items.forEach(item => {
        const classe = item.item_efisco.classe || 'Material Diverso'
        if (!groups[classe]) groups[classe] = []
        groups[classe].push({
          ...item,
          quantidade: item.quantidade || 1,
          valor_unitario: item.valor_estimado || 0,
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

  useEffect(() => {
    async function getUnits() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('user_units')
          .select('*')
          .eq('user_id', user.id)
        
        if (data) {
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

      const { data: profile } = await supabase.from('profiles').select('campus_id').eq('id', user.id).single()

      for (const group of dfdGroups) {
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
      router.push('/minhas-dfds')
    } catch (error: any) {
      toast.error('Erro ao finalizar DFDs: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-40 animate-in fade-in slide-in-from-bottom-10 h-screen">
        <div className="w-40 h-40 bg-slate-50 rounded-[40px] flex items-center justify-center text-slate-200 mb-10 ring-1 ring-slate-100 shadow-inner">
           <ShoppingCartSimple size={80} weight="thin" />
        </div>
        <h2 className="text-4xl font-display font-black text-[#1A237E] uppercase tracking-tighter italic">Seu carrinho está vazio</h2>
        <p className="text-slate-400 font-medium mb-12 text-center max-w-sm">
           Selecione itens no catálogo oficial da instituição para iniciar o planejamento das suas demandas.
        </p>
        <Button onClick={() => router.push('/catalogo')} className="bg-[#1A237E] rounded-full px-12 h-16 text-lg shadow-2xl shadow-indigo-200 font-black uppercase italic tracking-widest">
           Explorar Catálogo
        </Button>
      </div>
    )
  }

  const totalGeral = dfdGroups.reduce((acc, g) => acc + g.items.reduce((iAcc, i) => iAcc + (i.quantidade * i.valor_unitario), 0), 0)

  return (
    <div className="max-w-7xl mx-auto space-y-16 pb-64 px-8">
      {/* Dynamic Stepper Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 pt-12">
        <div className="space-y-3">
           <div className="flex items-center gap-3">
              <span className="bg-indigo-50 text-indigo-700 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100/50">Fluxo de Solicitação PCA</span>
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
           </div>
           <h1 className="font-display text-6xl font-black text-[#1A237E] tracking-tighter italic leading-none">CONFIGURAR DEMANDAS</h1>
           <p className="text-slate-400 font-medium text-lg max-w-2xl leading-relaxed pr-10">
             O sistema agrupou inteligentemente seus <span className="text-[#1A237E] font-bold">{items.length} itens</span> em <span className="text-indigo-600 font-bold">{dfdGroups.length} categorias</span> para otimizar o processo de licitação.
           </p>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl flex items-center gap-8 min-w-[320px]">
           <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-700 shrink-0">
              <TrendUp size={32} weight="duotone" />
           </div>
           <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Prévia PCA</span>
              <div className="text-3xl font-black text-[#1A237E] tracking-tighter">
                R$ {totalGeral.toLocaleString('pt-BR')}
              </div>
           </div>
        </div>
      </div>

      {/* Accordion list with high-fidelity transitions */}
      <div className="space-y-10">
        <AnimatePresence mode="popLayout">
          {dfdGroups.map((group, gIdx) => (
            <motion.div 
              key={group.classe}
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ 
                type: 'spring',
                damping: 25,
                stiffness: 200,
                delay: gIdx * 0.1 
              }}
              className="bg-white rounded-[56px] border border-black/[0.03] shadow-2xl overflow-hidden group/card"
            >
              {/* Header da DFD - Premium Indigo Variant */}
              <div className="p-10 bg-gradient-to-br from-[#1A237E] to-[#0D1452] text-white flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-[28px] flex items-center justify-center text-indigo-200 border border-white/10 ring-4 ring-white/5 shadow-inner">
                     <Files size={32} weight="duotone" />
                  </div>
                  <div className="space-y-1">
                     <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40">Grupo Licitatório</span>
                        <span className="px-2 py-0.5 bg-indigo-400/20 text-indigo-200 rounded text-[9px] font-black border border-indigo-400/10">PCA 2027</span>
                     </div>
                     <h3 className="font-display font-black italic text-2xl uppercase tracking-tighter leading-none">{group.classe}</h3>
                     <p className="text-indigo-300/60 text-xs font-bold uppercase tracking-widest">{group.items.length} itens condicionados</p>
                  </div>
                </div>

                <div className="flex items-center gap-10 bg-white/5 backdrop-blur-md px-10 py-5 rounded-[32px] border border-white/5">
                  <div className="text-right">
                    <div className="text-[9px] font-black opacity-30 uppercase tracking-[0.3em] mb-1">Previsão Financeira</div>
                    <div className="text-3xl font-black tracking-tighter text-indigo-100">
                      R$ {group.items.reduce((acc, i) => acc + (i.quantidade * i.valor_unitario), 0).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-10 space-y-16">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                  <div className="space-y-10">
                     <FormGroup label="TÍTULO DO OBJETO" icon={Files}>
                        <div className="relative group/input">
                           <input 
                             type="text" 
                             value={group.formData.objeto}
                             onChange={(e) => updateGroupForm(gIdx, 'objeto', e.target.value)}
                             className="w-full bg-[#F8F9FE] border-2 border-transparent rounded-[24px] py-6 px-10 font-bold text-[#1A237E] text-lg outline-none focus:ring-8 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-500/20 transition-all shadow-inner group-focus-within/input:shadow-2xl" 
                           />
                           <div className="absolute left-4 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-full opacity-20" />
                        </div>
                     </FormGroup>

                     <FormGroup label="JUSTIFICATIVA DA NECESSIDADE" icon={ChatText}>
                        <div className="relative group/textarea">
                           <textarea 
                             rows={6}
                             value={group.formData.justificativa_contratacao}
                             onChange={(e) => updateGroupForm(gIdx, 'justificativa_contratacao', e.target.value)}
                             placeholder="Ex: Demanda urgente para reposição de materiais de laboratório essenciais para as aulas de Química I..."
                             className="w-full bg-[#F8F9FE] border-2 border-transparent rounded-[32px] py-8 px-10 font-medium text-slate-700 text-base leading-relaxed outline-none focus:ring-8 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-500/20 transition-all resize-none shadow-inner group-focus-within/textarea:shadow-2xl" 
                           />
                           <div className="absolute right-6 bottom-6 text-[10px] font-black text-slate-300 uppercase tracking-widest pointer-events-none">Obrigatório</div>
                        </div>
                     </FormGroup>
                  </div>

                  <div className="space-y-10">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <FormGroup label="UNIDADE REQUISITANTE" icon={Buildings}>
                           <select 
                             value={group.formData.unidade_id}
                             onChange={(e) => {
                               const unit = userUnits.find(u => u.unit_id === e.target.value)
                               updateGroupForm(gIdx, 'unidade_id', e.target.value)
                               updateGroupForm(gIdx, 'tipo_unidade', unit?.unit_type)
                             }}
                             className="w-full bg-[#F8F9FE] border-2 border-transparent rounded-[24px] py-6 px-10 font-bold text-[#1A237E] outline-none focus:ring-8 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-500/20 transition-all shadow-inner appearance-none cursor-pointer"
                           >
                             <option value="" className="p-4">Selecione...</option>
                             {userUnits.map(u => (
                               <option key={u.id} value={u.unit_id} className="p-4 font-bold">
                                 {u.unit_type === 'departamento' ? '🏢' : '🧪'} {u.nome}
                               </option>
                             ))}
                           </select>
                        </FormGroup>

                        <FormGroup label="PREVISÃO RECEBIMENTO" icon={Calendar}>
                           <input 
                             type="date" 
                             value={group.formData.previsao_data}
                             onChange={(e) => updateGroupForm(gIdx, 'previsao_data', e.target.value)}
                             className="w-full bg-[#F8F9FE] border-2 border-transparent rounded-[24px] py-[22px] px-10 font-bold text-[#1A237E] outline-none focus:ring-8 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-500/20 transition-all shadow-inner cursor-pointer" 
                           />
                        </FormGroup>
                     </div>

                     <FormGroup label="BASE DE CÁLCULO (QUANTIDADES)" icon={Package}>
                        <div className="relative group/textarea">
                           <textarea 
                             rows={6}
                             value={group.formData.justificativa_quantidade}
                             onChange={(e) => updateGroupForm(gIdx, 'justificativa_quantidade', e.target.value)}
                             placeholder="Explique como as quantidades foram dimensionadas (ex: histórico de consumo, alunos matriculados...)"
                             className="w-full bg-[#F8F9FE] border-2 border-transparent rounded-[32px] py-8 px-10 font-medium text-slate-700 text-base leading-relaxed outline-none focus:ring-8 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-500/20 transition-all resize-none shadow-inner group-focus-within/textarea:shadow-2xl" 
                           />
                        </div>
                     </FormGroup>
                  </div>
                </div>

                <div className="space-y-8">
                   <div className="flex items-center justify-between border-b border-indigo-50 pb-6 mb-4">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-1 h-3 bg-indigo-500 rounded-full"></div>
                         <h4 className="font-display text-2xl font-black uppercase text-[#1A237E] tracking-tight italic">Itens do Lote</h4>
                      </div>
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{group.items.length} Itens Mapeados</span>
                   </div>

                   <div className="grid grid-cols-1 gap-6">
                      {group.items.map((item, iIdx) => (
                        <motion.div 
                          key={item.id} 
                          layout
                          className="p-10 rounded-[48px] bg-[#F9FAFF] border border-indigo-50 space-y-10 relative group/item hover:bg-white hover:shadow-2xl hover:shadow-indigo-900/5 transition-all duration-300"
                        >
                           <button 
                             onClick={() => removeItem(item.id)}
                             className="absolute top-8 right-8 w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 transition-all shadow-sm border border-slate-100 hover:scale-110 active:scale-90"
                           >
                              <Trash size={20} weight="bold" />
                           </button>

                           <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                              <div className="bg-white border-2 border-indigo-50 px-5 py-2 rounded-2xl text-xs font-mono font-black text-indigo-600 shadow-sm">
                                 SIAD {item.item_efisco.codigo_tce}
                              </div>
                              <h5 className="font-bold text-[#1A237E] text-xl leading-tight tracking-tight group-hover/item:text-indigo-600 transition-colors uppercase">
                                 {item.item_efisco.descricao}
                              </h5>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
                              <div className="space-y-3">
                                 <label className="text-[10px] font-black uppercase text-indigo-300 tracking-widest ml-1">Quantidade</label>
                                 <input 
                                   type="number" 
                                   value={item.quantidade}
                                   onChange={(e) => updateItem(gIdx, iIdx, 'quantidade', Number(e.target.value))}
                                   className="w-full bg-white border-2 border-indigo-50 rounded-[20px] py-5 px-6 font-black text-2xl text-[#1A237E] outline-none focus:border-indigo-400/30 transition-all shadow-sm text-center" 
                                 />
                              </div>
                              <div className="space-y-3">
                                 <label className="text-[10px] font-black uppercase text-indigo-300 tracking-widest ml-1">Preço Unitário</label>
                                 <div className="relative">
                                    <CurrencyDollar className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-300" size={24} weight="bold" />
                                    <input 
                                      type="number" 
                                      value={item.valor_unitario}
                                      onChange={(e) => updateItem(gIdx, iIdx, 'valor_unitario', Number(e.target.value))}
                                      className="w-full bg-white border-2 border-indigo-50 rounded-[20px] py-5 pl-14 pr-6 font-black text-2xl text-[#1A237E] outline-none focus:border-indigo-400/30 transition-all shadow-sm" 
                                    />
                                 </div>
                              </div>
                              <div className="md:col-span-2 space-y-3">
                                 <label className="text-[10px] font-black uppercase text-indigo-300 tracking-widest ml-1">Referência Técnica (Link)</label>
                                 <div className="relative">
                                    <LinkIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-300" size={24} weight="bold" />
                                    <input 
                                      type="text" 
                                      value={item.link_referencia}
                                      onChange={(e) => updateItem(gIdx, iIdx, 'link_referencia', e.target.value)}
                                      placeholder="Ex: paineldeprecos.planejamento.gov.br"
                                      className="w-full bg-white border-2 border-indigo-50 rounded-[20px] py-5 pl-14 pr-6 font-bold text-[#1A237E] outline-none focus:border-indigo-400/30 transition-all shadow-sm text-sm" 
                                    />
                                 </div>
                              </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                              <div className="space-y-3">
                                 <label className="text-[10px] font-black uppercase text-indigo-300 tracking-widest ml-1">Local Sugerido (Sala/Lab/Setor)</label>
                                 <div className="relative">
                                    <MapPin className="absolute left-5 top-5 text-indigo-200" size={24} />
                                    <textarea 
                                      rows={2}
                                      value={item.local_uso}
                                      onChange={(e) => updateItem(gIdx, iIdx, 'local_uso', e.target.value)}
                                      className="w-full bg-white border-2 border-indigo-50 rounded-[24px] py-5 pl-14 pr-10 font-semibold text-slate-700 outline-none focus:border-indigo-400/30 transition-all shadow-sm resize-none" 
                                    />
                                 </div>
                              </div>
                              <div className="space-y-3">
                                 <label className="text-[10px] font-black uppercase text-indigo-300 tracking-widest ml-1">Justificativa Técnica Adicional</label>
                                 <div className="relative">
                                    <Info className="absolute left-5 top-5 text-indigo-200" size={24} />
                                    <textarea 
                                      rows={2}
                                      value={item.justificativa_item}
                                      onChange={(e) => updateItem(gIdx, iIdx, 'justificativa_item', e.target.value)}
                                      placeholder="Ex: Compatibilidade com equipamentos existentes modelo X..."
                                      className="w-full bg-white border-2 border-indigo-50 rounded-[24px] py-5 pl-14 pr-10 font-semibold text-slate-700 outline-none focus:border-indigo-400/30 transition-all shadow-sm resize-none" 
                                    />
                                 </div>
                              </div>
                           </div>
                        </motion.div>
                      ))}
                   </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-5xl px-8 z-50">
         <motion.div 
           initial={{ y: 100, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           className="bg-white/80 backdrop-blur-2xl p-4 rounded-[40px] border border-indigo-100 shadow-[0_40px_100px_-20px_rgba(26,35,126,0.25)] flex items-center justify-between"
         >
            <div className="flex items-center gap-10 px-6">
               <div className="flex flex-col">
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em] leading-none mb-1">Impacto Financeiro Final</span>
                  <div className="text-4xl font-display font-black text-[#1A237E] tracking-tighter italic">
                    R$ {totalGeral.toLocaleString('pt-BR')}
                  </div>
               </div>
               <div className="h-10 w-[1px] bg-indigo-100 hidden md:block" />
               <div className="hidden md:flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Distorção Prevista</span>
                  <div className="text-sm font-bold text-slate-500 uppercase tracking-tighter">+/- 4.2% Regional</div>
               </div>
            </div>

            <div className="flex items-center gap-4">
               <Button 
                onClick={() => router.back()}
                variant="ghost"
                className="h-16 px-8 rounded-full font-black uppercase italic tracking-widest text-slate-400 hover:text-indigo-600 transition-all"
               >
                  <ArrowLeft size={20} className="mr-3" /> Voltar
               </Button>
               <Button 
                onClick={handleFinalize}
                disabled={loading}
                className="bg-[#1A237E] hover:bg-indigo-700 text-white rounded-[32px] px-16 h-20 font-black uppercase italic tracking-widest text-xl shadow-2xl shadow-indigo-100 group transition-all"
               >
                  {loading ? (
                    <span className="flex items-center gap-3">
                       <ArrowClockwise className="animate-spin" size={24} /> PROCESSANDO
                    </span>
                  ) : (
                    <span className="flex items-center gap-3">
                       FINALIZAR RASCUNHO <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
                    </span>
                  )}
               </Button>
            </div>
         </motion.div>
      </div>
    </div>
  )
}

function FormGroup({ label, icon: Icon, children }: any) {
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em] ml-2">
        <Icon size={20} weight="duotone" className="text-indigo-500" />
        {label}
      </label>
      {children}
    </div>
  )
}

function ArrowClockwise(props: any) {
  return (
    <svg 
      {...props} 
      viewBox="0 0 256 256" 
      fill="currentColor"
    >
      <path d="M240,128a112,112,0,0,1-212.71,39.05L15.47,159A8,8,0,0,1,12,149.33L32,109.33a8,8,0,0,1,11.31-2.67l40,30a8,8,0,0,1-9.6,12.8L51.24,132.33A96,96,0,1,0,128,32a95.42,95.42,0,0,0-67.88,28.12,8,8,0,0,1-11.31-11.31A111.34,111.34,0,0,1,128,16,112.12,112.12,0,0,1,240,128Z" />
    </svg>
  )
}
