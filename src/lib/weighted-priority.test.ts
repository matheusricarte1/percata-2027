import test from "node:test";
import assert from "node:assert/strict";
import { computeWeightedPriority } from "./weighted-priority";
test("restored weighted score matches previous default and independently weighted formulas", () => {
  assert.equal(computeWeightedPriority(4, 4, 999), 227);
  assert.equal(computeWeightedPriority(3, 2, 99, 2, 3), 60 + 48 + 48 + 2);
  assert.ok(computeWeightedPriority(4, 4, 10000) > computeWeightedPriority(4, 4, 1000));
});
