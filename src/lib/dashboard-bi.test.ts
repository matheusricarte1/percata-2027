import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDashboardBi } from "./dashboard-bi";

describe("dashboard-bi", () => {
  const dfds = [
    {
      id: "a",
      status: "aprovada",
      created_at: "2026-05-01T00:00:00.000Z",
      valor_total_estimado: 1000,
      unidade_id: "unit-1",
      tipo_unidade: "departamento",
      origin_type: "individual",
      numero_protocolo: "DFD-A",
      objeto_contratacao: "Material de laboratório",
    },
    {
      id: "b",
      status: "triagem",
      created_at: "2026-05-10T00:00:00.000Z",
      valor_total_estimado: 3000,
      unidade_id: "unit-1",
      tipo_unidade: "departamento",
      origin_type: "collective",
      numero_protocolo: "DFD-B",
      objeto_contratacao: "Equipamentos",
    },
    {
      id: "c",
      status: "concluida",
      created_at: "2026-06-01T00:00:00.000Z",
      valor_total_estimado: 2000,
      unidade_id: "unit-2",
      tipo_unidade: "laboratorio",
      origin_type: "individual",
      numero_protocolo: "DFD-C",
      objeto_contratacao: "Serviços",
    },
  ];

  const items = [
    {
      dfd_id: "a",
      quantidade: 2,
      valor_unitario_estimado: 100,
      codigo_item_efisco: "100",
      gnd_derivado: "3.3.90.30",
      nome_grupo: "Consumo",
      requires_natureza_review: false,
    },
    {
      dfd_id: "b",
      quantidade: 3,
      valor_unitario_estimado: 500,
      codigo_item_efisco: null,
      gnd_derivado: "4.4.90.52",
      nome_grupo: "Equipamentos",
      requires_natureza_review: true,
    },
  ];

  it("builds campus-scoped summary, monthly series and efisco coverage", () => {
    const result = buildDashboardBi({
      dfds,
      items,
      logs: [],
      unitNames: new Map([
        ["unit-1", "Administração"],
        ["unit-2", "Laboratório Central"],
      ]),
      now: new Date("2026-06-10T00:00:00.000Z"),
    });

    assert.equal(result.summary.totalDfds, 3);
    assert.equal(result.summary.plannedValue, 6000);
    assert.equal(result.summary.approvedValue, 3000);
    assert.equal(result.summary.collectiveDfds, 1);
    assert.equal(result.summary.efiscoCoveragePct, 50);
    assert.deepEqual(
      result.topCategories.map((row) => [row.name, row.items, row.codedItems, row.coveragePct]),
      [
        ["Equipamentos", 1, 0, 0],
        ["Consumo", 1, 1, 100],
      ],
    );
    assert.deepEqual(
      result.monthly.map((row) => [row.month, row.dfds]),
      [
        ["2026-05", 2],
        ["2026-06", 1],
      ],
    );
  });

  it("builds status flow, unit matrix and priority queue from the same rows", () => {
    const result = buildDashboardBi({
      dfds,
      items,
      logs: [],
      unitNames: new Map([
        ["unit-1", "Administração"],
        ["unit-2", "Laboratório Central"],
      ]),
      now: new Date("2026-06-10T00:00:00.000Z"),
    });

    assert.equal(result.flow.origins.collective, 1);
    assert.equal(result.flow.statuses.triagem, 1);
    assert.equal(result.units[0].name, "Administração");
    assert.equal(result.units[0].total, 2);
    assert.equal(result.priorities[0].id, "b");
  });

  it("derives lead time by status from status logs when available", () => {
    const result = buildDashboardBi({
      dfds,
      items,
      logs: [
        { dfd_id: "b", action: "triagem", created_at: "2026-05-12T00:00:00.000Z" },
        { dfd_id: "b", action: "aprovada", created_at: "2026-05-20T00:00:00.000Z" },
      ],
      unitNames: new Map(),
      now: new Date("2026-06-10T00:00:00.000Z"),
    });

    assert.equal(result.leadTimeByStage.find((row) => row.stage === "triagem")?.days, 8);
  });
});
