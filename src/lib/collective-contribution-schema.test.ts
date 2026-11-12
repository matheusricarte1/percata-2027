import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function collectiveContributionMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
    .join("\n");
}

describe("collective contribution schema", () => {
  it("persists fiscal metadata required when converting rooms into official DFDs", () => {
    const sql = collectiveContributionMigrations();
    const requiredColumns = [
      "efisco_item_id",
      "efisco_item_natureza_id",
      "natureza_count",
      "has_mixed_expense_classes",
      "has_missing_natureza",
      "requires_natureza_review",
    ];

    const contributionAlterStatements =
      sql.match(/ALTER TABLE public\.dfd_collective_contributions[\s\S]*?;/gi) || [];
    const contributionAlterSql = contributionAlterStatements.join("\n");

    for (const column of requiredColumns) {
      assert.match(
        contributionAlterSql,
        new RegExp(`\\b${column}\\b`, "i"),
        `Missing dfd_collective_contributions.${column}`,
      );
    }
  });
});
