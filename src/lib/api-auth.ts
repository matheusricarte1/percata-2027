import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminCredentials,
} from "@/lib/supabase-admin";
import { normalizeRole, type UserRole } from "@/lib/access";
import { captureError } from "@/lib/observability";

/**
 * Autorização canônica para Route Handlers da API.
 *
 * Antes deste wrapper, cada rota repetia (com variações sutis):
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *   if (!user) return 401;
 *   const { data: profile } = await supabase.from("profiles").select("role")...
 *   const role = normalizeRole(profile?.role, user.email);
 *   if (role !== "admin" && role !== "superadmin") return 403;
 *
 * Cada cópia é uma chance de bug autorizacional. Este módulo centraliza.
 *
 * Uso:
 *
 *   export const POST = withAuthorizedRole(
 *     ["admin", "superadmin"],
 *     async ({ request, supabase, supabaseAdmin, user, role }) => {
 *       // lógica da rota
 *       return NextResponse.json({ ok: true });
 *     },
 *     { requireAdminClient: true }
 *   );
 */

export type AuthorizedContext = {
  request: NextRequest;
  user: NonNullable<Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>["auth"]["getUser"]>>["data"]["user"]>;
  role: UserRole;
  supabase: Awaited<ReturnType<typeof createClient>>;
  /**
   * Cliente service-role. Só presente quando `requireAdminClient: true`
   * e as credenciais estão configuradas. Em ambiente sem credenciais, a rota
   * é abortada com 503 antes mesmo do handler rodar.
   */
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | null;
};

export type AuthorizedHandler<TParams = unknown> = (
  ctx: AuthorizedContext,
  routeParams: TParams,
) => Promise<NextResponse> | NextResponse;

export type WithAuthorizedRoleOptions = {
  /**
   * Quando true, instancia o supabaseAdmin (service-role). Se as credenciais
   * de admin não estiverem configuradas, retorna 503 antes do handler.
   */
  requireAdminClient?: boolean;
  /**
   * Mensagem customizada de 403. Default: "Acesso negado."
   */
  forbiddenMessage?: string;
};

export function withAuthorizedRole<TParams = unknown>(
  allowedRoles: readonly UserRole[],
  handler: AuthorizedHandler<TParams>,
  options: WithAuthorizedRoleOptions = {},
) {
  const allowed = new Set<UserRole>(allowedRoles);

  return async function authorizedRoute(
    request: NextRequest,
    routeCtx?: { params: Promise<TParams> | TParams },
  ): Promise<NextResponse> {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { error: "Usuário não autenticado." },
          { status: 401 },
        );
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        // Falha em ler profile não deve revelar detalhes ao cliente.
        void captureError(profileError, {
          source: "withAuthorizedRole.profileLookup",
          userId: user.id,
        });
        return NextResponse.json(
          { error: "Não foi possível verificar suas credenciais." },
          { status: 500 },
        );
      }

      const role = normalizeRole(profile?.role, user.email);

      if (!allowed.has(role)) {
        return NextResponse.json(
          { error: options.forbiddenMessage || "Acesso negado." },
          { status: 403 },
        );
      }

      let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | null =
        null;
      if (options.requireAdminClient) {
        if (!hasSupabaseAdminCredentials()) {
          return NextResponse.json(
            {
              error:
                "Credenciais administrativas do Supabase não configuradas.",
            },
            { status: 503 },
          );
        }
        try {
          supabaseAdmin = createSupabaseAdminClient();
        } catch (err: any) {
          void captureError(err, {
            source: "withAuthorizedRole.adminInit",
          });
          return NextResponse.json(
            { error: "Falha ao inicializar cliente administrativo." },
            { status: 503 },
          );
        }
      }

      const params = routeCtx?.params
        ? ((await Promise.resolve(routeCtx.params)) as TParams)
        : ({} as TParams);

      return await handler(
        { request, user, role, supabase, supabaseAdmin },
        params,
      );
    } catch (error: any) {
      void captureError(error, {
        source: "withAuthorizedRole.handler",
        path: request.nextUrl.pathname,
      });
      return NextResponse.json(
        { error: error?.message || "Erro interno." },
        { status: 500 },
      );
    }
  };
}
