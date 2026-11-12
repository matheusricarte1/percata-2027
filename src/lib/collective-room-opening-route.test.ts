import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const routeSource = readFileSync(
  path.join(process.cwd(), "src/app/api/collective-rooms/route.ts"),
  "utf8",
);

test("membro vinculado abre sala coletiva diretamente para contribuicoes", () => {
  assert.match(routeSource, /const status = "aberta"/);
  assert.match(routeSource, /published_at: new Date\(\)\.toISOString\(\)/);
  assert.match(routeSource, /published_by: actor\.id/);
  assert.doesNotMatch(routeSource, /const status = isChefia \? "aberta" : "proposta"/);
});

test("abertura coletiva notifica todos os demais membros da unidade", () => {
  assert.match(routeSource, /loadUnitRecipientUserIds\(admin, \{\s*unitId,\s*unitType\s*\}\)/);
  assert.doesNotMatch(routeSource, /else \{[\s\S]*roleInUnit: "chefia"/);
});
