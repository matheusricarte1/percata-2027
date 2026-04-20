'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { UserNav } from '@/components/layout/UserNav'
import { MagnifyingGlass, Bell } from '@phosphor-icons/react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen" style={{ '--sidebar-width': '80px' } as any}>
      <Sidebar />
      
      <main className="flex-1 ml-20 flex flex-col h-screen overflow-hidden">
        {/* App Bar */}
        <header className="app-bar border-b border-outline-variant/30">
          <div className="font-display font-black text-2xl tracking-tighter text-primary italic uppercase">
             PERCATA <span className="text-foreground/40 font-medium tracking-normal lowercase not-italic text-sm">2027</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-surface-variant/50 rounded-full h-12 px-6 flex items-center gap-4 w-72 focus-within:w-96 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-500 shadow-sm">
               <MagnifyingGlass size={20} weight="bold" className="text-secondary" />
               <input 
                 type="text" 
                 placeholder="O que você está procurando?" 
                 className="bg-transparent border-none outline-none text-sm w-full font-medium placeholder:text-secondary/50"
               />
            </div>
            
            <button className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-surface-variant transition-all relative group shadow-sm bg-white border border-outline-variant/20">
               <Bell size={24} className="text-secondary group-hover:text-primary transition-colors" />
               <div className="absolute top-3.5 right-3.5 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white"></div>
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
