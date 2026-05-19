export type CatalogSearchRow = {
  id?: number | string | null;
  codigo_efisco?: string | null;
  descricao?: string | null;
  tipo?: string | null;
  categoria?: string | null;
  grupo?: string | null;
  classe?: string | null;
  tipo_objeto?: string | null;
  codigo_grupo?: string | null;
  nome_grupo?: string | null;
  codigo_classe?: string | null;
  nome_classe?: string | null;
  codigo_material_servico?: string | null;
  nome_material_servico?: string | null;
  codigo_natureza_preferencial?: string | null;
  gnd_preferencial?: string | null;
  natureza_count?: number | string | null;
  unidade_medida?: string | null;
  rank?: number | null;
};

export type CatalogSearchDocument = {
  id: string;
  catalog_id: number;
  codigo_efisco: string;
  descricao: string;
  nome_item: string;
  specs: string;
  tipo: string;
  categoria: string;
  grupo: string;
  classe: string;
  tipo_objeto: string;
  codigo_grupo: string;
  nome_grupo: string;
  codigo_classe: string;
  nome_classe: string;
  codigo_material_servico: string;
  nome_material_servico: string;
  codigo_natureza_preferencial: string;
  gnd_preferencial: string;
  natureza_count: number;
  unidade_medida: string;
};

function cleanText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function splitCatalogDescription(value: unknown) {
  const descricao = cleanText(value);
  if (!descricao) return { nome_item: "", specs: "" };

  const separator = descricao.search(/\s+-\s+|,/);
  if (separator < 0) return { nome_item: descricao, specs: "" };

  return {
    nome_item: descricao.slice(0, separator).trim(),
    specs: descricao.slice(separator).replace(/^\s*-\s*|^\s*,\s*/, "").trim(),
  };
}

export function normalizeCatalogObjectType(value: unknown) {
  const normalized = cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (normalized.includes("servico")) return "SERVIÇO";
  if (normalized.includes("material") || normalized.includes("produto")) return "MATERIAL";
  return normalized.toUpperCase();
}

export function buildCatalogSearchDocument(row: CatalogSearchRow): CatalogSearchDocument {
  const descricao = cleanText(row.descricao);
  const { nome_item, specs } = splitCatalogDescription(descricao);
  const catalogId = Number(row.id || 0);

  return {
    id: String(row.id || row.codigo_efisco || descricao),
    catalog_id: Number.isFinite(catalogId) ? catalogId : 0,
    codigo_efisco: cleanText(row.codigo_efisco),
    descricao,
    nome_item,
    specs,
    tipo: cleanText(row.tipo),
    categoria: cleanText(row.categoria),
    grupo: cleanText(row.grupo),
    classe: cleanText(row.classe),
    tipo_objeto: normalizeCatalogObjectType(row.tipo_objeto || row.tipo),
    codigo_grupo: cleanText(row.codigo_grupo),
    nome_grupo: cleanText(row.nome_grupo),
    codigo_classe: cleanText(row.codigo_classe),
    nome_classe: cleanText(row.nome_classe),
    codigo_material_servico: cleanText(row.codigo_material_servico),
    nome_material_servico: cleanText(row.nome_material_servico),
    codigo_natureza_preferencial: cleanText(row.codigo_natureza_preferencial),
    gnd_preferencial: cleanText(row.gnd_preferencial),
    natureza_count: Number(row.natureza_count || 0),
    unidade_medida: cleanText(row.unidade_medida || "UN"),
  };
}

export function catalogDocumentToRow(document: CatalogSearchDocument, rank = 0): CatalogSearchRow {
  return {
    id: document.catalog_id || document.id,
    codigo_efisco: document.codigo_efisco,
    descricao: document.descricao,
    tipo: document.tipo,
    categoria: document.categoria,
    grupo: document.grupo,
    classe: document.classe,
    tipo_objeto: document.tipo_objeto,
    codigo_grupo: document.codigo_grupo,
    nome_grupo: document.nome_grupo,
    codigo_classe: document.codigo_classe,
    nome_classe: document.nome_classe,
    codigo_material_servico: document.codigo_material_servico,
    nome_material_servico: document.nome_material_servico,
    codigo_natureza_preferencial: document.codigo_natureza_preferencial,
    gnd_preferencial: document.gnd_preferencial,
    natureza_count: document.natureza_count,
    unidade_medida: document.unidade_medida,
    rank,
  };
}
