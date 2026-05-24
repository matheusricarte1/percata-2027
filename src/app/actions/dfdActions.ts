"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { normalizeRole } from "@/lib/access";

// Conjunto de papéis autorizados a criar DFD. Mantém solicitante (caminho normal)
// e papéis superiores (chefia/admin/superadmin podem criar em nome de unidade).
const ROLES_PODEM_CRIAR_DFD = new Set([
  "solicitante",
  "chefia",
  "admin",
  "superadmin",
] as const);

type NewDfdPayload = {
  objeto: string;
  justificativaGeral: string;
  previsao?: string | null;
  unidade_id?: string | null;
  tipo_unidade?: "departamento" | "laboratorio" | null;
};

type NewDfdItemPayload = {
  item_efisco: {
    codigo_tce: string;
    descricao: string;
    gnd?: string;
    tipo_objeto?: string;
    codigo_grupo?: string;
    nome_grupo?: string;
    codigo_classe?: string;
    nome_classe?: string;
    codigo_material_servico?: string;
    nome_material_servico?: string;
    codigo_natureza_despesa?: string;
    gnd_derivado?: string;
  };
  quantidade: number;
  valor_unitario_estimado: number;
  justificativa_quantidade?: string;
  justificativa_item?: string;
  local_de_uso?: string;
  link_referencia?: string;
  grupo_justificativa_id?: string;
};

export async function createDFDAction(
  dfdData: NewDfdPayload,
  items: NewDfdItemPayload[],
) {
  try {
    if (!dfdData?.objeto?.trim()) {
      throw new Error("Objeto da contratação é obrigatório.");
    }
    if (!items || items.length === 0) {
      throw new Error("A DFD precisa de pelo menos um item.");
    }
    if (!dfdData?.unidade_id) {
      throw new Error("Local de uso (departamento/laboratório) é obrigatório.");
    }
    if (!dfdData?.justificativaGeral?.trim()) {
      throw new Error("Justificativa da DFD é obrigatória.");
    }

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const itemLabel = `Item ${index + 1}`;
      const quantidade = Number(item.quantidade || 0);
      const valorUnitario = Number(item.valor_unitario_estimado || 0);
      const codigo = String(item.item_efisco?.codigo_tce || "").trim();
      const descricao = String(item.item_efisco?.descricao || "").trim();
      const unidade = String(
        (item.item_efisco as { unidade_medida?: string })?.unidade_medida || "",
      ).trim();
      const justificativaItem = String(item.justificativa_item || "").trim();
      const linkReferencia = String(item.link_referencia || "").trim();

      if (!codigo) throw new Error(`${itemLabel}: código e-Fisco é obrigatório.`);
      if (!descricao) throw new Error(`${itemLabel}: descrição é obrigatória.`);
      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        throw new Error(`${itemLabel}: quantidade deve ser maior que zero.`);
      }
      if (!Number.isFinite(valorUnitario) || valorUnitario <= 0) {
        throw new Error(`${itemLabel}: valor unitário deve ser maior que zero.`);
      }
      if (!unidade) {
        throw new Error(`${itemLabel}: unidade de medida é obrigatória.`);
      }
      if (justificativaItem.length < 12) {
        throw new Error(
          `${itemLabel}: justificativa técnica deve ter ao menos 12 caracteres.`,
        );
      }
      if (!linkReferencia) {
        throw new Error(`${itemLabel}: referência técnica (link) é obrigatória.`);
      }
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Usuário não autenticado.");
    }

    // CHECAGEM DE PAPEL — antes deste patch, qualquer usuário autenticado
    // criava DFD para qualquer unidade. RLS é a segunda barreira, não a única.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,campus_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    const role = normalizeRole(profile?.role, user.email);
    if (!ROLES_PODEM_CRIAR_DFD.has(role as any)) {
      throw new Error("Seu perfil não pode criar DFDs.");
    }

    const itemsPayload = items.map((item) => ({
      codigo_tce: String(item.item_efisco?.codigo_tce || "").trim(),
      codigo_item_efisco: String(item.item_efisco?.codigo_tce || "").trim(),
      descricao: String(item.item_efisco?.descricao || "").trim(),
      quantidade: Number(item.quantidade || 0),
      valor_unitario_estimado: Number(item.valor_unitario_estimado || 0),
      justificativa_quantidade: item.justificativa_quantidade || null,
      justificativa_item: item.justificativa_item || null,
      gnd: item.item_efisco?.gnd || "3.3.90.30",
      gnd_derivado:
        item.item_efisco?.gnd_derivado || item.item_efisco?.gnd || null,
      tipo_objeto: item.item_efisco?.tipo_objeto || null,
      codigo_grupo: item.item_efisco?.codigo_grupo || null,
      nome_grupo: item.item_efisco?.nome_grupo || null,
      codigo_classe: item.item_efisco?.codigo_classe || null,
      nome_classe: item.item_efisco?.nome_classe || null,
      codigo_material_servico: item.item_efisco?.codigo_material_servico || null,
      nome_material_servico: item.item_efisco?.nome_material_servico || null,
      codigo_natureza_despesa: item.item_efisco?.codigo_natureza_despesa || null,
      grupo_justificativa_id: item.grupo_justificativa_id || null,
      local_uso: item.local_de_uso || null,
      link_referencia: item.link_referencia || null,
    }));

    // Chamada à RPC transacional (migration 0040). Faz INSERT em dfds +
    // dfd_items + audit_log dentro da mesma transação Postgres. Protocolo
    // é gerado server-side via SEQUENCE; sem race entre dois clients.
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "create_dfd_with_items",
      {
        p_dfd: {
          objeto_contratacao: dfdData.objeto.trim(),
          justificativa_contratacao: dfdData.justificativaGeral?.trim() || "",
          unidade_id: dfdData.unidade_id || null,
          tipo_unidade: dfdData.tipo_unidade || null,
          previsao_recebimento: dfdData.previsao || null,
        },
        p_items: itemsPayload,
      },
    );

    if (rpcError) throw rpcError;
    const protocol =
      (rpcResult as any)?.numero_protocolo || (rpcResult as any)?.protocol || null;

    revalidatePath("/minhas-dfds");
    return { success: true, protocol };
  } catch (error: any) {
    return { success: false, error: error.message || "Erro interno." };
  }
}
