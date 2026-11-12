import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const operationSource = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260908143000_dfd_return_notification.sql"),
  "utf8",
);
const resendRouteSource = readFileSync(
  path.join(process.cwd(), "src/app/api/dfd/send-to-triagem/route.ts"),
  "utf8",
);

test("devolução formal cria uma notificação clara para o solicitante", () => {
  assert.match(operationSource, /NEW\.action <> 'devolvida'[\s\S]*INSERT INTO public\.notifications[\s\S]*DFD devolvida para correção/);
  assert.match(operationSource, /template_key.*dfd_returned/);
  assert.match(operationSource, /cta_url/);
});

test("reenvio de DFD devolvida exige justificativa e registra a resposta", () => {
  assert.match(resendRouteSource, /resubmissionJustification/);
  assert.match(resendRouteSource, /Explique brevemente o que foi corrigido/);
  assert.match(resendRouteSource, /submit_dfd_with_deadline/);
  const deadlineMigration = readFileSync(path.join(process.cwd(), "supabase/migrations/20261001120000_submission_deadline_and_exceptions.sql"), "utf8");
  assert.match(deadlineMigration, /reenviada_apos_devolucao/);
  assert.match(deadlineMigration, /FOR UPDATE/);
});
