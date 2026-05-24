import { test, expect } from "./helpers/auth";

/**
 * Teste do autosave do wizard (Onda 3 / Patch e).
 *
 * Cenário central do bug original:
 *   1. Usuário monta DFD (preenche objeto + justificativa).
 *   2. Recarrega a aba (ou navega out e volta).
 *   3. Tudo deve estar preservado.
 *
 * Pré-requisito: E2E_TEST_USER_ID precisa ter pelo menos 1 item no carrinho
 * persistente (Zustand localStorage), OU o teste primeiro abre o catálogo
 * e adiciona um item.
 */

test.describe("nova-dfd autosave", () => {
  test("preserva formData após reload", async ({ authedPage: page }) => {
    // 1. Vai ao catálogo, adiciona 1 item ao carrinho.
    await page.goto("/catalogo");
    await page.waitForLoadState("networkidle");

    // O catálogo tem um campo de busca + cards com botão "Adicionar".
    // Estratégia robusta: aciona o primeiro botão "Adicionar" visível.
    const firstAddButton = page
      .getByRole("button", { name: /adicionar|incluir/i })
      .first();
    if (await firstAddButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstAddButton.click();
    } else {
      test.skip(
        true,
        "Catálogo sem itens renderizados; rode o seed antes do e2e.",
      );
    }

    // 2. Vai para nova-dfd.
    await page.goto("/nova-dfd");
    await page.waitForLoadState("networkidle");

    // Preenche o objeto da contratação (primeiro grupo).
    const objetoInput = page
      .getByLabel(/objeto da contrata[cç][aã]o/i)
      .first();
    await expect(objetoInput).toBeVisible({ timeout: 10_000 });
    const testValue = `Teste autosave ${Date.now()}`;
    await objetoInput.fill(testValue);

    // Aguarda debounce (1500ms) + margem para save server-side.
    await page.waitForTimeout(2_500);

    // 3. Reload.
    await page.reload();
    await page.waitForLoadState("networkidle");

    // 4. Assert: valor restaurado.
    const restoredInput = page
      .getByLabel(/objeto da contrata[cç][aã]o/i)
      .first();
    await expect(restoredInput).toBeVisible({ timeout: 10_000 });
    await expect(restoredInput).toHaveValue(testValue);
  });

  test("clear via finalize não é destrutivo no erro", async () => {
    // Garante que se o finalize falhar, o rascunho NÃO é apagado.
    // Isso é defesa contra "perdeu trabalho porque o save final deu 500".
    // Cobertura simplificada: confirma que após erro de finalize,
    // recarregar mantém o objeto preenchido.
    test.skip(
      true,
      "Cenário de erro requer injeção de falha no Supabase; cobrir em unit test do hook.",
    );
  });
});
