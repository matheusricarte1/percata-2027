import { strict as assert } from "node:assert";
import { test } from "node:test";
import { correctionHistoryDetails } from "./dfd-correction-history";
test("administrative history preserves precise old prices, reasons and before/after values", () => {
  const output = correctionHistoryDetails(JSON.stringify({ reason: "Preço corrigido", before: { dfd: { valor_total_estimado: 5.941 }, items: [{ id: "a", quantidade: 1, valor_unitario_estimado: 5.941 }] }, after: { dfd: { valor_total_estimado: 11882 }, items: [{ id: "a", codigo_tce: "531980-3", quantidade: 2, valor_unitario_estimado: 5941 }] } }));
  assert.match(output, /Motivo: Preço corrigido/);
  assert.match(output, /quantidade: 1 → 2/);
  assert.match(output, /5,941/);
  assert.match(output, /5\.941,00/);
  assert.match(output, /Total da DFD/);
});
test("legacy history remains readable", () => assert.equal(correctionHistoryDetails("Alteração registrada"), "Alteração registrada"));
test("room history does not invent totals absent from the room snapshot", () => assert.doesNotMatch(correctionHistoryDetails(JSON.stringify({ before: { dfd: { title: "Sala" }, items: [] }, after: { dfd: { title: "Sala corrigida" }, items: [] }, reason: "Título corrigido" })), /NaN|Total da DFD/));
test("history identifies removals, additions and fiscal changes without losing the original code", () => {
  const output = correctionHistoryDetails(JSON.stringify({ reason: "Classificação corrigida", before: { items: [{ id: "a", codigo_tce: "OLD", gnd: "3.3.90.30", quantidade: 1, valor_unitario_estimado: 10 }, { id: "b", codigo_tce: "REMOVED", quantidade: 2, valor_unitario_estimado: 20 }] }, after: { items: [{ id: "a", codigo_tce: "NEW", gnd: "4.4.90.52", quantidade: 1, valor_unitario_estimado: 10 }, { id: "c", codigo_tce: "ADDED", quantidade: 3, valor_unitario_estimado: 30 }] }, removals: [{ id: "b", removalReason: "Não corresponde à necessidade" }] }));
  assert.match(output, /OLD → NEW/);
  assert.match(output, /3\.3\.90\.30 → 4\.4\.90\.52/);
  assert.match(output, /ADDED adicionado/);
  assert.match(output, /REMOVED excluído/);
  assert.match(output, /Não corresponde à necessidade/);
});
