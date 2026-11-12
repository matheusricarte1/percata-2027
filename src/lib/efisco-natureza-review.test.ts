import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildNaturezaReviewCsv,
  normalizeNaturezaReviewDecision,
  summarizeNaturezaReviewQueue,
} from "./efisco-natureza-review";

describe("efisco-natureza-review", () => {
  it("normalizes valid review decisions and trims administrative notes", () => {
    const decision = normalizeNaturezaReviewDecision({
      status: "saneado",
      efisco_item_id: "123",
      dfd_item_id: "550e8400-e29b-41d4-a716-446655440000",
      codigo_natureza_despesa: "3.3.90.30.16",
      justificativa: "  confirmado pela equipe  ",
    });

    assert.deepEqual(decision, {
      status: "saneado",
      efisco_item_id: 123,
      dfd_item_id: "550e8400-e29b-41d4-a716-446655440000",
      codigo_natureza_despesa: "33903016",
      replacement_efisco_item_id: null,
      justificativa: "confirmado pela equipe",
    });
  });

  it("rejects saneado decisions without an official natureza code", () => {
    assert.throws(
      () =>
        normalizeNaturezaReviewDecision({
          status: "saneado",
          efisco_item_id: 123,
          justificativa: "sem codigo",
        }),
      /natureza/i,
    );
  });

  it("summarizes queue status for admin alerts", () => {
    const summary = summarizeNaturezaReviewQueue([
      { status: "pendente" },
      { status: "pendente" },
      { status: "em_analise" },
      { status: "saneado" },
      { status: "substituido" },
      { status: "bloqueado" },
    ]);

    assert.equal(summary.total, 6);
    assert.equal(summary.open, 3);
    assert.equal(summary.closed, 3);
    assert.equal(summary.byStatus.pendente, 2);
  });

  it("builds a csv report with sem-natureza review fields", () => {
    const csv = buildNaturezaReviewCsv([
      {
        codigo_efisco: "001",
        descricao: 'Item "especial"',
        numero_protocolo: "DFD-1",
        status: "pendente",
        codigo_natureza_despesa: null,
        justificativa: "Analisar",
      },
    ]);

    assert.match(csv, /^codigo_efisco;descricao;numero_protocolo;/);
    assert.match(csv, /"Item ""especial"""/);
    assert.match(csv, /"pendente"/);
  });
});
