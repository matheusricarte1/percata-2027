import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const routeSource = readFileSync(
  resolve(process.cwd(), "src/app/api/dfd/reassign-chefia/route.ts"),
  "utf8",
);

test("reencaminhamento de DFD é exclusivo do superadmin e protegido antes da avaliação", () => {
  assert.match(routeSource, /withAuthorizedRole\(\s*\["superadmin"\]/);
  assert.match(routeSource, /canSuperadminReassignDfd/);
  assert.match(routeSource, /dfd_logs/);
});
