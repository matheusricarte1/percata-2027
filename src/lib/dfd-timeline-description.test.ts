import assert from "node:assert/strict";
import { test } from "node:test";
import { dfdTimelineDescription } from "./dfd-timeline-description";

test("tramitação apresenta motivos de JSON e objetos sem perder quebras de linha", () => {
  assert.equal(dfdTimelineDescription('{"reason":"Status alterado para triagem"}'), "Status alterado para triagem");
  assert.equal(dfdTimelineDescription({ reason: "Corrigir quantidade", justification: "Turma ampliada\nConferir estoque" }), "Corrigir quantidade\nTurma ampliada\nConferir estoque");
  assert.equal(dfdTimelineDescription("Enviada dentro do prazo."), "Enviada dentro do prazo.");
});

test("tramitação não despeja campos técnicos ou valores não textuais", () => {
  for (const details of [null, { id: "interno", reason: { status: "triagem" } }, '["interno"]']) {
    assert.equal(dfdTimelineDescription(details), "Movimentação registrada automaticamente pelo sistema.");
  }
});
