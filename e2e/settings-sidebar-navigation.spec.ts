import { test, expect } from "./helpers/auth";

// Use a dedicated superadmin test account. Navigation is read-only; no user,
// preference, contribution or DFD is saved by this regression.
test("superadmin can leave embedded settings modules using the sidebar", async ({ authedPage: page }) => {
  await page.goto("/admin/configuracoes");
  await expect(page.getByRole("heading", { name: "Configurações do Sistema", exact: true })).toBeVisible();
  await expect(page.getByText("Modo Superadmin", { exact: true })).toBeVisible();

  for (const destination of [
    { name: "Catálogo", path: /\/catalogo(?:\?|$)/ },
    { name: "Todas as DFDs", path: /\/admin\/todas-dfds(?:\?|$)/ },
    { name: "Painel Unificado", path: /\/dashboard(?:\?|$)/ },
    { name: "Análise da Chefia", path: /\/triagem(?:\?|$)/ },
  ]) {
    await page.getByRole("tab", { name: /^usuários$/i }).click();
    await expect(page.getByRole("heading", { name: "Pessoas e Permissões", exact: true })).toBeVisible();
    await page.getByRole("link", { name: destination.name, exact: true }).click();
    await expect(page).toHaveURL(destination.path);
    await expect(page.getByRole("navigation", { name: /Navegação (principal|recolhida)/ })).toBeVisible();
    await expect(page.getByRole("heading").first()).toBeVisible();
    await page.getByRole("link", { name: "Configurações", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Configurações do Sistema", exact: true })).toBeVisible();
  }
});
