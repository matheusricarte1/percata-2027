import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const routeSource = readFileSync(
  path.join(process.cwd(), "src/app/api/collective-rooms/[id]/route.ts"),
  "utf8",
);

test("sala coletiva nao avanca para previa enquanto houver contribuicao devolvida", () => {
  assert.match(routeSource, /status === "pronta_para_conversao"[\s\S]*dfd_collective_contributions/);
  assert.match(routeSource, /\.eq\("status", "devolvida"\)/);
  assert.match(routeSource, /Corrija ou confirme os itens devolvidos antes de abrir a prévia/);
});
