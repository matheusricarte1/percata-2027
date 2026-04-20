'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  House,
  Files,
  Package,
  ClockCounterClockwise,
  SignOut,
  Lightning,
  SquaresFour,
  CheckCircle,
  Users,
  Gear,
  Wallet,
  ChartLineUp
} from '@phosphor-icons/react'
import { useCarrinhoStore } from '@/store/carrinho'

interface SidebarProps {
  role?: 'usuario' | 'chefia' | 'admin'
}

export function Sidebar({ role = 'usuario' }: SidebarProps) {
  const pathname = usePathname()
  const itemCount = useCarrinhoStore((s) => s.items.length)

  // -- ADMIN SIDEBAR (WIDE / PREMIUM M3) --
  if (role === 'admin') {
    return (
      <nav className="fixed left-0 top-0 h-full w-[280px] bg-[#1C1B1F] text-[#E6E1E5] flex flex-col p-4 z-50 shadow-2xl border-r border-white/5">
        <div className="flex items-center gap-4 font-display text-2xl font-black mb-12 px-4 py-4 italic">
          <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Lightning weight="fill" className="text-white" size={24} />
          </div>
          PERCATA
        </div>

        <div className="space-y-1 flex-1">
          <SectionLabel label="Gestão Superior" />
          <SidebarLink href="/admin" icon={SquaresFour} label="Painel Executivo" active={pathname === '/admin'} wide />
          <SidebarLink href="/admin/aprovacoes" icon={CheckCircle} label="Triagem de Demandas" active={pathname === '/admin/aprovacoes'} badge="12" wide />
          <SidebarLink href="#" icon={ChartLineUp} label="Planejamento PCA" active={false} wide />
          
          <div className="h-[1px] bg-white/10 my-6 mx-4" />
          
          <SectionLabel label="Configurações Estruturais" />
          <SidebarLink href="#" icon={Package} label="Catálogo Mestre" active={false} wide />
          <SidebarLink href="#" icon={Users} label="Gestão de Usuários" active={false} wide />
          <SidebarLink href="#" icon={Gear} label="Parâmetros do Sistema" active={false} wide />
        </div>

        <button className="flex items-center gap-4 p-4 mt-auto text-white/60 hover:text-white hover:bg-white/5 rounded-2xl transition-all font-display font-bold text-sm">
          <SignOut size={22} weight="bold" />
          <span>Encerrar Sessão</span>
        </button>
      </nav>
    )
  }

  // -- CHEFIA NAV RAIL M3 --
  if (role === 'chefia') {
    return (
      <nav className="fixed left-0 top-0 h-full w-20 bg-[#F5FBF9] flex flex-col items-center py-8 z-50 border-r border-emerald-100 shadow-sm">
        <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center text-2xl mb-12 shadow-lg shadow-emerald-600/20">
          <Lightning weight="fill" />
        </div>

        <div className="flex-1 w-full flex flex-col items-center gap-6">
          <SidebarLink href="/triagem" icon={SquaresFour} label="Painel" active={pathname === '/triagem'} theme="chefia" />
          <SidebarLink href="#" icon={CheckCircle} label="Validar" active={false} theme="chefia" badge="4" />
          <SidebarLink href="#" icon={Wallet} label="Verbas" active={false} theme="chefia" />
        </div>

        <button className="flex flex-col items-center gap-1 p-3 mt-auto text-emerald-900/40 hover:text-emerald-900 transition-colors">
           <SignOut size={26} weight="bold" />
           <span className="text-[10px] font-black uppercase tracking-tighter">Sair</span>
        </button>
      </nav>
    )
  }

  // -- USUARIO NAV RAIL (Standard M3) --
  return (
    <nav className="nav-rail">
      <div className="w-12 h-12 mb-12 flex items-center justify-center rounded-[18px] bg-primary text-white shadow-lg shadow-primary/30 active:scale-90 transition-transform cursor-pointer">
        <Lightning size={26} weight="fill" />
      </div>

      <div className="flex-1 w-full flex flex-col items-center gap-4">
        <SidebarLink href="/dashboard" icon={House} label="Início" active={pathname === '/dashboard'} />
        <SidebarLink href="/minhas-dfds" icon={Files} label="Pedidos" active={pathname === '/minhas-dfds'} />
        <SidebarLink href="/catalogo" icon={Package} label="Catálogo" active={pathname === '/catalogo'} badge={itemCount > 0 ? itemCount.toString() : null} />
        <div className="w-8 h-[2px] bg-outline-variant/30 my-2 rounded-full" />
        <SidebarLink href="/historico" icon={ClockCounterClockwise} label="Histórico" active={pathname === '/historico'} />
      </div>

      <button className="flex flex-col items-center gap-1 p-3 mt-auto text-on-surface-variant hover:text-red-600 transition-all group">
        <div className="w-12 h-8 rounded-full flex items-center justify-center group-hover:bg-red-50 transition-colors">
          <SignOut size={24} weight="bold" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-tighter font-display">Sair</span>
      </button>
    </nav>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="text-[10px] uppercase text-white/30 font-black tracking-[0.2em] mb-4 px-5">
      {label}
    </div>
  )
}

function SidebarLink({ 
  href, 
  icon: Icon, 
  label, 
  active, 
  wide, 
  badge, 
  theme 
}: { 
  href: string, 
  icon: any, 
  label: string, 
  active: boolean, 
  wide?: boolean, 
  badge?: string | null,
  theme?: 'usuario' | 'chefia' | 'admin'
}) {
  if (wide) {
    return (
      <Link
        href={href}
        className={cn(
          'flex items-center justify-between p-4 rounded-[20px] transition-all duration-300 group mx-2',
          active ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/60 hover:bg-white/5 hover:text-white'
        )}
      >
        <div className="flex items-center gap-4">
          <Icon size={24} weight={active ? 'fill' : 'bold'} className={cn(active ? 'text-white' : 'text-white/40 group-hover:text-white')} />
          <span className={cn('text-sm font-display font-bold tracking-tight', active ? 'text-white' : '')}>{label}</span>
        </div>
        {badge && (
          <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm">
            {badge}
          </span>
        )}
      </Link>
    )
  }

  // Rail View (Narrow M3 Style)
  const isChefia = theme === 'chefia'
  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col items-center justify-center w-full relative no-underline gap-1',
        active ? 'text-primary' : 'text-on-surface-variant hover:text-primary'
      )}
    >
      <div className={cn(
        'w-14 h-8 flex items-center justify-center rounded-full transition-all duration-400',
        active 
          ? (isChefia ? 'bg-emerald-200 text-emerald-900' : 'bg-primary-container text-on-primary-container') 
          : 'hover:bg-surface-variant'
      )}>
        <Icon size={24} weight={active ? 'fill' : 'bold'} />
        {badge && (
          <span className={cn(
            'absolute font-black text-white text-[9px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2',
            isChefia ? 'top-[-2px] right-2 bg-orange-600 border-[#F5FBF9]' : 'top-[-4px] right-2 bg-red-600 border-surface'
          )}>
            {badge}
          </span>
        )}
      </div>
      <span className={cn(
        'text-[10px] font-display font-black uppercase tracking-tighter text-center transition-colors',
        active ? 'text-primary' : 'text-on-surface-variant'
      )}>
        {label}
      </span>
    </Link>
  )
}
