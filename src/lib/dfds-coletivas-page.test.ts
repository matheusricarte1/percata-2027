import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("diagnostico da compra nao cobra contexto e pessoas impactadas", () => {
  const pageSource = readFileSync(
    path.join(process.cwd(), "src/app/(dashboard)/dfds-coletivas/page.tsx"),
    "utf8",
  );

  assert.equal(pageSource.includes("1. Contexto da demanda"), false);
  assert.equal(pageSource.includes("2. Pessoas e atividades impactadas"), false);
  assert.equal(pageSource.includes("Problema descrito"), false);
  assert.equal(pageSource.includes("Beneficiários mapeados"), false);
});

test("menu de dfds coletivas entra direto na lista de salas ativas", () => {
  const sidebarSource = readFileSync(
    path.join(process.cwd(), "src/components/layout/Sidebar.tsx"),
    "utf8",
  );
  const pageSource = readFileSync(
    path.join(process.cwd(), "src/app/(dashboard)/dfds-coletivas/page.tsx"),
    "utf8",
  );

  assert.equal(sidebarSource.includes('href: "/dfds-coletivas?view=rooms"'), true);
  assert.equal(sidebarSource.includes("stripHrefQuery(href)"), true);
  assert.equal(pageSource.includes('searchParams.get("view") === "rooms"'), true);
  assert.equal(
    pageSource.includes('useState<"rooms" | "quick" | "wizard">(routeRequestsRooms ? "rooms" : "wizard")'),
    true,
  );
  assert.equal(pageSource.includes('creationMode === "quick"'), true);
});

test("catalogo adiciona item misto somente com a classe fiscal escolhida", () => {
  const catalogSource = readFileSync(
    path.join(process.cwd(), "src/app/(dashboard)/catalogo/page.tsx"),
    "utf8",
  );

  assert.doesNotMatch(catalogSource, /function addMixedExpenseClassVariantsToCart/);
  assert.match(
    catalogSource,
    /selected_expense_class: selectedUsage\.expenseClass/,
  );
  assert.match(
    catalogSource,
    /if \(fiscalIssue === "mixed_expense_classes"\)[\s\S]*selectNaturezaOptionByExpenseClass\(options, selectedExpenseClass\)/,
  );
  assert.match(
    catalogSource,
    /addResolvedProductToCart\([\s\S]*efisco_item_natureza_id: option\.efisco_item_natureza_id[\s\S]*natureza_count: 1[\s\S]*has_mixed_expense_classes: false/,
  );
});

