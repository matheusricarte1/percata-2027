'use client'

import React from 'react'
import { 
  ArrowLeft, 
  Printer, 
  DownloadSimple, 
  ChatTeardropDots, 
  CheckCircle, 
  XCircle,
  FileText,
  Package,
  User,
  Clock,
  DotsThreeVertical,
  Paperclip,
  ShareFat
} from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'

export default function DFDDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const id = params.id || '2027.0001'

  const dfdData = {
    id,
    title: 'Equipamentos de T.I. - Setor Alpha',
    solicitante: 'Mariana Silva',
    data: '10/05/2026',
    status: 'Em Análise',
    prioridade: 'Alta',
    justificativaGeral: 'Modernização do parque tecnológico do setor financeiro para suportar os novos sistemas de auditoria estatal.',
    itens: [
      { id: '1', name: 'Notebook i7 16GB RAM 512GB SSD', siad: '28392-1', qtd: 3, valor: 'R$ 6.500,00', justificativa: 'Para uso dos auditores seniores.' },
      { id: '2', name: 'Monitor 27" 4K IPS Professional', siad: '28392-5', qtd: 2, valor: 'R$ 2.800,00', justificativa: 'Necessário para análise de planilhas complexas.' },
    ]
  }

  return (
    <div className="p-8 space-y-8 pb-32 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-3 rounded-full hover:bg-black/5 transition-colors"
          >
            <ArrowLeft size={24} weight="bold" />
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-extrabold text-[#1C1B1F]">DFD #{dfdData.id}</h1>
              <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest">{dfdData.status}</span>
            </div>
            <p className="text-[#625B71] font-medium">{dfdData.title}</p>
          </div>
        </div>

        <div className="flex gap-2">
           <button 
            onClick={() => router.push(`/dfd/${id}/impressao`)}
            className="p-3 rounded-xl bg-black/5 hover:bg-black/10 transition-all text-black/60"
           >
              <Printer size={22} weight="fill" />
           </button>
           <button className="p-3 rounded-xl bg-black/5 hover:bg-black/10 transition-all text-black/60">
              <DownloadSimple size={22} weight="bold" />
           </button>
           <button className="p-3 rounded-xl bg-black/5 hover:bg-black/10 transition-all text-black/60">
              <ShareFat size={22} weight="fill" />
           </button>
           <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#6750A4] text-white font-bold shadow-lg shadow-[#6750A4]/20 hover:scale-[1.02] transition-all">
              AÇÕES
              <DotsThreeVertical size={18} weight="bold" />
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-8">
           <div className="glass-card p-8 space-y-6">
              <h3 className="font-display text-lg font-bold text-[#1C1B1F] flex items-center gap-2 border-b border-black/5 pb-4">
                 <FileText size={22} weight="fill" className="text-[#6750A4]" />
                 Informações Gerais
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <InfoItem icon={User} label="Solicitante" value={dfdData.solicitante} />
                 <InfoItem icon={Clock} label="Data de Criação" value={dfdData.data} />
                 <div className="md:col-span-2 space-y-2">
                    <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">Justificativa Técnica Global</p>
                    <p className="text-sm text-black/70 leading-relaxed font-medium bg-[#FBFAFD] p-4 rounded-2xl border border-black/5 italic">
                       "{dfdData.justificativaGeral}"
                    </p>
                 </div>
              </div>
           </div>

           <div className="glass-card overflow-hidden">
              <div className="p-6 border-b border-black/5 bg-white/50">
                 <h3 className="font-display text-lg font-bold text-[#1C1B1F] flex items-center gap-2">
                    <Package size={22} weight="fill" className="text-[#6750A4]" />
                    Itens da Solicitação
                 </h3>
              </div>
              <div className="divide-y divide-black/5">
                 {dfdData.itens.map((item) => (
                    <div key={item.id} className="p-6 flex gap-6">
                       <div className="w-14 h-14 rounded-2xl bg-[#F3EDF7] flex items-center justify-center text-[#6750A4]/40 flex-shrink-0">
                          <Package size={28} />
                       </div>
                       <div className="flex-1 space-y-3">
                          <div className="flex justify-between">
                             <div>
                                <h4 className="font-bold text-[#1C1B1F]">{item.name}</h4>
                                <span className="text-[10px] font-black text-black/20 uppercase tracking-widest">SIAD: {item.siad}</span>
                             </div>
                             <div className="text-right">
                                <p className="font-display font-black text-black/80">{item.valor}</p>
                                <p className="text-[10px] font-bold text-black/30 capitalize">Qtd: {item.qtd}</p>
                             </div>
                          </div>
                          <p className="text-xs text-black/50 leading-relaxed border-l-2 border-[#D0BCFF] pl-4 italic">
                             Justificativa: {item.justificativa}
                          </p>
                       </div>
                    </div>
                 ))}
              </div>
              <div className="p-6 bg-black/[0.02] border-t border-black/5 flex justify-between items-center font-display font-black">
                 <span className="text-black/40 uppercase text-xs">Total Estimado</span>
                 <span className="text-2xl text-[#6750A4]">R$ 22.100,00</span>
              </div>
           </div>
        </div>

        {/* Sidebar Status/History */}
        <div className="space-y-6">
           <div className="glass-card p-6 space-y-6">
              <h3 className="font-display text-lg font-bold text-[#1C1B1F]">Painel de Tramitação</h3>
              <div className="space-y-6 relative">
                 <div className="absolute left-[15px] top-6 bottom-6 w-[2px] bg-[#E7E0EC]" />
                 
                 <TimelineStep date="11/05/2026" title="Aguardando Triagem" desc="Aguardando revisão por Roberto Costa (Chefe Depto)." status="pending" />
                 <TimelineStep date="10/05/2026" title="DFD Submetida" desc="Pedido enviado por Mariana Silva para o PCA 2027." status="success" />
              </div>
           </div>

           <div className="glass-card p-6 space-y-4">
              <h3 className="font-display text-lg font-bold text-[#1C1B1F] flex items-center gap-2">
                 <ChatTeardropDots size={22} weight="fill" className="text-[#6750A4]" />
                 Anexos
              </h3>
              <div className="space-y-2">
                 <AnexoItem label="etp_computadores_v1.pdf" size="1.2MB" />
                 <AnexoItem label="orcamento_fornecedores.xlsx" size="450KB" />
              </div>
              <button className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#CAC4D0] rounded-2xl text-[#625B71] text-xs font-bold hover:bg-black/5 transition-all">
                 <Paperclip size={18} />
                 ADICIONAR ANEXO
              </button>
           </div>
        </div>

      </div>
    </div>
  )
}

function InfoItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="space-y-1">
       <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">{label}</p>
       <div className="flex items-center gap-2 font-bold text-[#1C1B1F]">
          <Icon size={18} weight="fill" className="text-[#6750A4]/60" />
          {value}
       </div>
    </div>
  )
}

function TimelineStep({ date, title, desc, status }: { date: string, title: string, desc: string, status: 'success' | 'pending' }) {
  return (
    <div className="flex gap-4 relative z-10">
       <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
         status === 'success' ? 'bg-[#EADDFF] text-[#6750A4]' : 'bg-white border-2 border-[#E7E0EC] text-black/20'
       }`}>
          {status === 'success' ? <CheckCircle size={20} weight="fill" /> : <div className="w-2 h-2 bg-black/10 rounded-full" />}
       </div>
       <div className="space-y-1">
          <p className="text-[10px] font-black text-black/20">{date}</p>
          <p className="text-sm font-bold text-[#1C1B1F]">{title}</p>
          <p className="text-xs text-[#625B71] leading-tight">{desc}</p>
       </div>
    </div>
  )
}

function AnexoItem({ label, size }: { label: string, size: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 hover:bg-black/10 transition-colors cursor-pointer">
       <div className="flex items-center gap-3">
          <FileText size={18} weight="fill" className="text-[#6750A4]/40" />
          <span className="text-xs font-bold text-black/70 truncate w-32">{label}</span>
       </div>
       <span className="text-[10px] font-black text-black/20">{size}</span>
    </div>
  )
}
