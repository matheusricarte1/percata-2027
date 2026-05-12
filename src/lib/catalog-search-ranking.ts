type CatalogSearchItem = {
  rank?: number | null;
  descricao?: string | null;
  name?: string | null;
  nome_material_servico?: string | null;
  classe?: string | null;
};

const STOPWORDS = new Set([
  "a",
  "as",
  "com",
  "das",
  "de",
  "do",
  "dos",
  "em",
  "para",
  "por",
  "tipo",
]);

const WEAK_SPEC_TERMS = new Set([
  "btu",
  "btus",
  "cm",
  "full",
  "hd",
  "hdmi",
  "hz",
  "kg",
  "led",
  "mm",
  "polegada",
  "polegadas",
  "smart",
  "uhd",
  "v",
  "w",
]);

const PRODUCT_SYNONYM_GROUPS: Array<{ label: string; terms: string[] }> = [
  {
    label: "tv/televisor",
    terms: ["tv", "televisor", "televisao", "televisores"],
  },
  {
    label: "projetor/datashow",
    terms: ["datashow", "data show", "projetor", "projetor multimidia"],
  },
  {
    label: "notebook/laptop",
    terms: ["notebook", "laptop", "computador portatil"],
  },
  {
    label: "computador/desktop",
    terms: ["computador", "desktop", "microcomputador", "estacao de trabalho"],
  },
  {
    label: "ar condicionado",
    terms: ["ar condicionado", "condicionador de ar", "condicionador"],
  },
  {
    label: "impressora",
    terms: ["impressora", "multifuncional"],
  },
  {
    label: "monitor",
    terms: ["monitor", "tela"],
  },
];

type StrongTermGroup = {
  label: string;
  terms: string[];
};

export type CatalogSearchQueryAnalysis = {
  primaryTerms: string[];
  specificationTerms: string[];
  tokens: string[];
};

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function singularizeToken(term: string) {
  if (term.length <= 4) return term;
  if (term.endsWith("oes")) return `${term.slice(0, -3)}ao`;
  if (term.endsWith("s")) return term.slice(0, -1);
  return term;
}

function normalizeCatalogText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSearch(value: string) {
  return normalizeCatalogText(value)
    .split(" ")
    .filter(Boolean)
    .filter((term) => !STOPWORDS.has(term))
    .map(singularizeToken);
}

function isWeakSpecTerm(term: string) {
  return /^\d+$/.test(term) || WEAK_SPEC_TERMS.has(term);
}

function buildStrongTermGroups(query: string) {
  const normalizedQuery = normalizeCatalogText(query);
  const tokens = tokenizeSearch(query).filter((term) => !isWeakSpecTerm(term));
  const groups: StrongTermGroup[] = [];
  const covered = new Set<string>();

  for (const synonymGroup of PRODUCT_SYNONYM_GROUPS) {
    const matched = synonymGroup.terms.some((term) =>
      normalizedQuery.split(" ").includes(term) || normalizedQuery.includes(term),
    );
    if (!matched) continue;
    groups.push(synonymGroup);
    synonymGroup.terms.forEach((term) => {
      covered.add(term);
      term.split(" ").forEach((part) => covered.add(part));
    });
  }

  for (const token of tokens) {
    if (covered.has(token)) continue;
    groups.push({ label: token, terms: [token] });
  }

  return groups;
}

function groupMatchesText(group: StrongTermGroup | { terms: string[] }, text: string) {
  return group.terms.some((term) => {
    if (term.includes(" ")) return text.includes(term);
    const boundaryMatch = new RegExp(`(^|\\s)${term}(\\s|$)`).test(text);
    if (term.length <= 3) return boundaryMatch;
    return boundaryMatch || text.includes(term);
  });
}

function getSearchableText(item: CatalogSearchItem) {
  return normalizeCatalogText(
    [
      item.descricao,
      item.name,
      item.nome_material_servico,
      item.classe,
    ].join(" "),
  );
}

function getBaseText(item: CatalogSearchItem) {
  const source = String(item.descricao || item.name || "");
  const base = source.split(/\s+-\s+|,/)[0] || source;
  return normalizeCatalogText(base);
}

function hasExactNumericSpec(queryTokens: string[], text: string) {
  const numbers = queryTokens.filter((term) => /^\d+$/.test(term));
  if (numbers.length === 0) return false;
  const asksForInches = queryTokens.some((term) => term === "polegada" || term === "polegadas");
  if (!asksForInches) return false;
  return numbers.some((number) =>
    new RegExp(`(^|\\s)${number}\\s+polegadas?(\\s|$)`).test(text),
  );
}

export function analyzeCatalogSearchQuery(query: string): CatalogSearchQueryAnalysis {
  const tokens = tokenizeSearch(query);
  const displayTokens = normalizeCatalogText(query)
    .split(" ")
    .filter(Boolean)
    .filter((term) => !STOPWORDS.has(term));
  const strongTermGroups = buildStrongTermGroups(query);
  return {
    primaryTerms: uniqueValues(strongTermGroups.map((group) => group.label)),
    specificationTerms: uniqueValues(displayTokens.filter((term) =>
      isWeakSpecTerm(singularizeToken(term)),
    )),
    tokens,
  };
}

export function rerankCatalogSearchResults<T extends CatalogSearchItem>(
  query: string,
  items: T[],
): T[] {
  const normalizedQuery = normalizeCatalogText(query);
  if (!normalizedQuery) return items;

  const queryTokens = tokenizeSearch(query);
  const strongTermGroups = buildStrongTermGroups(query);

  return items
    .map((item, index) => {
      const text = getSearchableText(item);
      const baseText = getBaseText(item);
      const strongMatches = strongTermGroups.filter((group) =>
        groupMatchesText(group, text),
      ).length;
      const baseStrongMatches = strongTermGroups.filter((group) =>
        groupMatchesText(group, baseText),
      ).length;
      const missingStrongTerms = Math.max(0, strongTermGroups.length - strongMatches);
      const weakMatches = queryTokens.filter(
        (term) => isWeakSpecTerm(term) && groupMatchesText({ terms: [term] }, text),
      ).length;
      const phraseHit = text.includes(normalizedQuery) ? 1 : 0;
      const exactNumericSpec = hasExactNumericSpec(queryTokens, text) ? 1 : 0;
      const originalRank = Number(item.rank || 0);
      const adjustedRank =
        originalRank +
        strongMatches * 140 +
        baseStrongMatches * 80 +
        phraseHit * 40 +
        exactNumericSpec * 60 +
        weakMatches * 8 -
        missingStrongTerms * 120;

      return { item: { ...item, rank: adjustedRank } as T, adjustedRank, index };
    })
    .sort((a, b) => b.adjustedRank - a.adjustedRank || a.index - b.index)
    .map((entry) => entry.item);
}
