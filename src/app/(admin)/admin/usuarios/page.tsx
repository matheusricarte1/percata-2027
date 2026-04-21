'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  UserPlus, 
  Gear, 
  ShieldCheck, 
  DotsThreeVertical,
  MagnifyingGlass,
  CheckCircle,
  Funnel
} from '@phosphor-icons/react'

export default function AdminUsuarios() {
  return (
    <div className="p-8 bg-[#F8F9FA] min-h-screen space-y-8">
      {/* Header Gestão */}
      <div className="flex justify-between items-center">
        <div>
           <h1 className="font-display text-3xl font-black text-[#1A237E] italic tracking-tighter">GESTÃO DE USUÁRIOS</h1>
           <p className="text-black/40 text-sm font-medium">Controle de acessos e delegação de autoridade (UPE)</p>
        </div>
        <button className="flex items-center gap-3 bg-[#1A237E] text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-[#1A237E]/20 hover:scale-105 active:scale-95 transition-all">
          <UserPlus size={20} weight="bold" />
          Convidar Servidor
        </button>
      </div>

      {/* Toolbar e Filtros */}
      <div className="bg-white p-6 rounded-[24px] border border-black/5 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[300px]">
          <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome, CPF ou Unidade..." 
            className="w-full pl-12 pr-4 py-3 bg-black/5 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#1A237E]/10 transition-all outline-none"
          />
        </div>
        <div className="flex gap-2">
           <FilterChip label="Solicitantes" count="452" active />
           <FilterChip label="Gestores" count="28" />
           <FilterChip label="Admin (PROPLAN)" count="2" />
        </div>
      </div>

      {/* Tabela de Usuários (Design M3) */}
      <div className="bg-white rounded-[32px] border border-black/5 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-[#1A237E]/5 text-[#1A237E]">
              <th className="p-6 font-black uppercase tracking-widest text-[10px]">Servidor</th>
              <th className="p-6 font-black uppercase tracking-widest text-[10px]">Unidade / Setor</th>
              <th className="p-6 font-black uppercase tracking-widest text-[10px]">Papel no Sistema</th>
              <th className="p-6 font-black uppercase tracking-widest text-[10px]">Status</th>
              <th className="p-6 font-black uppercase tracking-widest text-[10px] text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {[
              { nome: 'Ana Beatriz Souza', email: 'ana.souza@upe.br', unidade: 'Campus Garanhuns', setor: 'Diretoria Geral', role: 'Chefia', status: 'Ativo' },
              { nome: 'Matheus Ricarte', email: 'matheus.ricarte@upe.br', unidade: 'Reitoria', setor: 'PROPLAN', role: 'Administrador', status: 'Ativo' },
              { nome: 'Ricardo Mendes', email: 'ricardo.mendes@upe.br', unidade: 'Campus Caruaru', setor: 'Coordenação Acadêmica', role: 'Solicitante', status: 'Ativo' },
              { nome: 'Cláudio Ferreira', email: 'claudio.ferreira@upe.br', unidade: 'HUOC', setor: 'Compras Médicas', role: 'Solicitante', status: 'Pendente' },
            ].map((user, i) => (
              <tr key={i} className="hover:bg-black/5 transition-colors">
                <td className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1A237E]/10 text-[#1A237E] rounded-full flex items-center justify-center font-black text-xs">
                      {user.nome.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-[#1C1B1F]">{user.nome}</div>
                      <div className="text-xs text-black/40">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-6">
                   <div className="font-medium text-black/60">{user.unidade}</div>
                   <div className="text-[10px] uppercase font-black text-black/30 tracking-tighter">{user.setor}</div>
                </td>
                <td className="p-6">
                   <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${user.role === 'Administrador' ? 'bg-red-50 text-red-600' : user.role === 'Chefia' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                     {user.role}
                   </span>
                </td>
                <td className="p-6">
                   <div className="flex items-center gap-2">
                     <div className={`w-2 h-2 rounded-full ${user.status === 'Ativo' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                     <span className="font-bold text-xs">{user.status}</span>
                   </div>
                </td>
                <td className="p-6 text-right">
                   <button className="p-2 hover:bg-black/5 rounded-full text-black/20 hover:text-[#1A237E] transition-all">
                     <DotsThreeVertical size={24} weight="bold" />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FilterChip({ label, count, active }: any) {
  return (
    <button className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${active ? 'bg-[#1A237E] text-white shadow-lg' : 'bg-black/5 text-black/40 hover:bg-black/10'}`}>
      {label} <span className="opacity-40 ml-2">{count}</span>
    </button>
  )
}
