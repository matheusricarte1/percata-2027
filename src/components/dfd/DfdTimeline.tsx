'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle,
  ArrowRight,
  WarningCircle,
  ChatText,
  Clock,
  PlusCircle,
  PaperPlaneTilt,
  PencilCircle,
  Handshake,
  Buildings
} from '@phosphor-icons/react'

const icons: any = {
  rascunho: { icon: PencilCircle, color: 'text-slate-400', bg: 'bg-slate-100', label: 'Rascunho Criado', border: 'border-slate-200' },
  triagem: { icon: PaperPlaneTilt, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Enviada para Triagem', border: 'border-blue-100' },
  aprovada: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Demanda Homologada', border: 'border-emerald-100' },
  devolvida: { icon: WarningCircle, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Devolvida para Ajuste', border: 'border-amber-100' },
  pactuando: { icon: Buildings, color: 'text-indigo-500', bg: 'bg-indigo-50', label: 'Fase de Pactuação', border: 'border-indigo-100' },
  concluida: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Processo Concluído', border: 'border-emerald-200' }
}

export function DfdTimeline({ logs }: { logs: any[] }) {
  if (!logs || logs.length === 0) return (
    <div className="py-12 text-center opacity-20">
       <Clock size={48} className="mx-auto mb-2" />
       <p className="font-black uppercase tracking-widest text-[10px]">Sem histórico registrado</p>
    </div>
  )

  return (
    <div className="space-y-10 relative before:absolute before:left-7 before:top-4 before:bottom-4 before:w-[3px] before:bg-slate-50">
      <AnimatePresence mode="popLayout">
        {logs.map((log, idx) => {
          const config = icons[log.action] || icons.rascunho
          const Icon = config.icon

          return (
            <motion.div
              layout
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ 
                type: 'spring',
                damping: 25,
                stiffness: 300,
                delay: idx * 0.05 
              }}
              key={log.id}
              className="relative flex gap-8 items-start group"
            >
              {/* Icon Container with Elevation */}
              <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center shrink-0 z-10 shadow-sm border-2 ${config.bg} ${config.color} ${config.border} group-hover:scale-110 transition-transform duration-300`}>
                <Icon size={28} weight="duotone" />
              </div>

              {/* Log Card */}
              <div className="bg-white p-6 rounded-[28px] border border-black/5 shadow-sm flex-1 space-y-3 hover:shadow-md transition-shadow duration-300">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <h4 className="font-black text-xs uppercase tracking-widest text-slate-800 italic">{config.label}</h4>
                    <div className="flex gap-2 items-center">
                       <span className="px-2 py-0.5 bg-slate-50 rounded text-[8px] font-bold text-slate-400 uppercase">Sistema Percata</span>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-300 uppercase bg-slate-50 px-3 py-1.5 rounded-full">
                    <Clock size={12} weight="bold" />
                    {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                <p className="text-xs text-slate-500 font-medium leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-black/[0.02]">
                  {log.details || 'Ação registrada automaticamente pelo sistema de governança.'}
                </p>

                {log.action === 'devolvida' && (
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-2xl border border-amber-100/50">
                    <ChatText size={16} weight="fill" />
                    <span className="text-[10px] font-black uppercase tracking-tight">Ver comentários de ajuste</span>
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
