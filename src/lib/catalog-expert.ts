import {
  formatCatalogDisplayText,
  parseCatalogDescription,
} from "./catalog-description";

export type CatalogExpertNode = {
  key: string;
  label: string;
  count: number;
  children: CatalogExpertNode[];
  hasMoreChildren?: boolean;
};

export type CatalogExpertNodePath = {
  gnd?: string;
  type?: string;
  group?: string;
  class?: string;
};

export type CatalogGroupSymbol = {
  token: string;
  title: string;
  tone: "blue" | "teal" | "amber" | "violet" | "rose" | "slate";
  shape: "rounded" | "circle" | "diamond" | "hex";
};

export function buildCatalogExpertNodeKey(path: CatalogExpertNodePath) {
  const parts: string[] = [];
  if (path.gnd) parts.push(`gnd:${path.gnd}`);
  if (path.type) parts.push(`type:${path.type}`);
  if (path.group) parts.push(`group:${path.group}`);
  if (path.class) parts.push(`class:${path.class}`);
  return parts.length > 0 ? parts.join("|") : "base";
}

export function getCatalogExpertNodeDepth(key: string | null) {
  const path = parseCatalogExpertNodeKey(key);
  if (path.class) return "class";
  if (path.group) return "group";
  if (path.type) return "type";
  if (path.gnd) return "gnd";
  return "base";
}

export type CatalogExpertSummary = {
  id: string;
  code: string;
  term: string;
  details: string;
  fullDescription: string;
  typeLabel: string;
  groupLabel: string;
  classLabel: string;
  gndLabel: string;
  isLongDescription: boolean;
  needsNaturezaChoice: boolean;
  hasMixedExpenseClasses: boolean;
};

function normalizeLabel(value: unknown, fallback: string) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function normalizeKey(value: unknown, fallback: string) {
  return normalizeLabel(value, fallback).toLocaleLowerCase("pt-BR");
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getInitials(value: string) {
  const words = value
    .replace(/^\d+\s*-\s*/, "")
    .split(/\s+/)
    .filter((word) => word.length > 2);
  const initials = words.slice(0, 2).map((word) => word[0]?.toLocaleUpperCase("pt-BR"));
  return initials.join("") || "GR";
}

export function getCatalogGroupSymbol(input: {
  code?: unknown;
  label?: unknown;
}): CatalogGroupSymbol {
  const code = String(input.code || "").replace(/\s+/g, "").trim();
  const label = normalizeLabel(input.label, "Grupo E-Fisco");
  const seed = `${code || "sem-codigo"}:${label}`;
  const hash = hashText(seed);
  const tones: CatalogGroupSymbol["tone"][] = [
    "blue",
    "teal",
    "amber",
    "violet",
    "rose",
    "slate",
  ];
  const shapes: CatalogGroupSymbol["shape"][] = ["rounded", "circle", "diamond", "hex"];
  const token = code
    ? `G${code.replace(/[^a-zA-Z0-9]/g, "").slice(-3).toLocaleUpperCase("pt-BR")}`
    : getInitials(label);

  return {
    token,
    title: `${token} · ${label}`,
    tone: tones[hash % tones.length],
    shape: shapes[Math.floor(hash / tones.length) % shapes.length],
  };
}

export function getCatalogGroupSymbolFromNode(
  nodeKey: string | null,
  label?: unknown,
): CatalogGroupSymbol | null {
  const path = parseCatalogExpertNodeKey(nodeKey);
  if (!path.group) return null;
  return getCatalogGroupSymbol({ code: path.group === "sem-grupo" ? "" : path.group, label });
}

function getGndBucket(value: unknown) {
  const normalized = String(value || "").trim();
  const firstDigit = normalized.match(/\d/)?.[0] || "";
  if (firstDigit === "3" || firstDigit === "4" || firstDigit === "5") return firstDigit;
  return "sem-gnd";
}

function getPrimaryGnd(item: any) {
  const gnd =
    item?.gnd ||
    item?.gnd_preferencial ||
    item?.gnd_derivado ||
    (Array.isArray(item?.gnds) ? item.gnds[0] : null);
  return getGndBucket(gnd);
}

function getGndLabel(gnd: string) {
  const firstDigit = gnd.match(/\d/)?.[0] || "";
  if (firstDigit === "3") return "3 - Custeio";
  if (firstDigit === "4") return "4 - Capital";
  if (firstDigit === "5") return "5 - Transferências";
  if (gnd === "sem-gnd") return "Sem GND";
  return `GND ${gnd}`;
}

function getTypeLabel(item: any) {
  const raw = String(item?.tipo_objeto || item?.category || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  if (raw.includes("servico") || raw.includes("serviço")) return "Serviço";
  return "Material";
}

function pathKey(parts: string[]) {
  return parts.join("|");
}

export function parseCatalogExpertNodeKey(key: string | null): CatalogExpertNodePath {
  if (!key || key === "base") return {};
  return key.split("|").reduce<CatalogExpertNodePath>((acc, part) => {
    const [dimension, ...valueParts] = part.split(":");
    const value = valueParts.join(":");
    if (!value) return acc;
    if (dimension === "gnd") acc.gnd = value;
    if (dimension === "type") acc.type = value;
    if (dimension === "group") acc.group = value;
    if (dimension === "class") acc.class = value;
    return acc;
  }, {});
}

export function getCatalogExpertItemPath(item: any) {
  const gnd = getPrimaryGnd(item);
  const typeLabel = getTypeLabel(item);
  const groupLabel = withCodeLabel(
    item?.codigo_grupo,
    item?.nome_grupo || item?.grupo,
    "Sem grupo",
  );
  const classLabel = withCodeLabel(
    item?.codigo_classe,
    item?.nome_classe || item?.classe,
    "Sem classe",
  );
  const gndPart = `gnd:${normalizeKey(gnd, "sem-gnd")}`;
  const typePart = `type:${normalizeKey(typeLabel, "material")}`;
  const groupPart = `group:${normalizeKey(item?.codigo_grupo || groupLabel, "sem-grupo")}`;
  const classPart = `class:${normalizeKey(item?.codigo_classe || classLabel, "sem-classe")}`;

  return [
    "base",
    pathKey([gndPart]),
    pathKey([gndPart, typePart]),
    pathKey([gndPart, typePart, groupPart]),
    pathKey([gndPart, typePart, groupPart, classPart]),
  ];
}

function withCodeLabel(code: unknown, label: unknown, fallback: string) {
  const normalizedCode = String(code || "").trim();
  const normalizedLabel = normalizeLabel(label, fallback);
  return normalizedCode ? `${normalizedCode} - ${normalizedLabel}` : normalizedLabel;
}

function upsertChild(parent: CatalogExpertNode, key: string, label: string) {
  let child = parent.children.find((node) => node.key === key);
  if (!child) {
    child = { key, label, count: 0, children: [] };
    parent.children.push(child);
  }
  child.count += 1;
  return child;
}

function sortNodes(node: CatalogExpertNode): CatalogExpertNode {
  return {
    ...node,
    children: node.children
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true }))
      .map(sortNodes),
  };
}

