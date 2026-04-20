'use client'

import React from 'react'
import { 
  ChartDonut, 
  TrendUp, 
  CurrencyDollar, 
  ArrowUpRight,
  CaretRight,
  Table,
  Buildings,
  HardDrive
} from '@phosphor-icons/react'

export default function ChefiaOrcamentoPage() {
  return (
    <div className="p-8 space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="font-display text-4xl font-extrabold text-[#00695C] tracking-tight">
            Gestão do Orçamento
          </h1>
          <p className="text-[#004D40] font-medium opacity-80">
            Acompanhamento em tempo real do PCA alocado para o seu departamento.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="bg-white p-3 rounded-2xl border border-black/5 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
               <TrendUp size={24} weight="bold" />
            </div>
            <div>
              <p className="text-[10px] font-black text-black/40 uppercase">Teto Global</p>
              <p className="text-sm font-bold text-black/70">R$ 150.000</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Budget Card */}
        <div className="lg:col-span-1 space-y-6">
           <div className="glass-card p-8 bg-gradient-to-br from-[#00695C] to-[#004D40] text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                 <CurrencyDollar size={180} weight="fill" />
              </div>
              
              <div className="space-y-8 relative z-10">
                <div className="space-y-1">
                   <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Saldo Disponível (PCA 2027)</p>
                   <h2 className="font-display text-5xl font-black">R$ 84.750</h2>
                </div>

                <div className="space-y-2">
                   <div className="flex justify-between text-xs font-bold">
                      <span>Consumido: R$ 65.250</span>
                      <span>43.5%</span>
                   </div>
                   <div className="w-full h-4 bg-white/20 rounded-full overflow-hidden">
                      <div className="w-[43.5%] h-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.5)]" />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                   <div className="p-4 rounded-2xl bg-white/10 border border-white/10">
                      <p className="text-[10px] font-bold text-white/50 uppercase">Em Aprovacao</p>
                      <p className="text-lg font-black tracking-tight">R$ 12.400</p>
                   </div>
                   <div className="p-4 rounded-2xl bg-white/10 border border-white/10">
                      <p className="text-[10px] font-bold text-white/50 uppercase">Pactuado</p>
                      <p className="text-lg font-black tracking-tight">R$ 52.850</p>
                   </div>
                </div>
              </div>
           </div>

           <div className="glass-card p-6">
              <h3 className="font-display font-bold text-[#00695C] mb-4 flex items-center gap-2">
                <ChartDonut size={20} weight="fill" />
                Destaque por Categoria
              </h3>
              <div className="space-y-4">
                 <CategoryItem label="Tecnologia (SaaS/Hw)" value="R$ 42.000" percent={64} color="emerald" />
                 <CategoryItem label="Mobiliário" value="R$ 15.250" percent={23} color="amber" />
                 <CategoryItem label="Outros" value="R$ 8.000" percent={13} color="blue" />
              </div>
           </div>
        </div>

        {/* Detailed Breakdown Table */}
        <div className="lg:col-span-2 space-y-6">
           <div className="glass-card overflow-hidden">
              <div className="p-6 border-b border-black/5 flex justify-between items-center bg-white/50">
                 <div className="flex items-center gap-3">
                    <Table size={22} weight="fill" className="text-[#00695C]" />
                    <h3 className="font-display font-bold text-[#004D40]">Detalhamento por Elemento de Despesa</h3>
                 </div>
                 <button className="text-[#00695C] text-xs font-bold hover:underline flex items-center gap-1">
                    Ver Planilha Completa <ArrowUpRight size={14} />
                 </button>
              </div>
              
              <div className="p-0">
                 <table className="w-full text-left">
                    <thead>
                      <tr className="bg-emerald-50 text-[#00695C] text-[10px] font-black uppercase tracking-widest">
                        <th className="px-6 py-4">Elemento (Conta)</th>
                        <th className="px-6 py-4">Sinalizador</th>
                        <th className="px-6 py-4 text-center">DFDs</th>
                        <th className="px-6 py-4 text-right">Total Solicitado</th>
                        <th className="px-6 py-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                       <BudgetRow icon={HardDrive} label="4.4.90.52 - Equip. Material Permanente" color="emerald" count={8} total="R$ 45.200" status="Ok" />
                       <BudgetRow icon={Buildings} label="3.3.90.39 - Serviços de Terceiros PJ" color="amber" count={3} total="R$ 12.150" status="No Limite" />
                       <BudgetRow icon={HardDrive} label="3.3.90.30 - Material de Consumo" color="emerald" count={12} total="R$ 7.900" status="Ok" />
                    </tbody>
                 </table>
              </div>
           </div>

           <div className="p-8 rounded-[32px] bg-white border border-black/5 shadow-sm flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 space-y-4">
                 <h4 className="font-display text-2xl font-black text-[#004D40]">Previsão de Execução</h4>
                 <p className="text-sm text-black/50 leading-relaxed">
                   Com base nas solicitações atuais da sua equipe, seu departamento consumirá <strong>82%</strong> do orçamento planejado até o final da safra.
                 </p>
                 <button className="px-6 py-2.5 rounded-xl bg-[#00695C] text-white font-bold text-sm">
                   Simular Novos Cenários
                 </button>
              </div>
              <div className="w-full md:w-48 h-32 flex items-end gap-2 px-2">
                 {[40, 65, 30, 85, 45, 90, 55].map((h, i) => (
                   <div key={i} className="flex-1 bg-[#00695C]/20 rounded-t-lg transition-all hover:bg-[#00695C]" style={{ height: `${h}%` }} />
                 ))}
              </div>
           </div>
        </div>

      </div>
    </div>
  )
}

function CategoryItem({ label, value, percent, color }: { label: string, value: string, percent: number, color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500'
  }
  return (
    <div className="space-y-1.5">
       <div className="flex justify-between text-xs font-bold text-black/70">
          <span>{label}</span>
          <span className="text-black/40">{value}</span>
       </div>
       <div className="w-full h-1.5 bg-black/5 rounded-full overflow-hidden">
          <div className={`h-full ${colors[color] || colors.emerald}`} style={{ width: `${percent}%` }} />
       </div>
    </div>
  )
}

function BudgetRow({ icon: Icon, label, color, count, total, status }: { icon: any, label: string, color: string, count: number, total: string, status: string }) {
  return (
    <tr className="hover:bg-emerald-50/30 transition-colors">
       <td className="px-6 py-5">
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-black/5 text-black/40">
                <Icon size={18} />
             </div>
             <span className="text-xs font-bold text-black/70">{label}</span>
          </div>
       </td>
       <td className="px-6 py-5">
          <div className={`w-3 h-3 rounded-full ${color === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
       </td>
       <td className="px-6 py-5 text-center text-xs font-bold text-black/40">{count}</td>
       <td className="px-6 py-5 text-right font-display font-black text-[#00695C]">{total}</td>
       <td className="px-6 py-5 text-right">
          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
            status === 'Ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>{status}</span>
       </td>
    </tr>
  )
}
