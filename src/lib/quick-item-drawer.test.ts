import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuickItemDrawer } from "../components/triagem/QuickItemDrawer";
import { AnalysisSession } from "./analysis-session";
import type { AnalysisDfd } from "./dfd-analysis";

function sessionForDrawer() {
  const dfd: AnalysisDfd = {
    id: "dfd-drawer",
    numero_protocolo: "DFD-2026-0001",
    requester: "Ana Luícia",
    sector: "Biblioteca",
    objeto_contratacao: "Mobiliário",
    justificativa_contratacao: "Atendimento",
    created_at: "2026-09-01",
    valor_total_estimado: 200,
    status: "triagem",
    revision: "base",
    draft: null,
    items: [
      {
        id: "item-drawer",
        descricao: "Mesa de leitura",
        quantidade: 2,
        valor_unitario_estimado: 100,
        criticidade: null,
        moscow_categoria: null,
        is_highlight_item: false,
      },
    ],
  };
  const session = new AnalysisSession({
    dfd,
    actorId: "actor",
    send: async () => ({ ok: true }),
    storage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
  });
  session.start();
  return session;
}

const render = (options: Partial<React.ComponentProps<typeof QuickItemDrawer>> = {}) =>
  renderToStaticMarkup(
    React.createElement(QuickItemDrawer, {
      session: sessionForDrawer(),
      itemId: "item-drawer",
      calendarOpen: true,
      superadmin: true,
      selected: false,
      onSelect: () => {},
      onRefresh: async () => {},
      onDelete: () => {},
      onItemChange: () => {},
      onClose: () => {},
      ...options,
    }),
  );

test("sidebar rápida preserva o contexto e as escolhas por item", () => {
  const html = render();
  assert.match(html, /AVALIANDO ITEM/);
  assert.match(html, /DFD-2026-0001/);
  assert.match(html, /Ana Luícia/);
  assert.match(html, /Biblioteca/);
  assert.match(html, /Mesa de leitura/);
  assert.match(html, /Quantidade/);
  assert.match(html, /R\$\s?200,00/);
  assert.equal((html.match(/type="range"/g) || []).length, 2);
  assert.match(html, /Observações \(opcional\)/);
  assert.match(html, /Salvar avaliação/);
  assert.match(html, /Fechar avaliação/);
});

test("sidebar preserva revisão, confirmar ajustes, homologar e devolver a DFD com orientação", () => {
  const html = render();
  assert.match(html, /Revisar e decidir a DFD/);
  assert.match(html, /Confirmar ajustes/);
  assert.match(html, /Homologar DFD/);
  assert.match(html, /Orientação para o solicitante/);
  assert.match(html, /Devolver DFD inteira para correção/);
});

test("sidebar oferece retirada formal somente quando o handler está disponível", () => {
  assert.doesNotMatch(render(), /Retirar item da DFD/);
  const html = render({ onRemoveItem: () => {} });
  assert.match(html, /Retirar item da DFD/);
});

test("sidebar preserva seleção para homologação em lote", () => {
  assert.match(render(), /Incluir na homologação em lote/);
});

test("sidebar do superadmin preserva exclusão por protocolo em qualquer estado", () => {
  const html = render();
  assert.match(html, /Administração da DFD/);
  assert.match(html, /Excluir DFD/);
});

test("sidebar preserva recuperação diante de falha de gravação", () => {
  const session = sessionForDrawer();
  session.setError("Falha temporária");
  const html = render({ session });
  assert.match(html, /Tentar novamente/);
});

test("sidebar preserva próxima pendência e contexto completo da DFD", () => {
  const html = render();
  assert.match(html, /Descrição completa/);
  assert.match(html, /Ver DFD/);
});
