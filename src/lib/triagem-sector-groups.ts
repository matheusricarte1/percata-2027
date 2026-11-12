import {
  groupTriagemItemsByRequester,
  type TriagemRequesterGroup,
  type TriagemRequesterItem,
} from "./triagem-solicitante-groups";

export type TriagemSectorItem = TriagemRequesterItem & {
  analysis_unidade_nome?: string | null;
  unidade_nome?: string | null;
  campus_nome?: string | null;
};

export type TriagemSectorGroup<T extends TriagemSectorItem> = {
  sectorKey: string;
  name: string;
  dfdCount: number;
  itemCount: number;
  total: number;
  requesters: TriagemRequesterGroup<T>[];
};

function getSectorName(item: TriagemSectorItem) {
  return String(
    item.analysis_unidade_nome || item.unidade_nome || item.campus_nome || "Unidade não identificada",
  ).trim();
}

export function groupTriagemItemsBySector<T extends TriagemSectorItem>(
  items: T[],
): TriagemSectorGroup<T>[] {
  const groupedItems = new Map<string, { name: string; items: T[] }>();

  for (const item of items) {
    const name = getSectorName(item);
    const sectorKey = name.toLocaleLowerCase("pt-BR");
    const current = groupedItems.get(sectorKey) || { name, items: [] };
    current.items.push(item);
    groupedItems.set(sectorKey, current);
  }

  return [...groupedItems.entries()]
    .map(([sectorKey, group]) => {
      const requesters = groupTriagemItemsByRequester(group.items);
      return {
        sectorKey,
        name: group.name,
        dfdCount: new Set(group.items.map((item) => item.dfd_id)).size,
        itemCount: group.items.length,
        total: group.items.reduce(
          (total, item) =>
            total + Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0),
          0,
        ),
        requesters,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
