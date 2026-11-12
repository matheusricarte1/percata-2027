import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDfdPrintExportCsv } from "./dfd-print-export.ts";

describe("dfd-print-export", () => {
  it("exports DFD metadata and items as downloadable CSV content", () => {
    const csv = buildDfdPrintExportCsv({
      protocolo: "DFD-2026-001",
      data: "06/05/2026",
      status: "homologada",
      solicitante: "Maria Silva",
      email: "maria@upe.br",
      setor: "Biblioteca",
      campus: "Ouricuri",
      objeto: "Aquisição de material",
      justificativa: "Reposição de estoque",
      gnd: "3.3.90.30",
      itens: [
        {
          cod: "123",
          desc: "Papel A4",
          qtd: 10,
          un: "RESMA",
          valor: 25,
        },
      ],
    });

    assert.match(csv, /"DFD-2026-001"/);
    assert.match(csv, /"Papel A4"/);
    assert.match(csv, /"250.00"/);
  });

  it("exports planning subsidies as readable metadata rows", () => {
    const csv = buildDfdPrintExportCsv({
      protocolo: "DFD-2026-003",
      data: "",
      status: "",
      solicitante: "",
      email: "",
      setor: "",
      campus: "",
      objeto: "",
      justificativa: "",
      gnd: "",
      planning_subsidies: {
        expectedResult: "Reduzir retrabalho no laboratório",
        constraints: "=depende de adequação elétrica",
      },
      itens: [],
    });

    assert.match(csv, /"Informações de planejamento - Resultado esperado"/);
    assert.match(csv, /"Reduzir retrabalho no laboratório"/);
    assert.match(csv, /"Informações de planejamento - Cuidados ou restrições"/);
    assert.match(csv, /"'=depende de adequação elétrica"/);
  });

  it("protects exported cells from spreadsheet formula injection", () => {
    const csv = buildDfdPrintExportCsv({
      protocolo: "DFD-2026-002",
      data: "",
      status: "",
      solicitante: "",
      email: "",
      setor: "",
      campus: "",
      objeto: '=HYPERLINK("http://bad")',
      justificativa: "",
      gnd: "",
      itens: [],
    });

    assert.match(csv, /"'=HYPERLINK/);
  });

  it("exports collective authors and item-level distribution details", () => {
    const csv = buildDfdPrintExportCsv({
      protocolo: "DFD-COLETIVA-1",
      data: "",
      status: "",
      solicitante: "",
      email: "",
      setor: "",
      campus: "",
      objeto: "",
      justificativa: "",
      gnd: "3.3.90.30",
      origem: "DFD coletiva convertida",
      sala_coletiva: "Sala de TI",
      coautores: "Ana (qtd 2); Bruno (qtd 1)",
      coautores_detalhados: [
        {
          nome: "Ana",
          email: "ana@upe.br",
          quantidade_total: 2,
          valor_total_estimado: 300,
        },
      ],
      itens: [
        {
          cod: "244683-9",
          desc: "Trava de segurança para notebook",
          qtd: 3,
          un: "UN",
          valor: 100,
          gnd: "3.3.90.30",
          natureza: "339030",
          local_uso: "Biblioteca",
          justificativa_item: "Reposição",
          distribuicao_usuarios: "Ana: 2; Bruno: 1",
          distribuicao_usuarios_json: JSON.stringify([
            { name: "Ana", quantidade: 2 },
            { name: "Bruno", quantidade: 1 },
          ]),
        },
      ],
    });

    assert.match(csv, /"COAUTOR","coautor_1","Ana"/);
    assert.match(csv, /"ana@upe.br"/);
    assert.match(csv, /"Ana: 2; Bruno: 1"/);
    assert.match(csv, /"339030"/);
    assert.match(csv, /"Biblioteca"/);
  });
});
