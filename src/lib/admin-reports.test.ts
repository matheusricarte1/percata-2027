import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCsv,
  buildDfdItemDetailRows,
  buildDfdSheetRows,
  buildItemSheetRows,
  collectExportHeaders,
  FULL_EXPORT_PREFERRED_HEADERS,
  protectSpreadsheetCell,
  summarizeByKey,
} from "./admin-reports.ts";

describe("admin-reports", () => {
  it("protects spreadsheet exports from formula injection", () => {
    assert.equal(protectSpreadsheetCell("=IMPORTXML(\"x\")"), "'=IMPORTXML(\"x\")");
    assert.equal(protectSpreadsheetCell("+SUM(A1:A2)"), "'+SUM(A1:A2)");
    assert.equal(protectSpreadsheetCell("Texto normal"), "Texto normal");
  });

  it("builds quoted CSV with protected cells", () => {
    const csv = buildCsv([{ descricao: "=1+1", valor: 10 }], ["descricao", "valor"]);

    assert.match(csv, /"'=1\+1","10"/);
  });

  it("summarizes rows by key and value", () => {
    const result = summarizeByKey(
      [
        { gnd: "3.3.90.30", valor: 10 },
        { gnd: "3.3.90.30", valor: 15 },
        { gnd: "4.4.90.52", valor: 8 },
      ],
      (row) => row.gnd,
      (row) => row.valor,
    );

    assert.deepEqual(result[0], { chave: "3.3.90.30", quantidade: 2, valor: 25 });
  });

  it("builds dfd and item sheet rows with protocol context", () => {
    const dfds = [
      {
        id: "dfd-1",
        numero_protocolo: "P-1",
        objeto_contratacao: "@obj",
        campus_nome_relatorio: "Campus Teste",
      },
    ];
    const items = [
      {
        id: "item-1",
        dfd_id: "dfd-1",
        descricao: "-risco",
        quantidade: 2,
        valor_unitario_estimado: 5,
        justificativa_item: "Uso em sala.\nDistribuicao por usuario: Ana: 1; Bruno: 1",
      },
    ];

    assert.equal(buildDfdSheetRows(dfds)[0].objeto_relatorio, "'@obj");
    assert.equal(buildDfdSheetRows(dfds)[0].campus_relatorio, "Campus Teste");
    assert.equal(buildItemSheetRows(items, dfds)[0].protocolo_relatorio, "P-1");
    assert.equal(buildItemSheetRows(items, dfds)[0].valor_total_estimado_relatorio, 10);
    assert.equal(buildItemSheetRows(items, dfds)[0].descricao_relatorio, "'-risco");
    assert.equal(buildItemSheetRows(items, dfds)[0].distribuicao_usuarios_relatorio, "Ana: 1; Bruno: 1");
  });

  it("builds complete denormalized DFD item rows for CSV exports", () => {
    const rows = buildDfdItemDetailRows(
      [
        {
          id: "item-1",
          dfd_id: "dfd-1",
          codigo_tce: "123",
          descricao: "=risco",
          quantidade: 3,
          valor_unitario_estimado: 7,
          gnd_derivado: "3.3.90.30",
          codigo_natureza_despesa: "339030",
          justificativa_item: "Necessário.\nDistribuicao por usuario: Ana: 2; Bruno: 1",
          raw_extra: { origem: "teste" },
        },
      ],
      [
        {
          id: "dfd-1",
          numero_protocolo: "DFD-1",
          objeto_contratacao: "Objeto",
          status: "aprovada",
          campus_nome_relatorio: "Campus",
          unidade_nome_relatorio: "Setor",
          solicitante_nome_relatorio: "Pessoa",
          solicitante_email_relatorio: "pessoa@upe.br",
          planning_subsidies: {
            expectedResult: "Atender aulas práticas",
            constraints: "+depende de instalação",
          },
        },
      ],
    );

    assert.equal(rows[0].dataset, "item_dfd");
    assert.equal(rows[0].dfd_numero_protocolo, "DFD-1");
    assert.equal(rows[0].item_valor_total_estimado, 21);
    assert.equal(rows[0].item_descricao, "'=risco");
    assert.equal(rows[0].item_raw_extra, "{\"origem\":\"teste\"}");
    assert.equal(rows[0].item_gnd_derivado, "3.3.90.30");
    assert.equal(rows[0].item_codigo_natureza_despesa, "339030");
    assert.equal(rows[0].item_distribuicao_usuarios, "Ana: 2; Bruno: 1");
    assert.equal(rows[0].item_distribuicao_usuarios_total, 3);
    assert.match(String(rows[0].item_distribuicao_usuarios_json || ""), /"name":"Ana"/);
    assert.equal(rows[0].dfd_subsidio_etp_tr_resultado_esperado, "Atender aulas práticas");
    assert.equal(rows[0].dfd_subsidio_etp_tr_cuidados_restricoes, "'+depende de instalação");
    assert.match(String(rows[0].dfd_subsidios_etp_tr || ""), /Resultado esperado: Atender aulas práticas/);

    const headers = collectExportHeaders(rows, FULL_EXPORT_PREFERRED_HEADERS);
    assert(headers.indexOf("dataset") < headers.indexOf("item_descricao"));
    assert(headers.includes("dfd_subsidios_etp_tr"));
    assert(headers.includes("item_distribuicao_usuarios"));
    assert(headers.includes("item_raw_extra"));
  });

  it("keeps DFDs without items in complete CSV exports", () => {
    const rows = buildDfdItemDetailRows([], [
      {
        id: "dfd-vazia",
        numero_protocolo: "DFD-V",
        objeto_contratacao: "Sem item",
      },
    ]);

    assert.equal(rows[0].dataset, "dfd_sem_item");
    assert.equal(rows[0].dfd_id, "dfd-vazia");
    assert.equal(rows[0].dfd_objeto_contratacao, "Sem item");
  });
});

