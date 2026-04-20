'use client'

import React from 'react'
import { 
  ArrowLeft, 
  FileCsv, 
  FileXls, 
  Selection, 
  CheckCircle,
  Database,
  Lightning,
  ArrowsClockwise
} from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'

export default function ExportacaoPage() {
  const router = useRouter()

  return (
    <div className="p-8 space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-3 rounded-full hover:bg-black/5 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div className="space-y-1">
          <h1 className="font-display text-4xl font-extrabold text-[#1A237E] tracking-tight">
            Exportação e-Fisco / PCA
          </h1>
          <p className="text-[#3F51B5] font-medium opacity-80">
            Geração de arquivos estruturados para integração com o TCE e Governo Estadual.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Export Profiles */}
        <div className="lg:col-span-2 space-y-6">
           <ExportProfileCard 
              icon={FileCsv}
              title="Layout e-Fisco (Licitatário)"
              desc="Exporta todos os itens consolidados no formato CSV compatível com o sistema de auditoria do e-Fisco."
              fields={['Cod. TCE', 'GND', 'Valor Total', 'Vigor PCA']}
              color="indigo"
           />
           <ExportProfileCard 
              icon={Selection}
              title="Layout PCA Consolidado (LOA 2027)"
              desc="Agrupamento estratégico por Campus e Grupo de Natureza de Despesa para inclusão na Lei Orçamentária Anual."
              fields={['Campus', 'Elemento de Despesa', 'Dotação']}
              color="blue"
           />
        </div>

        {/* Export Jobs / History */}
        <div className="space-y-6">
           <div className="glass-card p-6">
              <h3 className="font-display font-bold text-[#1A237E] mb-6 flex items-center gap-2">
                 <ArrowsClockwise size={22} weight="bold" />
                 Processamentos Recentes
              </h3>
              <div className="space-y-4">
                 <JobItem id="JOB-042" status="Exportado" date="Hoje, 09:40" type="e-Fisco" />
                 <JobItem id="JOB-039" status="Erro" date="Ontem, 14:20" type="PCA LOA" />
              </div>
           </div>

           <div className="glass-card p-6 bg-amber-50 border border-amber-100">
              <div className="flex items-center gap-3 text-amber-800 mb-3">
                 <Lightning size={24} weight="fill" />
                 <h4 className="font-bold">Dica Técnica</h4>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                 O processamento de exportação pode levar alguns minutos se houver mais de 5.000 itens pendentes. Recomendamos realizar a exportação fora do horário de pico.
              </p>
           </div>
        </div>

      </div>
    </div>
  )
}

function ExportProfileCard({ icon: Icon, title, desc, fields, color }: any) {
  return (
    <div className="glass-card p-8 group hover:shadow-2xl transition-all cursor-pointer border-l-8 border-[#3F51B5] flex flex-col md:flex-row gap-8 items-center">
       <div className={`w-20 h-20 rounded-3xl flex items-center justify-center flex-shrink-0 ${
         color === 'indigo' ? 'bg-[#1A237E]/10 text-[#1A237E]' : 'bg-blue-100 text-blue-600'
       } group-hover:scale-110 transition-transform`}>
          <Icon size={40} weight="fill" />
       </div>
       <div className="flex-1 space-y-4">
          <div>
            <h3 className="font-display text-2xl font-black text-[#1A237E]">{title}</h3>
            <p className="text-sm text-black/50 leading-relaxed max-w-lg">{desc}</p>
          </div>
          <div className="flex flex-wrap gap-2">
             {fields.map((f: string) => (
                <span key={f} className="px-2 py-0.5 rounded bg-black/5 text-[9px] font-black uppercase text-black/40">{f}</span>
             ))}
          </div>
       </div>
       <button className="px-8 py-3 rounded-2xl bg-[#1A237E] text-white font-black text-sm shadow-lg shadow-[#1A237E]/20 hover:scale-105 active:scale-95 transition-all">
          EXPORTAR AGORA
       </button>
    </div>
  )
}

function JobItem({ id, status, date, type }: any) {
  return (
    <div className="p-4 rounded-2xl border border-black/5 hover:bg-black/[0.02] transition-all flex justify-between items-center">
       <div className="space-y-0.5">
          <p className="text-xs font-bold text-[#1A237E]">{type} / {id}</p>
          <p className="text-[10px] text-black/30 font-bold">{date}</p>
       </div>
       <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
         status === 'Exportado' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
       }`}>
          {status}
       </span>
    </div>
  )
}
