// ============================================================
// PERCATA 2027 — Tipos de Domínio
// Espelha o modelo de dados do Supabase + Lei 14.133
// ============================================================

export type Campus = 'petrolina' | 'ouricuri'

export type Role = 'usuario' | 'chefia' | 'chefia_lab' | 'admin'

export type GND =
  | '3.3.90.30' // Material de Consumo
  | '3.3.90.36' // Serviços PF
  | '3.3.90.39' // Serviços PJ
  | '4.4.90.52' // Equipamentos/Material Permanente
  | '4.4.90.51' // Obras e Instalações

export type DFDStatus =
  | 'rascunho'   // Criada pelo usuário, não enviada
  | 'triagem'    // Enviada para análise da chefia
  | 'devolvida'  // Devolvida para correção pelo usuário
  | 'aprovada'   // Homologada pela chefia
  | 'pactuando'  // Em consolidação pelo Admin no PCA
  | 'concluida'  // Processo finalizado

export type ItemPrioridade = 'essencial' | 'estratégica' | 'desejável' | 'opcional'

export type DFDItemStatus = 'ativo' | 'removido_chefia' | 'abandonado_corte_pca'

// -------------------------------------------------------
// Catálogo E-Fisco (somente guia taxonômico, sem preço)
// -------------------------------------------------------
export interface ItemEfisco {
  codigo_tce: string
  descricao: string
  gnd: GND
  unidade_medida: string
  categoria_consumo: boolean // true = Material, false = Serviço
}

// -------------------------------------------------------
// Item dentro de uma DFD
// -------------------------------------------------------
export interface DFDItem {
  id: string
  dfd_id: string
  item_efisco: ItemEfisco
  quantidade: number
  valor_unitario_estimado: number // preenchido pelo usuário
  link_referencia: string // cotação online obrigatória
  justificativa_quantidade: string // exigência Lei 14.133
  prioridade: ItemPrioridade
  status: DFDItemStatus
  // Agrupamento de justificativa (Opção A: mesma subcategoria)
  grupo_justificativa_id?: string
}

// -------------------------------------------------------
// DFD (Documento de Formalização de Demanda)
// -------------------------------------------------------
export interface DFD {
  id: string
  numero_protocolo: string // Ex: DFD-2027-0089
  campus: Campus
  solicitante_id: string
  solicitante_nome: string
  solicitante_email: string
  local_de_uso: string // Setor/Lab — define roteamento para chefia
  chefia_responsavel_id: string
  fiscal_contrato_id: string // Próprio solicitante por padrão
  objeto_contratacao: string
  justificativa_contratacao: string // mín 100 chars
  previsao_recebimento: string // ISO date
  status: DFDStatus
  gnd_principal: GND
  items: DFDItem[]
  valor_total_estimado: number // soma calculada dos itens
  ranking_chefia?: number // posição dada pela chefia
  termo_aceite_timestamp?: string
  aprovado_por_admin?: boolean // override flag
  criado_em: string
  atualizado_em: string
}

// -------------------------------------------------------
// Safra (Campanha PCA controlada pelo Admin)
// -------------------------------------------------------
export interface Safra {
  id: string
  titulo: string // Ex: "PCA 2027 - Campus Petrolina"
  campus: Campus
  data_inicio: string
  data_fim: string
  ativa: boolean
  criado_por: string // admin_id
}

// -------------------------------------------------------
// Histórico legado (planilha PERCATALICITA.xlsx 2025)
// -------------------------------------------------------
export interface DFDLegado {
  codigo_demanda: string     // DFD-2025-XXXX
  objeto: string
  valor_estimado_geral?: number
  status_workflow: string    // "Em Análise", "Aprovado", etc.
  status_entrega: string     // "Aguardando análise técnica", etc.
  responsavel_email: string  // chave de cruzamento com auth.email
  area_requisitante?: string
  campus: Campus
  data_submissao: string
}

// -------------------------------------------------------
// Carrinho de Demandas (estado local Zustand)
// -------------------------------------------------------
export interface CarrinhoItem {
  item_efisco: ItemEfisco
  quantidade: number
  valor_unitario_estimado: number
  link_referencia: string
  justificativa_quantidade: string
  local_de_uso: string
}
