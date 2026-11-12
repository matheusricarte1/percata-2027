import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const apiSource = readFileSync(
  path.join(process.cwd(), "src/lib/collective-room-api.ts"),
  "utf8",
);

test("chefias coletivas exigem vinculo explicito de chefia na unidade da sala", () => {
  assert.match(
    apiSource,
    /export function actorIsChefiaForUnit[\s\S]*unit\.role_in_unit === "chefia"[\s\S]*unit\.unit_id === unitId/,
  );
  assert.doesNotMatch(
    apiSource,
    /\(actor\.role === "chefia" \|\| unit\.role_in_unit === "chefia"\)/,
  );
  assert.match(
    apiSource,
    /const isChefiaLikeActor = actorRoomRole === "chefia" \|\| actorRoomRole === "admin" \|\| actorRoomRole === "superadmin"/,
  );
});

test("detalhe da sala coletiva carrega alternativas fiscais do catalogo v2", () => {
  assert.match(apiSource, /catalogo_item_naturezas_v2/);
  assert.match(apiSource, /fiscal_options/);
  assert.match(
    apiSource,
    /activeContributions[\s\S]*fiscal_options[\s\S]*aggregateCollectiveContributions/,
  );
});

test("conversao coletiva preserva o criador da sala como solicitante", () => {
  assert.match(apiSource, /const requesterId = room\.created_by/);
  assert.match(apiSource, /solicitante_id: requesterId/);
});
