import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const routeSource = readFileSync(
  path.join(process.cwd(), "src/app/api/catalog-search/route.ts"),
  "utf8",
);

test("catalog search route does not reuse the first RPC window for later pages", () => {
  assert.match(
    routeSource,
    /if \(offset > 0\)[\s\S]*searchCatalogWithSqlFallback\([\s\S]*limit[\s\S]*offset[\s\S]*source: "supabase-v2-sql-fallback-offset"/,
  );
  assert.doesNotMatch(routeSource, /if \(pagedRows\.length > 0\)/);
});

test("catalog search route blocks sensitive armament queries before search providers", () => {
  assert.match(routeSource, /isArmamentRelatedCatalogQuery\(query\)[\s\S]*blocked-sensitive-catalog-query/);
  assert.ok(
    routeSource.indexOf("isArmamentRelatedCatalogQuery(query)") <
      routeSource.indexOf("const typesenseRows = await searchCatalogWithTypesense"),
  );
});

test("catalog initial listing scans past blocked rows to fill visible material pages", () => {
  assert.match(routeSource, /const rawChunkSize = 200/);
  assert.match(routeSource, /while \(rows\.length < safeLimit[\s\S]*filterArmamentRelatedCatalogRows\(chunk\)/);
  assert.match(routeSource, /hasMore: initialPage\.hasMore/);
});
