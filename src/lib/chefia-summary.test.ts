import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPcaGoalMetrics, buildSetorSummary } from "./chefia-summary.ts";

describe("chefia-summary", () => {
  it("builds PCA goal metrics from real DFD and item states", () => {
    const metrics = buildPcaGoalMetrics({
      today: new Date("2026-05-06T12:00:00"),
      dfds: [
        { id: "1", status: "triagem", previsao_recebimento: "2026-05-10" },
        { id: "2", status: "aprovada", previsao_recebimento: "2026-05-20" },
        { id: "3", status: "concluida" },
      ],
      items: [
        { criticidade: "alta", moscow_categoria: "deve_ter", is_highlight_item: true },
        { criticidade: "media", moscow_categoria: null },
      ],
    });

    assert.equal(metrics.progressPercent, 67);
    assert.equal(metrics.pendingCount, 1);
    assert.equal(metrics.classifiedPercent, 50);
    assert.equal(metrics.deadlineLabel, "4 dia(s)");
  });

  it("summarizes sector budget and collective DFDs", () => {
    const summary = buildSetorSummary({
      dfds: [
        { id: "1", status: "triagem", valor_total_estimado: 100 },
        { id: "2", status: "aprovada", valor_total_estimado: 300 },
      ],
      items: [
        {
          dfd_id: "1",
          quantidade: 2,
          valor_unitario_estimado: 10,
          gnd: "3.3.90.30",
          justificativa_item: "Distribuição por usuário: Ana: 1; Bia: 1",
        },
        {
          dfd_id: "2",
          quantidade: 3,
          valor_unitario_estimado: 20,
          gnd: "4.4.90.52",
        },
      ],
    });

    assert.equal(summary.totalGerenciado, 400);
    assert.equal(summary.triagemCount, 1);
    assert.equal(summary.homologadoCount, 1);
    assert.equal(summary.collective.participantCount, 2);
    assert.equal(summary.collective.itemCount, 1);
    assert.equal(summary.gndMetrics[0].gnd, "4.4.90.52");
  });
});
