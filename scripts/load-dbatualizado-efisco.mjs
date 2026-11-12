import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse";
import pg from "pg";

import { loadDatabaseConfig } from "./supabase-db-url.mjs";

const { Client } = pg;

const csvPath = resolve(
  process.cwd(),
  process.argv[2] || "../DBAtualizado.csv",
);
const batchSize = Number(process.env.EFISCO_LOAD_BATCH_SIZE || 2500);

function cleanText(value) {
  const cleaned = String(value ?? "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function cleanName(value) {
  const cleaned = String(value ?? "").replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeTipoObjeto(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized === "SERVIÇO" || normalized === "SERVICO"
    ? "SERVIÇO"
    : "MATERIAL";
}

function rowHash(raw) {
  const fields = [
    "CODIGO_GRUPO",
    "NOME_GRUPO",
    "DESCRICAO_GRUPO",
    "SITUACAO_GRUPO",
    "CODIGO_CLASSE",
    "NOME_CLASSE",
    "DESCRICAO_CLASSE",
    "SITUACAO_CLASSE",
    "CODIGO_MATERIAL_SERVICO",
    "NOME_MATERIAL_SERVICO",
    "SITUACAO_MATERIAL_SERVICO",
    "TIPO_OBJETO",
    "CODIGO_ITEM",
    "NOME_ITEM",
    "DATA_INCLUSAO_ITEM",
    "SITUACAO_ITEM",
    "CODIGO_NATUREZA_DESPESA",
  ];
  return createHash("md5")
    .update(fields.map((field) => raw[field] ?? "").join("|"))
    .digest("hex");
}

function toRawRow(raw, batchId, sourceLineNo) {
  return [
    batchId,
    sourceLineNo,
    rowHash(raw),
    cleanText(raw.CODIGO_GRUPO),
    cleanText(raw.NOME_GRUPO),
    cleanText(raw.DESCRICAO_GRUPO),
    cleanText(raw.SITUACAO_GRUPO),
    cleanText(raw.CODIGO_CLASSE),
    cleanText(raw.NOME_CLASSE),
    cleanText(raw.DESCRICAO_CLASSE),
    cleanText(raw.SITUACAO_CLASSE),
    cleanText(raw.CODIGO_MATERIAL_SERVICO),
    cleanText(raw.NOME_MATERIAL_SERVICO),
    cleanText(raw.SITUACAO_MATERIAL_SERVICO),
    normalizeTipoObjeto(raw.TIPO_OBJETO),
    cleanText(raw.CODIGO_ITEM),
    cleanName(raw.NOME_ITEM),
    cleanText(raw.DATA_INCLUSAO_ITEM),
    cleanText(raw.SITUACAO_ITEM),
    cleanText(raw.CODIGO_NATUREZA_DESPESA),
  ];
}

async function insertRawRows(client, rows) {
  if (rows.length === 0) return;
  const cols = [
    "batch_id",
    "source_line_no",
    "row_hash",
    "codigo_grupo",
    "nome_grupo",
    "descricao_grupo",
    "situacao_grupo",
    "codigo_classe",
    "nome_classe",
    "descricao_classe",
    "situacao_classe",
    "codigo_material_servico",
    "nome_material_servico",
    "situacao_material_servico",
    "tipo_objeto",
    "codigo_item",
    "nome_item",
    "data_inclusao_item_text",
    "situacao_item",
    "codigo_natureza_despesa",
  ];
  const params = [];
  const values = rows.map((row, rowIndex) => {
    const offset = rowIndex * cols.length;
    params.push(...row);
    return `(${cols.map((_, colIndex) => `$${offset + colIndex + 1}`).join(",")})`;
  });

  await client.query(
    `
      INSERT INTO efisco_raw.db_atualizado_rows (${cols.join(",")})
      VALUES ${values.join(",")}
      ON CONFLICT (batch_id, row_hash) DO NOTHING
    `,
    params,
  );
}

function transformSql(batchId) {
  const batch = `${Number(batchId)}::BIGINT`;
  return `
INSERT INTO efisco_core.grupos (codigo_grupo, nome_grupo, descricao_grupo, situacao_grupo, updated_at)
SELECT DISTINCT codigo_grupo, nome_grupo, descricao_grupo, situacao_grupo, now()
FROM efisco_raw.db_atualizado_rows
WHERE batch_id = ${batch}
  AND codigo_grupo IS NOT NULL
ON CONFLICT (codigo_grupo) DO UPDATE SET
  nome_grupo = EXCLUDED.nome_grupo,
  descricao_grupo = EXCLUDED.descricao_grupo,
  situacao_grupo = EXCLUDED.situacao_grupo,
  updated_at = now();

INSERT INTO efisco_core.classes (codigo_classe, codigo_grupo, nome_classe, descricao_classe, situacao_classe, updated_at)
SELECT DISTINCT codigo_classe, codigo_grupo, nome_classe, descricao_classe, situacao_classe, now()
FROM efisco_raw.db_atualizado_rows
WHERE batch_id = ${batch}
  AND codigo_classe IS NOT NULL
ON CONFLICT (codigo_classe) DO UPDATE SET
  codigo_grupo = EXCLUDED.codigo_grupo,
  nome_classe = EXCLUDED.nome_classe,
  descricao_classe = EXCLUDED.descricao_classe,
  situacao_classe = EXCLUDED.situacao_classe,
  updated_at = now();

INSERT INTO efisco_core.materiais_servicos (
  codigo_material_servico,
  codigo_classe,
  nome_material_servico,
  situacao_material_servico,
  tipo_objeto,
  updated_at
)
SELECT DISTINCT codigo_material_servico, codigo_classe, nome_material_servico, situacao_material_servico, tipo_objeto, now()
FROM efisco_raw.db_atualizado_rows
WHERE batch_id = ${batch}
  AND codigo_material_servico IS NOT NULL
ON CONFLICT (codigo_material_servico) DO UPDATE SET
  codigo_classe = EXCLUDED.codigo_classe,
  nome_material_servico = EXCLUDED.nome_material_servico,
  situacao_material_servico = EXCLUDED.situacao_material_servico,
  tipo_objeto = EXCLUDED.tipo_objeto,
  updated_at = now();

INSERT INTO efisco_core.itens (
  codigo_item,
  codigo_material_servico,
  nome_item,
  nome_item_base,
  especificacao_item,
  tipo_objeto,
  data_inclusao_item,
  situacao_item,
  source_batch_id,
  updated_at
)
SELECT DISTINCT ON (codigo_item)
  codigo_item,
  codigo_material_servico,
  nome_item,
  trim(split_part(nome_item, ' - ', 1)),
  CASE
    WHEN position(' - ' in nome_item) > 0
    THEN nullif(trim(substring(nome_item from position(' - ' in nome_item) + 3)), '')
    ELSE NULL
  END,
  tipo_objeto,
  to_timestamp(data_inclusao_item_text, 'DD/MM/YYYY HH24:MI:SS'),
  situacao_item,
  ${batch},
  now()
FROM efisco_raw.db_atualizado_rows
WHERE batch_id = ${batch}
  AND codigo_item IS NOT NULL
ORDER BY codigo_item, codigo_natureza_despesa NULLS LAST
ON CONFLICT (codigo_item) DO UPDATE SET
  codigo_material_servico = EXCLUDED.codigo_material_servico,
  nome_item = EXCLUDED.nome_item,
  nome_item_base = EXCLUDED.nome_item_base,
  especificacao_item = EXCLUDED.especificacao_item,
  tipo_objeto = EXCLUDED.tipo_objeto,
  data_inclusao_item = EXCLUDED.data_inclusao_item,
  situacao_item = EXCLUDED.situacao_item,
  source_batch_id = EXCLUDED.source_batch_id,
  updated_at = now();

INSERT INTO efisco_core.naturezas_despesa (
  codigo_natureza_despesa,
  gnd,
  classe_despesa,
  elemento_despesa
)
SELECT DISTINCT
  codigo_natureza_despesa,
  concat(substring(codigo_natureza_despesa from 1 for 1), '.', substring(codigo_natureza_despesa from 2 for 1), '.', substring(codigo_natureza_despesa from 3 for 2), '.', substring(codigo_natureza_despesa from 5 for 2)),
  CASE
    WHEN codigo_natureza_despesa LIKE '3%' THEN 'custeio'
    WHEN codigo_natureza_despesa LIKE '4%' THEN 'investimento'
    ELSE 'outra'
  END,
  substring(codigo_natureza_despesa from 5 for 2)
FROM efisco_raw.db_atualizado_rows
WHERE batch_id = ${batch}
  AND codigo_natureza_despesa ~ '^[0-9]{8}$'
ON CONFLICT (codigo_natureza_despesa) DO NOTHING;

INSERT INTO efisco_core.item_naturezas (
  item_id,
  codigo_item,
  codigo_natureza_despesa,
  natureza_key,
  gnd,
  classe_despesa,
  source_batch_id
)
SELECT DISTINCT
  i.id,
  r.codigo_item,
  r.codigo_natureza_despesa,
  coalesce(r.codigo_natureza_despesa, '__SEM_NATUREZA__'),
  CASE
    WHEN r.codigo_natureza_despesa ~ '^[0-9]{8}$'
    THEN concat(substring(r.codigo_natureza_despesa from 1 for 1), '.', substring(r.codigo_natureza_despesa from 2 for 1), '.', substring(r.codigo_natureza_despesa from 3 for 2), '.', substring(r.codigo_natureza_despesa from 5 for 2))
    ELSE NULL
  END,
  CASE
    WHEN r.codigo_natureza_despesa IS NULL THEN 'sem_natureza'
    WHEN r.codigo_natureza_despesa LIKE '3%' THEN 'custeio'
    WHEN r.codigo_natureza_despesa LIKE '4%' THEN 'investimento'
    ELSE 'outra'
  END,
  ${batch}
FROM efisco_raw.db_atualizado_rows r
JOIN efisco_core.itens i ON i.codigo_item = r.codigo_item
WHERE r.batch_id = ${batch}
ON CONFLICT (codigo_item, natureza_key) DO UPDATE SET
  item_id = EXCLUDED.item_id,
  codigo_natureza_despesa = EXCLUDED.codigo_natureza_despesa,
  gnd = EXCLUDED.gnd,
  classe_despesa = EXCLUDED.classe_despesa,
  source_batch_id = EXCLUDED.source_batch_id;

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
WHERE metrics.id = i.id;

UPDATE efisco_raw.ingestion_batches
SET row_count = (SELECT count(*) FROM efisco_raw.db_atualizado_rows WHERE batch_id = ${batch})
WHERE id = ${batch};

SELECT efisco_search.refresh_catalogo_documents();
SELECT efisco_analytics.refresh_all();
`;
}

const client = new Client(loadDatabaseConfig());

try {
  console.log(`Carregando CSV: ${csvPath}`);
  await client.connect();
  await client.query("SET statement_timeout = 0");
  await client.query("SET idle_in_transaction_session_timeout = 0");
  await client.query("BEGIN");
  const batchResult = await client.query(
    `
      INSERT INTO efisco_raw.ingestion_batches (
        source_file_name,
        source_file_sha256,
        notes
      ) VALUES (
        $1,
        '1CEBFCBF8E8D282758E8EAB587772EF3FD63C72133BC843C9A057605C74935E4',
        'DBAtualizado.csv canonical load via Node loader'
      )
      RETURNING id
    `,
    [csvPath],
  );
  const batchId = Number(batchResult.rows[0].id);
  let sourceLineNo = 0;
  let pending = [];

  const parser = createReadStream(csvPath).pipe(
    parse({
      bom: true,
      columns: true,
      delimiter: ";",
      relax_quotes: true,
      skip_empty_lines: false,
    }),
  );

  for await (const raw of parser) {
    sourceLineNo += 1;
    pending.push(toRawRow(raw, batchId, sourceLineNo));
    if (pending.length >= batchSize) {
      await insertRawRows(client, pending);
      pending = [];
      if (sourceLineNo % 50_000 === 0) {
        console.log(`Linhas carregadas no raw: ${sourceLineNo}`);
      }
    }
  }
  await insertRawRows(client, pending);
  console.log(`Raw carregado: ${sourceLineNo} linhas lidas.`);

  console.log("Normalizando tabelas core/search/analytics...");
  await client.query(transformSql(batchId));
  await client.query("COMMIT");

  const { rows } = await client.query(
    `
      SELECT
        (SELECT row_count FROM efisco_raw.ingestion_batches WHERE id = $1) AS raw_rows,
        (SELECT count(*) FROM efisco_core.itens) AS itens,
        (SELECT count(*) FROM efisco_core.item_naturezas) AS item_naturezas,
        (SELECT count(*) FROM efisco_search.catalogo_documents) AS search_docs
    `,
    [batchId],
  );
  console.log(JSON.stringify({ batch_id: batchId, ...rows[0] }, null, 2));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end().catch(() => {});
}
