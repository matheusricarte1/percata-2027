import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import Typesense from "typesense";

const PROJECT_ROOT = process.cwd();
const BATCH_SIZE = Number(process.env.CATALOG_TYPESENSE_BATCH_SIZE || 1000);
const COLLECTION_NAME = process.env.TYPESENSE_CATALOG_COLLECTION || "catalogo_efisco";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

loadEnvFile(path.join(PROJECT_ROOT, ".env.local"));
loadEnvFile(path.join(PROJECT_ROOT, ".env"));

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitCatalogDescription(value) {
  const descricao = cleanText(value);
  const separator = descricao.search(/\s+-\s+|,/);
  if (separator < 0) return { nome_item: descricao, specs: "" };
  return {
    nome_item: descricao.slice(0, separator).trim(),
    specs: descricao.slice(separator).replace(/^\s*-\s*|^\s*,\s*/, "").trim(),
  };
}

function normalizeTipoObjeto(value) {
  const normalized = cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (normalized.includes("servico")) return "SERVIÇO";
  if (normalized.includes("material") || normalized.includes("produto")) return "MATERIAL";
  return normalized.toUpperCase();
}

function buildDocument(row) {
  const descricao = cleanText(row.descricao);
  const { nome_item, specs } = splitCatalogDescription(descricao);
  return {
    id: String(row.id || row.codigo_efisco || descricao),
    catalog_id: Number(row.id || 0),
    codigo_efisco: cleanText(row.codigo_efisco),
    descricao,
    nome_item,
    specs,
    tipo: cleanText(row.tipo),
    categoria: cleanText(row.categoria),
    grupo: cleanText(row.grupo),
    classe: cleanText(row.classe),
    tipo_objeto: normalizeTipoObjeto(row.tipo_objeto || row.tipo),
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

const schema = {
  name: COLLECTION_NAME,
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

const supabase = createClient(
  requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

const typesense = new Typesense.Client({
  nodes: [
    {
      host: requiredEnv("TYPESENSE_HOST"),
      port: Number(process.env.TYPESENSE_PORT || 443),
      protocol: process.env.TYPESENSE_PROTOCOL || "https",
    },
  ],
  apiKey: requiredEnv("TYPESENSE_API_KEY"),
  connectionTimeoutSeconds: 10,
});

async function ensureCollection() {
  try {
    await typesense.collections(COLLECTION_NAME).retrieve();
    return;
  } catch (error) {
    if (error?.httpStatus !== 404) throw error;
  }
  await typesense.collections().create(schema);
}

async function importBatch(rows) {
  if (rows.length === 0) return;
  const documents = rows.map(buildDocument);
  const results = await typesense
    .collections(COLLECTION_NAME)
    .documents()
    .import(documents, { action: "upsert" });

  const failures = String(results)
    .split(/\r?\n/)
    .filter((line) => line && line.includes('"success":false'));
  if (failures.length > 0) {
    throw new Error(`Typesense rejected ${failures.length} documents. First failure: ${failures[0]}`);
  }
}

async function main() {
  await ensureCollection();

  let offset = 0;
  let total = 0;
  while (true) {
    const { data, error } = await supabase
      .from("catalogo")
      .select(
        "id,codigo_efisco,descricao,tipo,categoria,grupo,classe,tipo_objeto,codigo_grupo,nome_grupo,codigo_classe,nome_classe,codigo_material_servico,nome_material_servico,codigo_natureza_preferencial,gnd_preferencial,natureza_count,unidade_medida",
      )
      .in("tipo_objeto", ["MATERIAL", "SERVIÇO"])
      .order("id", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;
    const rows = data || [];
    if (rows.length === 0) break;

    await importBatch(rows);
    total += rows.length;
    offset += rows.length;
    console.log(`Indexed ${total} catalog items...`);

    if (rows.length < BATCH_SIZE) break;
  }

  console.log(`Typesense catalog index complete: ${total} documents in ${COLLECTION_NAME}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
