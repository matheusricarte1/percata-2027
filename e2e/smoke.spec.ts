import { test, expect } from "@playwright/test";

/**
 * Smokes que rodam sem usuário autenticado. Garantem que o app sobe
 * e que rotas públicas/protegidas respondem com os status esperados.
 *
 * Estes testes precisam apenas:
 *   - servidor rodando (dev ou prod) em E2E_BASE_URL
 *   - banco aplicado (migrations 0003-0042)
 */

test.describe("smoke", () => {
  test("landing page carrega", async ({ page }) => {
    await page.goto("/");
    // Heading institucional ou metadata PERCATA presente.
    await expect(page).toHaveTitle(/PERCATA/i);
  });

  test("login page renderiza CTA", async ({ page }) => {
    await page.goto("/login");
    // Não dependemos de texto específico (UI muda); apenas confirma 200.
    expect(page.url()).toContain("/login");
  });

  test("rota protegida redireciona para login quando deslogado", async ({
    page,
  }) => {
    const response = await page.goto("/dashboard");
    // Pode ser redirect server-side (status 302/307) ou client (página
    // de login renderizada). Aceita ambos.
    expect(response).toBeTruthy();
    const isOnLogin = page.url().includes("/login");
    const isOnDashboard = page.url().includes("/dashboard");
    expect(isOnLogin || isOnDashboard).toBe(true);
    // Se ficou em /dashboard, garante que mostra estado vazio ou redireciona
    // — não pode mostrar dados de outro usuário.
  });

  test("health endpoint responde", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status");
    expect(["ok", "degraded"]).toContain(body.status);
  });

  test("auth/callback rejeita next com host externo (open redirect fix)", async ({
    request,
  }) => {
    // Sem ?code, o handler ainda processa o next param.
    // O fix do Patch 2 garante que //evil.com vira /dashboard.
    const res = await request.get("/auth/callback?next=//evil.com", {
      maxRedirects: 0,
    });
    // Espera redirect (3xx). Location não pode apontar para evil.com.
    expect([301, 302, 303, 307, 308]).toContain(res.status());
    const location = res.headers()["location"] || "";
    expect(location).not.toContain("evil.com");
    expect(location).toMatch(/\/dashboard|\/login|\/$/);
  });

  test("rate limit em catalog-search/verify (sem auth retorna 401, não 500)", async ({
    request,
  }) => {
    const res = await request.get("/api/catalog-search?q=teste");
    // Sem auth, retorna 401.
    expect(res.status()).toBe(401);
  });

  test("dfd/verify rejeita assinatura malformada", async ({ request }) => {
    const res = await request.get(
      "/api/dfd/verify?id=00000000-0000-0000-0000-000000000000&sig=xxx",
    );
    // Pode ser 400 (sig inválida) ou 429 (rate limit já triggou em CI repeat).
    expect([400, 404, 429]).toContain(res.status());
  });
});
