'use client'

import { useState } from 'react'
import { 
  Scales, 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  ChatText, 
  Eye, 
  MagnifyingGlass,
  Funnel,
  ArrowRight,
  Info,
  Ranking
} from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

// Mock de DFDs pendentes de triagem
const dfdsTriagem = [
  { 
    id: 'DFD-2027-089', 
    objeto: 'Reagentes análise física-química', 
    solicitante: 'Prof. João Silva', 
    unidade: 'Lab Análises', 
    valor: 12450, 
    data: '3 dias atrás',
    prioridade_sugerida: 'Essencial',
    itens_count: 5
  },
  { 
    id: 'DFD-2027-092', 
    objeto: 'Vidraria para graduação - Q3', 
    solicitante: 'Profa. Amanda Souza', 
    unidade: 'Lab Microbiologia', 
    valor: 3890, 
    data: '1 dia atrás',
    prioridade_sugerida: 'Estratégica',
    itens_count: 3
  },
  { 
    id: 'DFD-2027-095', 
    objeto: 'Manutenção de Espectrômetro', 
    solicitante: 'Dra. Helena Reis', 
    unidade: 'Lab Central', 
    valor: 7200, 
    data: 'Hoje',
    prioridade_sugerida: 'Essencial',
    itens_count: 1
  }
]

