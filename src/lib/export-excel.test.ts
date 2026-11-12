import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildWorkbookBuffer } from "./export-excel";

test("generated XLSX reopens with exact numeric totals, protected cells, filters and frozen headings",async()=>{
  const buffer=await buildWorkbookBuffer([{name:"Consolidação",rows:[
    {codigo:"123",descricao:"=HYPERLINK(\"https://example.com\")\u0001",score:347.37,valor:100.25},
    {codigo:"124",descricao:"Texto íntegro",score:244.44,valor:200.5},
  ]},{name:"Contexto",rows:[{campus:"Ouricuri",simulacao:"SIM"}]}]);
  const workbook=new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
  const sheet=workbook.worksheets[0];
  assert.equal(sheet.rowCount,3); assert.equal(sheet.getCell("C2").value,347.37);
  assert.equal(Number(sheet.getCell("D2").value)+Number(sheet.getCell("D3").value),300.75);
  assert.equal(sheet.getCell("B2").value,"'=HYPERLINK(\"https://example.com\")");
  assert.equal(sheet.views[0].state,"frozen"); assert.ok(sheet.autoFilter);
  assert.equal(workbook.getWorksheet("Contexto")?.getCell("A2").value,"Ouricuri");
});
