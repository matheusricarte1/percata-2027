import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260920110000_normalize_dfd_status_email_notifications.sql",
);
const submissionPath = path.join(
  process.cwd(),
  "src/app/api/dfd/send-to-triagem/route.ts",
);

test("encaminhamento cria aviso rico dfd_submitted para cada responsável pela análise", () => {
  const source = readFileSync(submissionPath, "utf8");
  assert.match(source, /template_key:\s*"dfd_submitted"/);
  assert.match(source, /context_label:\s*"Análise da chefia"/);
  assert.match(source, /cta_label:\s*"Analisar DFD"/);
});

test("a migração substitui avisos genéricos por eventos ricos e idempotentes de status", () => {
  assert.equal(existsSync(migrationPath), true, "migration de normalização ausente");
  const source = readFileSync(migrationPath, "utf8");

  assert.match(source, /CREATE OR REPLACE FUNCTION private\.notify_dfd_status_email/);
  assert.match(source, /p_template_key text/);
  assert.match(source, /IF EXISTS\s*\(\s*SELECT 1\s*FROM public\.notifications/);
  assert.match(source, /'template_key', p_template_key/);
  assert.match(source, /'dfd_approved'/);
  assert.match(source, /'dfd_rejected'/);
  assert.match(source, /'dfd_archived'/);
  assert.match(source, /'cta_url', '\/dfd\/' \|\| p_dfd\.id::text/);
});

test("decisões terminais preservam o status e a justificativa no aviso auditável", () => {
  const source = readFileSync(migrationPath, "utf8");
  assert.match(source, /IF NEW\.status = 'aprovada' THEN[\s\S]*?notify_dfd_status_email\([\s\S]*?'dfd_approved'/);
  assert.match(source, /ELSIF NEW\.status IN \('rejeitada', 'reprovada'\) THEN[\s\S]*'dfd_rejected'/);
  assert.match(source, /ELSIF NEW\.status = 'arquivada' THEN[\s\S]*'dfd_archived'/);
  assert.match(source, /Decisão registrada:/);
});
