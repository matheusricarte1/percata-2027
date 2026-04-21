'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Files, 
  Info, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle,
  Package,
  Warning,
  ListNumbers,
  ChatText,
  Calendar
} from '@phosphor-icons/react'
import Link from 'next/link'

export default function NovaDFD() {
  const [step, setStep] = useState(1)

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      {/* Stepper Progress */}
      <div className="flex items-center justify-between px-12">
        <StepIndicator num={1} label="Identificação" active={step >= 1} />
        <div className={`flex-1 h-[2px] mx-4 ${step > 1 ? 'bg-[#4F378B]' : 'bg-black/5'}`} />
        <StepIndicator num={2} label="Itens & Quantidades" active={step >= 2} />
        <div className={`flex-1 h-[2px] mx-4 ${step > 2 ? 'bg-[#4F378B]' : 'bg-black/5'}`} />
        <StepIndicator num={3} label="Justificativa" active={step >= 3} />
        <div className={`flex-1 h-[2px] mx-4 ${step > 3 ? 'bg-[#4F378B]' : 'bg-black/5'}`} />
        <StepIndicator num={4} label="Finalizar" active={step >= 4} />
      </div>

      {/* Main Form Content */}
      <div className="bg-white rounded-[48px] border border-black/5 shadow-2xl p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#4F378B]/5 rounded-bl-[200px] -mr-20 -mt-20 pointer-events-none" />
        
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-1">
                <h2 className="font-display text-4xl font-black text-[#4F378B] tracking-tighter italic">01. IDENTIFICAÇÃO</h2>
                <p className="text-black/40 font-medium">Defina o objeto principal e a origem da demanda.</p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <FormGroup label="Objeto da Contratação" icon={Files}>
                   <input type="text" placeholder="Ex: Aquisição de reagentes químicos para o semestre 2027.1" className="w-full bg-black/5 border-none rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-[#4F378B]/20" />
                </FormGroup>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormGroup label="Unidade Vinculada" icon={CheckCircle}>
                     <select className="w-full bg-black/5 border-none rounded-2xl py-4 px-6 text-sm font-bold outline-none cursor-pointer">
                        <option>Campus Garanhuns</option>
                        <option>Campus Caruaru</option>
                        <option>Reitoria</option>
                     </select>
                  </FormGroup>
                  <FormGroup label="Previsão de Necessidade" icon={Calendar}>
                     <input type="date" className="w-full bg-black/5 border-none rounded-2xl py-4 px-6 text-sm font-bold outline-none" />
                  </FormGroup>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-1">
                <h2 className="font-display text-4xl font-black text-[#4F378B] tracking-tighter italic">02. SELEÇÃO DE ITENS</h2>
                <p className="text-black/40 font-medium">Vincule os produtos do catálogo e suas respectivas quantidades.</p>
              </div>

              <div className="space-y-4">
                 <div className="p-8 border-2 border-dashed border-black/5 rounded-[32px] flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 bg-[#4F378B]/5 text-[#4F378B]/20 rounded-full flex items-center justify-center">
                       <Package size={32} weight="bold" />
                    </div>
                    <div>
                       <h4 className="font-bold text-black/40">Nenhum item adicionado ainda</h4>
                       <p className="text-sm text-black/20">Você deve selecionar itens do catálogo e-Fisco.</p>
                    </div>
                    <Link href="/catalogo" className="px-6 py-2 bg-[#4F378B]/10 text-[#4F378B] rounded-full text-xs font-black uppercase tracking-widest hover:bg-[#4F378B] hover:text-white transition-all">
                       Abrir Catálogo
                    </Link>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-12 pt-8 border-t border-black/5 flex justify-between">
           <button 
             onClick={() => setStep(s => Math.max(1, s - 1))}
             className={`flex items-center gap-2 font-black text-xs uppercase tracking-widest text-black/40 hover:text-[#4F378B] transition-colors ${step === 1 ? 'opacity-0 pointer-events-none' : ''}`}
           >
             <ArrowLeft weight="bold" /> Voltar
           </button>
           <button 
             onClick={() => setStep(s => Math.min(4, s + 1))}
             className="btn-filled flex items-center gap-2 px-10 py-5 text-sm"
           >
             Continuar <ArrowRight weight="bold" />
           </button>
        </div>
      </div>

      {/* Info Warning */}
      <div className="bg-amber-50 border border-amber-100 p-6 rounded-[28px] flex gap-4">
         <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <Warning size={24} weight="fill" />
         </div>
         <div className="space-y-1">
            <h4 className="font-bold text-amber-900 text-sm">Informação Importante</h4>
            <p className="text-xs text-amber-800/70 font-medium leading-relaxed">Você pode salvar este documento como rascunho a qualquer momento e continuar depois. A submissão final exige a homologação da sua chefia imediata.</p>
         </div>
      </div>
    </div>
  )
}

function StepIndicator({ num, label, active }: any) {
  return (
    <div className={`flex flex-col items-center gap-3 transition-opacity ${active ? 'opacity-100' : 'opacity-20'}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 ${active ? 'bg-[#4F378B] text-white border-[#4F378B]' : 'border-black/20 text-black/40'}`}>
        {num}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{label}</span>
    </div>
  )
}

function FormGroup({ label, icon: Icon, children }: any) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs font-black text-[#4F378B] uppercase tracking-widest ml-1">
        <Icon size={18} weight="bold" />
        {label}
      </label>
      {children}
    </div>
  )
}
