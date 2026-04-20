'use client'

import React, { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { 
  Bell, 
  MagnifyingGlass, 
  UserCircle, 
  CaretDown,
  SignOut,
  User,
  Gear,
  Question
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background flex">
      {/* 1. NAVIGATION RAIL (SIDEBAR) */}
      <Sidebar role="usuario" />

      <main className="flex-1 flex flex-col pl-20 transition-all duration-300">
        
        {/* 2. APP BAR UNIFICADA (M3) */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-black/5 flex items-center justify-between px-8 sticky top-0 z-40 transition-all">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative group w-full max-w-md">
              <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30 group-focus-within:text-primary transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Busca global no sistema..." 
                className="w-full bg-black/5 border-none rounded-full py-2 pl-12 pr-6 text-sm font-medium focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Badges e Menus */}
            <button className="relative p-2 text-black/40 hover:text-primary transition-all">
              <Bell size={24} weight="bold" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>

            {/* Perfil com Menu Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-3 p-1 pr-3 bg-black/5 hover:bg-black/10 rounded-full transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                  MR
                </div>
                <span className="text-xs font-bold text-black/60 group-hover:text-black">Matheus</span>
                <CaretDown size={14} weight="bold" className={isMenuOpen ? "rotate-180" : ""} />
              </button>

              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-56 bg-white border border-black/5 rounded-2xl shadow-xl p-2 z-50 overflow-hidden"
                  >
                    <MenuLink icon={User} label="Meu Perfil" />
                    <MenuLink icon={Gear} label="Configurações" />
                    <MenuLink icon={Question} label="Ajuda" />
                    <div className="h-[1px] bg-black/5 my-2 mx-2" />
                    <MenuLink icon={SignOut} label="Sair do Sistema" variant="danger" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="flex-1 relative overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}

function MenuLink({ icon: Icon, label, variant = 'default' }: any) {
  return (
    <button className={`
      w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all
      ${variant === 'danger' ? 'text-red-500 hover:bg-red-50' : 'text-black/60 hover:bg-black/5'}
    `}>
      <Icon size={18} weight="bold" />
      {label}
    </button>
  )
}
