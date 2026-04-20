'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Warning, ArrowLeft, House } from '@phosphor-icons/react'

export default function AuthErrorPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#FDFBFF] flex items-center justify-center p-6">
      <div className="max-w-md w-full glass-card p-10 text-center space-y-6 shadow-2xl">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-inner">
          <Warning size={40} weight="fill" />
        </div>
        
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-extrabold text-[#1C1B1F]">Ops! Erro na Autenticação</h1>
          <p className="text-[#625B71] text-sm leading-relaxed">
            Houve um problema ao processar seu login com o Google. Isso pode acontecer por causa de cookies bloqueados ou expiração da sessão.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={() => router.push('/login')}
            className="w-full py-4 rounded-2xl bg-[#6750A4] text-white font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"
          >
            <ArrowLeft size={20} weight="bold" />
            Tentar Novamente
          </button>
          
          <button 
            onClick={() => router.push('/dashboard')}
            className="w-full py-4 rounded-2xl bg-black/5 text-black/60 font-bold flex items-center justify-center gap-2 hover:bg-black/10 transition-all"
          >
            <House size={20} weight="bold" />
            Ir para Dashboard
          </button>
        </div>

        <p className="text-[10px] text-black/20 font-black uppercase tracking-widest pt-4">
          Token detectado, mas não processado.
        </p>
      </div>
    </div>
  )
}
