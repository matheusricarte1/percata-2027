import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const pageSource = readFileSync(
  path.join(process.cwd(), "src/app/(dashboard)/minhas-dfds/page.tsx"),
  "utf8",
);
const draftHookSource = readFileSync(
  path.join(process.cwd(), "src/lib/use-dfd-draft.ts"),
  "utf8",
);

test("Minhas DFDs separates the in-progress draft from formal DFD records", () => {
  assert.match(pageSource, /useDfdDraft\(\)/);
  assert.match(pageSource, /Rascunho em andamento/);
  assert.match(pageSource, /Ainda não é uma DFD protocolada e não possui destino definido/);
  assert.match(pageSource, /Continuar preenchimento/);
  assert.match(pageSource, /router\.push\("\/nova-dfd"\)/);
  assert.match(pageSource, /restoreDfdDraftCartItems/);
});

test("discarding a draft is confirmed and preserves a failed server draft", () => {
  assert.match(pageSource, /Descartar este rascunho\?/);
  assert.match(pageSource, /Manter rascunho/);
  assert.match(pageSource, /Esta ação não cria, altera nem cancela uma DFD formal/);
  assert.match(draftHookSource, /if \(location !== "local"\)/);
  assert.match(draftHookSource, /if \(!result\.ok\) \{/);
  assert.match(draftHookSource, /return false/);
});

