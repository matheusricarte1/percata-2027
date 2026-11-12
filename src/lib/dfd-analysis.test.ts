import assert from "node:assert/strict";
import test from "node:test";
import {
  analysisError,
  highlightLimit,
  describeChanges,
  getReviewBlocker,
  type AnalysisItem,
} from "./dfd-analysis.ts";

const item: AnalysisItem = {
  id: "one",
  descricao: "Mesa",
  quantidade: 2,
  valor_unitario_estimado: 10,
  criticidade: null,
  moscow_categoria: null,
  is_highlight_item: false,
};
test("database failure is never presented as missing DFD", () => {
  assert.equal(analysisError("DATABASE_ERROR").status, 500);
  assert.equal(analysisError("DFD_NOT_FOUND").status, 404);
  assert.doesNotMatch(
    analysisError("DATABASE_ERROR").message,
    /não encontrada/,
  );
});
test("priority remains undecided and last item removal has an actionable blocker", () => {
  assert.match(getReviewBlocker([item], "approve")!, /prioridade/);
  assert.match(
    getReviewBlocker(
      [{ ...item, remove: true, removalReason: "Duplicado" }],
      "apply",
    )!,
    /Devolva/,
  );
});
test("highlight cap is per DFD and does not require highlighting", () => {
  assert.equal(highlightLimit(6), 2);
  const ready = { ...item, criticidade: "media", moscow_categoria: "deve_ter" };
  assert.equal(getReviewBlocker([ready], "approve"), null);
  assert.match(
    getReviewBlocker(
      [
        ready,
        { ...ready, id: "two", is_highlight_item: true },
        { ...ready, id: "three", is_highlight_item: true },
      ],
      "approve",
    )!,
    /destaque/,
  );
});
test("review summary identifies the precise item, quantity, priority and reason", () => {
  const changes = describeChanges(
    [item],
    [{ ...item, quantidade: 3, moscow_categoria: "nao_tera_agora" }],
  );
  assert.match(changes.join("\n"), /Mesa.*2 → 3/);
  assert.match(changes.join("\n"), /Postergado/);
  assert.match(
    describeChanges(
      [item],
      [{ ...item, remove: true, removalReason: "Duplicado" }],
    ).join("\n"),
    /Mesa.*retirar.*Duplicado/,
  );
});
