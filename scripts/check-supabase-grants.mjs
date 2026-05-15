import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationsDir = join(root, "supabase", "migrations");
const migrationName = "20260513103000_explicit_public_data_api_grants.sql";
const migration = readFileSync(join(migrationsDir, migrationName), "utf8").toLowerCase();

const createdTables = new Set();
const createTablePattern =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:public)\.)?([a-z0-9_]+)/gi;

for (const fileName of readdirSync(migrationsDir)) {
  if (!fileName.endsWith(".sql")) continue;
  const content = readFileSync(join(migrationsDir, fileName), "utf8");
  for (const match of content.matchAll(createTablePattern)) {
    createdTables.add(match[1].toLowerCase());
  }
}

const intentionallyExcluded = new Set([]);

for (const table of [...createdTables].sort()) {
  if (intentionallyExcluded.has(table)) continue;
  assert.match(
    migration,
    new RegExp(`'${table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'`),
    `Missing explicit Data API grant coverage for public.${table}`,
  );
}

for (const required of [
  "grant usage on schema public to anon, authenticated, service_role",
  "grant select on public.app_system_settings to anon, authenticated",
  "grant execute on function %s to authenticated, service_role",
  "security_invoker = true",
  "enable row level security",
]) {
  assert.ok(migration.includes(required), `Missing required SQL fragment: ${required}`);
}

assert.ok(
  !migration.includes("grant select, insert, update, delete on all tables in schema public to authenticated"),
  "Do not grant every future public table to authenticated by default; future migrations need explicit grants.",
);

console.log(`Supabase grant migration covers ${createdTables.size} public tables.`);
