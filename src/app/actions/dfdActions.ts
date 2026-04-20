'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function createDFDAction(dfdData: any, items: any[]) {
  try {
    // 1. Insert DFD
    const { data: dfd, error: dfdError } = await supabase
      .from('dfds')
      .insert({
        numero_protocolo: `DFD-2027-${Math.floor(Math.random() * 10000)}`,
        objeto_contratacao: dfdData.objeto,
        justificativa_contratacao: dfdData.justificativaGeral,
        campus: dfdData.campus,
        solicitante_id: dfdData.solicitante_id,
        previsao_recebimento: dfdData.previsao,
        valor_total_estimado: dfdData.total,
        status: 'triagem'
      })
      .select()
      .single()

    if (dfdError) throw dfdError

    // 2. Insert Items
    const itemsToInsert = items.map(item => ({
      dfd_id: dfd.id,
      codigo_tce: item.item_efisco.codigo_tce,
      descricao: item.item_efisco.descricao,
      quantidade: item.quantidade,
      valor_unitario_estimado: item.valor_unitario_estimado,
      justificativa_quantidade: item.justificativa_quantidade,
      gnd: item.item_efisco.gnd,
      grupo_justificativa_id: item.grupo_justificativa_id
    }))

    const { error: itemsError } = await supabase
      .from('dfd_items')
      .insert(itemsToInsert)

    if (itemsError) throw itemsError

    revalidatePath('/minhas-dfds')
    return { success: true, protocol: dfd.numero_protocolo }
  } catch (error: any) {
    console.error('Error creating DFD:', error)
    return { success: false, error: error.message }
  }
}
