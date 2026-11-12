export type TriagemRequesterItem = {
  id: string;
  dfd_id: string;
  numero_protocolo: string;
  solicitante_nome: string;
  solicitante_email: string;
  descricao: string;
  quantidade: number;
  valor_unitario_estimado: number;
};

export type TriagemRequesterGroup<T extends TriagemRequesterItem> = {
  requesterKey: string;
  name: string;
  email: string;
  dfdCount: number;
  itemCount: number;
  total: number;
  items: T[];
};

export function groupTriagemItemsByRequester<T extends TriagemRequesterItem>(
  items: T[],
): TriagemRequesterGroup<T>[] {
  const groups = new Map<string, TriagemRequesterGroup<T>>();

  for (const item of items) {
    const name = String(item.solicitante_nome || "Solicitante não identificado").trim();
    const email = String(item.solicitante_email || "").trim();
    const requesterKey = email.toLowerCase() || name.toLocaleLowerCase("pt-BR");
    const current = groups.get(requesterKey) || {
      requesterKey,
      name,
      email,
      dfdCount: 0,
      itemCount: 0,
      total: 0,
      items: [],
    };
    current.items.push(item);
    current.itemCount += 1;
    current.total +=
      Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0);
    groups.set(requesterKey, current);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      dfdCount: new Set(group.items.map((item) => item.dfd_id)).size,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
