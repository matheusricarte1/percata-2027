import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse";
import pg from "pg";

import { loadDatabaseConfig } from "./supabase-db-url.mjs";

const { Client } = pg;

const csvPath = resolve(process.cwd(), process.argv[2] || "../DBAtualizado.csv");
const batchSize = Number(process.env.EFISCO_CORE_LOAD_BATCH_SIZE || 3000);

function text(value) {
  const cleaned = String(value ?? "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function name(value) {
  const cleaned = String(value ?? "").replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function tipo(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized === "SERVIÇO" || normalized === "SERVICO"
    ? "SERVIÇO"
    : "MATERIAL";
}

function gnd(natureza) {
  const digits = String(natureza ?? "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(digits)) return null;
  return `${digits[0]}.${digits[1]}.${digits.slice(2, 4)}.${digits.slice(4, 6)}`;
}

function classeDespesa(natureza) {
  const digits = String(natureza ?? "").replace(/\D/g, "");
  if (!digits) return "sem_natureza";
  if (digits.startsWith("3")) return "custeio";
  if (digits.startsWith("4")) return "investimento";
  return "outra";
}

function itemParts(nomeItem) {
  const value = name(nomeItem) || "";
  const index = value.indexOf(" - ");
  if (index < 0) return [value, null];
  return [value.slice(0, index).trim() || value, value.slice(index + 3).trim() || null];
}

function dataInclusao(value) {
  const cleaned = text(value);
  if (!cleaned) return null;
  const match = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, day, month, year, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
}

async function insertBatches(client, table, columns, rows, conflictSql) {
  for (let start = 0; start < rows.length; start += batchSize) {
    const chunk = rows.slice(start, start + batchSize);
    const params = [];
    const values = chunk.map((row, rowIndex) => {
      const offset = rowIndex * columns.length;
      params.push(...row);
      return `(${columns.map((_, colIndex) => `$${offset + colIndex + 1}`).join(",")})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES ${values.join(",")} ${conflictSql}`,
      params,
    );
    if (start > 0 && start % (batchSize * 10) === 0) {
      console.log(`${table}: ${Math.min(start + batchSize, rows.length)}/${rows.length}`);
    }
  }
}

console.log(`Lendo e deduplicando CSV: ${csvPath}`);

const grupos = new Map();
const classes = new Map();
const materiais = new Map();
const itens = new Map();
const naturezas = new Map();
const itemNatureza = new Map();
const itemClasses = new Map();
let totalRows = 0;

const parser = createReadStream(csvPath).pipe(
  parse({
    bom: true,
    columns: true,
    delimiter: ";",
    relax_quotes: true,
    skip_empty_lines: false,
  }),
);

for await (const row of parser) {
  totalRows += 1;
  const codigoGrupo = text(row.CODIGO_GRUPO);
  const codigoClasse = text(row.CODIGO_CLASSE);
  const codigoMaterial = text(row.CODIGO_MATERIAL_SERVICO);
  const codigoItem = text(row.CODIGO_ITEM);
  const codigoNatureza = text(row.CODIGO_NATUREZA_DESPESA);
  const tipoObjeto = tipo(row.TIPO_OBJETO);

  if (codigoGrupo) {
    grupos.set(codigoGrupo, [
      codigoGrupo,
      text(row.NOME_GRUPO),
      text(row.DESCRICAO_GRUPO),
      text(row.SITUACAO_GRUPO),
    ]);
  }
  if (codigoClasse) {
    classes.set(codigoClasse, [
      codigoClasse,
      codigoGrupo,
      text(row.NOME_CLASSE),
      text(row.DESCRICAO_CLASSE),
      text(row.SITUACAO_CLASSE),
    ]);
  }
  if (codigoMaterial) {
    materiais.set(codigoMaterial, [
      codigoMaterial,
      codigoClasse,
      text(row.NOME_MATERIAL_SERVICO),
      text(row.SITUACAO_MATERIAL_SERVICO),
      tipoObjeto,
    ]);
  }
  if (codigoItem && !itens.has(codigoItem)) {
    const [base, especificacao] = itemParts(row.NOME_ITEM);
    itens.set(codigoItem, [
      codigoItem,
      codigoMaterial,
      name(row.NOME_ITEM),
      base,
      especificacao,
      tipoObjeto,
      dataInclusao(row.DATA_INCLUSAO_ITEM),
      text(row.SITUACAO_ITEM),
    ]);
  }
  if (codigoNatureza && /^\d{8}$/.test(codigoNatureza)) {
    naturezas.set(codigoNatureza, [
      codigoNatureza,
      gnd(codigoNatureza),
      classeDespesa(codigoNatureza),
      codigoNatureza.slice(4, 6),
    ]);
  }
  if (codigoItem) {
    const naturezaKey = codigoNatureza || "__SEM_NATUREZA__";
    itemNatureza.set(`${codigoItem}|${naturezaKey}`, [
      codigoItem,
      codigoNatureza,
      naturezaKey,
      gnd(codigoNatureza),
      classeDespesa(codigoNatureza),
    ]);
    if (!itemClasses.has(codigoItem)) itemClasses.set(codigoItem, new Set());
    itemClasses.get(codigoItem).add(classeDespesa(codigoNatureza));
  }

  if (totalRows % 100_000 === 0) {
    console.log(`Linhas lidas: ${totalRows}`);
  }
}

console.log(
  JSON.stringify(
    {
      totalRows,
      grupos: grupos.size,
      classes: classes.size,
      materiais: materiais.size,
      itens: itens.size,
      naturezas: naturezas.size,
      itemNaturezas: itemNatureza.size,
    },
    null,
    2,
  ),
);

const client = new Client(loadDatabaseConfig());
await client.connect();
await client.query("SET statement_timeout = 0");
await client.query("SET idle_in_transaction_session_timeout = 0");

try {
  const batchResult = await client.query(
    `
      INSERT INTO efisco_raw.ingestion_batches (
        source_file_name,
        source_file_sha256,
        row_count,
        notes
      ) VALUES (
        $1,
        '1CEBFCBF8E8D282758E8EAB587772EF3FD63C72133BC843C9A057605C74935E4',
        $2,
        'DBAtualizado.csv normalized core load via Node fast loader'
      )
      RETURNING id
    `,
    [csvPath, totalRows],
  );
  const batchId = Number(batchResult.rows[0].id);

  console.log("Gravando grupos/classes/materiais/itens/naturezas...");
  await client.query("BEGIN");
  await insertBatches(
    client,
    "efisco_core.grupos",
    ["codigo_grupo", "nome_grupo", "descricao_grupo", "situacao_grupo"],
    [...grupos.values()],
    `ON CONFLICT (codigo_grupo) DO UPDATE SET
      nome_grupo = EXCLUDED.nome_grupo,
      descricao_grupo = EXCLUDED.descricao_grupo,
      situacao_grupo = EXCLUDED.situacao_grupo,
      updated_at = now()`,
  );
  await insertBatches(
    client,
    "efisco_core.classes",
    ["codigo_classe", "codigo_grupo", "nome_classe", "descricao_classe", "situacao_classe"],
    [...classes.values()],
    `ON CONFLICT (codigo_classe) DO UPDATE SET
      codigo_grupo = EXCLUDED.codigo_grupo,
      nome_classe = EXCLUDED.nome_classe,
      descricao_classe = EXCLUDED.descricao_classe,
      situacao_classe = EXCLUDED.situacao_classe,
      updated_at = now()`,
  );
  await insertBatches(
    client,
    "efisco_core.materiais_servicos",
    [
      "codigo_material_servico",
      "codigo_classe",
      "nome_material_servico",
      "situacao_material_servico",
      "tipo_objeto",
    ],
    [...materiais.values()],
    `ON CONFLICT (codigo_material_servico) DO UPDATE SET
      codigo_classe = EXCLUDED.codigo_classe,
      nome_material_servico = EXCLUDED.nome_material_servico,
      situacao_material_servico = EXCLUDED.situacao_material_servico,
      tipo_objeto = EXCLUDED.tipo_objeto,
      updated_at = now()`,
  );

  await insertBatches(
    client,
    "efisco_core.itens",
    [
      "codigo_item",
      "codigo_material_servico",
      "nome_item",
      "nome_item_base",
      "especificacao_item",
      "tipo_objeto",
      "data_inclusao_item",
      "situacao_item",
      "source_batch_id",
    ],
    [...itens.values()].map((row) => [...row, batchId]),
    `ON CONFLICT (codigo_item) DO UPDATE SET
      codigo_material_servico = EXCLUDED.codigo_material_servico,
      nome_item = EXCLUDED.nome_item,
      nome_item_base = EXCLUDED.nome_item_base,
      especificacao_item = EXCLUDED.especificacao_item,
      tipo_objeto = EXCLUDED.tipo_objeto,
      data_inclusao_item = EXCLUDED.data_inclusao_item,
      situacao_item = EXCLUDED.situacao_item,
      source_batch_id = EXCLUDED.source_batch_id,
      updated_at = now()`,
  );

  await insertBatches(
    client,
    "efisco_core.naturezas_despesa",
    ["codigo_natureza_despesa", "gnd", "classe_despesa", "elemento_despesa"],
    [...naturezas.values()],
    "ON CONFLICT (codigo_natureza_despesa) DO NOTHING",
  );
  await client.query("COMMIT");

  console.log("Carregando mapa de ids de itens...");
  const itemIdResult = await client.query(
    "SELECT id, codigo_item FROM efisco_core.itens",
  );
  const itemIds = new Map(itemIdResult.rows.map((row) => [row.codigo_item, row.id]));

  console.log("Gravando vínculo item-natureza...");
  await client.query("BEGIN");
  const itemNaturezaRows = [...itemNatureza.values()]
    .map(([codigoItem, codigoNatureza, naturezaKey, itemGnd, itemClasse]) => [
      itemIds.get(codigoItem),
      codigoItem,
      codigoNatureza,
      naturezaKey,
      itemGnd,
      itemClasse,
      batchId,
    ])
    .filter((row) => row[0]);
  await insertBatches(
    client,
    "efisco_core.item_naturezas",
    [
      "item_id",
      "codigo_item",
      "codigo_natureza_despesa",
      "natureza_key",
      "gnd",
      "classe_despesa",
      "source_batch_id",
    ],
    itemNaturezaRows,
    `ON CONFLICT (codigo_item, natureza_key) DO UPDATE SET
      item_id = EXCLUDED.item_id,
      codigo_natureza_despesa = EXCLUDED.codigo_natureza_despesa,
      gnd = EXCLUDED.gnd,
      classe_despesa = EXCLUDED.classe_despesa,
      source_batch_id = EXCLUDED.source_batch_id`,
  );
  await client.query("COMMIT");

  console.log("Atualizando métricas e busca...");
  await client.query("BEGIN");
  await client.query(`
    WITH metrics AS (
      SELECT
        i.id,
        count(inat.id)::INTEGER AS natureza_count,
        bool_or(inat.classe_despesa = 'sem_natureza') AS has_missing_natureza,
        count(DISTINCT inat.classe_despesa) FILTER (WHERE inat.classe_despesa IN ('custeio', 'investimento')) > 1 AS has_mixed_expense_classes
      FROM efisco_core.itens i
      LEFT JOIN efisco_core.item_naturezas inat ON inat.item_id = i.id
      GROUP BY i.id
    )
    UPDATE efisco_core.itens i
    SET
      natureza_count = metrics.natureza_count,
      has_missing_natureza = metrics.has_missing_natureza,
      has_mixed_expense_classes = metrics.has_mixed_expense_classes,
      updated_at = now()
    FROM metrics
    WHERE metrics.id = i.id
  `);
  await client.query("COMMIT");

  console.log("Atualizando documentos de busca...");
  await client.query("SELECT efisco_search.refresh_catalogo_documents()");

  console.log("Atualizando marts analíticos...");
  await client.query("SELECT efisco_analytics.refresh_all()");

  const validation = await client.query(`
    SELECT
      (SELECT count(*) FROM efisco_core.itens) AS itens,
      (SELECT count(*) FROM efisco_core.item_naturezas) AS item_naturezas,
      (SELECT count(*) FROM efisco_search.catalogo_documents) AS search_docs,
      (SELECT count(*) FROM efisco_core.itens WHERE has_missing_natureza) AS itens_com_natureza_ausente,
      (SELECT count(*) FROM efisco_core.itens WHERE has_mixed_expense_classes) AS itens_mistos
  `);
  console.log(JSON.stringify({ batch_id: batchId, ...validation.rows[0] }, null, 2));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end().catch(() => {});
}
