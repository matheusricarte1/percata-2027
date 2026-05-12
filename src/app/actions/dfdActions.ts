"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

function buildProtocol(seed = 0) {
  const now = new Date();
  const year = now.getFullYear();
  const chunk =
    `${now.getMonth() + 1}`.padStart(2, "0") +
    `${now.getDate()}`.padStart(2, "0") +
    `${now.getHours()}`.padStart(2, "0") +
    `${now.getMinutes()}`.padStart(2, "0") +
    `${now.getSeconds()}`.padStart(2, "0");
  const random = Math.floor(Math.random() * 9000 + 1000) + seed;
  return `DFD-${year}-${chunk}-${String(random).padStart(4, "0")}`;
}

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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("campus_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    let campusLegacy = "SEM_CAMPUS";
    if (profile?.campus_id) {
      const { data: campusRow } = await supabase
        .from("campi")
        .select("sigla,nome")
        .eq("id", profile.campus_id)
        .maybeSingle();
      campusLegacy =
        String(campusRow?.sigla || campusRow?.nome || profile.campus_id).trim() ||
        "SEM_CAMPUS";
    }

    const total = items.reduce((acc, item) => {
      const qty = Number(item.quantidade || 0);
      const unit = Number(item.valor_unitario_estimado || 0);
      return acc + qty * unit;
    }, 0);

    const { data: dfd, error: dfdError } = await supabase
      .from("dfds")
      .insert({
        numero_protocolo: buildProtocol(),
        objeto_contratacao: dfdData.objeto.trim(),
        justificativa_contratacao: dfdData.justificativaGeral?.trim() || "",
        solicitante_id: user.id,
        campus: campusLegacy,
        campus_id: profile?.campus_id || null,
        unidade_id: dfdData.unidade_id || null,
        tipo_unidade: dfdData.tipo_unidade || null,
        previsao_recebimento: dfdData.previsao || null,
        valor_total_estimado: total,
        status: "rascunho",
      })
      .select("id,numero_protocolo")
      .single();

    if (dfdError) throw dfdError;

    const itemsToInsert = items.map((item) => ({
      dfd_id: dfd.id,
      codigo_tce: String(item.item_efisco.codigo_tce || "").trim(),
      codigo_item_efisco: String(item.item_efisco.codigo_tce || "").trim(),
      descricao: String(item.item_efisco.descricao || "").trim(),
      quantidade: Number(item.quantidade || 0),
      valor_unitario_estimado: Number(item.valor_unitario_estimado || 0),
      justificativa_quantidade: item.justificativa_quantidade || null,
      justificativa_item: item.justificativa_item || null,
      gnd: item.item_efisco.gnd || "3.3.90.30",
      gnd_derivado: item.item_efisco.gnd_derivado || item.item_efisco.gnd || null,
      tipo_objeto: item.item_efisco.tipo_objeto || null,
      codigo_grupo: item.item_efisco.codigo_grupo || null,
      nome_grupo: item.item_efisco.nome_grupo || null,
      codigo_classe: item.item_efisco.codigo_classe || null,
      nome_classe: item.item_efisco.nome_classe || null,
      codigo_material_servico: item.item_efisco.codigo_material_servico || null,
      nome_material_servico: item.item_efisco.nome_material_servico || null,
      codigo_natureza_despesa: item.item_efisco.codigo_natureza_despesa || null,
      grupo_justificativa_id: item.grupo_justificativa_id || null,
      local_uso: item.local_de_uso || null,
      link_referencia: item.link_referencia || null,
    }));

    const { error: itemsError } = await supabase
      .from("dfd_items")
      .insert(itemsToInsert);
    if (itemsError) {
      await supabase.from("dfds").delete().eq("id", dfd.id);
      throw itemsError;
    }

    revalidatePath("/minhas-dfds");
    return { success: true, protocol: dfd.numero_protocolo };
  } catch (error: any) {
    return { success: false, error: error.message || "Erro interno." };
  }
}
