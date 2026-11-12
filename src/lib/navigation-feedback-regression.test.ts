import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const providersSource = readFileSync(
  path.join(process.cwd(), "src/components/providers/AppProviders.tsx"),
  "utf8",
);

test("providers do not install a global click interceptor for navigation feedback", () => {
  assert.doesNotMatch(
    providersSource,
    /import\s+\{\s*NavigationFeedback\s*\}\s+from/,
    "A global navigation feedback listener must not run in the provider tree because it can swallow App Router link navigation.",
  );
  assert.doesNotMatch(
    providersSource,
    /<NavigationFeedback\s*\/>/,
  );
});
