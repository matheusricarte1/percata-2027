'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SignOut, User, CaretDown, Envelope } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'

export function UserNav() {
  const [userData, setUserData] = useState<any>(null)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserData({
          name: user.user_metadata.full_name || user.email?.split('@')[0],
          email: user.email,
          avatar: user.user_metadata.avatar_url,
          initials: (user.user_metadata.full_name || user.email || 'U').substring(0, 2).toUpperCase()
        })
      }
    }
    getUser()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!userData) return <div className="w-10 h-10 rounded-full bg-black/5 animate-pulse" />

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1.5 rounded-full hover:bg-black/5 transition-all group"
      >
        <div className="relative">
          {userData.avatar ? (
            <img 
              src={userData.avatar} 
              alt={userData.name} 
              className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm group-hover:border-[#6750A4]/20 transition-all"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6750A4] to-[#9575CD] flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm">
              {userData.initials}
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
        </div>
        
        <div className="hidden md:flex flex-col items-start mr-1">
          <span className="text-xs font-black text-[#1C1B1F] leading-none uppercase tracking-tighter">{userData.name}</span>
          <span className="text-[9px] font-medium text-black/40 lowercase -mt-0.5">{userData.email}</span>
        </div>
        <CaretDown size={14} weight="bold" className={`text-black/20 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-3 w-64 bg-white rounded-3xl shadow-2xl border border-black/5 p-2 z-50 animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-black/5 flex items-center gap-4">
               <img src={userData.avatar} alt="" className="w-12 h-12 rounded-2xl shadow-lg" />
               <div className="flex-1 overflow-hidden">
                  <p className="font-display font-black text-[#1C1B1F] leading-tight truncate">{userData.name}</p>
                  <p className="text-[10px] text-black/40 font-medium truncate flex items-center gap-1.5">
                     <Envelope size={12} weight="fill" />
                     {userData.email}
                  </p>
               </div>
            </div>
            
            <div className="py-2">
               <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-black/60 hover:bg-black/5 hover:text-[#6750A4] rounded-2xl transition-all group">
                  <User size={20} weight="fill" className="group-hover:scale-110 transition-transform" />
                  Perfil do Usuário
               </button>
               <button 
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-2xl transition-all group"
               >
                  <SignOut size={20} weight="fill" className="group-hover:translate-x-1 transition-transform" />
                  Sair do Sistema
               </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
