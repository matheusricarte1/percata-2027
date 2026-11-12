export type ParsedCatalogDescription = {
  term: string;
  details: string;
  hasDetails: boolean;
};

const DISPLAY_WORDS: Record<string, string> = {
  AGUA: "água",
  AGUAS: "águas",
  AEREO: "aéreo",
  AEREOS: "aéreos",
  ALUMINIO: "alumínio",
  ACO: "aço",
  CARACTERISTICA: "característica",
  CARACTERISTICAS: "características",
  CATALOGACAO: "catalogação",
  CATALOGADO: "catalogado",
  CONSTRUCAO: "construção",
  CORRECAO: "correção",
  DESCRICAO: "descrição",
  DIAMETRO: "diâmetro",
  ELETRICO: "elétrico",
  ELETRICOS: "elétricos",
  EQUIPAMENTOS: "equipamentos",
  ESPECIFICACAO: "especificação",
  ESPECIFICACOES: "especificações",
  INCLUSA: "inclusa",
  LANCADOR: "lançador",
  MEMORIA: "memoria",
  METROPOLITANA: "metropolitana",
  MUNICAO: "munição",
  MUNICOES: "munições",
  NAO: "não",
  POTAVEL: "potável",
  REGIAO: "região",
  RODOVIARIO: "rodoviário",
  RAM: "RAM",
  SERVICO: "serviço",
  SERVICOS: "serviços",
  TRANSPORTE: "transporte",
};

const ALWAYS_UPPERCASE_PATTERN =
  /^(\d+([.,/]\d+)*[A-Z]+|[A-Z]+\d+[A-Z0-9]*|\d+[A-Z0-9/.-]*|[A-Z]{1,4}-?\d+)$/;

function lowerDisplayWord(word: string) {
  const normalized = word.toLocaleUpperCase("pt-BR");
  if (ALWAYS_UPPERCASE_PATTERN.test(normalized)) return word;

  const [head, ...tail] = normalized.split("-");
  if (tail.length > 0) {
    return [DISPLAY_WORDS[head] || head.toLocaleLowerCase("pt-BR")]
      .concat(tail.map((part) => DISPLAY_WORDS[part] || part.toLocaleLowerCase("pt-BR")))
      .join("-");
  }

  return DISPLAY_WORDS[normalized] || normalized.toLocaleLowerCase("pt-BR");
}

function capitalizeFirstLetter(value: string) {
  return value.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

export function formatCatalogDisplayText(value: unknown): string {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const softened = normalized.replace(/\b[\p{L}\d./-]+\b/gu, (word) =>
    lowerDisplayWord(word),
  );

  return capitalizeFirstLetter(softened);
}

export function parseCatalogDescription(value: unknown): ParsedCatalogDescription {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  const separator = " - ";
  const separatorIndex = normalized.indexOf(separator);

  if (separatorIndex > 0) {
    const term = normalized.slice(0, separatorIndex).trim();
    const details = normalized.slice(separatorIndex + separator.length).trim();
    if (term && details) {
      return {
        term,
        details,
        hasDetails: true,
      };
    }
  }

  return {
    term: normalized,
    details: "",
    hasDetails: false,
  };
}
