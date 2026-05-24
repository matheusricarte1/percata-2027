import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function extractFullName(metadata: Record<string, any> | undefined): string | null {
  const fullName = String(metadata?.full_name || metadata?.name || "").trim();
  if (fullName) return fullName;
  const given = String(metadata?.given_name || "").trim();
  const family = String(metadata?.family_name || "").trim();
  const joined = `${given} ${family}`.trim();
  return joined || null;
}

function extractAvatarUrl(metadata: Record<string, any> | undefined): string | null {
  const avatar = String(metadata?.avatar_url || metadata?.picture || "").trim();
  return avatar || null;
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

async function isEmailInSystemList(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string,
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const [profileCheck, legacyCheck, legacyMapCheck] = await Promise.all([
    supabase.from("profiles").select("id,is_active").ilike("email", normalized).limit(1),
    supabase
      .from("legacy_user_directory")
      .select("id")
      .ilike("email", normalized)
      .limit(1),
    supabase
      .from("legacy_user_profile_links")
      .select("id")
      .eq("legacy_email", normalized)
      .limit(1),
  ]);

  const inProfiles =
    !profileCheck.error && (profileCheck.data || []).some((row: any) => row.is_active !== false);
  const inLegacy = !legacyCheck.error && (legacyCheck.data || []).length > 0;
  const inLegacyMapping =
    !legacyMapCheck.error && (legacyMapCheck.data || []).length > 0;

  return inProfiles || inLegacy || inLegacyMapping;
}

async function syncProfileIdentity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | null,
  user: any,
) {
  const metadata = (user?.user_metadata || {}) as Record<string, any>;
  const payloadWithAvatar = {
    id: user.id,
    email: user.email ? String(user.email).toLowerCase() : null,
    full_name: extractFullName(metadata),
    avatar_url: extractAvatarUrl(metadata),
  };

  const { error } = await supabase
    .from("profiles")
    .upsert(payloadWithAvatar, { onConflict: "id" });

  // Backward compatibility: in case avatar_url column is not migrated yet
  if (error && /avatar_url/i.test(String(error.message || ""))) {
    const fallbackPayload = {
      id: user.id,
      email: user.email ? String(user.email).toLowerCase() : null,
      full_name: extractFullName(metadata),
    };
    const fallbackResult = await supabase.from("profiles").upsert(
      {
        ...fallbackPayload,
      },
      { onConflict: "id" },
    );
    if (!fallbackResult.error) return;
  } else if (!error) {
    return;
  }

  // Fallback path for stricter RLS scenarios: use service-role if available.
  if (supabaseAdmin) {
    const adminInsert = await supabaseAdmin
      .from("profiles")
      .upsert(payloadWithAvatar, { onConflict: "id" });
    if (!adminInsert.error) return;

    if (/avatar_url/i.test(String(adminInsert.error.message || ""))) {
      await supabaseAdmin.from("profiles").upsert(
        {
          id: user.id,
          email: user.email ? String(user.email).toLowerCase() : null,
          full_name: extractFullName(metadata),
        },
        { onConflict: "id" },
      );
    }
  }
}

function getRequestIp(request: Request): string | null {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-client-ip") ||
    null
  );
}

function isMissingLoginEventsTable(error: any): boolean {
  const text = String(error?.message || error || "").toLowerCase();
  return (
    text.includes("auth_login_events") &&
    (text.includes("schema cache") ||
      text.includes("could not find the table") ||
      text.includes("does not exist") ||
      text.includes("42p01"))
  );
}

async function logLoginEvent(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | null,
  user: any,
  request: Request,
) {
  if (!supabaseAdmin || !user?.id || !user?.email) return;

  const metadata = (user.user_metadata || {}) as Record<string, any>;
  const provider =
    String(
      user.app_metadata?.provider ||
        (Array.isArray(user.app_metadata?.providers)
          ? user.app_metadata.providers[0]
          : ""),
    ).trim() || null;

  const { error } = await supabaseAdmin.from("auth_login_events").insert({
    user_id: user.id,
    email: String(user.email || "").toLowerCase(),
    provider,
    full_name: extractFullName(metadata),
    avatar_url: extractAvatarUrl(metadata),
    ip_address: getRequestIp(request),
    user_agent: request.headers.get("user-agent"),
    metadata: {
      auth_provider: provider,
      app_metadata: user.app_metadata || {},
      aud: user.aud || null,
    },
    logged_at: new Date().toISOString(),
  });

  if (error && !isMissingLoginEventsTable(error)) {
    console.error("Falha ao registrar evento de login:", error.message || error);
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const code = searchParams.get("code");
  const callbackOrigin = origin;

  // Sanitização de `next` contra open redirect.
  // Aceitar APENAS caminhos relativos que não sejam protocol-relative.
  // Antes: `rawNext.startsWith("/") && !rawNext.startsWith("//")` deixava
  // passar `/\evil.com`, `/%2fevil.com`, e variações com backslash que
  // browsers normalizam para `//evil.com`.
  // Estratégia robusta: resolver contra o origin e exigir que continue
  // no mesmo origin; rejeitar qualquer protocolo, host ou backslash no path.
  function safeNextPath(raw: string | null): string {
    if (!raw) return "/dashboard";
    if (raw.length > 512) return "/dashboard";
    // Rejeitar protocolo absoluto, protocol-relative e backslash (Windows-style).
    if (!raw.startsWith("/")) return "/dashboard";
    if (raw.startsWith("//") || raw.startsWith("/\\")) return "/dashboard";
    if (/[\\\r\n\t]/.test(raw)) return "/dashboard";
    try {
      const resolved = new URL(raw, callbackOrigin);
      if (resolved.origin !== callbackOrigin) return "/dashboard";
      // Reconstruir explicitamente para descartar credenciais / host embutidos.
      return `${resolved.pathname}${resolved.search}${resolved.hash}` || "/dashboard";
    } catch {
      return "/dashboard";
    }
  }
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | null = null;
    try {
      supabaseAdmin = createSupabaseAdminClient();
    } catch {
      supabaseAdmin = null;
    }
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      try {
        const authUser = data?.user || (await supabase.auth.getUser()).data.user;
        const email = normalizeEmail(authUser?.email);

        if (!authUser || !email) {
          await supabase.auth.signOut();
          return NextResponse.redirect(
            `${callbackOrigin}/auth/auth-code-error?error=Conta%20Google%20sem%20e-mail%20válido.`,
          );
        }

        const isAllowed = await isEmailInSystemList(supabase, email);

        if (!isAllowed) {
          await supabase.auth.signOut();
          return NextResponse.redirect(
            `${callbackOrigin}/auth/auth-code-error?error=Acesso%20restrito.%20Solicite%20ativação%20prévia%20do%20seu%20usuário%20pela%20administração.`,
          );
        }

        if (authUser) {
          await syncProfileIdentity(supabase, supabaseAdmin, authUser);
          await logLoginEvent(supabaseAdmin, authUser, request);
        }
      } catch (syncError) {
        console.error("Falha ao sincronizar identidade do usuário:", syncError);
      }
      return NextResponse.redirect(`${callbackOrigin}${next}`);
    }
    // Se houve erro na troca do código, aí sim mostramos o erro
    return NextResponse.redirect(
      `${callbackOrigin}/auth/auth-code-error?error=${error.message}`,
    );
  }

  // Se não veio código, mas você tem o #access_token (visível ao navegador),
  // o dashboard vai conseguir te logar. Vamos tentar!
  return NextResponse.redirect(`${callbackOrigin}${next}`);
}
