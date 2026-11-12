import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const pageSource = readFileSync(
  resolve(process.cwd(), "src/app/(chefia)/triagem/orcamento/page.tsx"),
  "utf8",
);

test("lista setorial prioriza solicitante e chefia responsável com avatar", () => {
  assert.match(pageSource, /<span>Solicitante<\/span>/);
  assert.match(pageSource, /<span>Chefia responsável<\/span>/);
  assert.doesNotMatch(pageSource, /<span>Classificação<\/span>/);
  assert.doesNotMatch(pageSource, /<span>Qualidade<\/span>/);
  assert.match(pageSource, /<PersonCell label="Solicitante"/);
  assert.match(pageSource, /<PersonCell label="Chefia"/);
  assert.match(pageSource, /src=\{person\.avatarUrl\}/);
  assert.match(pageSource, /from\("user_units"\)/);
});
