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

  // -- DESIGN UNIFICADO (BRANCO / SURFACE) --
  const isWide = role === 'admin'

  return (
    <nav className={cn(
      "fixed left-0 top-0 h-full bg-white flex flex-col z-50 border-r border-black/5 shadow-sm transition-all duration-300",
      isWide ? "w-[260px] p-6" : "w-20 py-6 items-center"
    )}>
      {/* Logo Unificada */}
      <div className={cn(
        "flex items-center gap-3 mb-12",
        isWide ? "px-3" : "justify-center"
      )}>
        <div className="w-10 h-10 bg-[#4F378B] text-white rounded-xl flex items-center justify-center shadow-lg">
          <Lightning weight="fill" size={24} />
        </div>
        {isWide && (
          <span className="font-display text-2xl font-black text-[#1C1B1F] italic tracking-tighter">PERCATA</span>
        )}
      </div>

      <div className={cn("flex-1 w-full flex flex-col gap-2", isWide ? "" : "items-center")}>
        {/* Links Principais */}
        <SidebarLink 
          href="/dashboard" 
          icon={House} 
          label="Início" 
          active={pathname === '/dashboard'} 
          wide={isWide} 
        />
        
        {role === 'admin' ? (
          <>
            <SidebarLink href="/admin/aprovacoes" icon={CheckCircle} label="Triagem" active={pathname === '/admin/aprovacoes'} wide={isWide} badge="12" />
            <SidebarLink href="#" icon={ChartLineUp} label="Planejamento" active={false} wide={isWide} />
            <div className="h-[1px] bg-black/5 my-4 mx-3" />
            <SidebarLink href="#" icon={Package} label="Catálogo" active={false} wide={isWide} />
            <SidebarLink href="#" icon={Users} label="Usuários" active={false} wide={isWide} />
          </>
        ) : (
          <>
            <SidebarLink href="/minhas-dfds" icon={Files} label="Pedidos" active={pathname === '/minhas-dfds'} wide={isWide} />
            <SidebarLink 
              href="/catalogo" 
              icon={Package} 
              label="Catálogo" 
              active={pathname === '/catalogo'} 
              wide={isWide} 
              badge={itemCount > 0 ? itemCount.toString() : null} 
            />
            
            {role === 'chefia' && (
               <>
                 <div className="h-[1px] bg-black/5 my-2 w-8" />
                 <SidebarLink href="/triagem" icon={CheckCircle} label="Validar" active={pathname === '/triagem'} wide={isWide} badge="5" />
               </>
            )}

            <div className={cn("h-[1px] bg-black/5 my-2", isWide ? "mx-3" : "w-8")} />
            <SidebarLink href="/historico" icon={ClockCounterClockwise} label="2025" active={pathname === '/historico'} wide={isWide} />
          </>
        )}
      </div>

      <button className={cn(
        "flex items-center gap-3 p-3 mt-auto text-red-600/60 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all",
        isWide ? "w-full px-4" : "flex-col gap-1 w-14"
      )}>
        <SignOut size={24} weight="bold" />
        <span className={cn("font-bold uppercase tracking-tighter", isWide ? "text-sm" : "text-[10px]")}>Sair</span>
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
  badge 
}: { 
  href: string, 
  icon: any, 
  label: string, 
  active: boolean, 
  wide?: boolean, 
  badge?: string | null
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center transition-all duration-300 relative group no-underline",
        wide 
          ? "p-3.5 rounded-xl gap-4 hover:bg-[#F3EDF7] w-full" 
          : "w-14 h-14 flex-col justify-center rounded-2xl mb-2",
        active 
          ? (wide ? "bg-[#EADDFF] text-[#4F378B]" : "bg-[#EADDFF] text-[#4F378B]") 
          : "text-[#625B71]"
      )}
    >
      <div className="relative">
        <Icon size={24} weight={active ? 'fill' : 'bold'} />
        {badge && (
          <span className={cn(
            "absolute flex items-center justify-center bg-[#B3261E] text-white text-[10px] font-black rounded-full border-2 border-white min-w-[18px] h-[18px]",
            wide ? "-top-2 -right-3 px-1.5" : "top-[-4px] right-[-6px]"
          )}>
            {badge}
          </span>
        )}
      </div>
      <span className={cn(
        "font-display uppercase tracking-tighter",
        wide ? "text-sm font-bold" : "text-[10px] font-black mt-1"
      )}>
        {label}
      </span>
    </Link>
  )
}
