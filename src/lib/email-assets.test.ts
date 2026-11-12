import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(process.cwd(), "public", "email");
const eventSlots = new Set([
  "dfd-sent-to-chefia", "dfd-consolidated", "coauthorship-opened", "coauthorship-closed",
  "contribution-submitted", "contribution-locked", "dfd-rejected-or-archived",
  "triage-conflict", "sla-reminder", "broadcast-announcement",
]);
const slots = [
  "welcome", "dfd-submitted", "dfd-approved", "dfd-returned", "dfd-status", "admin-summary",
  "dfd-sent-to-chefia", "dfd-consolidated", "coauthorship-opened", "coauthorship-closed",
  "contribution-submitted", "contribution-locked", "dfd-rejected-or-archived", "triage-conflict",
  "sla-reminder", "broadcast-announcement", "test", "generic",
];

describe("assets dos e-mails PERCATA", () => {
  it("mantém um PNG flat para cada modelo", () => {
    for (const slot of slots) {
      const file = path.join(root, eventSlots.has(slot) ? "events" : "", `${slot}.png`);
      assert.equal(existsSync(file), true, `asset ausente: ${file}`);
      assert.ok(statSync(file).size > 100_000, `asset vazio ou pequeno: ${file}`);
    }
  });
});
