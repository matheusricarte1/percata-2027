'use client'

import React from 'react'
import { Printer, DownloadSimple, QrCode } from '@phosphor-icons/react'

export default function DFDPrintPage({ params }: { params: { id: string } }) {
  const id = params.id || '2027-0089'

  const data = {
    protocolo: `DFD-${id}`,
    data: '20 de Abril de 2026',
    solicitante: 'MARIANA SILVA SANTOS',
    cpf: 'XXX.XXX.782-XX',
    setor: 'DEPARTAMENTO FINANCEIRO - REITORIA',
    campus: 'PETROLINA',
    objeto: 'AQUISIÇÃO DE EQUIPAMENTOS DE HARDWARE PARA MODERNIZAÇÃO DA AUDITORIA INTERNA',
    justificativa: 'A presente demanda justifica-se pela necessidade premente de substituição do parque tecnológico obsoleto, visando atender às novas diretrizes de fiscalização digital e garantir a integridade dos dados processados nos sistemas core da instituição.',
    gnd: '4.4.90.52 - EQUIPAMENTOS E MATERIAL PERMANENTE',
    itens: [
      { cod: 'SIAD 28392-1', desc: 'Notebook de alto desempenho i7 16GB RAM', qtd: 3, un: 'UN', valor: 6500.00 },
      { cod: 'SIAD 28392-5', desc: 'Monitor Profissional 27" 4K', qtd: 2, un: 'UN', valor: 2800.00 },
    ]
  }

  const total = data.itens.reduce((acc, i) => acc + (i.qtd * i.valor), 0)

  return (
    <div className="bg-slate-100 min-h-screen p-10 print:p-0 print:bg-white flex flex-col items-center gap-6">
      
      {/* Controls (Hidden on mobile/print) */}
      <div className="flex gap-4 print:hidden">
         <button 
           onClick={() => window.print()}
           className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#6750A4] text-white font-bold shadow-lg hover:scale-105 transition-all"
         >
           <Printer size={20} weight="fill" />
           Imprimir / Salvar PDF
         </button>
         <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white border border-black/10 font-bold hover:bg-black/5 transition-all">
           <DownloadSimple size={20} />
           Baixar Dados (JSON)
         </button>
      </div>

      {/* Formal Document Container */}
      <div className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-2xl p-[20mm] flex flex-col gap-10 font-serif border border-black/5 print:shadow-none print:border-none">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-6">
           <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-black flex items-center justify-center text-white text-[8px] font-black p-2 text-center">
                 LOGOMARCA INSTITUCIONAL
              </div>
              <div className="space-y-1">
                 <p className="text-xl font-black uppercase">Universidade UPE</p>
                 <p className="text-sm font-bold text-black/60">Sistema Integrado de Planejamento e Compras - PERCATA</p>
              </div>
           </div>
           <div className="text-right">
              <p className="text-xs font-black uppercase tracking-widest text-black/40">Protocolo de Formalização</p>
              <p className="text-2xl font-black">{data.protocolo}</p>
              <p className="text-xs font-bold">{data.data}</p>
           </div>
        </div>

        {/* Identification */}
        <div className="space-y-4">
           <h4 className="bg-slate-100 px-4 py-2 font-black text-sm uppercase tracking-widest">1. Identificação do Requisitante</h4>
           <div className="grid grid-cols-2 gap-x-12 gap-y-4 px-4 text-sm">
              <div>
                 <p className="text-[10px] uppercase font-black text-black/40">Solicitante</p>
                 <p className="font-bold underline">{data.solicitante}</p>
              </div>
              <div>
                 <p className="text-[10px] uppercase font-black text-black/40">Setor / Lotação</p>
                 <p className="font-bold">{data.setor}</p>
              </div>
              <div>
                 <p className="text-[10px] uppercase font-black text-black/40">CPF</p>
                 <p className="font-bold">{data.cpf}</p>
              </div>
              <div>
                 <p className="text-[10px] uppercase font-black text-black/40">Unidade / Campus</p>
                 <p className="font-bold">{data.campus}</p>
              </div>
           </div>
        </div>

        {/* Object & Justification */}
        <div className="space-y-4">
           <h4 className="bg-slate-100 px-4 py-2 font-black text-sm uppercase tracking-widest">2. Objeto e Justificativa</h4>
           <div className="px-4 space-y-4">
              <div className="p-4 border border-black/10 bg-slate-50/50">
                 <p className="text-[10px] uppercase font-black text-black/40 mb-1">Resumo do Objeto</p>
                 <p className="font-bold leading-tight">{data.objeto}</p>
              </div>
              <div className="text-sm leading-relaxed text-justify">
                 <p className="text-[10px] uppercase font-black text-black/40 mb-1">Fundamentação Técnica (Lei 14.133)</p>
                 {data.justificativa}
              </div>
           </div>
        </div>

        {/* Items Table */}
        <div className="space-y-4">
           <h4 className="bg-slate-100 px-4 py-2 font-black text-sm uppercase tracking-widest">3. Descritivo de Itens e Custos Estimados</h4>
           <table className="w-full text-xs border-collapse">
              <thead>
                 <tr className="border-b border-black">
                    <th className="py-3 px-2 text-left w-12">Item</th>
                    <th className="py-3 px-2 text-left">Especificação Técnica (SIAD)</th>
                    <th className="py-3 px-2 text-center w-16">Qtd</th>
                    <th className="py-3 px-2 text-center w-16">Unid.</th>
                    <th className="py-3 px-2 text-right w-24">Unitário</th>
                    <th className="py-3 px-2 text-right w-24">Total</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {data.itens.map((item, idx) => (
                    <tr key={idx} className="align-top">
                       <td className="py-4 px-2 font-bold">{idx + 1}</td>
                       <td className="py-4 px-2">
                          <p className="font-bold text-sm">{item.desc}</p>
                          <p className="text-[10px] text-black/50 mt-1">{item.cod}</p>
                       </td>
                       <td className="py-4 px-2 text-center font-bold">{item.qtd}</td>
                       <td className="py-4 px-2 text-center">{item.un}</td>
                       <td className="py-4 px-2 text-right">R$ {item.valor.toLocaleString('pt-BR')}</td>
                       <td className="py-4 px-2 text-right font-black">R$ {(item.qtd * item.valor).toLocaleString('pt-BR')}</td>
                    </tr>
                 ))}
                 <tr className="border-t-2 border-black bg-slate-50 font-black">
                    <td colSpan={5} className="py-4 px-2 text-right uppercase tracking-[2px]">VALOR GLOBAL ESTIMADO</td>
                    <td className="py-4 px-2 text-right text-lg">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                 </tr>
              </tbody>
           </table>
        </div>

        {/* Global GND */}
        <div className="px-4 py-4 bg-slate-50 border-l-4 border-black flex justify-between items-center">
           <div className="space-y-1">
              <p className="text-[10px] font-black text-black/40 uppercase">GND Principal para Empenho</p>
              <p className="font-bold text-sm tracking-tight">{data.gnd}</p>
           </div>
           <div className="text-[8px] font-medium text-black/40 italic max-w-xs text-right">
              Classificação automatizada baseada no catálogo institucional e plano de contas vigente.
           </div>
        </div>

        {/* Signatures & Footer */}
        <div className="mt-auto pt-20 flex flex-col items-center gap-12 border-t border-black/5">
           <div className="grid grid-cols-2 gap-32">
              <div className="flex flex-col items-center gap-2">
                 <div className="w-64 border-t border-black pt-2 text-center">
                    <p className="text-[10px] font-black uppercase">{data.solicitante}</p>
                    <p className="text-[9px] font-medium opacity-50">Assinatura do Requisitante</p>
                 </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                 <div className="w-64 border-t border-black/10 pt-2 text-center">
                    <p className="text-[10px] font-black uppercase text-black/20">ROBERTO COSTA</p>
                    <p className="text-[9px] font-medium opacity-50 italic">Pendente Assinatura da Chefia</p>
                 </div>
              </div>
           </div>
           
           <div className="flex w-full justify-between items-end opacity-20 hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-4">
                 <QrCode size={64} weight="thin" />
                 <div className="text-[8px] font-mono leading-none">
                    <p>VERIFICAR AUTENTICIDADE</p>
                    <p>HASH: 8A9D7C2B4E1F0G6H9J2K1L4M</p>
                    <p>SIS: PERCATA_2027_V1.4</p>
                 </div>
              </div>
              <p className="text-[8px] font-bold">PÁGINA 1 DE 1</p>
           </div>
        </div>
      </div>
    </div>
  )
}
