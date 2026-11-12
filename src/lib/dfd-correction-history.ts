export function correctionHistoryDetails(raw: string): string {
  try {
    const data = JSON.parse(raw);
    const lines = [`Motivo: ${String(data.reason || "Não informado")}`];
    const before = data.before?.dfd || {};
    const after = data.after?.dfd || {};
    for (const [key, label] of [["objeto_contratacao", "Objeto da contratação"], ["justificativa_contratacao", "Justificativa da contratação"]]) {
      if (before[key] !== after[key]) lines.push(`${label}: ${String(before[key] || "Não informado")} → ${String(after[key] || "Não informado")}`);
    }
    const money = (value: unknown) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 3 });
    for (const item of Array.isArray(data.after?.items) ? data.after.items : []) {
      const old = (Array.isArray(data.before?.items) ? data.before.items : []).find((value: { id: string }) => value.id === item.id);
      const prefix = `Item ${item.codigo_tce || item.id}`;
      if (!old) { lines.push(`${prefix} adicionado · quantidade ${item.quantidade} · valor unitário ${money(item.valor_unitario_estimado)}`); continue; }
      if (Number(old.quantidade) !== Number(item.quantidade)) lines.push(`${prefix} · quantidade: ${old.quantidade} → ${item.quantidade}`);
      if (Number(old.valor_unitario_estimado) !== Number(item.valor_unitario_estimado)) lines.push(`${prefix} · valor unitário: ${money(old.valor_unitario_estimado)} → ${money(item.valor_unitario_estimado)}`);
      for (const [key, label] of [["unidade_medida", "unidade de medida"], ["codigo_tce", "código e-Fisco"], ["descricao", "descrição"], ["codigo_grupo", "código do grupo"], ["nome_grupo", "grupo"], ["codigo_classe", "código da classe"], ["nome_classe", "classe"], ["gnd", "GND"], ["codigo_natureza_despesa", "natureza da despesa"], ["justificativa_quantidade", "justificativa da quantidade"], ["justificativa_item", "justificativa do item"], ["link_referencia", "referência"], ["local_uso", "local de uso"]]) {
        if ((old[key] || "") !== (item[key] || "")) lines.push(`${prefix} · ${label}: ${String(old[key] || "Não informado")} → ${String(item[key] || "Não informado")}`);
      }
    }
    for (const item of Array.isArray(data.before?.items) ? data.before.items : []) {
      if (!(Array.isArray(data.after?.items) ? data.after.items : []).some((value: { id: string }) => value.id === item.id)) {
        const removal = (Array.isArray(data.removals) ? data.removals : []).find((value: { id: string }) => value.id === item.id);
        lines.push(`Item ${item.codigo_tce || item.id} excluído · quantidade ${item.quantidade} · valor unitário ${money(item.valor_unitario_estimado)} · motivo: ${removal?.removalReason || data.reason || "Não informado"}`);
      }
    }
    for (const [key, label] of [["title", "Título da coletiva"], ["description", "Justificativa da coletiva"]]) {
      if (before[key] !== after[key]) lines.push(`${label}: ${String(before[key] || "Não informado")} → ${String(after[key] || "Não informado")}`);
    }
    if (Number.isFinite(Number(before.valor_total_estimado)) && Number.isFinite(Number(after.valor_total_estimado)) && Number(before.valor_total_estimado) !== Number(after.valor_total_estimado)) lines.push(`Total da DFD: ${money(before.valor_total_estimado)} → ${money(after.valor_total_estimado)}`);
    return lines.join("\n");
  } catch { return raw; }
}
