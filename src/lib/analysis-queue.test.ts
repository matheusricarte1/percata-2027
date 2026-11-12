import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalysisWorkspace } from "../components/triagem/AnalysisWorkspace";
import {
  queueFromWorkspace,
  parseAnalysisQueueQuery,
} from "./dfd-analysis-queue";
import type { AnalysisWorkspaceData } from "./dfd-analysis";

const queueRouteSource = readFileSync(
  path.join(process.cwd(), "src/app/api/dfd/analysis/queue/route.ts"),
  "utf8",
);
export function largeFixture(): AnalysisWorkspaceData {
  return {
    actorId: "fixture",
    role: "chefia",
    calendar: null,
    dfds: Array.from({ length: 200 }, (_, p) => ({
      id: `dfd-${p}`,
      solicitante_id: `person-${p}`,
      requester: `Pessoa ${String(p).padStart(3, "0")}`,
      sector: "Biblioteca",
      numero_protocolo: `DFD-${p}`,
      objeto_contratacao: "Mobiliário",
      status: "triagem",
      created_at: "2026-09-01",
      valor_total_estimado: 1000,
      justificativa_contratacao: "Atendimento",
      revision: "base",
      draft: null,
      items: Array.from({ length: 10 }, (_, i) => ({
        id: `item-${p}-${i}`,
        descricao: `Mesa ${p}-${i}`,
        codigo_tce: `COD-${p}-${i}`,
        quantidade: 1,
        valor_unitario_estimado: 100,
        criticidade: null,
        moscow_categoria: null,
        is_highlight_item: false,
      })),
    })),
  };
}
test("200 pessoas e 2000 itens: fila inicial transfere somente resumos de 25 pessoas", () => {
  const q = queueFromWorkspace(largeFixture());
  assert.equal(q.totalPeople, 200);
  assert.equal(q.totalDfds, 200);
  assert.equal(q.totals.items, 2000);
  assert.equal(q.people.length, 25);
  assert.equal(JSON.stringify(q).includes('"items":['), false);
  const second = queueFromWorkspace(largeFixture(), { page: 2 });
  assert.equal(second.people[0].id, "person-25");
});
test("fila inicial não monta controles até a chefia chamar Avaliar", () => {
  const html = renderToStaticMarkup(
    React.createElement(AnalysisWorkspace, { initialData: largeFixture() }),
  );
  assert.equal((html.match(/type="range"/g) || []).length, 0);
  assert.equal((html.match(/AVALIANDO ITEM/g) || []).length, 0);
  assert.match(html, /Selecione uma DFD na fila/);
  assert.doesNotMatch(html, /Mesa 0-9/);
});
test("pessoas homônimas permanecem separadas por identificador", () => {
  const data = largeFixture();
  data.dfds[1].requester = data.dfds[0].requester;
  const q = queueFromWorkspace(data);
  assert.equal(q.totalPeople, 200);
  assert.notEqual(q.people[0].id, q.people[1].id);
});
test("busca por código identifica exatamente a DFD e o item", () => {
  const q = queueFromWorkspace(largeFixture(), { search: "COD-198-7" });
  assert.equal(q.totalDfds, 1);
  assert.equal(q.people[0].dfds[0].id, "dfd-198");
  assert.deepEqual(q.people[0].dfds[0].matchedItemIds, ["item-198-7"]);
});
test("contadores refletem rascunho sem confundir preenchimento e decisão", () => {
  const data = largeFixture();
  const d = data.dfds[0];
  d.draft = {
    revision: 1,
    base_revision: d.revision,
    updated_at: "now",
    payload: {
      items: d.items.map((i, n) => ({
        ...i,
        criticidade: "alta",
        moscow_categoria: "deve_ter",
        remove: n === 0,
        removalReason: "Duplicado",
      })),
    },
  };
  const q = queueFromWorkspace(data, { filter: "removal" });
  assert.equal(q.totalDfds, 1);
  assert.equal(q.people[0].dfds[0].status, "triagem");
  assert.equal(q.totals.missingImpact, 0);
  assert.equal(q.totals.removedItems, 1);
  assert.equal(q.totals.proposedTotal, 900);
});
test("consulta recusa página e filtros inválidos", () => {
  assert.throws(() => parseAnalysisQueueQuery(new URLSearchParams("page=0")));
  assert.throws(() =>
    parseAnalysisQueueQuery(new URLSearchParams("filter=unknown")),
  );
  assert.equal(
    parseAnalysisQueueQuery(new URLSearchParams("search=%25_%")).search,
    "%_%",
  );
});

test("filtros de estrela e alto valor usam os itens antes de resumir a fila", () => {
  const data = largeFixture();
  data.dfds[0].items[0].is_highlight_item = true;
  data.dfds[1].items[0].valor_unitario_estimado = 1000;

  const starred = queueFromWorkspace(data, { filter: "starred" });
  assert.equal(starred.totalDfds, 1);
  assert.equal(starred.totals.starredItems, 1);

  const highValue = queueFromWorkspace(data, { filter: "high_value" });
  assert.equal(highValue.totalDfds, 1);
  assert.equal(highValue.totals.highValueItems, 1);
});

test("superadmin queue keeps returned DFDs out of the chefia worklist", () => {
  assert.match(queueRouteSource, /p_all:\s*false/);
});
