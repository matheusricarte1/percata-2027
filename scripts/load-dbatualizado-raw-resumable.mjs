import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse";
import pg from "pg";

import { loadDatabaseConfig } from "./supabase-db-url.mjs";

const { Client } = pg;
const csvPath = resolve(process.cwd(), process.argv[2] || "../DBAtualizado.csv");
const batchSize = Number(process.env.EFISCO_RAW_LOAD_BATCH_SIZE || 2500);

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

function hashRow(row) {
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
    .update(fields.map((field) => row[field] ?? "").join("|"))
    .digest("hex");
}

function toDbRow(row, batchId, sourceLineNo) {
  return [
    batchId,
    sourceLineNo,
    hashRow(row),
    text(row.CODIGO_GRUPO),
    text(row.NOME_GRUPO),
    text(row.DESCRICAO_GRUPO),
    text(row.SITUACAO_GRUPO),
    text(row.CODIGO_CLASSE),
    text(row.NOME_CLASSE),
    text(row.DESCRICAO_CLASSE),
    text(row.SITUACAO_CLASSE),
    text(row.CODIGO_MATERIAL_SERVICO),
    text(row.NOME_MATERIAL_SERVICO),
    text(row.SITUACAO_MATERIAL_SERVICO),
    tipo(row.TIPO_OBJETO),
    text(row.CODIGO_ITEM),
    name(row.NOME_ITEM),
    text(row.DATA_INCLUSAO_ITEM),
    text(row.SITUACAO_ITEM),
    text(row.CODIGO_NATUREZA_DESPESA),
  ];
}

async function insertRows(client, rows) {
  if (rows.length === 0) return;
  const columns = [
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
    const offset = rowIndex * columns.length;
    params.push(...row);
    return `(${columns.map((_, colIndex) => `$${offset + colIndex + 1}`).join(",")})`;
  });

  await client.query(
    `
      INSERT INTO efisco_raw.db_atualizado_rows (${columns.join(",")})
      VALUES ${values.join(",")}
      ON CONFLICT (batch_id, row_hash) DO NOTHING
    `,
    params,
  );
}

const client = new Client(loadDatabaseConfig());
await client.connect();
await client.query("SET statement_timeout = 0");
await client.query("SET idle_in_transaction_session_timeout = 0");

try {
  const batchResult = await client.query(`
    SELECT id, row_count
    FROM efisco_raw.ingestion_batches
    WHERE source_file_sha256 = '1CEBFCBF8E8D282758E8EAB587772EF3FD63C72133BC843C9A057605C74935E4'
    ORDER BY id DESC
    LIMIT 1
  `);
  let batchId = Number(batchResult.rows[0]?.id || 0);
  if (!batchId) {
    const inserted = await client.query(
      `
        INSERT INTO efisco_raw.ingestion_batches (
          source_file_name,
          source_file_sha256,
          notes
        ) VALUES (
          $1,
          '1CEBFCBF8E8D282758E8EAB587772EF3FD63C72133BC843C9A057605C74935E4',
          'DBAtualizado.csv raw audit load'
        )
        RETURNING id
      `,
      [csvPath],
    );
    batchId = Number(inserted.rows[0].id);
  }

  const existingResult = await client.query(
    "SELECT coalesce(max(source_line_no), 0)::INTEGER AS last_line FROM efisco_raw.db_atualizado_rows WHERE batch_id = $1",
    [batchId],
  );
  const lastLine = Number(existingResult.rows[0].last_line || 0);
  console.log(`Batch raw ${batchId}; retomando após linha ${lastLine}.`);

  let sourceLineNo = 0;
  let insertedSinceStart = 0;
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

  for await (const row of parser) {
    sourceLineNo += 1;
    if (sourceLineNo <= lastLine) continue;
    pending.push(toDbRow(row, batchId, sourceLineNo));
    if (pending.length >= batchSize) {
      await insertRows(client, pending);
      insertedSinceStart += pending.length;
      pending = [];
      if (sourceLineNo % 50_000 === 0) {
        console.log(`Raw audit: ${sourceLineNo}/751293 linhas processadas.`);
      }
    }
  }
  await insertRows(client, pending);
  insertedSinceStart += pending.length;

  await client.query(
    "UPDATE efisco_raw.ingestion_batches SET row_count = (SELECT count(*) FROM efisco_raw.db_atualizado_rows WHERE batch_id = $1) WHERE id = $1",
    [batchId],
  );

  const validation = await client.query(
    "SELECT row_count FROM efisco_raw.ingestion_batches WHERE id = $1",
    [batchId],
  );
  console.log(
    JSON.stringify(
      {
        batch_id: batchId,
        processed_until_line: sourceLineNo,
        inserted_or_skipped_this_run: insertedSinceStart,
        raw_rows: validation.rows[0]?.row_count,
      },
      null,
      2,
    ),
  );
} finally {
  await client.end().catch(() => {});
}
