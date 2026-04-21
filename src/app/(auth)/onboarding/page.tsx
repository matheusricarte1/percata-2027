'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { 
  Check, 
  Buildings, 
  Flask, 
  IdentificationCard, 
  CaretRight, 
  CaretLeft, 
  GraduationCap,
  Sparkle,
  Target,
  UsersThree,
  HandWaving,
  RocketLaunch
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Progress } from '@/components/ui/progress'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Campus {
  id: string
  nome: string
  sigla: string
}

interface Item {
  id: string
  nome: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [campi, setCampi] = useState<Campus[]>([])
  const [depts, setDepts] = useState<Item[]>([])
  const [labs, setLabs] = useState<Item[]>([])
  
  const [selectedCampus, setSelectedCampus] = useState<string | null>(null)
  const [selectedDepts, setSelectedDepts] = useState<string[]>([])
  const [selectedLabs, setSelectedLabs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const { data: campiData } = await supabase.from('campi').select('*').eq('ativo', true)
      if (campiData) setCampi(campiData)
      
      const { data: labsData } = await supabase.from('laboratorios').select('*').eq('ativo', true)
      if (labsData) setLabs(labsData)
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedCampus) {
      async function fetchDepts() {
        const { data } = await supabase
          .from('departamentos')
          .select('*')
          .eq('campus_id', selectedCampus)
          .eq('ativo', true)
        if (data) setDepts(data)
      }
      fetchDepts()
    }
  }, [selectedCampus])

  const handleNext = () => setStep(s => s + 1)
  const handleBack = () => setStep(s => s - 1)

  const toggleSelection = (id: string, list: string[], setList: (l: string[]) => void) => {
    if (list.includes(id)) {
      setList(list.filter(item => item !== id))
    } else {
      setList([...list, id])
    }
  }

  const handleComplete = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não encontrado')

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ campus_id: selectedCampus })
        .eq('id', user.id)

      if (profileError) throw profileError

      const unitInserts = [
        ...selectedDepts.map(id => ({ user_id: user.id, unit_type: 'departamento', unit_id: id })),
        ...selectedLabs.map(id => ({ user_id: user.id, unit_type: 'laboratorio', unit_id: id }))
      ]

      if (unitInserts.length > 0) {
        const { error: unitsError } = await supabase
          .from('user_units')
          .insert(unitInserts)
        
        if (unitsError) throw unitsError
      }

      toast.success('Identidade institucional configurada!')
      router.push('/dashboard')
    } catch (error: any) {
      toast.error('Erro ao configurar perfil: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const progress = (step / 3) * 100

  return (
    <div className="min-h-screen bg-[#FDFBFF] flex flex-col items-center justify-center p-6 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Animated Background Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
         <motion.div 
           animate={{ 
             scale: [1, 1.2, 1],
             x: [0, 50, 0],
             opacity: [0.03, 0.05, 0.03]
           }}
           transition={{ duration: 20, repeat: Infinity }}
           className="absolute -top-40 -left-40 w-[800px] h-[800px] bg-[#1A237E] rounded-full blur-[120px]"
         />
         <motion.div 
           animate={{ 
             scale: [1, 1.1, 1],
             x: [0, -30, 0],
             opacity: [0.02, 0.04, 0.02]
           }}
           transition={{ duration: 15, repeat: Infinity, delay: 5 }}
           className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-amber-400 rounded-full blur-[150px]"
         />
      </div>

      <div className="w-full max-w-3xl space-y-12 relative z-10">
        
        {/* Header Content */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-indigo-50 rounded-full border border-indigo-100 shadow-sm">
             <RocketLaunch size={18} weight="fill" className="text-indigo-600" />
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700">Primeiros Passos PCA 2027</span>
          </div>
          <h1 className="font-display text-5xl font-black italic tracking-tighter text-[#1A237E] uppercase leading-none">
             Bem-vinda(o) ao PERCATA
          </h1>
          <p className="text-slate-400 text-lg font-medium max-w-sm mx-auto leading-tight">
            Precisamos vincular sua conta às suas unidades de atuação institucional.
          </p>
        </motion.div>

        {/* Dynamic Stepper Visualizaion */}
        <div className="space-y-4 px-10">
           <div className="flex justify-between items-end mb-2">
              <div className="space-y-1">
                 <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300">Progresso da Identidade</span>
                 <p className="text-sm font-bold text-[#1A237E]">Passo {step} de 3</p>
              </div>
              <span className="text-2xl font-black italic text-indigo-600 tracking-tighter">{Math.round(progress)}%</span>
           </div>
           <div className="h-4 bg-slate-100 rounded-full p-1 ring-1 ring-black/[0.02]">
              <motion.div 
                animate={{ width: `${progress}%` }}
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all duration-700" 
              />
           </div>
        </div>

        {/* Main Selection Card */}
        <motion.div 
          layout
          className="bg-white rounded-[60px] border border-black/[0.03] shadow-[0_40px_100px_-20px_rgba(26,35,126,0.12)] overflow-hidden"
        >
          <div className="p-12 space-y-12">
            
            <div className="flex items-center gap-6 pb-10 border-b border-slate-50">
              <motion.div 
                key={step}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-20 h-20 bg-indigo-50 rounded-[28px] flex items-center justify-center text-indigo-600 shadow-inner ring-8 ring-indigo-50/50"
              >
                {step === 1 && <GraduationCap size={44} weight="duotone" />}
                {step === 2 && <Buildings size={44} weight="duotone" />}
                {step === 3 && <Flask size={44} weight="duotone" />}
              </motion.div>
              <div className="space-y-1">
                <h2 className="font-display text-4xl font-black italic uppercase tracking-tighter text-[#1A237E] leading-none">
                  {step === 1 && 'Vínculo do Campus'}
                  {step === 2 && 'Gestão de Unidades'}
                  {step === 3 && 'Apoio Tecnológico'}
                </h2>
                <p className="text-slate-400 font-medium">
                  {step === 1 && 'Selecione o campus onde você está lotado(a).'}
                  {step === 2 && 'Quais departamentos você representa juridicamente?'}
                  {step === 3 && 'Você gerencia bibliotecas ou laboratórios de pesquisa?'}
                </p>
              </div>
            </div>

            <div className="min-h-[300px]">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div 
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-1 gap-6"
                  >
                    {campi.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCampus(c.id)}
                        className={cn(
                          "group flex items-center justify-between p-8 rounded-[40px] border-2 transition-all duration-500",
                          selectedCampus === c.id 
                            ? "border-indigo-600 bg-indigo-50/20 shadow-2xl shadow-indigo-900/5 translate-x-2" 
                            : "border-slate-50 hover:border-indigo-100 hover:bg-slate-50/50"
                        )}
                      >
                        <div className="flex items-center gap-6">
                          <div className={cn(
                             "w-16 h-16 rounded-[24px] flex items-center justify-center font-black text-xl transition-all duration-500",
                             selectedCampus === c.id ? "bg-indigo-600 text-white rotate-6" : "bg-white border-2 border-slate-50 text-slate-300"
                          )}>
                            {c.sigla}
                          </div>
                          <div className="text-left space-y-1">
                             <div className={cn("font-black uppercase tracking-tight text-xl transition-colors", selectedCampus === c.id ? "text-indigo-600" : "text-slate-800")}>{c.nome}</div>
                             <p className={cn("text-xs font-bold uppercase tracking-widest", selectedCampus === c.id ? "text-indigo-400" : "text-slate-300")}>Unidade Organizacional</p>
                          </div>
                        </div>
                        {selectedCampus === c.id && (
                          <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white">
                             <Check size={24} weight="bold" />
                          </div>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div 
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  >
                    {depts.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => toggleSelection(d.id, selectedDepts, setSelectedDepts)}
                        className={cn(
                          "group flex items-center justify-between p-6 rounded-[32px] border-2 transition-all duration-300 text-left",
                          selectedDepts.includes(d.id) 
                            ? "border-indigo-600 bg-indigo-50/20" 
                            : "border-slate-50 hover:bg-slate-50"
                        )}
                      >
                        <span className={cn("font-bold text-lg leading-tight uppercase tracking-tighter", selectedDepts.includes(d.id) ? "text-[#1A237E]" : "text-slate-500")}>
                           {d.nome}
                        </span>
                        {selectedDepts.includes(d.id) && (
                           <div className="shrink-0 ml-4 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white">
                              <Check size={14} weight="bold" />
                           </div>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div 
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {labs.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => toggleSelection(l.id, selectedLabs, setSelectedLabs)}
                          className={cn(
                            "group flex items-center justify-between p-6 rounded-[32px] border-2 transition-all duration-300 text-left",
                            selectedLabs.includes(l.id) 
                              ? "border-indigo-600 bg-indigo-50/20" 
                              : "border-slate-50 hover:bg-slate-50"
                          )}
                        >
                          <span className={cn("font-bold text-lg leading-tight uppercase tracking-tighter", selectedLabs.includes(l.id) ? "text-[#1A237E]" : "text-slate-500")}>
                             {l.nome}
                          </span>
                        </button>
                      ))}
                    </div>
                    
                    <div className="p-8 rounded-[40px] bg-indigo-900 border border-white/10 shadow-2xl relative overflow-hidden group">
                       <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full pointer-events-none" />
                       <div className="flex gap-6 items-start relative z-10">
                          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-300 shrink-0">
                             <Sparkle size={28} weight="duotone" />
                          </div>
                          <div className="space-y-2">
                             <h4 className="text-white font-black uppercase text-xs tracking-widest">Dica de Gestão</h4>
                             <p className="text-white/60 text-xs font-medium leading-relaxed">
                                Vincular-se a laboratórios e departamentos permite que o sistema organize as DFDs por **Centro de Custo**, facilitando a aprovação pela chefia técnica competente.
                             </p>
                          </div>
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer Controllers */}
          <div className="p-12 pt-0 flex justify-between gap-6">
            {step > 1 ? (
              <Button 
                variant="ghost" 
                onClick={handleBack} 
                className="h-20 px-10 rounded-[32px] font-black uppercase italic tracking-widest text-[#1A237E] hover:bg-indigo-50 transition-all"
              >
                <CaretLeft size={24} weight="bold" className="mr-3" /> Voltar
              </Button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <Button 
                onClick={handleNext} 
                disabled={step === 1 && !selectedCampus}
                className="h-20 px-12 rounded-[32px] bg-[#1A237E] hover:bg-indigo-700 text-white font-black uppercase italic tracking-widest text-lg shadow-2xl shadow-indigo-100 group transition-all"
              >
                Próximo <CaretRight size={24} weight="bold" className="ml-3 group-hover:translate-x-2 transition-transform" />
              </Button>
            ) : (
              <Button 
                onClick={handleComplete} 
                disabled={loading || selectedDepts.length === 0}
                className="h-20 px-16 rounded-[40px] bg-[#1A237E] hover:bg-indigo-700 text-white font-black uppercase italic tracking-widest text-xl shadow-[0_20px_50px_-10px_rgba(26,35,126,0.5)] transition-all animate-pulse"
              >
                {loading ? 'FINALIZANDO...' : 'ATIVAR CONTA PCA 2027'}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
