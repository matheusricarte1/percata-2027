import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationSource = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260628204000_collective_contribution_return_status.sql",
  ),
  "utf8",
);

test("schema permite devolver contribuicoes coletivas para correcao", () => {
  assert.match(migrationSource, /DROP CONSTRAINT IF EXISTS dfd_collective_contributions_status_check/);
  assert.match(migrationSource, /status IN \('aberta', 'devolvida', 'consolidada', 'arquivada'\)/);
  assert.match(migrationSource, /idx_dfd_collective_contributions_returned/);
});
