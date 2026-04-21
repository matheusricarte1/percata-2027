'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle,
  ArrowRight,
  WarningCircle,
  ChatText,
  Clock,
  PlusCircle,
  PaperPlaneTilt,
  PencilCircle,
  Handshake
} from '@phosphor-icons/react'

const icons: any = {
  rascunho: { icon: PencilCircle, color: 'text-slate-400', bg: 'bg-slate-100', label: 'Rascunho Criado' },
  triagem: { icon: PaperPlaneTilt, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Enviada para Triagem' },
  aprovada: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Demanda Homologada' },
  devolvida: { icon: WarningCircle, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Devolvida para Ajuste' },
  pactuando: { icon: Handshake, color: 'text-indigo-500', bg: 'bg-indigo-50', label: 'Em Pactuação' }
}

export function DfdTimeline({ logs }: { logs: any[] }) {
  return (
    <div className="space-y-8 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
      {logs.map((log, idx) => {
        const config = icons[log.action] || icons.rascunho
        const Icon = config.icon

        return (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={log.id}
            className="relative flex gap-6 items-start"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 z-10 shadow-sm border-4 border-white ${config.bg} ${config.color}`}>
              <Icon size={24} weight="bold" />
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex-1 space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="font-black text-sm uppercase tracking-tight text-slate-800">{config.label}</h4>
                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-300 uppercase">
                  <Clock size={12} weight="bold" />
                  {new Date(log.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {log.details || 'Nenhuma observação adicional registrada.'}
              </p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
