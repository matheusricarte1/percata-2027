'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { UserNav } from '@/components/layout/UserNav'
import { MagnifyingGlass, Bell } from '@phosphor-icons/react'

export default function TriagemLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen" style={{ '--sidebar-width': '90px' } as any}>
      <Sidebar role="chefia" />
      
      <main className="flex-1 ml-[90px] flex flex-col h-screen overflow-hidden">
        {/* App Bar */}
        <header className="app-bar">
          <div className="font-display font-semibold text-xl text-amber-900/80">
             Central de Triagem
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-[var(--md-surface-variant)] rounded-full h-10 px-4 flex items-center gap-3 w-64 focus-within:w-80 focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--md-primary-container)] transition-all duration-300">
               <MagnifyingGlass size={20} className="text-[var(--md-secondary)]" />
               <input 
                 type="text" 
                 placeholder="Buscar na fila de triagem..." 
                 className="bg-transparent border-none outline-none text-sm w-full"
               />
            </div>
            
            <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--md-surface-variant)] transition-colors relative mr-1">
               <Bell size={24} />
            </button>
            
            <UserNav />
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto mt-[72px] p-8">
           <div className="max-w-7xl mx-auto">
             {children}
           </div>
        </div>
      </main>
    </div>
  )
}
