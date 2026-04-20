'use client'

import React from 'react'
import { 
  Users, 
  UserPlus, 
  MagnifyingGlass, 
  Funnel, 
  DotsThreeVertical,
  CheckCircle,
  ShieldCheck,
  Building
} from '@phosphor-icons/react'

const usersData = [
  { id: 1, name: 'Roberto Costa', email: 'roberto.costa@instituicao.gov.br', role: 'Chefia', dept: 'Financeiro', status: 'Ativo' },
  { id: 2, name: 'Mariana Silva', email: 'mariana.silva@instituicao.gov.br', role: 'Solicitante', dept: 'Financeiro', status: 'Ativo' },
  { id: 3, name: 'Admin Geral', email: 'admin@percata.com', role: 'Administrador', dept: 'Geral', status: 'Ativo' },
  { id: 4, name: 'Carlos Oliveira', email: 'carlos.oliveira@instituicao.gov.br', role: 'Solicitante', dept: 'Manutenção', status: 'Inativo' },
]

export default function UsuariosPage() {
  return (
    <div className="p-8 space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="font-display text-4xl font-extrabold text-[#1A237E] tracking-tight">
            Usuários & Níveis
          </h1>
          <p className="text-[#3F51B5] font-medium opacity-80">
            Gerencie o acesso institucional e as permissões de cada servidor.
          </p>
        </div>

        <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1A237E] text-white font-bold shadow-lg shadow-[#1A237E]/20 hover:scale-[1.02] active:scale-95 transition-all">
          <UserPlus size={20} weight="bold" />
          Convidar Usuário
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-black/5 flex flex-col md:flex-row gap-4 items-center justify-between bg-white/50">
           <div className="flex items-center gap-3">
              <Users size={22} weight="fill" className="text-[#1A237E]" />
              <h2 className="font-display text-xl font-bold text-[#1A237E]">Servidores Cadastrados</h2>
           </div>

           <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                 <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" size={18} />
                 <input 
                   type="text" 
                   placeholder="Nome, e-mail ou setor..." 
                   className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-black/5 border-none focus:ring-2 focus:ring-[#1A237E]/20 transition-all text-sm font-medium"
                 />
              </div>
              <button className="p-2.5 rounded-xl bg-black/5 hover:bg-black/10 transition-all text-black/60">
                 <Funnel size={20} weight="bold" />
              </button>
           </div>
        </div>

        <div className="overflow-x-auto">
           <table className="w-full text-left">
              <thead>
                 <tr className="bg-[#E8EAF6]/30 text-[10px] font-black uppercase tracking-widest text-[#1A237E]/60">
                    <th className="px-8 py-4">Servidor</th>
                    <th className="px-8 py-4 text-center">Nível de Acesso</th>
                    <th className="px-8 py-4 text-center">Departamento</th>
                    <th className="px-8 py-4 text-center">Status</th>
                    <th className="px-8 py-4 text-right">Ações</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                 {usersData.map((user) => (
                    <tr key={user.id} className="hover:bg-[#E8EAF6]/10 transition-all group">
                       <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-full bg-[#3F51B5] text-white flex items-center justify-center font-bold">
                                {user.name.charAt(0)}
                             </div>
                             <div>
                                <div className="font-bold text-black/80">{user.name}</div>
                                <div className="text-xs text-black/40 font-medium">{user.email}</div>
                             </div>
                          </div>
                       </td>
                       <td className="px-8 py-6 text-center">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-[10px] font-black uppercase tracking-tight text-black/60">
                             <ShieldCheck size={14} weight="fill" className={user.role === 'Administrador' ? 'text-amber-500' : 'text-blue-500'} />
                             {user.role}
                          </div>
                       </td>
                       <td className="px-8 py-6 text-center text-xs font-bold text-black/50">
                          <div className="flex items-center justify-center gap-2">
                             <Building size={14} />
                             {user.dept}
                          </div>
                       </td>
                       <td className="px-8 py-6 text-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            user.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {user.status}
                          </span>
                       </td>
                       <td className="px-8 py-6 text-right">
                          <button className="p-2 rounded-lg hover:bg-black/5 text-black/20 hover:text-black/60 transition-all">
                             <DotsThreeVertical size={24} weight="bold" />
                          </button>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>
    </div>
  )
}
