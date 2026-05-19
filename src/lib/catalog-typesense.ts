import "server-only";

import Typesense from "typesense";
import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import {
  catalogDocumentToRow,
  type CatalogSearchDocument,
} from "@/lib/catalog-search-document";
import { rerankCatalogSearchResults } from "@/lib/catalog-search-ranking";

export const CATALOG_TYPESENSE_COLLECTION =
  process.env.TYPESENSE_CATALOG_COLLECTION || "catalogo_efisco";

export const CATALOG_TYPESENSE_SCHEMA: CollectionCreateSchema = {
  name: CATALOG_TYPESENSE_COLLECTION,
  fields: [
    { name: "catalog_id", type: "int64" },
    { name: "codigo_efisco", type: "string", optional: true },
    { name: "descricao", type: "string" },
    { name: "nome_item", type: "string" },
    { name: "specs", type: "string", optional: true },
    { name: "tipo", type: "string", optional: true, facet: true },
    { name: "categoria", type: "string", optional: true, facet: true },
    { name: "grupo", type: "string", optional: true, facet: true },
    { name: "classe", type: "string", optional: true, facet: true },
    { name: "tipo_objeto", type: "string", facet: true },
    { name: "codigo_grupo", type: "string", optional: true, facet: true },
    { name: "nome_grupo", type: "string", optional: true, facet: true },
    { name: "codigo_classe", type: "string", optional: true, facet: true },
    { name: "nome_classe", type: "string", optional: true, facet: true },
    { name: "codigo_material_servico", type: "string", optional: true },
    { name: "nome_material_servico", type: "string", optional: true },
    { name: "codigo_natureza_preferencial", type: "string", optional: true, facet: true },
    { name: "gnd_preferencial", type: "string", optional: true, facet: true },
    { name: "natureza_count", type: "int32", optional: true },
    { name: "unidade_medida", type: "string", optional: true, facet: true },
  ],
  default_sorting_field: "catalog_id",
};

type CatalogSearchParams = {
  query: string;
  category?: string;
  limit?: number;
  offset?: number;
};

function getTypesenseNode() {
  const host = process.env.TYPESENSE_HOST;
  const apiKey = process.env.TYPESENSE_SEARCH_API_KEY || process.env.TYPESENSE_API_KEY;
  if (!host || !apiKey) return null;

  return {
    host,
    port: Number(process.env.TYPESENSE_PORT || 443),
    protocol: process.env.TYPESENSE_PROTOCOL || "https",
    apiKey,
  };
}

export function hasTypesenseCatalogConfig() {
  return Boolean(getTypesenseNode());
}

export function createTypesenseCatalogClient() {
  const node = getTypesenseNode();
  if (!node) return null;

  return new Typesense.Client({
    nodes: [
      {
        host: node.host,
        port: node.port,
        protocol: node.protocol,
      },
    ],
    apiKey: node.apiKey,
    connectionTimeoutSeconds: 3,
    retryIntervalSeconds: 0.2,
    numRetries: 1,
  });
}

function buildTypesenseFilter(category?: string) {
  if (category === "material") return "tipo_objeto:=MATERIAL";
  if (category === "servico") return "tipo_objeto:=SERVIÇO";
  return "tipo_objeto:=[MATERIAL,SERVIÇO]";
}

function normalizeTypesenseRank(hit: { text_match?: number; vector_distance?: number }, index: number) {
  const textMatch = Number(hit.text_match || 0);
  if (Number.isFinite(textMatch) && textMatch > 0) return textMatch / 1_000_000;
  return Math.max(1, 1000 - index);
}

export async function searchCatalogWithTypesense({
  query,
  category = "all",
  limit = 30,
  offset = 0,
}: CatalogSearchParams) {
  const client = createTypesenseCatalogClient();
  if (!client) return null;

  const result = await client
    .collections<CatalogSearchDocument>(CATALOG_TYPESENSE_COLLECTION)
    .documents()
    .search({
      q: query,
      query_by:
        "nome_item,descricao,codigo_efisco,nome_material_servico,nome_classe,nome_grupo,categoria,grupo,classe",
      query_by_weights: "9,3,7,5,2,2,1,1,1",
      filter_by: buildTypesenseFilter(category),
      per_page: Math.max(1, Math.min(50, limit)),
      page: Math.floor(Math.max(0, offset) / Math.max(1, limit)) + 1,
      num_typos: "1,1,0,1,1,1,1,1,1",
      prefix: "true,true,false,true,true,true,false,false,false",
      drop_tokens_threshold: 1,
      exhaustive_search: false,
    });

  const rows = (result.hits || []).map((hit, index) =>
    catalogDocumentToRow(
      hit.document as CatalogSearchDocument,
      normalizeTypesenseRank(hit, index),
    ),
  );

  return rerankCatalogSearchResults(query, rows);
}
