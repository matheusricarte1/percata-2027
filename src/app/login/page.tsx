'use client'

import React from 'react'
import { 
  ShieldCheck, 
  ArrowRight, 
  GoogleLogo, 
  BuildingLibrary,
  Key,
  IdentificationCard
} from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    // Simulated login redirect
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#FDFBFF] flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* Visual Side (Hero) */}
      <div className="md:w-[55%] bg-[#6750A4] relative flex flex-col justify-center p-12 lg:p-24 overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#D0BCFF] rounded-full blur-[120px] opacity-20 animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-[#21005D] rounded-full blur-[150px] opacity-30" />
        
        <div className="relative z-10 space-y-8 animate-in slide-in-from-left duration-1000">
           <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-2xl text-[#6750A4]">
                 <BuildingLibrary size={40} weight="fill" />
              </div>
              <h1 className="font-display text-5xl font-black text-white tracking-widest uppercase">
                 PERCATA
                 <span className="block text-2xl font-light tracking-[8px] opacity-70">SISTEMA 2027</span>
              </h1>
           </div>
           
           <div className="space-y-4 max-w-lg">
              <h2 className="font-display text-4xl font-bold text-white leading-tight">
                 O futuro do planejamento institucional começa aqui.
              </h2>
              <p className="text-[#EADDFF] text-lg font-medium leading-relaxed">
                 Plataforma unificada para formalização de demandas (DFD), gestão orçamentária e transparência pública conforme a Lei 14.133.
              </p>
           </div>

           <div className="flex gap-10 pt-10 border-t border-white/10">
              <div className="space-y-1">
                 <p className="text-3xl font-black text-white">100%</p>
                 <p className="text-xs font-bold text-[#EADDFF] uppercase tracking-widest">Auditável</p>
              </div>
              <div className="space-y-1">
                 <p className="text-3xl font-black text-white">2027</p>
                 <p className="text-xs font-bold text-[#EADDFF] uppercase tracking-widest">Versão PCA</p>
              </div>
           </div>
        </div>

        {/* Floating Decoration Icons */}
        <div className="absolute right-10 bottom-10 opacity-10">
           <ShieldCheck size={300} weight="thin" className="text-white" />
        </div>
      </div>

      {/* Login Side (Form) */}
      <div className="md:w-[45%] bg-white flex flex-col justify-center p-8 lg:p-20 relative">
        <div className="max-w-md w-full mx-auto space-y-10 animate-in slide-in-from-right duration-1000">
          
          <div className="space-y-2">
            <h3 className="font-display text-3xl font-black text-[#1C1B1F]">Acesse sua conta</h3>
            <p className="text-[#625B71] font-medium">Utilize suas credenciais institucionais para entrar.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-1.5">
               <label className="text-[10px] font-black text-black/40 uppercase tracking-widest px-2">E-mail Institucional</label>
               <div className="relative">
                  <IdentificationCard className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20" size={20} />
                  <input 
                    type="email" 
                    placeholder="nome.sobrenome@uva.br"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-[#FBFAFD] border border-[#E7E0EC] focus:ring-4 focus:ring-[#6750A4]/10 focus:border-[#6750A4] transition-all font-medium text-[#1C1B1F]"
                    required
                  />
               </div>
            </div>

            <div className="space-y-1.5">
               <div className="flex justify-between items-center px-2">
                  <label className="text-[10px] font-black text-black/40 uppercase tracking-widest">Senha</label>
                  <button type="button" className="text-[10px] font-black text-[#6750A4] uppercase hover:underline">Esqueci a senha</button>
               </div>
               <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20" size={20} />
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-[#FBFAFD] border border-[#E7E0EC] focus:ring-4 focus:ring-[#6750A4]/10 focus:border-[#6750A4] transition-all font-medium text-[#1C1B1F]"
                    required
                  />
               </div>
            </div>

            <button 
              type="submit"
              className="w-full py-4 rounded-2xl bg-[#6750A4] text-white font-black text-lg shadow-xl shadow-[#6750A4]/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              ENTRAR NO SISTEMA
              <ArrowRight size={20} weight="bold" />
            </button>
          </form>

          <div className="relative">
             <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E7E0EC]"></div></div>
             <div className="relative flex justify-center text-[10px] uppercase font-black text-black/20 tracking-widest"><span className="bg-white px-4">Ou continue com</span></div>
          </div>

          <button className="w-full py-4 rounded-2xl bg-white border border-[#E7E0EC] text-[#1C1B1F] font-bold flex items-center justify-center gap-3 hover:bg-[#FBFAFD] transition-all">
             <GoogleLogo size={24} weight="bold" className="text-[#EA4335]" />
             Conta Institucional Google
          </button>

          <p className="text-[10px] text-center text-black/30 font-medium leading-relaxed px-8">
            Ao acessar o sistema, você concorda com os termos de uso e política de privacidade de dados da Instituição.
          </p>
        </div>
      </div>
    </div>
  )
}
