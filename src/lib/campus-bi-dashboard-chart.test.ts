import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("CampusBiDashboard chart containers", () => {
  it("sets minimum dimensions on every Recharts ResponsiveContainer", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "components", "dashboard", "CampusBiDashboard.tsx"),
      "utf8",
    );
    const containers = source.match(/<ResponsiveContainer\b[^>]*>/g) || [];

    assert.ok(containers.length > 0, "Expected chart containers in CampusBiDashboard");
    for (const container of containers) {
      assert.match(container, /\bminWidth=/, container);
      assert.match(container, /\bminHeight=/, container);
    }
  });
});
