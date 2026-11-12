import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const pageSource = readFileSync(
  path.join(process.cwd(), "src/app/(dashboard)/catalogo/page.tsx"),
  "utf8",
);

test("catalog cards use institutional symbols, semantic stacks, and usage-first expansion", () => {
  assert.match(pageSource, /function getCatalogCategoryVisual/);
  assert.match(pageSource, /function CatalogCardStackLayers/);
  assert.match(pageSource, /function buildUsageDecisionOptions/);
  assert.match(pageSource, /Ver usos/);
  assert.match(pageSource, /Como este item será utilizado\?/);
  assert.match(pageSource, /Escolher corrente/);
  assert.match(pageSource, /Escolher capital/);
  assert.doesNotMatch(pageSource, /Dia a dia \/ Rotina/);
  assert.doesNotMatch(pageSource, /Necessidade frequente do setor/);
  assert.doesNotMatch(pageSource, /useState\(index === 1 && hasFiscalChoices\)/);
  assert.match(pageSource, /useState\(false\)/);
  assert.match(pageSource, /Escolher este uso/);
});

test("mixed catalog items persist one selected fiscal class instead of adding both variants", () => {
  assert.match(pageSource, /selected_expense_class/);
  assert.match(pageSource, /selectNaturezaOptionByExpenseClass\(options, selectedExpenseClass\)/);
  assert.doesNotMatch(pageSource, /addMixedExpenseClassVariantsToCart/);
  assert.match(
    pageSource,
    /Comparar[\s\S]*setIsUsageOpen\(true\)[\s\S]*Escolher este uso[\s\S]*onAdd\(\{[\s\S]*selected_expense_class: selectedUsage\.expenseClass/,
  );
});

test("catalog top strip follows compact search and strategy layout", () => {
  assert.doesNotMatch(pageSource, /Catálogo institucional/);
  assert.doesNotMatch(pageSource, /bg-gradient-to-br from-\[var\(--p-color-brand-500\)\] to-\[var\(--p-color-brand-700\)\]/);
  assert.match(pageSource, /Pesquisa inteligente[\s\S]*Estratégia da busca/);
  assert.match(pageSource, /Pesquise por nome, código e-Fisco, categoria ou palavra-chave/);
});

test("catalog load-more has its own busy state and appends guarded pages", () => {
  assert.match(pageSource, /const \[loadingMore, setLoadingMore\] = useState\(false\)/);
  assert.match(
    pageSource,
    /if \(isNewSearch\) \{\s*setLoading\(true\);\s*\} else \{\s*setLoadingMore\(true\);\s*\}/,
  );
  assert.match(pageSource, /setLoadingMore\(false\)/);
  assert.match(pageSource, /disabled=\{loading \|\| loadingMore\}/);
  assert.match(pageSource, /if \(loading \|\| loadingMore \|\| !hasMore\) return;[\s\S]*setPage\(\(currentPage\) => currentPage \+ 1\)/);
});

test("cart sidebar uses compact item accordions on desktop", () => {
  assert.match(
    pageSource,
    /md:max-w-\[460px\]/,
  );
  assert.match(
    pageSource,
    /Itens selecionados \(\{items\.length\}\)/,
  );
  assert.match(
    pageSource,
    /fixed inset-x-0 bottom-0 z-\[80\] max-h-\[92dvh\] w-full overflow-y-auto/,
  );
  assert.match(
    pageSource,
    /<div className="space-y-2 p-3 md:p-4">\s*<div className="flex items-center justify-between px-1">\s*<p className="type-caption font-semibold text-\[var\(--p-color-brand-500\)\]">Itens selecionados/,
  );
  assert.doesNotMatch(
    pageSource,
    /<div className="flex-1 space-y-2 overflow-y-auto p-3 md:p-4">/,
  );
  assert.match(
    pageSource,
    /entry\.item_efisco\.codigo_tce[\s\S]*entry\.item_efisco\.descricao[\s\S]*Quantidade: \{entry\.quantidade\}/,
  );
  assert.match(
    pageSource,
    /\{isExpanded && \([\s\S]*Preencha os dados abaixo para liberar o envio da DFD\./,
  );
  assert.match(pageSource, /Unidade de medida[\s\S]*catalogMeasurementUnits\.map/);
  assert.match(
    pageSource,
    /item_efisco: \{[\s\S]*unidade_medida: event\.target\.value/,
  );
});

test("cart keeps destination selection out of the permanent sidebar", () => {
  assert.match(pageSource, /const \[destinationDialogOpen, setDestinationDialogOpen\] = useState\(false\)/);
  assert.match(pageSource, /Para onde deseja enviar esta demanda\?/);
  assert.match(pageSource, /Escolher destino/);
  assert.match(pageSource, /Enviar para DFD coletiva/);
  assert.match(pageSource, /Criar DFD individual/);
  assert.doesNotMatch(pageSource, /Há \{collectiveRooms\.length\} DFD coletiva\(s\) aberta\(s\)\./);
  assert.doesNotMatch(pageSource, /Continuar navegando no catálogo/);
});

test("cart offers an explicit draft save without forcing a destination", () => {
  assert.match(pageSource, /const saveCartAsDraft = useCallback\(async \(\) =>/);
  assert.match(pageSource, /cartItems: snapshotDfdDraftCartItems\(items\)/);
  assert.match(pageSource, /"catalogo"/);
  assert.match(pageSource, /Salvar rascunho/);
  assert.match(pageSource, /Rascunho salvo no PERCATA\. Para retomar, acesse Nova DFD\./);
  assert.match(pageSource, /Rascunho salvo neste navegador\. O servidor do PERCATA está indisponível no momento\./);
});
