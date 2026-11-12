import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalysisGroupStatus } from "../components/triagem/AnalysisGroupStatus";
import type { AnalysisGroupProgress } from "./dfd-analysis-queue";

const group: AnalysisGroupProgress = { key: "biology", unitId: "unit", unitType: "departamento", name: "Colegiado de Biologia", campus: "Campus Petrolina", total: 10, sent: 0, ready: 10, pending: 0, items: 86, missingFields: 0, readyIds: ["ready"], percent: 100, dfds: [] };
const render = (value = group, calendarOpen = true) => renderToStaticMarkup(React.createElement(AnalysisGroupStatus, { group: value, busy: false, calendarOpen, onSend: () => {} }));

test("grupo integralmente avaliado oferece o envio das DFDs prontas", () => {
  const html = render();
  assert.match(html, /Avaliação completa/);
  assert.match(html, /Enviar 10 DFD/);
  assert.doesNotMatch(html, /disabled/);
});
test("grupo enviado tem confirmação persistente e não oferece reenvio", () => {
  const html = render({ ...group, sent: 10, ready: 0, readyIds: [] });
  assert.match(html, /Tudo concluído neste grupo/);
  assert.match(html, /Encaminhado à consolidação/);
  assert.match(html, /disabled/);
});
test("grupo parcial e janela fechada distinguem pendência de envio", () => {
  const html = render({ ...group, sent: 2, ready: 3, pending: 5 }, false);
  assert.match(html, /5 com pendências/);
  assert.match(html, /período de envio está fechado/);
  assert.match(html, /disabled/);
});

test("superadmin pode enviar pendentes com nota 10 explicitamente", () => {
  const html = renderToStaticMarkup(React.createElement(AnalysisGroupStatus, { group: { ...group, total: 15, ready: 14, pending: 1, items: 44, pendingItems: 1, evaluatedItems: 43 }, busy: false, calendarOpen: false, onSend: () => {}, onSendMedian: () => {} }));
  assert.match(html, /Enviar 15 DFD\(s\).*nota 10 em 1 item pendente/);
  assert.match(html, /44 itens · 43 avaliados · 1 item pendente de avaliação/);
  assert.match(html, /Avaliações completas serão preservadas/);
  assert.doesNotMatch(render({ ...group, ready: 0, pending: 10 }), /nota 10 nos itens/);
});
