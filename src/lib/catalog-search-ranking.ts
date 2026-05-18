type CatalogSearchItem = {
  rank?: number | null;
  descricao?: string | null;
  name?: string | null;
  nome_material_servico?: string | null;
  classe?: string | null;
  tipo?: string | null;
  tipo_objeto?: string | null;
  categoria?: string | null;
  grupo?: string | null;
  nome_grupo?: string | null;
  nome_classe?: string | null;
};

const STOPWORDS = new Set([
  "a",
  "as",
  "ao",
  "aos",
  "com",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
  "tipo",
  "um",
  "uma",
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
  {
    label: "vidracaria",
    terms: ["vidracaria", "vidro", "box", "espelho", "janela", "blindex", "temperado", "vitrine"],
  },
  {
    label: "marcenaria",
    terms: ["marcenaria", "madeira", "mdf", "compensado", "movel planejado", "armario", "bancada"],
  },
  {
    label: "gessaria",
    terms: ["gessaria", "gesso", "drywall", "forro", "sanca", "placa de gesso"],
  },
  {
    label: "serralharia",
    terms: ["serralharia", "ferro", "aco", "grade", "portao", "corrimao", "estrutura metalica"],
  },
  {
    label: "marmoraria",
    terms: ["marmoraria", "marmore", "granito", "pedra", "bancada"],
  },
  {
    label: "alcool",
    terms: ["alcool", "alcoolico", "gl", "grau", "inpm"],
  },
  {
    label: "controle de acesso",
    terms: ["controle de acesso", "biometria", "biometrico", "facial", "catraca", "reconhecimento facial"],
  },
  {
    label: "ventilacao nao invasiva",
    terms: ["bipap", "cpap", "ventilacao nao invasiva", "vni", "ventilador pulmonar"],
  },
  {
    label: "torneira",
    terms: ["torneira", "misturador", "registro", "metais sanitarios"],
  },
  {
    label: "lampada led",
    terms: ["lampada led", "led", "luminaria", "bulbo"],
  },
];

const SERVICE_TERMS = new Set([
  "servico",
  "manutencao",
  "instalacao",
  "locacao",
  "contratacao",
  "reparo",
  "corretiva",
  "preventiva",
  "fornecimento",
  "assentamento",
  "transporte",
  "desinsetizacao",
  "dedetizacao",
]);

const PIECE_TERMS = new Set([
  "peca",
  "reposicao",
  "capacitor",
  "helice",
  "filtro",
  "suporte",
  "refil",
  "acessorio",
]);

const TABLE_TERMS = new Set(["sinapi", "orse", "seinfra", "seduc", "tabela", "composicao"]);

const TECHNICAL_UNIT_PATTERN =
  /\b\d+(?:[,.]\d+)?\s?(mm|cm|m|m2|m3|kg|g|l|ml|btus?|btu\/h|w|kw|v|hz|pol|polegadas?|gl|inpm)\b/i;

const OFICIO_TERMS = new Set([
  "vidracaria",
  "marcenaria",
  "gessaria",
  "serralharia",
  "marmoraria",
]);

const MATERIAL_INTENT_TERMS = new Set([
  "material",
  "materiais",
  "fornecimento",
  "insumo",
  "insumos",
  "inclui",
  "inclusive",
]);

const CONTEXTUAL_OFICIO_BLOCKLIST = new Set([
  "pedagogico",
  "treinamento",
  "didatico",
  "esportivo",
  "escolar",
  "infantil",
  "brinquedo",
  "jogo",
  "memoria",
]);

type SearchIntent = "produto" | "servico" | "peca" | "tabela" | "qualquer";

type FunctionalType = "principal" | "servico" | "peca" | "kit" | "tabela";

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
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\b([0-9]{1,2})\.?000\s*(btus?|btu\/h)\b/g, "$1 000 $2")
    .replace(/º\s*gl/g, " gl")
    .replace(/°\s*gl/g, " gl")
    .replace(/%/g, " gl ")
    .replace(/[^a-z0-9.]+/g, " ")
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
  return /^\d+(?:\.\d+)?/.test(term) || WEAK_SPEC_TERMS.has(term);
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
      item.nome_classe,
      item.grupo,
      item.nome_grupo,
      item.categoria,
    ].join(" "),
  );
}

