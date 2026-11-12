import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const pageSource = readFileSync(
  resolve(process.cwd(), "src/app/(dashboard)/dfd/[id]/page.tsx"),
  "utf8",
);

test("detalhe da DFD oferece troca dentro do cartão de responsável para o superadmin", () => {
  assert.match(pageSource, /currentRole === "superadmin"/);
  assert.match(pageSource, /rightContent=\s*\{\s*canReassignChefia/);
  assert.match(pageSource, /Trocar responsável/);
  assert.match(pageSource, /\/api\/dfd\/reassign-chefia/);
});
