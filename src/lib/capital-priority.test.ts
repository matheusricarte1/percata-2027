import assert from "node:assert/strict";
import test from "node:test";
import { calculateCapitalPriorities, type CapitalPriorityInput } from "./capital-priority";

const input = (key: string, campusId: string, unitKey: string, value: number): CapitalPriorityInput => ({
  key, campusId, unitKey, value,
  criticidadeLevel: 4, prioridadeLevel: 4, chefiaPareto: false, eligible: true,
});

test("capital uses campus isolation and is invariant to proportional currency scale", () => {
  const ouricuri = [1000, 1200, 1500, 1800, 2200, 25000].map((value, index) => input(`o${index}`, "ouricuri", "lab", value));
  const petrolina = [2000, 2400, 2800, 3200, 4000, 40000].map((value, index) => input(`p${index}`, "petrolina", "dept", value));
  const alone = calculateCapitalPriorities(ouricuri);
  const both = calculateCapitalPriorities([...ouricuri, ...petrolina]);
  assert.deepEqual(both.get("o5"), alone.get("o5"));
  const scaled = calculateCapitalPriorities(ouricuri.map((item) => ({ ...item, value: item.value * 10 })));
  assert.equal(scaled.get("o5")?.totalPenalty, alone.get("o5")?.totalPenalty);
});

test("small units do not receive a local penalty", () => {
  const portfolio = [1000, 1200, 1500, 1800, 2200, 25000].map((value, index) =>
    input(`i${index}`, "campus", index === 5 ? "single" : "other", value));
  const result = calculateCapitalPriorities(portfolio).get("i5");
  assert.equal(result?.status, "calculated");
  assert.equal(result?.unitIncrement, 0);
  assert.ok((result?.campusPenalty || 0) > 0);
});

test("Pareto is the chefia flag and missing classification remains pending", () => {
  const portfolio = [1000, 1200, 1500, 1800, 2200, 25000, 3000, 3200].map((value, index) => input(`i${index}`, "campus", "unit", value));
  portfolio[0].chefiaPareto = true;
  portfolio[1].criticidadeLevel = 0;
  portfolio[6].prioridadeLevel = 5;
  const result = calculateCapitalPriorities(portfolio);
  assert.equal(result.get("i0")?.paretoBonus, 28);
  assert.equal(result.get("i5")?.paretoBonus, 0);
  assert.equal(result.get("i1")?.status, "pending");
  assert.equal(result.get("i1")?.finalScore, undefined);
  assert.equal(result.get("i6")?.status, "pending");
});

test("local adjustment adds only excess local penalty and stays within the cap", () => {
  const portfolio = [100, 150, 200, 250, 300, 350, 400, 450, 500, 5000, 8000, 12000].map((value, index) =>
    input(`u${index}`, "campus", index < 10 ? "unit-a" : "unit-b", value));
  const result = calculateCapitalPriorities(portfolio);
  for (const score of result.values()) {
    if (score.status === "calculated") {
      assert.ok((score.unitIncrement || 0) >= 0 && (score.unitIncrement || 0) <= 28);
      assert.ok((score.totalPenalty || 0) <= 112);
      assert.ok((score.finalScore || 0) >= 0 && (score.finalScore || 0) <= 280);
    }
  }
});
