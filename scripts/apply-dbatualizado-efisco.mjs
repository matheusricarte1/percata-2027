import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

import { loadDatabaseConfig } from "./supabase-db-url.mjs";

const { Client } = pg;

const migrationPath = resolve(
  process.cwd(),
  process.argv[2] || "supabase/migrations/20260531120000_dbatualizado_efisco_v2.sql",
);

const sql = readFileSync(migrationPath, "utf8");
const client = new Client(loadDatabaseConfig());

try {
  console.log(`Aplicando migracao: ${migrationPath}`);
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(`
    SELECT
      to_regclass('efisco_core.itens') AS itens_table,
      to_regclass('efisco_search.catalogo_documents') AS search_table,
      to_regclass('public.catalogo_efisco_v2') AS catalog_view
  `);
  console.log(JSON.stringify(rows[0], null, 2));
} finally {
  await client.end().catch(() => {});
}
