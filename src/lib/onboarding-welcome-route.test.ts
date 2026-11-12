import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const routePath = path.join(root, "src/app/api/onboarding/welcome/route.ts");
const onboardingPath = path.join(root, "src/app/(auth)/onboarding/page.tsx");

test("onboarding concluído solicita uma notificação de boas-vindas idempotente", () => {
  assert.equal(existsSync(routePath), true, "rota de boas-vindas ausente");
  const routeSource = readFileSync(routePath, "utf8");
  const onboardingSource = readFileSync(onboardingPath, "utf8");

  assert.match(routeSource, /buildOnboardingWelcomeNotification/);
  assert.match(routeSource, /\.eq\("title", "Seu acesso institucional está pronto"\)/);
  assert.match(routeSource, /alreadySent/);
  assert.match(onboardingSource, /fetch\("\/api\/onboarding\/welcome"/);
});
