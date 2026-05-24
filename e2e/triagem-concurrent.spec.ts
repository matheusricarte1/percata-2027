import { test, expect } from "./helpers/auth";

/**
 * Teste de regressão para o lost update fix (Patch 1).
 *
 * Cenário original do bug:
 *   - Chefia A abre DFD em status="triagem".
 *   - Chefia B aprova a mesma DFD (status -> "aprovada").
 *   - Chefia A devolve. SEM o `.eq("status","triagem")` no UPDATE,
 *     a devolução sobrescrevia a aprovação silenciosamente.
 *
 * Como reproduzir em e2e: simulamos o passo do "outro usuário" via
 * service-role (atualizamos status diretamente no BD entre o load
 * da DFD e o clique de devolver), depois clicamos devolver e
 * esperamos toast de "já foi processada por outra chefia".
 *
 * Pré-requisito: ambiente com SUPABASE_SERVICE_ROLE_KEY + uma DFD
 * em triagem cujo `analysis_unidade_id` está vinculado ao test user
 * como chefia. O setup é feito via API/SQL antes do teste.
 */

test.describe("triagem concurrent updates", () => {
  test("detecta lost update e mostra toast de conflito", async ({
    authedPage: page,
  }) => {
    test.skip(
      !process.env.E2E_TRIAGEM_DFD_ID,
      "Defina E2E_TRIAGEM_DFD_ID com o id de uma DFD em status=triagem na unidade do test user.",
    );

    const dfdId = process.env.E2E_TRIAGEM_DFD_ID!;

    await page.goto("/triagem");
    await page.waitForLoadState("networkidle");

    // Abre a DFD específica do bug.
    // O componente renderiza linhas com data-dfd-id; clica na nossa.
    const row = page.locator(`[data-dfd-id="${dfdId}"]`);
    if (!(await row.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(
        true,
        `DFD ${dfdId} não visível na fila do test user. Verifique vínculo de chefia.`,
      );
    }
    await row.click();

    // Simula "outra chefia aprovou" usando a API service-role.
    // (Em CI, um script setup faz isso via SQL direto.)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    await fetch(
      `${supabaseUrl}/rest/v1/dfds?id=eq.${dfdId}`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ status: "aprovada" }),
      },
    );

    // Tenta devolver — espera erro de conflito.
    const devolverBtn = page.getByRole("button", { name: /devolver/i });
    if (await devolverBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Preenche motivo (devolução exige comentário).
      const motivo = page.getByPlaceholder(/motivo|coment/i).first();
      if (await motivo.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await motivo.fill("Teste de conflito concorrente");
      }
      await devolverBtn.click();
    }

    // Toast esperado (sonner): "já foi processada por outra chefia".
    await expect(
      page.getByText(/processada por outra chefia|mudou de status/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});
