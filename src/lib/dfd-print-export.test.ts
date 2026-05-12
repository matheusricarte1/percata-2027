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
});
