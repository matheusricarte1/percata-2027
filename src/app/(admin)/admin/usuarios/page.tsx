'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Users, 
  UserPlus, 
  Gear, 
  ShieldCheck, 
  DotsThreeVertical,
  MagnifyingGlass,
  CheckCircle,
  Funnel,
  Buildings,
  User,
  Shield,
  Pencil
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('Todos')

  const fetchUsuarios = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          campi:campus_id (nome, sigla)
        `)
        .order('full_name', { ascending: true })

      if (error) throw error
      setUsuarios(data || [])
    } catch (e: any) {
      toast.error('Erro ao carregar usuários: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsuarios()
  }, [])

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error
      
      setUsuarios(usuarios.map(u => u.id === userId ? { ...u, role: newRole } : u))
      toast.success(`Papel do usuário atualizado para ${newRole}!`)
    } catch (e: any) {
      toast.error('Erro ao atualizar papel: ' + e.message)
    }
  }

  const filtered = usuarios.filter(u => {
    const matchesSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) || 
                          u.email?.toLowerCase().includes(search.toLowerCase())
    const matchesRole = filterRole === 'Todos' || u.role === filterRole.toLowerCase().replace('gestores', 'chefia').replace('solicitantes', 'solicitante').replace('administradores', 'admin')
    return matchesSearch && matchesRole
  })

  return (
    <div className="p-8 bg-[#F8F9FA] min-h-screen space-y-8">
      {/* Header Gestão */}
      <div className="flex justify-between items-center bg-white p-8 rounded-[40px] border border-black/5 shadow-sm">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 bg-[#1A237E] text-white rounded-3xl flex items-center justify-center text-3xl shadow-lg">
              <Users weight="fill" />
           </div>
           <div>
              <h1 className="font-display text-4xl font-black text-[#1A237E] italic tracking-tighter uppercase">Gestão de Autoridade</h1>
              <p className="text-black/40 text-sm font-medium">Controle de acessos e delegação de perfis para o PERCATA 2027</p>
           </div>
        </div>
        <button className="flex items-center gap-3 bg-[#1A237E] text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all">
          <UserPlus size={20} weight="bold" />
          Convidar Servidor
        </button>
      </div>

      {/* Toolbar e Filtros */}
      <div className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[300px]">
          <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20" size={18} />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email ou CPF..." 
            className="w-full pl-12 pr-4 py-3 bg-black/5 border-none rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
          />
        </div>
        <div className="flex gap-2">
           {['Todos', 'Solicitantes', 'Gestores', 'Admin'].map((label) => (
             <button 
                key={label}
                onClick={() => setFilterRole(label)}
                className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filterRole === label ? 'bg-[#1A237E] text-white shadow-xl' : 'bg-black/5 text-black/40 hover:bg-black/10'}`}
             >
               {label}
             </button>
           ))}
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white rounded-[40px] border border-black/5 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-400">
              <th className="p-8 font-black uppercase tracking-[0.2em] text-[10px]">Servidor Identificado</th>
              <th className="p-8 font-black uppercase tracking-[0.2em] text-[10px]">Lotação Principal</th>
              <th className="p-8 font-black uppercase tracking-[0.2em] text-[10px]">Perfil PERCATA</th>
              <th className="p-8 font-black uppercase tracking-[0.2em] text-[10px] text-right">Ações de Gestão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {loading ? (
              [1, 2, 3].map(i => (
                <tr key={i}><td colSpan={4} className="p-4"><Skeleton className="h-12 w-full rounded-2xl" /></td></tr>
              ))
            ) : (
              filtered.map((user, i) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 text-[#1A237E] rounded-2xl flex items-center justify-center font-black text-xs shadow-sm border border-indigo-100 group-hover:scale-110 transition-transform">
                        {user.full_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="font-black text-slate-800 uppercase tracking-tight">{user.full_name || 'Usuário Sem Nome'}</div>
                        <div className="text-xs text-black/30 font-medium">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-8">
                     <div className="font-black text-slate-600 uppercase tracking-widest text-[10px]">{user.campi?.nome || 'Não vinculado'}</div>
                     <div className="text-[9px] uppercase font-black text-black/20 italic tracking-tighter">SIGLA: {user.campi?.sigla || 'N/A'}</div>
                  </td>
                  <td className="p-8">
                     <select 
                        value={user.role || 'solicitante'}
                        onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-none ring-1 appearance-none cursor-pointer focus:ring-4 transition-all ${
                          user.role === 'admin' ? 'bg-red-50 text-red-600 ring-red-100' : 
                          user.role === 'chefia' ? 'bg-emerald-50 text-emerald-600 ring-emerald-100' : 
                          'bg-blue-50 text-blue-600 ring-blue-100'
                        }`}
                     >
                        <option value="solicitante">SOLICITANTE</option>
                        <option value="chefia">CHEFIA UNIDADE</option>
                        <option value="admin">ADMIN PROPLAN</option>
                     </select>
                  </td>
                  <td className="p-8 text-right">
                     <div className="flex justify-end gap-2">
                        <button className="p-3 bg-black/5 hover:bg-black/10 rounded-xl text-black/40 hover:text-slate-800 transition-all shadow-sm">
                          <Gear size={20} weight="fill" />
                        </button>
                        <button className="p-3 bg-black/5 hover:bg-black/10 rounded-xl text-black/40 hover:text-slate-800 transition-all shadow-sm">
                          <DotsThreeVertical size={24} weight="bold" />
                        </button>
                     </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {!loading && filtered.length === 0 && (
          <div className="py-20 text-center space-y-4 opacity-30">
            <MagnifyingGlass size={64} weight="thin" className="mx-auto" />
            <p className="font-display font-black text-xl uppercase tracking-widest">Nenhum servidor encontrado</p>
          </div>
        )}
      </div>
    </div>
  )
}
