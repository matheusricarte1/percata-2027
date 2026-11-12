import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationsDir = join(root, "supabase", "migrations");
const migrationName = "20260513103000_explicit_public_data_api_grants.sql";
const migration = readFileSync(join(migrationsDir, migrationName), "utf8").toLowerCase();
const sqlFileNames = readdirSync(migrationsDir).filter((fileName) => fileName.endsWith(".sql"));
const allMigrations = sqlFileNames.map((fileName) => ({
  fileName,
  content: readFileSync(join(migrationsDir, fileName), "utf8").toLowerCase(),
}));

const createdTables = new Set();
const createTablePattern =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:public)\.)?([a-z0-9_]+)\s*\(/gi;

for (const { content } of allMigrations) {
  for (const match of content.matchAll(createTablePattern)) {
    createdTables.add(match[1].toLowerCase());
  }
}

function hasDedicatedTableCoverage(table) {
  const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rlsPattern = new RegExp(`alter\\s+table\\s+public\\.${escapedTable}\\s+enable\\s+row\\s+level\\s+security`);
  const authenticatedGrantPattern = new RegExp(
    `grant\\s+[^;]*\\s+on\\s+(?:table\\s+)?public\\.${escapedTable}\\s+to\\s+authenticated`,
  );
  const serviceRoleGrantPattern = new RegExp(
    `grant\\s+[^;]*\\s+on\\s+(?:table\\s+)?public\\.${escapedTable}\\s+to\\s+service_role`,
  );
  const denyAllClientPolicyPattern = new RegExp(
    `create\\s+policy[\\s\\S]*?on\\s+public\\.${escapedTable}[\\s\\S]*?to\\s+authenticated[\\s\\S]*?using\\s*\\(false\\)[\\s\\S]*?with\\s+check\\s*\\(false\\)`,
  );

  return allMigrations.some(({ content }) => {
    if (!rlsPattern.test(content)) return false;
    const hasAuthenticatedGrant = authenticatedGrantPattern.test(content);
    if (hasAuthenticatedGrant) return true;
    return serviceRoleGrantPattern.test(content) && denyAllClientPolicyPattern.test(content);
  });
}

for (const table of [...createdTables].sort()) {
  const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const coveredByCentralGrantMigration = new RegExp(`'${escapedTable}'`).test(migration);
  assert.ok(
    coveredByCentralGrantMigration || hasDedicatedTableCoverage(table),
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
