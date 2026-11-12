import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";

const settingsSource = readFileSync(
  join(process.cwd(), "src/components/settings/SettingsPanel.tsx"),
  "utf8",
);

test("configuracoes mantem a identificacao de titularidade discreta e recolhida", () => {
  assert.match(settingsSource, /<details[\s\S]*<summary/);
  assert.doesNotMatch(settingsSource, /<details[^>]*\sopen(?:=|\s|>)/);
  assert.match(settingsSource, /Informa(?:ç|&ccedil;)ões do sistema/);
  assert.match(settingsSource, /Matheus Ricarte de Oliveira Souza/);
});

test("aviso distingue a titularidade do software do uso e dos dados institucionais", () => {
  assert.match(settingsSource, /recursos próprios/);
  assert.match(
    settingsSource,
    /não implica cessão, doação,\s*transferência ou cotitularidade/,
  );
  assert.match(settingsSource, /dados institucionais/);
});