function getBaseText(item: CatalogSearchItem) {
  const source = String(item.descricao || item.name || "");
  const base = source.split(/\s+-\s+|,/)[0] || source;
  return normalizeCatalogText(base);
}

function hasExactNumericSpec(queryTokens: string[], text: string) {
  const numbers = queryTokens.filter((term) => /^\d+(?:\.\d+)?$/.test(term));
  if (numbers.length === 0) return false;
  const asksForInches = queryTokens.some((term) => term === "polegada" || term === "polegadas");
  if (!asksForInches) return false;
  return numbers.some((number) =>
    new RegExp(`(^|\\s)${number}\\s+polegadas?(\\s|$)`).test(text),
  );
}

function getBigrams(tokens: string[]) {
  return tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`);
}

function detectSearchIntent(query: string, tokens: string[]): SearchIntent {
  const normalizedQuery = normalizeCatalogText(query);
  const tokenSet = new Set(tokens);
  if (tokens.some((token) => TABLE_TERMS.has(token))) return "tabela";
  if (
    tokens.some((token) => OFICIO_TERMS.has(token)) &&
    tokens.some((token) => MATERIAL_INTENT_TERMS.has(token))
  ) {
    return "servico";
  }
  if (tokens.some((token) => SERVICE_TERMS.has(token))) return "servico";
  if (tokens.some((token) => PIECE_TERMS.has(token))) return "peca";
  if (TECHNICAL_UNIT_PATTERN.test(normalizedQuery)) return "produto";
  if (tokenSet.has("material") || tokenSet.has("equipamento")) return "produto";
  return "qualquer";
}

function classifyFunctionalType(item: CatalogSearchItem): FunctionalType {
  const baseText = getBaseText(item);
  const tipo = normalizeCatalogText(`${item.tipo_objeto || ""} ${item.tipo || ""}`);
  if (/^(tabela|cesta)\s+(sinapi|orse|seinfra|seduc|referencial)/.test(baseText)) return "tabela";
  if (/^(peca de reposicao|peca|acessorio|capacitor|helice|filtro|refil)\b/.test(baseText)) return "peca";
  if (/^(materiais? de|insumos? de|kit de)\b/.test(baseText)) return "kit";
  if (
    tipo.includes("servico") ||
    /^(servico|manutencao|instalacao|locacao|assentamento|reparo)\b/.test(baseText)
  ) {
    return "servico";
  }
  return "principal";
}

function getIntentMultiplier(intent: SearchIntent, functionalType: FunctionalType) {
  if (intent === "produto") {
    if (functionalType === "principal") return 1.16;
    if (functionalType === "kit") return 1.04;
    if (functionalType === "servico") return 0.34;
    if (functionalType === "peca") return 0.5;
    if (functionalType === "tabela") return 0.22;
  }
  if (intent === "servico") {
    if (functionalType === "servico") return 1.18;
    if (functionalType === "kit") return 1.06;
    if (functionalType === "tabela") return 0.42;
    return 0.86;
  }
  if (intent === "peca") {
    if (functionalType === "peca") return 1.2;
    if (functionalType === "principal") return 0.82;
    if (functionalType === "servico") return 0.52;
    if (functionalType === "tabela") return 0.28;
  }
  if (intent === "tabela") {
    return functionalType === "tabela" ? 1.25 : 0.62;
  }
  return functionalType === "tabela" ? 0.72 : 1;
}

function getNameDensity(queryTokens: string[], baseText: string) {
  const baseWords = baseText.split(" ").filter(Boolean);
  if (baseWords.length === 0 || queryTokens.length === 0) return 0;
  const matched = queryTokens.filter((token) =>
    baseWords.some((word) => word === token || (token.length > 3 && word.includes(token))),
  ).length;
  return matched / Math.max(baseWords.length, queryTokens.length);
}

function getPositionBonus(queryTokens: string[], baseText: string) {
  const baseWords = baseText.split(" ").filter(Boolean);
  if (baseWords.length === 0) return 0;
  return queryTokens.reduce((score, token) => {
    const position = baseWords.findIndex((word) => word === token || (token.length > 3 && word.includes(token)));
    if (position < 0) return score;
    if (position < Math.ceil(baseWords.length / 3)) return score + 16;
    if (position < Math.ceil((baseWords.length * 2) / 3)) return score + 7;
    return score + 2;
  }, 0);
}

function hasOficioIntent(tokens: string[]) {
  return tokens.some((token) => OFICIO_TERMS.has(token));
}

function hasMaterialCoOccurrence(tokens: string[], text: string) {
  return tokens.some((token) => OFICIO_TERMS.has(token)) &&
    tokens.some((token) => MATERIAL_INTENT_TERMS.has(token)) &&
    Array.from(OFICIO_TERMS).some((token) => text.includes(token) || groupMatchesText({ terms: [token] }, text)) &&
    Array.from(MATERIAL_INTENT_TERMS).some((token) => text.includes(token));
}

function diversifyByPrefix<T extends CatalogSearchItem>(
  entries: Array<{ item: T; adjustedRank: number; index: number }>,
) {
  const prefixCount = new Map<string, number>();
  const primary: typeof entries = [];
  const overflow: typeof entries = [];

  for (const entry of entries) {
    const prefix = getBaseText(entry.item).split(" ").filter(Boolean).slice(0, 3).join(" ");
    const key = prefix || `item-${entry.index}`;
    const count = prefixCount.get(key) || 0;
    if (count < 3) {
      primary.push(entry);
      prefixCount.set(key, count + 1);
    } else {
      overflow.push(entry);
    }
  }

  return [...primary, ...overflow];
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
  const intent = detectSearchIntent(query, queryTokens);
  const bigrams = getBigrams(queryTokens);
  const queryHasOficio = hasOficioIntent(queryTokens);

  const scored = items
    .map((item, index) => {
      const text = getSearchableText(item);
      const baseText = getBaseText(item);
      const functionalType = classifyFunctionalType(item);
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
      const phraseMatches = bigrams.filter((bigram) => baseText.includes(bigram)).length;
      const specPhraseMatches = bigrams.filter((bigram) => !baseText.includes(bigram) && text.includes(bigram)).length;
      const phraseHit = text.includes(normalizedQuery) ? 1 : 0;
      const exactNumericSpec = hasExactNumericSpec(queryTokens, text) ? 1 : 0;
      const density = getNameDensity(queryTokens, baseText);
      const positionBonus = getPositionBonus(queryTokens, baseText);
      const materialCoOccurrence = hasMaterialCoOccurrence(queryTokens, text) ? 1 : 0;
      const contextualBlock =
        queryHasOficio && Array.from(CONTEXTUAL_OFICIO_BLOCKLIST).some((token) => text.includes(token))
          ? 1
          : 0;
      const originalRank = Number(item.rank || 0);
      let adjustedRank =
        originalRank +
        strongMatches * 140 +
        baseStrongMatches * 80 +
        phraseHit * 40 +
        phraseMatches * 38 +
        specPhraseMatches * 14 +
        exactNumericSpec * 60 +
        weakMatches * 8 -
        missingStrongTerms * 120 +
        density * 95 +
        positionBonus +
        materialCoOccurrence * 55;

      adjustedRank *= getIntentMultiplier(intent, functionalType);
      if (functionalType === "kit" && materialCoOccurrence) adjustedRank *= 1.14;
      if (contextualBlock) adjustedRank *= 0.35;

      return { item: { ...item, rank: adjustedRank } as T, adjustedRank, index };
    })
    .sort((a, b) => b.adjustedRank - a.adjustedRank || a.index - b.index);

  return diversifyByPrefix(scored).map((entry) => entry.item);
}
