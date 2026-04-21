'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Check, Buildings, Flask, IdentificationCard, CaretRight, CaretLeft, GraduationCap } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Progress } from '@/components/ui/progress'

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
  
  // Selection state
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

      // 1. Atualiza o perfil com o campus
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ campus_id: selectedCampus })
        .eq('id', user.id)

      if (profileError) throw profileError

      // 2. Insere as unidades
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

      toast.success('Perfil configurado com sucesso!')
      router.push('/dashboard')
    } catch (error: any) {
      toast.error('Erro ao configurar perfil: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const progress = (step / 3) * 100

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black italic tracking-tighter text-[#1A237E]">PERCATA 2027</h1>
          <p className="text-muted-foreground font-medium">Configure sua identidade institucional para começar</p>
        </div>

        <div className="space-y-2">
           <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-[#1A237E]/40 mb-1">
              <span>Passo {step} de 3</span>
              <span>{Math.round(progress)}% Completo</span>
           </div>
           <Progress value={progress} className="h-2 bg-black/5" />
        </div>

        <Card className="border-none shadow-2xl shadow-indigo-100 bg-white/80 backdrop-blur-xl overflow-hidden">
          <CardHeader className="border-b border-black/5 pb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#1A237E] rounded-2xl text-white">
                {step === 1 && <GraduationCap size={32} weight="fill" />}
                {step === 2 && <Buildings size={32} weight="fill" />}
                {step === 3 && <Flask size={32} weight="fill" />}
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">
                  {step === 1 && 'Escolha seu Campus'}
                  {step === 2 && 'Seus Departamentos'}
                  {step === 3 && 'Seus Laboratórios'}
                </CardTitle>
                <CardDescription className="text-base">
                  {step === 1 && 'Onde você desenvolve suas atividades principais?'}
                  {step === 2 && 'Selecione as unidades administrativas às quais você pertence.'}
                  {step === 3 && 'Você gerencia ou utiliza laboratórios para pesquisa?'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8">
            {step === 1 && (
              <div className="grid grid-cols-1 gap-4">
                {campi.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCampus(c.id)}
                    className={`flex items-center justify-between p-6 rounded-2xl border-2 transition-all duration-300 ${
                      selectedCampus === c.id 
                        ? 'border-[#1A237E] bg-indigo-50/50 shadow-lg' 
                        : 'border-black/5 hover:border-black/10 hover:bg-black/5'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black ${selectedCampus === c.id ? 'bg-[#1A237E] text-white' : 'bg-black/5 text-black/40'}`}>
                        {c.sigla}
                      </div>
                      <div className="text-left font-bold text-lg text-slate-800">{c.nome}</div>
                    </div>
                    {selectedCampus === c.id && <Check size={24} weight="bold" className="text-[#1A237E]" />}
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-1 gap-3">
                {depts.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => toggleSelection(d.id, selectedDepts, setSelectedDepts)}
                    className={`flex items-center justify-between p-5 rounded-xl border-2 transition-all duration-200 ${
                      selectedDepts.includes(d.id) 
                        ? 'border-[#1A237E] bg-indigo-50/50' 
                        : 'border-black/5 hover:bg-black/5'
                    }`}
                  >
                    <span className="font-bold text-slate-700">{d.nome}</span>
                    {selectedDepts.includes(d.id) && <Check size={20} weight="bold" className="text-[#1A237E]" />}
                  </button>
                ))}
                {depts.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground animate-pulse">Carregando unidades...</p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="grid grid-cols-1 gap-3">
                {labs.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => toggleSelection(l.id, selectedLabs, setSelectedLabs)}
                    className={`flex items-center justify-between p-5 rounded-xl border-2 transition-all duration-200 ${
                      selectedLabs.includes(l.id) 
                        ? 'border-[#1A237E] bg-indigo-50/50' 
                        : 'border-black/5 hover:bg-black/5'
                    }`}
                  >
                    <span className="font-bold text-slate-700">{l.nome}</span>
                    {selectedLabs.includes(l.id) && <Check size={20} weight="bold" className="text-[#1A237E]" />}
                  </button>
                ))}
                 <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-100/50">
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
                      Lembre-se: Vincular-se a um laboratório permite que você envie DFDs específicas para validação da Chefia Técnica de Laboratório.
                    </p>
                 </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="p-8 pt-0 flex justify-between gap-4">
            {step > 1 ? (
              <Button 
                variant="outline" 
                onClick={handleBack} 
                className="h-12 px-6 rounded-xl border-2 font-bold"
              >
                <CaretLeft size={20} className="mr-2" /> Voltar
              </Button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <Button 
                onClick={handleNext} 
                disabled={step === 1 && !selectedCampus}
                className="h-12 px-8 rounded-xl bg-[#1A237E] hover:bg-[#1A237E]/90 text-white font-bold transition-all shadow-xl shadow-indigo-200"
              >
                Próximo <CaretRight size={20} className="ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleComplete} 
                disabled={loading || selectedDepts.length === 0}
                className="h-12 px-10 rounded-xl bg-[#1A237E] hover:bg-[#1A237E]/90 text-white font-black italic tracking-tight transition-all shadow-xl shadow-indigo-300"
              >
                {loading ? 'PROCESSANDO...' : 'FINALIZAR CONFIGURAÇÃO'}
              </Button>
            )}
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-slate-400 font-medium">
          Dúvidas no cadastro? Entre em contato: petrolina.administracao@upe.br
        </p>
      </div>
    </div>
  )
}
