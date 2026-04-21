'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { UserNav } from '@/components/layout/UserNav'
import { MagnifyingGlass, Bell } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [role, setRole] = useState<'usuario' | 'chefia' | 'admin'>('usuario')
  const [email, setEmail] = useState('')

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email || '')
        // LOGICA DE HARDCODE PARA ADMIN MESTRE
        if (user.email === 'matheus.ricarte@upe.br') {
          setRole('admin')
        } else {
          // Busca no banco se não for o admin mestre
          const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          
          if (data?.role) setRole(data.role as any)
        }
      }
    }
    getUser()
  }, [])

  const titles: any = {
    usuario: 'Painel do Solicitante',
    chefia: 'Triagem de Setor',
    admin: 'Painel Estratégico PROPLAN'
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} />
      
      <main className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ${role === 'admin' ? 'ml-[260px]' : role === 'chefia' ? 'ml-[90px]' : 'ml-20'}`}>
        {/* App Bar Dinâmica */}
        <header className={`app-bar transition-all h-[72px] fixed top-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-black/5 flex items-center justify-between px-8 ${role === 'admin' ? 'w-[calc(100%-260px)]' : role === 'chefia' ? 'w-[calc(100%-90px)]' : 'w-[calc(100%-80px)]'}`}>
          <div className={`font-display font-black text-xl italic tracking-tighter ${role === 'admin' ? 'text-[#1A237E]' : role === 'chefia' ? 'text-[#004D40]' : 'text-[#4F378B]'}`}>
             {titles[role]}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-black/5 rounded-full h-10 px-4 flex items-center gap-3 w-64 focus-within:w-80 focus-within:bg-white focus-within:ring-2 focus-within:ring-black/10 transition-all duration-300">
               <MagnifyingGlass size={20} className="text-black/30" />
               <input 
                 type="text" 
                 placeholder="Pesquisar no sistema..." 
                 className="bg-transparent border-none outline-none text-sm w-full font-medium"
               />
            </div>
            
            <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors relative mr-2">
               <Bell size={24} />
               <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white"></div>
            </button>
            
            <UserNav />
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className={`flex-1 overflow-y-auto mt-[72px] p-8 ${role === 'admin' ? 'bg-[#F8F9FA]' : role === 'chefia' ? 'bg-[#F5FBF9]' : ''}`}>
           <div className="max-w-7xl mx-auto">
             {children}
           </div>
        </div>
      </main>
    </div>
  )
}
