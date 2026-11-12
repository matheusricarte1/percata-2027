import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalysisWorkspace } from "../components/triagem/AnalysisWorkspace";
import type { AnalysisWorkspaceData } from "./dfd-analysis";

const fixture: AnalysisWorkspaceData = {
  role: "chefia", actorId: "viewer",
  calendar: { open: false, start: "2026-09-12T03:00:00Z", end: "2026-09-26T03:00:00Z" },
  dfds: [{
    id: "dfd", numero_protocolo: "DFD-EXEMPLO", objeto_contratacao: "Mobiliário",
    justificativa_contratacao: "Atendimento da biblioteca", status: "triagem",
    requester: "Ana", sector: "Biblioteca", created_at: "2026-09-01",
    valor_total_estimado: 200, revision: "base", draft: null,
    items: [{ id: "item", descricao: "Mesa de leitura", quantidade: 2,
      valor_unitario_estimado: 100, criticidade: null, moscow_categoria: null,
      is_highlight_item: false }],
  }],
};
const render = (data = fixture) => renderToStaticMarkup(
  React.createElement(AnalysisWorkspace, { initialData: data }),
);

test("fila abre sem sidebar e deixa a avaliação sob chamada explícita", () => {
  const html = render();
  assert.match(html, /Ana/);
  assert.match(html, /DFD-EXEMPLO/);
  assert.match(html, /Selecione uma DFD na fila/);
  assert.doesNotMatch(html, /AVALIANDO ITEM/);
  assert.doesNotMatch(html, /type="range"/);
});

test("a faixa de contexto explica o período de trabalho", () => {
  const html = render();
  assert.match(html, /Rascunhos liberados/);
  assert.match(html, /25\/09\/2026/);
});

test("chefia não recebe controles administrativos", () => {
  assert.doesNotMatch(render(), /Excluir DFD/);
});

test("Superadmin recebe filtro de todos os estados e histórico", () => {
  const html = render({ ...fixture, role: "superadmin" });
  assert.match(html, /Todas as DFDs, em qualquer estado/);
  assert.match(html, /Histórico de operações/);
});

test("100% da fila deixa claro que a classificação ainda aguarda homologação", () => {
  const classified = {
    ...fixture,
    dfds: fixture.dfds.map((dfd) => ({
      ...dfd,
      items: dfd.items.map((item) => ({
        ...item,
        criticidade: "alta",
        moscow_categoria: "deve_ter",
      })),
    })),
  };
  const html = render(classified);
  assert.match(html, /100% classificado/);
  assert.doesNotMatch(html, /100% pronto/);
  assert.match(html, /Campus não informado/);
  assert.doesNotMatch(html, /Campus Petrolina/);
});

test("faixa do setor identifica a chefia responsável", () => {
  const html = render({
    ...fixture,
    dfds: fixture.dfds.map((dfd) => ({
      ...dfd,
      chefiaName: "Ana Chefia",
      chefiaAvatarUrl: "https://example.test/ana.png",
    })),
  });
  assert.match(html, /Chefia responsável/);
  assert.match(html, /Ana Chefia/);
  assert.match(html, /Foto de Ana Chefia/);
});

test("resumo visual do setor mantém pendências, percentual e contadores", () => {
  const html = render();
  assert.match(html, /Progresso do setor/);
  assert.match(html, /2 decisões pendentes/);
  assert.match(html, /1 DFD/);
  assert.match(html, /1 item/);
});


test("envio exige ação explícita e informa que salvar não encaminha", () => {
  const html = render();
  assert.match(html, /Finalizar priorização/);
  assert.match(html, /As avaliações são salvas automaticamente/);
  assert.match(html, /A caixa azul mostra o andamento real do grupo/);
  assert.doesNotMatch(html, /Quando houver homologação automática/);
});
