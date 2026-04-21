'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Package, 
  Plus, 
  Trash, 
  ListBullets, 
  Selection, 
  MagnifyingGlass,
  ArrowRight,
  Info,
  Buildings,
  Flask,
  Archive,
  GraduationCap
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

export default function KitsAdminPage() {
  const [kits, setKits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newKit, setNewKit] = useState({ nome: '', descricao: '', categoria: 'Geral' })
  const [selectedKit, setSelectedKit] = useState<any>(null)
  const [kitItems, setKitItems] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  const fetchKits = async () => {
    setLoading(true)
    const { data } = await supabase.from('kits').select('*').order('created_at', { ascending: false })
    setKits(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchKits()
  }, [])

  const handleCreateKit = async () => {
    if (!newKit.nome) return toast.error('Dê um nome ao kit')
    
    const { data, error } = await supabase
      .from('kits')
      .insert([newKit])
      .select()
      .single()

    if (error) return toast.error(error.message)
    
    toast.success('Kit criado com sucesso!')
    setIsModalOpen(false)
    setNewKit({ nome: '', descricao: '', categoria: 'Geral' })
    fetchKits()
  }

  const handleDeleteKit = async (id: string) => {
    const { error } = await supabase.from('kits').delete().eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Kit removido')
    fetchKits()
  }

  const openKitEditor = async (kit: any) => {
    setSelectedKit(kit)
    const { data } = await supabase
      .from('kit_items')
      .select('*, catalogo(*)')
      .eq('kit_id', kit.id)
    setKitItems(data || [])
  }

  const searchItems = async (query: string) => {
    setSearch(query)
    if (query.length < 3) return setSearchResults([])
    
    const { data } = await supabase
      .from('catalogo')
      .select('*')
      .ilike('descricao', `%${query}%`)
      .limit(10)
    
    setSearchResults(data || [])
  }

  const addItemToKit = async (item: any) => {
    const { error } = await supabase
      .from('kit_items')
      .insert({
        kit_id: selectedKit.id,
        item_id: item.id,
        quantidade_sugerida: 1
      })
    
    if (error) return toast.error('Item já está no kit ou erro na inserção')
    
    toast.success('Item adicionado ao kit')
    openKitEditor(selectedKit)
  }

  const removeItemFromKit = async (itemId: number) => {
    await supabase.from('kit_items').delete().eq('kit_id', selectedKit.id).eq('item_id', itemId)
    openKitEditor(selectedKit)
  }

  return (
    <div className="p-8 space-y-10 min-h-screen bg-slate-50">
      {/* Header */}
      <div className="flex justify-between items-center bg-[#1A237E] p-10 rounded-[40px] text-white shadow-2xl">
         <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-3xl">
               <Package weight="fill" />
            </div>
            <div>
               <h1 className="text-3xl font-black italic tracking-tighter uppercase">Gestão de Kits (Modelos)</h1>
               <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">Crie cestas de itens para facilitar a vida do servidor</p>
            </div>
         </div>
         <Button 
          onClick={() => setIsModalOpen(true)}
          className="bg-white text-[#1A237E] h-14 px-8 rounded-2xl font-black uppercase tracking-tight hover:scale-105 transition-all shadow-xl"
         >
            <Plus size={20} weight="bold" className="mr-2" /> Novo Modelo de Kit
         </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Lista de Kits */}
        <div className="lg:col-span-1 space-y-4">
           <h2 className="text-xs font-black text-[#1A237E] uppercase tracking-[0.2em] ml-2">Kits Disponíveis</h2>
           <div className="space-y-3">
              {kits.map(kit => (
                <div 
                  key={kit.id} 
                  onClick={() => openKitEditor(kit)}
                  className={`p-6 rounded-[32px] border transition-all cursor-pointer group ${
                    selectedKit?.id === kit.id 
                      ? 'bg-[#1A237E] text-white border-[#1A237E] shadow-xl' 
                      : 'bg-white border-slate-200 hover:border-[#1A237E]'
                  }`}
                >
                   <div className="flex justify-between items-start">
                      <div className="space-y-1">
                         <div className={`text-[8px] font-black uppercase tracking-widest ${selectedKit?.id === kit.id ? 'text-white/40' : 'text-slate-400'}`}>
                           {kit.categoria}
                         </div>
                         <h3 className="font-bold text-lg leading-tight uppercase tracking-tighter">{kit.nome}</h3>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteKit(kit.id); }}
                        className={`p-2 rounded-xl transition-all ${selectedKit?.id === kit.id ? 'hover:bg-white/10 text-white/40' : 'text-slate-200 hover:text-red-500 hover:bg-red-50'}`}
                      >
                         <Trash size={20} />
                      </button>
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Editor do Kit */}
        <div className="lg:col-span-2">
           {selectedKit ? (
             <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
                <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#1A237E] text-white rounded-xl flex items-center justify-center">
                         <ListBullets size={24} weight="bold" />
                      </div>
                      <div>
                         <h3 className="font-black text-xl uppercase tracking-tighter italic">{selectedKit.nome}</h3>
                         <p className="text-slate-400 text-xs font-medium">{selectedKit.descricao || 'Sem descrição'}</p>
                      </div>
                   </div>
                   <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 font-black text-[#1A237E] text-xs">
                      {kitItems.length} ITENS NO MODELO
                   </div>
                </div>

                <div className="flex-1 flex flex-col p-8 space-y-8 overflow-hidden">
                   {/* Busca de Itens para adicionar */}
                   <div className="relative">
                      <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input 
                        type="text" 
                        placeholder="Adicionar item ao kit (pesquise no e-Fisco)..."
                        value={search}
                        onChange={(e) => searchItems(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-slate-100 border-none rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-[#1A237E]/5 transition-all"
                      />
                      
                      <AnimatePresence>
                        {searchResults.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 p-2 overflow-hidden"
                          >
                             {searchResults.map(item => (
                               <button 
                                key={item.id}
                                onClick={() => { addItemToKit(item); setSearch(''); setSearchResults([]); }}
                                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-all text-left group"
                               >
                                  <div className="flex-1 mr-4">
                                     <span className="text-[10px] font-black text-slate-300">SIAD #{item.codigo_efisco}</span>
                                     <p className="text-xs font-bold text-slate-700 leading-tight group-hover:text-[#1A237E]">{item.descricao}</p>
                                  </div>
                                  <Plus size={18} className="text-[#1A237E]" />
                               </button>
                             ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                   </div>

                   {/* Lista de Itens do Kit */}
                   <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                      {kitItems.map((kItem, idx) => (
                        <div key={kItem.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group">
                           <div className="flex-1">
                              <span className="text-[9px] font-black text-slate-300">ITEM #{idx+1}</span>
                              <p className="text-xs font-bold text-slate-800 leading-tight uppercase">{kItem.catalogo?.descricao}</p>
                           </div>
                           <div className="flex items-center gap-4">
                              <div className="flex flex-col items-end">
                                 <span className="text-[8px] font-black text-slate-400 uppercase">Qtd Sugerida</span>
                                 <span className="font-black text-[#1A237E]">{kItem.quantidade_sugerida}</span>
                              </div>
                              <button 
                                onClick={() => removeItemFromKit(kItem.item_id)}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                 <Trash size={18} />
                              </button>
                           </div>
                        </div>
                      ))}
                      {kitItems.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20 py-20">
                           <Archive size={64} weight="thin" />
                           <p className="font-black text-xl">Kit Vazio</p>
                           <p className="text-sm font-medium">Use a barra acima para popular este modelo.</p>
                        </div>
                      )}
                   </div>
                </div>
             </div>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30 bg-white rounded-[40px] border border-dashed border-slate-300 p-20">
                <Selection size={100} weight="thin" />
                <div className="space-y-2">
                   <h3 className="text-2xl font-black uppercase tracking-tighter">Selecione um Kit para editar</h3>
                   <p className="text-sm font-medium">Configure os itens que serão sugeridos aos servidores.</p>
                </div>
             </div>
           )}
        </div>
      </div>

      {/* Modal Criar Kit */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="rounded-[40px] p-8 max-w-lg border-none shadow-2xl">
           <DialogHeader className="space-y-4">
              <div className="w-14 h-14 bg-[#1A237E] rounded-2xl text-white flex items-center justify-center mb-2 shadow-lg">
                 <Package size={28} weight="fill" />
              </div>
              <DialogTitle className="text-3xl font-black italic tracking-tighter uppercase text-[#1A237E]">Novo Modelo de Kit</DialogTitle>
              <DialogDescription className="font-medium text-slate-500">
                Defina os parâmetros globais do kit. Você poderá adicionar itens no próximo passo.
              </DialogDescription>
           </DialogHeader>

           <div className="space-y-6 py-6 font-display">
              <div className="space-y-2">
                 <label className="text-xs font-black uppercase text-[#1A237E]/40 tracking-widest pl-1">Nome do Kit</label>
                 <input 
                  type="text" 
                  placeholder="Ex: Kit Administrativo Padrão"
                  value={newKit.nome}
                  onChange={(e) => setNewKit({...newKit, nome: e.target.value})}
                  className="w-full bg-slate-100 border-none rounded-2xl py-4 px-6 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-[#1A237E]/5 transition-all placeholder:text-slate-300" 
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-xs font-black uppercase text-[#1A237E]/40 tracking-widest pl-1">Finalidade Técnico/Acadêmica</label>
                 <textarea 
                  rows={2}
                  placeholder="Descreva brevemente a utilização deste kit..."
                  value={newKit.descricao}
                  onChange={(e) => setNewKit({...newKit, descricao: e.target.value})}
                  className="w-full bg-slate-100 border-none rounded-2xl py-4 px-6 font-medium text-sm text-slate-800 outline-none focus:ring-4 focus:ring-[#1A237E]/5 transition-all placeholder:text-slate-300 resize-none" 
                 />
              </div>
              <div className="grid grid-cols-1 gap-2">
                 <label className="text-xs font-black uppercase text-[#1A237E]/40 tracking-widest pl-1">Escolha a Categoria</label>
                 <div className="flex gap-2">
                    {['Geral', 'Escritório', 'Laboratório', 'TI'].map(cat => (
                      <button 
                        key={cat}
                        onClick={() => setNewKit({...newKit, categoria: cat})}
                        className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${newKit.categoria === cat ? 'bg-[#1A237E] text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                      >
                         {cat}
                      </button>
                    ))}
                 </div>
              </div>
           </div>

           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1 h-16 rounded-2xl font-bold">Cancelar</Button>
              <Button onClick={handleCreateKit} className="flex-1 h-16 rounded-2xl bg-[#1A237E] text-white font-black uppercase italic tracking-tight shadow-xl shadow-indigo-100">Criar Kit agora</Button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
