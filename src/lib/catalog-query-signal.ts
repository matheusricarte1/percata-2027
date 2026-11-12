const LOW_SIGNAL_TERMS = new Set([
  "tipo",
  "forma",
  "conforme",
  "interna",
  "externa",
  "altura",
  "diametro",
  "resistente",
  "material",
  "equipamento",
  "equipamentos",
  "item",
  "itens",
  "baixo",
  "alto",
  "para",
]);

const GENERIC_SHORT_TERMS = new Set([
  "material",
  "materiais",
  "servico",
  "servicos",
  "manutencao",
  "fornecido",
  "fornecimento",
  "baixo",
  "alto",
  "item",
  "itens",
  "equipamento",
  "equipamentos",
]);

const QUERY_REDUCTION_STOPWORDS = new Set([
  ...LOW_SIGNAL_TERMS,
  "a",
  "o",
  "as",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "com",
  "sem",
  "por",
  "um",
  "uma",
  "ate",
  "incluindo",
  "incluso",
  "medindo",
  "aproximadamente",
  "aproximadmente",
]);

const ARMAMENT_RELATED_TERMS = new Set([
  "arma",
  "armas",
  "armamento",
  "armamentos",
  "belico",
  "belicos",
  "municao",
  "municoes",
  "pistola",
  "pistolas",
  "revolver",
  "revolveres",
  "fuzil",
  "fuzis",
  "carabina",
  "carabinas",
  "espingarda",
  "espingardas",
  "rifle",
  "rifles",
  "escopeta",
  "escopetas",
  "metralhadora",
  "metralhadoras",
  "submetralhadora",
  "submetralhadoras",
  "cartucho",
  "cartuchos",
  "calibre",
  "coldre",
  "coldres",
  "silenciador",
  "silenciadores",
  "airsoft",
  "granada",
  "granadas",
  "explosivo",
  "explosivos",
  "explosiva",
  "explosivas",
  "lacrimogeneo",
  "lacrimogenea",
  "lacrimogeneos",
  "lacrimogeneas",
  "algema",
  "algemas",
  "espargidor",
  "espargidores",
]);

const ARMAMENT_RELATED_PHRASES = [
  /\barma\s+de\s+fogo\b/,
  /\barmas\s+de\s+fogo\b/,
  /\bcolete\s+balistic[oa]s?\b/,
  /\bmaterial\s+belico\b/,
  /\bmateriais\s+belicos\b/,
  /\bequipamento\s+belico\b/,
  /\bequipamentos\s+belicos\b/,
  /\bdefesa\s+armada\b/,
  /\bgas\s+de\s+pimenta\b/,
  /\btiro\s+esportivo\b/,
];

export function sanitizeCatalogSearchInput(value: string | null | undefined, maxLength = 180) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Math.max(0, maxLength));
}

export function sanitizeCatalogLikePattern(value: string | null | undefined, maxLength = 120) {
  return String(value || "")
    .replace(/[%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Math.max(0, maxLength));
}

export function normalizeCatalogCategory(value: string | null | undefined) {
  const normalized = String(value || "all")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (["material", "materiais", "produto", "produtos"].includes(normalized)) return "material";
  if (["servico", "servicos"].includes(normalized)) return "servico";
  return "all";
}

export function parseBoundedCatalogInt(
  value: string | null | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

export function normalizeCatalogQueryTerms(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

export function isArmamentRelatedCatalogText(value: string | null | undefined) {
  const normalized = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;
  if (ARMAMENT_RELATED_PHRASES.some((pattern) => pattern.test(normalized))) return true;
  return normalized
    .split(" ")
    .filter(Boolean)
    .some((term) => ARMAMENT_RELATED_TERMS.has(term));
}

export function isArmamentRelatedCatalogQuery(value: string | null | undefined) {
  return isArmamentRelatedCatalogText(value);
}

export function filterArmamentRelatedCatalogRows<T extends Record<string, any>>(rows: T[]) {
  return rows.filter((row) => {
    const searchableText = [
      row.descricao,
      row.name,
      row.summary,
      row.tipo,
      row.categoria,
      row.grupo,
      row.classe,
      row.tipo_objeto,
      row.nome_grupo,
      row.nome_classe,
      row.nome_material_servico,
    ].join(" ");
    return !isArmamentRelatedCatalogText(searchableText);
  });
}

export function isLikelyCatalogCodeQuery(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  const compact = normalized.replace(/[^a-zA-Z0-9]/g, "");
  if (compact.length < 6) return false;
  return /^[0-9][0-9A-Za-z._/-]*$/.test(normalized);
}

export function getCatalogCodeSearchCandidates(value: string) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return [];
  const candidates = new Set([raw]);
  if (digits.length >= 7) {
    candidates.add(`${digits.slice(0, -1)}-${digits.slice(-1)}`);
  }
  return Array.from(candidates);
}

export function isGenericCatalogShortQuery(value: string) {
  const terms = normalizeCatalogQueryTerms(value);
  if (terms.length === 0 || terms.length > 3) return false;
  return terms.some((term) => GENERIC_SHORT_TERMS.has(term));
}

export function isCatalogLowSignalQuery(value: string) {
  const terms = normalizeCatalogQueryTerms(value);
  if (terms.length === 0) return false;
  return terms.length <= 3 && terms.every((term) => LOW_SIGNAL_TERMS.has(term));
}

export function buildCatalogQueryFallbacks(value: string) {
  const original = String(value || "").trim();
  if (original.length < 40 && normalizeCatalogQueryTerms(original).length < 7) return [];

  const salientTerms = normalizeCatalogQueryTerms(original).filter((term) => {
    if (term.length < 3) return false;
    if (QUERY_REDUCTION_STOPWORDS.has(term)) return false;
    if (/^\d+$/.test(term)) return false;
    if (/^\d+[x.,-]\d+/.test(term)) return false;
    return true;
  });

  const variants: string[] = [];
  for (const size of [3, 4, 5, 6]) {
    const variant = salientTerms.slice(0, size).join(" ").trim();
    if (variant && variant !== original && !variants.includes(variant)) variants.push(variant);
  }
  return variants;
}
