import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const pageSource = readFileSync(
  path.join(process.cwd(), "src/app/(dashboard)/nova-dfd/page.tsx"),
  "utf8",
);
const routeSource = readFileSync(
  path.join(process.cwd(), "src/app/api/collective-contributions/consolidate/route.ts"),
  "utf8",
);

test("finalizacao coletiva fecha contribuicoes pela rota autorizada no servidor", () => {
  assert.match(pageSource, /fetch\("\/api\/collective-contributions\/consolidate"/);
  assert.doesNotMatch(pageSource, /from\("dfd_collective_contributions"\)[\s\S]{0,180}\.update\(\{ status: "consolidada"/);
  assert.match(routeSource, /actorHasUnit\(actor, unitId, unitType\)/);
  assert.match(routeSource, /solicitante_id[\s\S]*unidade_id[\s\S]*tipo_unidade/);
  assert.match(routeSource, /status: "consolidada", consolidated_dfd_id: dfdId/);
});

test("finalizacao antiga nao consome contribuicoes ligadas a salas abertas", () => {
  assert.match(pageSource, /\.eq\("status", "aberta"\)[\s\S]*?\.is\("room_id", null\)/);
  assert.match(routeSource, /\.is\("room_id", null\)/);
});
