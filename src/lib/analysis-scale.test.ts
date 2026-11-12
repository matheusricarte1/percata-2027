import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AnalysisScale,
  type AnalysisScaleProps,
} from "../components/triagem/AnalysisScale";

const options = [
  ["low", "Baixa"],
  ["medium", "Média"],
  ["high", "Alta"],
] as const;
const render = (props: Partial<AnalysisScaleProps> = {}) =>
  renderToStaticMarkup(
    React.createElement(AnalysisScale, {
      id: "impact-item",
      label: "Impacto",
      description: "Consequência de não atender o item.",
      options,
      value: null,
      onChange: () => {},
      tone: "impact",
      ...props,
    }),
  );

test("controle de criticidade usa slider discreto com nível explícito", () => {
  const html = render();
  assert.match(html, /type="range"/);
  assert.match(html, /min="0"/);
  assert.match(html, /max="3"/);
  assert.match(html, /aria-valuetext="Não definido"/);
  assert.match(html, /Não definido/);
  assert.match(html, /Baixa/);
  assert.match(html, /Média/);
  assert.match(html, /Alta/);
});

test("o slider mantém rótulo e valor compreensíveis", () => {
  const html = render({ value: "high" });
  assert.match(html, /<legend id="impact-item-label"/);
  assert.match(html, /aria-describedby="impact-item-description impact-item-help"/);
  assert.match(html, /aria-valuetext="Alta"/);
  assert.match(html, /Nível selecionado: Alta/);
});

test("limpar é explícito e não altera o valor durante a renderização", () => {
  const changes: (string | null)[] = [];
  const html = render({ value: "medium", onChange: (value) => changes.push(value) });
  assert.match(html, /aria-label="Limpar impacto"/);
  assert.deepEqual(changes, []);
});

test("slider bloqueado desabilita o controle e a limpeza", () => {
  const html = render({ disabled: true, value: "high" });
  assert.match(html, /<fieldset[^>]*disabled=""/);
  assert.match(html, /<input[^>]*type="range"[^>]*disabled=""/);
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-label="Limpar impacto"/);
});
