import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const usersPageSource = readFileSync(
  path.join(process.cwd(), "src/app/(admin)/admin/usuarios/page.tsx"),
  "utf8",
);

test("a lista de usuários começa recolhida dentro de configurações", () => {
  assert.match(
    usersPageSource,
    /<CollapsibleSection\s+title="Usuários cadastrados"[\s\S]*?defaultOpen=\{false\}[\s\S]*?<table/,
    "A listagem completa precisa ficar em uma seção recolhida, sem esconder os controles quando aberta.",
  );
});