export function buildCatalogExpertTaxonomy(items: any[]): CatalogExpertNode {
  const root: CatalogExpertNode = {
    key: "base",
    label: "Base",
    count: items.length,
    children: [],
  };

  items.forEach((item) => {
    const gnd = getPrimaryGnd(item);
    const gndPart = `gnd:${normalizeKey(gnd, "sem-gnd")}`;
    const gndNode = upsertChild(root, pathKey([gndPart]), getGndLabel(gnd));

    const typeLabel = getTypeLabel(item);
    const typePart = `type:${normalizeKey(typeLabel, "material")}`;
    const typeNode = upsertChild(
      gndNode,
      pathKey([gndPart, typePart]),
      typeLabel === "Serviço" ? "Serviços" : "Materiais",
    );

    const groupLabel = withCodeLabel(
      item?.codigo_grupo,
      item?.nome_grupo || item?.grupo,
      "Sem grupo",
    );
    const groupPart = `group:${normalizeKey(item?.codigo_grupo || groupLabel, "sem-grupo")}`;
    const groupNode = upsertChild(typeNode, pathKey([gndPart, typePart, groupPart]), groupLabel);

    const classLabel = withCodeLabel(
      item?.codigo_classe,
      item?.nome_classe || item?.classe,
      "Sem classe",
    );
    const classPart = `class:${normalizeKey(item?.codigo_classe || classLabel, "sem-classe")}`;
    upsertChild(groupNode, pathKey([gndPart, typePart, groupPart, classPart]), classLabel);
  });

  return sortNodes(root);
}

export function filterCatalogExpertItemsByNode(items: any[], selectedNodeKey: string | null) {
  if (!selectedNodeKey || selectedNodeKey === "base") return items;
  return items.filter((item) => getCatalogExpertItemPath(item).includes(selectedNodeKey));
}

export function summarizeCatalogExpertItem(item: any): CatalogExpertSummary {
  const fullDescription = normalizeLabel(item?.name || item?.descricao, "Descrição não informada");
  const parsed = parseCatalogDescription(fullDescription);
  const code = normalizeLabel(
    item?.siadLabel || item?.siad || item?.efiscoCode || item?.codigo_efisco || item?.id,
    "Sem código",
  );
  const gnd = getPrimaryGnd(item);

  return {
    id: String(item?.id ?? code),
    code,
    term: formatCatalogDisplayText(parsed.term),
    details: formatCatalogDisplayText(parsed.details),
    fullDescription: formatCatalogDisplayText(fullDescription),
    typeLabel: getTypeLabel(item),
    groupLabel: withCodeLabel(item?.codigo_grupo, item?.nome_grupo || item?.grupo, "Sem grupo"),
    classLabel: withCodeLabel(
      item?.codigo_classe,
      item?.nome_classe || item?.classe,
      "Sem classe",
    ),
    gndLabel: getGndLabel(gnd),
    isLongDescription: fullDescription.length > 700,
    needsNaturezaChoice:
      Boolean(item?.has_mixed_expense_classes) || Number(item?.natureza_count || 0) > 1,
    hasMixedExpenseClasses: Boolean(item?.has_mixed_expense_classes),
  };
}

export function selectCatalogExpertPreviewItem(items: any[], selectedId: string | null) {
  if (items.length === 0) return null;
  if (selectedId) {
    const selected = items.find((item) => String(item?.id) === selectedId);
    if (selected) return selected;
  }
  return items[0];
}
