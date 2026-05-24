import { test as base, type BrowserContext, type Page } from "@playwright/test";

/**
 * Helper de autenticação para testes e2e.
 *
 * Estratégia:
 *   - Se `E2E_TEST_USER_ID` e `E2E_SUPABASE_ACCESS_TOKEN` estão setados,
 *     injeta diretamente o cookie de sessão do Supabase. Não passa pelo
 *     fluxo OAuth/magic link (que é interativo).
 *   - Caso contrário, o teste é pulado com mensagem clara.
 *
 * Como gerar o token:
 *   1. No Supabase Studio, crie um usuário test (ex.: e2e@upe.br) e
 *      garanta que ele está na allowlist (profiles row + role).
 *   2. Use service_role para gerar JWT:
 *        const { data } = await adminClient.auth.admin.generateLink({
 *          type: "magiclink",
 *          email: "e2e@upe.br",
 *        });
 *      A URL contém ?access_token=... que serve para popular o cookie.
 *   3. Ou, mais simples: rode `npx supabase login` + `supabase functions invoke`
 *      um script que devolve `access_token` + `refresh_token` JSON.
 */

export type AuthedFixtures = {
  authedPage: Page;
};

/* eslint-disable react-hooks/rules-of-hooks --
 * O callback `use` de fixtures do Playwright é homônimo do `use()` de React
 * (introduzido em React 19). Não é um hook React — é a API oficial de
 * Playwright para injetar fixtures. Desabilitamos a regra no arquivo todo. */

export const test = base.extend<AuthedFixtures>({
  authedPage: async ({ context, baseURL }, use) => {
    const accessToken = process.env.E2E_SUPABASE_ACCESS_TOKEN;
    const refreshToken = process.env.E2E_SUPABASE_REFRESH_TOKEN || "";
    const projectRef = process.env.E2E_SUPABASE_PROJECT_REF;

    if (!accessToken || !projectRef) {
      base.skip(
        true,
        "Para testes autenticados, defina E2E_SUPABASE_ACCESS_TOKEN, " +
          "E2E_SUPABASE_REFRESH_TOKEN e E2E_SUPABASE_PROJECT_REF. " +
          "Veja e2e/helpers/auth.ts.",
      );
    }

    await injectSupabaseSession(context, {
      baseURL: baseURL!,
      projectRef: projectRef!,
      accessToken: accessToken!,
      refreshToken,
    });

    const page = await context.newPage();
    await use(page);
    await page.close();
  },
});

export const expect = test.expect;

export async function injectSupabaseSession(
  context: BrowserContext,
  params: {
    baseURL: string;
    projectRef: string;
    accessToken: string;
    refreshToken: string;
  },
) {
  // Supabase SSR usa o cookie nomeado `sb-<projectRef>-auth-token` contendo
  // JSON URL-encoded com { access_token, refresh_token, ... }.
  const cookieName = `sb-${params.projectRef}-auth-token`;
  const payload = JSON.stringify({
    access_token: params.accessToken,
    refresh_token: params.refreshToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });

  const url = new URL(params.baseURL);
  await context.addCookies([
    {
      name: cookieName,
      value: encodeURIComponent(`base64-${Buffer.from(payload).toString("base64")}`),
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ]);
}
