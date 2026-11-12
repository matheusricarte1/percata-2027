import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260919163000_prevent_duplicate_dfd_return_email.sql",
);

test("devolução formal não cria também a notificação genérica de mudança de status", () => {
  assert.equal(existsSync(migrationPath), true, "migration de deduplicação ausente");
  const source = readFileSync(migrationPath, "utf8");

  assert.match(source, /CREATE OR REPLACE FUNCTION public\.notify_dfd_status_change/);
  assert.match(source, /IF NEW\.status = 'devolvida' THEN\s+RETURN NEW;/);
  assert.match(source, /WHEN NEW\.status = 'aprovada' THEN 'success'/);
});
