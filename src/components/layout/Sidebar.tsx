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
  Gear,
  CheckCircle,
  Wallet,
  SquaresFour,
  Users,
  ChartLineUp,
} from '@phosphor-icons/react'
import { useCarrinhoStore } from '@/store/carrinho'

  role?: 'solicitante' | 'chefia' | 'admin'
}

export function Sidebar({ role = 'solicitante' }: SidebarProps) {
  const pathname = usePathname()
  const itemCount = useCarrinhoStore((s) => s.items.length)

  // -- ADMIN SIDEBAR (WIDE) --
  if (role === 'admin') {
    return (
      <nav className="fixed left-0 top-0 h-full w-[260px] bg-[#1A237E] text-white flex flex-col p-6 z-50 shadow-xl">
        <div className="flex items-center gap-3 font-display text-2xl font-extrabold mb-10 px-3">
          <Lightning weight="fill" className="text-white" />
          PERCATA
        </div>

        <div className="text-[10px] uppercase text-white/40 font-bold tracking-widest mb-3 px-3">
          Visão Gerencial
        </div>

        <div className="space-y-2 flex-1">
          <SidebarLink href="/admin" icon={SquaresFour} label="Dashboard Geral" active={pathname === '/admin'} wide />
          <SidebarLink href="/admin/campanhas" icon={ChartLineUp} label="Calendário PCA" active={pathname === '/admin/campanhas'} wide />
          <SidebarLink href="/admin/consolidacao" icon={CheckCircle} label="Consolidações" active={pathname === '/admin/consolidacao'} wide />
          
          <div className="h-[1px] bg-white/10 my-4" />
          
          <div className="text-[10px] uppercase text-white/40 font-bold tracking-widest mb-3 px-3">
            Gestão Sistema
          </div>
          
          <SidebarLink href="/admin/usuarios" icon={Users} label="Servidores & Níveis" active={pathname === '/admin/usuarios'} wide />
          <SidebarLink href="#" icon={Gear} label="Configurações" active={false} wide />
        </div>

        <button 
          aria-label="Sair do sistema"
          className="flex items-center gap-3 p-3 mt-auto text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
        >
          <SignOut size={22} />
          <span className="font-medium">Sair</span>
        </button>
      </nav>
    )
  }

  // -- CHEFIA NAV RAIL (90px) --
  if (role === 'chefia') {
    return (
      <nav className="fixed left-0 top-0 h-full w-[90px] bg-[#F5FBF9] flex flex-col items-center py-6 z-50 border-r border-emerald-100 shadow-sm">
        <div className="w-[50px] h-[50px] bg-[#B2DFDB] text-[#00695C] rounded-2xl flex items-center justify-center text-2xl mb-10">
          <Lightning weight="fill" />
        </div>

        <div className="flex-1 w-full flex flex-col items-center gap-4">
          <SidebarLink href="/triagem" icon={SquaresFour} label="Aprovações" active={pathname === '/triagem'} theme="chefia" badge="3" />
          <SidebarLink href="/triagem/orcamento" icon={Wallet} label="Orçamento" active={pathname === '/triagem/orcamento'} theme="chefia" />
          <SidebarLink href="#" icon={ChartLineUp} label="Relatórios" active={false} theme="chefia" />
        </div>

        <button className="flex flex-col items-center gap-1 p-2 mt-auto text-emerald-800/60 hover:text-emerald-800">
           <SignOut size={24} />
           <span className="text-[10px] font-bold">Sair</span>
        </button>
      </nav>
    )
  }

  // -- USUARIO NAV RAIL (80px) --
  return (
    <nav className="nav-rail">
      <div className="w-12 h-12 mb-10 flex items-center justify-center rounded-xl bg-[#EADDFF] text-[#4F378B] shadow-sm">
        <Lightning size={24} weight="bold" />
      </div>

      <div className="flex-1 w-full flex flex-col items-center gap-2">
        <SidebarLink href="/dashboard" icon={House} label="Início" active={pathname === '/dashboard'} />
        <SidebarLink href="/minhas-dfds" icon={Files} label="Pedidos" active={pathname === '/minhas-dfds'} />
        <SidebarLink href="/nova-dfd" icon={Gear} label="Nova DFD" active={pathname === '/nova-dfd'} />
        <SidebarLink href="/catalogo" icon={Package} label="Catálogo" active={pathname === '/catalogo'} badge={itemCount > 0 ? itemCount.toString() : null} />
        <div className="w-8 h-[1px] bg-black/5 my-2" />
        <SidebarLink href="/historico" icon={ClockCounterClockwise} label="Histórico" active={pathname === '/historico'} />
      </div>

      <button className="nav-rail-item mt-auto hover:bg-red-50 hover:text-red-600">
        <SignOut size={24} />
        <span>Sair</span>
      </button>
    </nav>
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
        aria-label={label}
        className={cn(
          'flex items-center justify-between p-3.5 rounded-xl transition-all duration-200 group',
          active ? 'bg-white/20 text-white shadow-inner' : 'text-white/70 hover:bg-white/10 hover:text-white'
        )}
      >
        <div className="flex items-center gap-3">
          <Icon size={22} weight={active ? 'fill' : 'bold'} />
          <span className={cn('text-sm font-black uppercase tracking-widest text-[10px]', active ? 'text-white' : 'text-white/60 group-hover:text-white')}>{label}</span>
        </div>
        {badge && (
          <span className="bg-[#FF5252] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </Link>
    )
  }

  // Rail View (Narrow)
  const isChefia = theme === 'chefia'
  const isSolicitante = theme === 'solicitante' || !theme
  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col items-center justify-center transition-all duration-300 relative no-underline',
        isChefia ? 'w-16 h-16 rounded-2xl mb-1 text-emerald-800' : 'w-14 h-14 rounded-2xl mb-4 text-[#625B71]',
        active && (isChefia ? 'bg-[#B2DFDB] text-[#00695C]' : 'bg-[#EADDFF] text-[#4F378B]'),
        !active && (isChefia ? 'hover:bg-emerald-50' : 'hover:bg-[#E7E0EC]')
      )}
    >
      {badge && (
        <span className={cn(
           'absolute font-bold text-white text-[10px] px-1.5 py-0.5 rounded-full border-2',
           isChefia ? 'top-2 right-3 bg-[#E65100] border-[#F5FBF9]' : 'top-1 right-2 bg-[#B3261E] border-[#FEF7FF]'
        )}>
          {badge}
        </span>
      )}
      <Icon size={24} weight={active ? 'fill' : 'bold'} />
      <span className={cn(
        'text-[10px] mt-1 font-black uppercase tracking-tighter text-center leading-tight',
        active ? 'opacity-100' : 'opacity-40'
      )}>
        {label}
      </span>
    </Link>
  )
}
