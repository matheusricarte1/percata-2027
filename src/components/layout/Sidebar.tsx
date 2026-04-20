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
  CheckCircle,
  Users,
  SquaresFour,
  Gear
} from '@phosphor-icons/react'

interface SidebarProps {
  role?: 'usuario' | 'chefia' | 'admin'
}

export function Sidebar({ role = 'usuario' }: SidebarProps) {
  const pathname = usePathname()

  return (
    <nav className="fixed left-0 top-0 h-full w-20 bg-white border-r border-black/5 flex flex-col items-center py-6 z-50 transition-all duration-300">
      {/* 1. BRANDING (M3 Logo) */}
      <div className="w-12 h-12 bg-primary text-white rounded-[16px] flex items-center justify-center shadow-lg shadow-primary/20 mb-10 transition-transform hover:rotate-12 cursor-pointer">
        <Lightning size={24} weight="fill" />
      </div>

      {/* 2. NAVIGATION ITEMS (Rail Style) */}
      <div className="flex-1 w-full flex flex-col items-center gap-4">
        <RailLink href="/dashboard" icon={House} label="Início" active={pathname === '/dashboard'} />
        <RailLink href="/catalogo" icon={Package} label="Catálogo" active={pathname === '/catalogo'} />
        <RailLink href="/minhas-dfds" icon={Files} label="DFDs" active={pathname === '/minhas-dfds'} />
        
        <div className="divider-h w-8 my-2" />
        
        <RailLink href="/historico" icon={ClockCounterClockwise} label="Legado" active={pathname === '/historico'} />
        
        {role === 'admin' && (
          <>
            <div className="divider-h w-8 my-2" />
            <RailLink href="/admin/usuarios" icon={Users} label="Gestão" active={pathname.startsWith('/admin')} />
          </>
        )}
      </div>

      {/* 3. SETTINGS & EXIT */}
      <div className="mt-auto flex flex-col items-center gap-4">
        <RailLink href="#" icon={Gear} label="Config" active={false} />
        <button className="w-12 h-12 flex items-center justify-center text-red-500/40 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
          <SignOut size={24} weight="bold" />
        </button>
      </div>
    </nav>
  )
}

function RailLink({ href, icon: Icon, label, active }: any) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative w-14 h-14 flex flex-col items-center justify-center rounded-2xl transition-all duration-300 no-underline",
        active ? "bg-primary-container text-primary" : "text-black/40 hover:bg-black/5"
      )}
    >
      <div className={cn(
        "absolute inset-0 bg-primary/10 rounded-2xl scale-0 group-hover:scale-100 transition-transform duration-300",
        active && "scale-100 opacity-50"
      )} />
      
      <Icon size={24} weight={active ? 'fill' : 'bold'} className="relative z-10" />
      
      {/* Tooltip Labelling (M3 Style) */}
      <span className={cn(
        "text-[9px] font-black uppercase tracking-tighter mt-1 relative z-10",
        active ? "text-primary" : "text-black/40"
      )}>
        {label}
      </span>
      
      {/* Active Indicator Pillar */}
      {active && (
        <motion.div 
          layoutId="active-pill"
          className="absolute -left-[54px] w-1 h-8 bg-primary rounded-r-full"
        />
      )}
    </Link>
  )
}