export default function TriagemPage() {
  const [selectedDFD, setSelectedDFD] = useState<any>(null)
  const [feedbackBody, setFeedbackBody] = useState('')
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('pendentes')

  const handleOpenDetail = (dfd: any) => {
    setSelectedDFD(dfd)
    setIsDetailOpen(true)
  }

  const handleDevolver = () => {
    if (!feedbackBody) {
      toast.error('Por favor, redija o comentário de devolutiva com as correções necessárias.')
      return
    }
    toast.success(`DFD ${selectedDFD.id} devolvida para o solicitante.`)
    setIsDetailOpen(false)
    setFeedbackBody('')
  }

  const handleAprovar = () => {
    toast.success(`DFD ${selectedDFD.id} aprovada e enviada para o Admin.`)
    setIsDetailOpen(false)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
             <Scales size={28} className="text-amber-500" />
             Triagem de Demandas (PCA 2027)
          </h1>
          <p className="text-muted-foreground text-sm">Analise, valide e normalize as solicitações do seu setor.</p>
        </div>
        
        <Card className="bg-slate-50 border-slate-200">
           <CardContent className="py-2 px-4 flex items-center gap-6">
              <div className="text-center">
                 <p className="text-[10px] uppercase font-bold text-slate-400">Pendentes</p>
                 <p className="text-lg font-bold text-amber-600">08</p>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div className="text-center">
                 <p className="text-[10px] uppercase font-bold text-slate-400">Total Analisado</p>
                 <p className="text-lg font-bold text-slate-700">142</p>
              </div>
           </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pendentes" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 p-1 mb-6">
          <TabsTrigger value="pendentes" className="data-[state=active]:bg-white">Pendentes (8)</TabsTrigger>
          <TabsTrigger value="devolvidas" className="data-[state=active]:bg-white">Devolvidas</TabsTrigger>
          <TabsTrigger value="aprovadas" className="data-[state=active]:bg-white">Aprovadas</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {dfdsTriagem.map((dfd) => (
                <Card key={dfd.id} className="percata-card flex flex-col overflow-hidden">
                   <CardHeader className="p-4 bg-slate-50 border-b">
                      <div className="flex justify-between items-center mb-1">
                         <span className="text-xs font-mono font-bold text-slate-500">{dfd.id}</span>
                         <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Aguardando</Badge>
                      </div>
                      <CardTitle className="text-sm font-semibold h-10 line-clamp-2 leading-tight">
                         {dfd.objeto}
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="p-4 flex-1 space-y-3">
                      <div className="space-y-1">
                         <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider text-ellipsis">Solicitante</p>
                         <p className="text-xs font-medium">{dfd.solicitante} <span className="text-slate-400 font-normal">({dfd.unidade})</span></p>
                      </div>
                      <div className="flex justify-between items-center">
                         <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Valor Estimado</p>
                            <p className="text-sm font-bold text-foreground">R$ {dfd.valor.toLocaleString('pt-BR')}</p>
                         </div>
                         <div className="text-right">
                             <p className="text-[10px] text-muted-foreground">{dfd.data}</p>
                             <p className="text-[10px] font-bold text-[#1351B4]">{dfd.itens_count} itens</p>
                         </div>
                      </div>
                   </CardContent>
                   <div className="p-3 bg-slate-50/50 border-t flex gap-2">
                       <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={() => handleOpenDetail(dfd)}>
                          <Eye size={14} className="mr-2" /> Detalhes
                       </Button>
                       <Button className="btn-upe w-full text-xs h-8" onClick={() => handleOpenDetail(dfd)}>
                          Triagem <ArrowRight size={14} className="ml-2" />
                       </Button>
                   </div>
                </Card>
             ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de Triagem Detalhada */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
               <Badge className="bg-amber-600">MODO TRIAGEM</Badge>
               <span className="text-xs text-muted-foreground">{selectedDFD?.id}</span>
            </div>
            <DialogTitle className="text-xl">{selectedDFD?.objeto}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
             {/* Coluna Dados */}
             <div className="md:col-span-2 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-3 rounded-lg bg-slate-50 border">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Solicitante</p>
                      <p className="text-sm font-medium">{selectedDFD?.solicitante}</p>
                   </div>
                   <div className="p-3 rounded-lg bg-slate-50 border">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Setor / Local</p>
                      <p className="text-sm font-medium">{selectedDFD?.unidade}</p>
                   </div>
                </div>

                <div className="space-y-2">
                   <h3 className="text-sm font-bold flex items-center gap-2">
                      <Info size={18} className="text-blue-600" />
                      Justificativa do Solicitante
                   </h3>
                   <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border leading-relaxed">
                      "Necessários para experimentos de titulação, gravimetria e análise qualitativa. Atenderá aproximadamente 40 alunos em 2 turmas do 3º semestre de 2027. Os itens são fundamentais para o cumprimento da ementa prática da disciplina."
                   </p>
                </div>

                <div className="space-y-4">
                   <h3 className="text-sm font-bold flex items-center gap-2">
                      <Ranking size={18} className="text-blue-600" />
                      Itens na Solicitação ({selectedDFD?.itens_count})
                   </h3>
                   {/* Mock de itens dentro da triagem */}
                   <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <Card key={i} className="border shadow-none">
                           <CardContent className="p-4">
                              <div className="flex justify-between items-start mb-3">
                                 <div>
                                    <h4 className="text-sm font-semibold">Item {i}: Ácido Sulfúrico 98% P.A.</h4>
                                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-tight">EF-003 · 10L</span>
                                 </div>
                                 <Badge className="bg-slate-100 text-slate-600 border-0 h-5 text-[10px]">R$ 850,00 Un.</Badge>
                              </div>
                              <div className="p-2 bg-blue-50/50 rounded-lg text-xs italic text-blue-700">
                                 "Suficiente para 40 alunos durante o 1º semestre de aulas práticas."
                              </div>
                           </CardContent>
                        </Card>
                      ))}
                   </div>
                </div>
             </div>

             {/* Coluna Ações da Chefia */}
             <div className="space-y-6">
                <Card className="border-amber-200 bg-amber-50/50">
                   <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm">Decisão de Chefia</CardTitle>
                   </CardHeader>
                   <CardContent className="p-4 space-y-4">
                      <div className="space-y-2">
                         <label className="text-xs font-bold uppercase text-slate-500">Importância Estratégica</label>
                         <div className="grid gap-2">
                            {['Essencial', 'Estratégica', 'Desejável', 'Opcional'].map(p => (
                               <div key={p} className="flex items-center gap-2 p-2 rounded-md border bg-white cursor-pointer hover:border-blue-300">
                                  <input type="radio" name="importance" value={p} defaultChecked={selectedDFD?.prioridade_sugerida === p} />
                                  <span className="text-xs">{p}</span>
                                </div>
                            ))}
                         </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                         <label className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                            <ChatText size={16} /> Comentário de Devolutiva
                         </label>
                         <textarea 
                           className="flex min-h-[120px] w-full rounded-md border border-input bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                           placeholder="Se for devolver, descreva o que o professor precisa corrigir (ex: link quebrado, quantidade excessiva, justificativa pobre)..."
                           value={feedbackBody}
                           onChange={(e) => setFeedbackBody(e.target.value)}
                         />
                      </div>
                   </CardContent>
                </Card>

                <div className="flex flex-col gap-2">
                   <Button className="w-full btn-upe bg-emerald-600 hover:bg-emerald-700 h-10 gap-2" onClick={handleAprovar}>
                      <CheckCircle size={18} weight="bold" /> Aprovar e Rankear
                   </Button>
                   <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 h-10 gap-2" onClick={handleDevolver}>
                      <XCircle size={18} weight="bold" /> Devolver p/ Ajuste
                   </Button>
                </div>
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
