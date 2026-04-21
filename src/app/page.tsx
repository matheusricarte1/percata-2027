'use client'

import React from 'react'
import { 
  ShieldCheck, 
  ArrowRight, 
  GoogleLogo, 
  Bank,
  Key,
  IdentificationCard,
  Lightning,
  TreeStructure,
  Infinity as InfinityIcon,
  ShieldChevron
} from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  const router = useRouter()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    // Simulated login redirect
    router.push('/dashboard')
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
  }

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Left Side: Premium Brand Hero */}
      <div className="md:w-[55%] bg-[#1A237E] relative flex flex-col justify-center p-12 lg:p-24 overflow-hidden">
        
        {/* Living Background Elements */}
        <div className="absolute top-0 right-0 w-full h-full pointer-events-none">
           <motion.div 
             animate={{ 
               scale: [1, 1.2, 1],
               opacity: [0.1, 0.2, 0.1]
             }}
             transition={{ duration: 10, repeat: Infinity }}
             className="absolute -top-20 -right-20 w-[600px] h-[600px] bg-indigo-400 rounded-full blur-[150px]"
           />
           <motion.div 
             animate={{ 
               scale: [1, 1.1, 1],
               opacity: [0.05, 0.1, 0.05]
             }}
             transition={{ duration: 15, repeat: Infinity, delay: 2 }}
             className="absolute -bottom-40 -left-20 w-[800px] h-[800px] bg-amber-400 rounded-full blur-[200px]"
           />
        </div>
        
        <div className="relative z-10 space-y-12">
           <motion.div 
             initial={{ opacity: 0, x: -30 }}
             animate={{ opacity: 1, x: 0 }}
             className="flex items-center gap-6"
           >
              <div className="w-20 h-20 bg-white rounded-[32px] flex items-center justify-center shadow-2xl text-[#1A237E] rotate-3 hover:rotate-0 transition-transform duration-500">
                 <Lightning size={48} weight="fill" />
              </div>
              <div className="space-y-1">
                 <h1 className="font-display text-6xl font-black text-white tracking-tighter italic">
                    PERCATA
                 </h1>
                 <div className="flex items-center gap-2">
                    <span className="h-[2px] w-8 bg-indigo-400 rounded-full" />
                    <span className="text-[11px] font-black tracking-[0.6em] text-indigo-300 uppercase">Gestão 2027</span>
                 </div>
              </div>
           </motion.div>
           
           <motion.div 
             initial={{ opacity: 0, y: 30 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.2 }}
             className="space-y-8 max-w-xl"
           >
              <h2 className="font-display text-6xl font-black text-white leading-[1] italic uppercase tracking-tighter">
                 Planejamento <br/>
                 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-indigo-400">Institucional</span> <br/>
                 Redefinido.
              </h2>
              <p className="text-indigo-100/60 text-xl font-medium leading-relaxed pr-10">
                 A plataforma definitiva para formalização de demandas (DFD), controle orçamentário e transparência estratégica integrada.
              </p>
           </motion.div>

           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 0.4 }}
             className="flex gap-16 pt-12 border-t border-white/5"
           >
              <div className="space-y-2">
                 <div className="flex items-center gap-3">
                    <ShieldChevron size={24} weight="duotone" className="text-indigo-400" />
                    <p className="text-3xl font-black text-white italic tracking-tighter">100%</p>
                 </div>
                 <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest leading-none">Auditável (Lei 14.133)</p>
              </div>
              <div className="space-y-2">
                 <div className="flex items-center gap-3">
                    <TreeStructure size={24} weight="duotone" className="text-indigo-400" />
                    <p className="text-3xl font-black text-white italic tracking-tighter">PCA</p>
                 </div>
                 <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest leading-none">Fluxo Consolidado</p>
              </div>
           </motion.div>
        </div>

        {/* Decorative Watermark */}
        <div className="absolute right-[-100px] bottom-[-100px] opacity-[0.03] select-none pointer-events-none rotate-12">
           <Lightning size={800} weight="fill" className="text-white" />
        </div>
      </div>

      {/* Right Side: Tactile Authentication Form */}
      <div className="md:w-[45%] bg-white flex flex-col justify-center p-8 lg:p-24 relative">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full mx-auto space-y-12"
        >
          
          <div className="space-y-4">
            <h3 className="font-display text-4xl font-black text-[#1A237E] uppercase italic tracking-tighter leading-none">Acesso Seguro</h3>
            <p className="text-slate-400 text-lg font-medium leading-tight">Entre com sua identidade institucional para operar no ciclo 2027.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-3">
               <label className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em] ml-2">E-mail Corporativo</label>
               <div className="relative group/input">
                  <IdentificationCard className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-indigo-500 transition-colors" size={24} weight="duotone" />
                  <input 
                    type="email" 
                    placeholder="servidor@instituicao.gov.br"
                    className="w-full pl-16 pr-8 py-6 rounded-[32px] bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white focus:ring-8 focus:ring-indigo-500/5 transition-all font-bold text-[#1A237E] text-lg outline-none placeholder:text-slate-300"
                    required
                  />
               </div>
            </div>

            <div className="space-y-3">
               <div className="flex justify-between items-center px-2">
                  <label className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em] ml-2">Sua Senha</label>
                  <button type="button" className="text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-indigo-500 transition-colors">Recuperar</button>
               </div>
               <div className="relative group/input">
                  <Key className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-indigo-500 transition-colors" size={24} weight="duotone" />
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    className="w-full pl-16 pr-8 py-6 rounded-[32px] bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white focus:ring-8 focus:ring-indigo-500/5 transition-all font-bold text-[#1A237E] text-lg outline-none placeholder:text-slate-300"
                    required
                  />
               </div>
            </div>

            <Button 
              type="submit"
              className="w-full h-20 rounded-[32px] bg-[#1A237E] hover:bg-indigo-700 text-white font-black text-xl shadow-[0_20px_40px_-10px_rgba(26,35,126,0.3)] group transition-all"
            >
              AUTENTICAR <ArrowRight size={24} weight="bold" className="ml-3 group-hover:translate-x-2 transition-transform" />
            </Button>
          </form>

          <div className="relative py-4">
             <div className="absolute inset-0 flex items-center"><div className="w-full border-t-2 border-slate-50"></div></div>
             <div className="relative flex justify-center text-[10px] uppercase font-black text-slate-300 tracking-[0.5em]"><span className="bg-white px-6">Login Único</span></div>
          </div>

          <Button 
            onClick={handleGoogleLogin}
            variant="outline"
            className="w-full h-20 rounded-[32px] border-2 border-slate-100 text-[#1A237E] font-black flex items-center justify-center gap-4 hover:bg-slate-50 hover:border-indigo-100 transition-all text-lg"
          >
             <GoogleLogo size={28} weight="bold" className="text-red-500" />
             Conta Institucional Google
          </Button>

          <p className="text-[11px] text-center text-slate-300 font-bold leading-relaxed px-12 uppercase tracking-tight">
            Ambiente Seguro. Todo acesso é monitorado e vinculado ao seu CPF/SIAPE.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
