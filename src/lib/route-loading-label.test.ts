import assert from "node:assert/strict";
import test from "node:test";
import { getRouteLoadingLabel } from "./route-loading-label";

test("loading distinguishes nested sections and item details", () => {
  assert.equal(getRouteLoadingLabel("/triagem/orcamento"), "Carregando Resumo do Setor...");
  assert.equal(getRouteLoadingLabel("/triagem"), "Carregando Análise da Chefia...");
  assert.equal(getRouteLoadingLabel("/dfd/123/impressao"), "Carregando Solicitação...");
  assert.equal(getRouteLoadingLabel("/admin/configuracoes?aba=usuarios"), "Carregando Configurações...");
});

test("unknown routes never claim unrelated processing", () => {
  assert.equal(getRouteLoadingLabel("/catalogo-outra-coisa"), "Carregando o PERCATA...");
  assert.equal(getRouteLoadingLabel("/login"), "Carregando o PERCATA...");
});
