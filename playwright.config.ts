import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração de testes e2e do PERCATA.
 *
 * Para rodar localmente:
 *   npm install --save-dev @playwright/test
 *   npx playwright install --with-deps chromium
 *   npx playwright test
 *
 * Em CI: workflow .github/workflows/ci.yml roda automaticamente.
 *
 * Os testes consomem 2 variáveis de ambiente além das do app:
 *   - E2E_BASE_URL:    default http://localhost:3000
 *   - E2E_TEST_USER_ID: UUID de usuário pré-criado no Supabase de staging
 *                       com role=solicitante. Sem isso, os testes que
 *                       dependem de sessão autenticada usam `test.skip`.
 *   - E2E_SUPABASE_ACCESS_TOKEN: token JWT do test user (gerado offline
 *                                via auth.admin.generateLink ou similar).
 *
 * Por que não criar usuário no setup: o magic link OAuth requer interação
 * humana. Para CI, geramos JWT diretamente pelo service-role e injetamos
 * como cookie supabase-auth-token via `storageState`.
 */

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // muitos testes mutam BD; serializar para reproduzir
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["list"],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
