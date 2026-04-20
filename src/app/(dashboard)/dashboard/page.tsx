'use client'

import { 
  Sparkle, 
  Plus, 
  Files, 
  ChartPieSlice, 
  Truck, 
  ArrowRight 
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Welcome Header */}
      <div className="space-y-1">
        <h1 className="font-display text-4xl font-bold text-[var(--md-primary)] tracking-tight">
          Boas vindas, Servidor!
        </h1>
        <p className="text-[var(--md-secondary)] text-lg">
          Aqui está o resumo das suas solicitações e orçamento do departamento.
        </p>
      </div>

      {/* Hero Carousel Area */}
      <div className="hero-carousel">
         <div className="relative z-10 max-w-2xl space-y-3">
            <div className="flex items-center gap-2 font-bold uppercase text-[10px] tracking-[2px]">
               <Sparkle weight="fill" /> Atualização
            </div>
            <h2 className="font-display text-3xl font-bold leading-tight">
               Nova rodada do PCA 2027 já está aberta!
            </h2>
            <p className="text-sm opacity-90 leading-relaxed max-w-lg">
               Sua unidade possui saldo orçamentário disponível. Lembre-se de anexar as cotações obrigatórias para evitar devoluções pela chefia.
            </p>
            <div className="flex gap-2 pt-2">
               <div className="w-6 h-1.5 rounded-full bg-white"></div>
               <div className="w-1.5 h-1.5 rounded-full bg-white/50"></div>
               <div className="w-1.5 h-1.5 rounded-full bg-white/50"></div>
            </div>
         </div>
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between">
         <h3 className="font-display text-xl font-semibold">Resumo Rápido</h3>
         <Button 
           className="btn-m3-primary" 
           onClick={() => router.push('/catalogo')}
         >
            <Plus size={18} weight="bold" /> Novo Pedido (DFD)
         </Button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         
         {/* Card 1: Solicitações */}
         <div className="glass-card flex flex-col justify-between h-full">
            <div className="space-y-4">
               <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-[var(--md-secondary)]">Minhas Solicitações</span>
                  <div className="w-12 h-12 rounded-xl bg-[#e3f2fd] text-[#1976d2] flex items-center justify-center">
                     <Files size={24} />
                  </div>
               </div>
               <div className="font-display text-3xl font-bold flex items-baseline gap-2">
                  3 <span className="text-sm font-normal text-[var(--md-secondary)]">pendentes</span>
               </div>
               <div className="text-xs font-semibold text-[var(--md-secondary)]">
                  Aprovadas este mês: 12
               </div>
            </div>
            <div className="pt-6 border-t border-black/5 mt-4 flex justify-end">
               <button 
                 onClick={() => router.push('/minhas-dfds')}
                 className="text-sm font-bold text-[var(--md-primary)] hover:bg-[var(--md-primary-container)] px-4 py-2 rounded-lg transition-colors"
               >
                  Ver todos os pedidos
               </button>
            </div>
         </div>

         {/* Card 2: Orçamento */}
         <div className="glass-card flex flex-col justify-between h-full">
            <div className="space-y-4">
               <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-[var(--md-secondary)]">Orçamento do Setor (Q1)</span>
                  <div className="w-12 h-12 rounded-xl bg-[#fce4ec] text-[#c2185b] flex items-center justify-center">
                     <ChartPieSlice size={24} />
                  </div>
               </div>
               <div className="font-display text-3xl font-bold">
                  R$ 15.400
               </div>
               <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold text-[var(--md-secondary)]">
                     <span>Consumo de Orçamento</span>
                     <span>75%</span>
                  </div>
                  <Progress value={75} className="h-1.5 bg-[var(--md-surface-variant)]" />
               </div>
            </div>
            <div className="pt-6 border-t border-black/5 mt-4 flex justify-end">
               <button className="text-sm font-bold text-[#c2185b] hover:bg-red-50 px-4 py-2 rounded-lg transition-colors">
                  Detalhes do PCA
               </button>
            </div>
         </div>

         {/* Card 3: Recebimento / Histórico */}
         <div className="glass-card flex flex-col justify-between h-full">
            <div className="space-y-4">
               <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-[var(--md-secondary)]">Aguardando Recebimento</span>
                  <div className="w-12 h-12 rounded-xl bg-[#e8f5e9] text-[#388e3c] flex items-center justify-center">
                     <Truck size={24} />
                  </div>
               </div>
               <div className="font-display text-3xl font-bold flex items-baseline gap-2">
                  1 <span className="text-sm font-normal text-[var(--md-secondary)]">pacote</span>
               </div>
               <div className="text-xs font-medium text-[var(--md-secondary)]">
                  Última atualização: Hoje 10:15
               </div>
            </div>
            <div className="pt-6 border-t border-black/5 mt-4 flex justify-end">
               <button className="text-sm font-bold text-[#388e3c] hover:bg-green-50 px-4 py-2 rounded-lg transition-colors">
                  Rastrear Entrega
               </button>
            </div>
         </div>

      </div>

      {/* Histórico Legado (Integrado como solicitado anteriormente) */}
      <div className="pt-6">
         <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-6 bg-[var(--md-primary)] rounded-full"></div>
            <h3 className="font-display text-lg font-bold">Seu Histórico 2025 (Pactuação)</h3>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
               { id: 'DFD-2025-0042', obj: 'Microscópio Biológico Binocular', val: 18500 },
               { id: 'DFD-2025-0012', obj: 'Expositores Temáticos HU', val: 3500 },
            ].map(h => (
               <div key={h.id} className="glass-card !p-4 border-dashed border-[var(--md-outline)]/20 bg-white/30 hover:bg-white/50">
                  <div className="flex justify-between items-center">
                     <div>
                        <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase">{h.id}</p>
                        <p className="text-sm font-bold truncate max-w-[200px]">{h.obj}</p>
                     </div>
                     <div className="text-right">
                        <span className="badge-pactucao whitespace-nowrap !bg-[#B3261E] !text-white !border-0 text-[10px]">
                           EM PACTUAÇÃO
                        </span>
                        <p className="text-[10px] font-bold text-slate-500 mt-1">R$ {h.val.toLocaleString('pt-BR')}</p>
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  )
}
