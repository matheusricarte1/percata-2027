import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getHomeForRole, normalizeRole } from "@/lib/access";

const PUBLIC_PATHS = ["/", "/login", "/verificar-dfd", "/api/dfd/verify", "/api/dev/audit-login"];
const SOLICITANTE_PATHS = ["/minhas-dfds", "/nova-dfd", "/catalogo", "/historico", "/dfd"];

function isSolicitantePath(pathname: string): boolean {
  return SOLICITANTE_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isDfdDetailPath(pathname: string): boolean {
  return pathname === "/dfd" || pathname.startsWith("/dfd/");
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function isUpeEmail(email: string): boolean {
  return email.endsWith("@upe.br");
}

async function isAllowedLoginEmail(supabase: any, email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (isUpeEmail(normalized)) return true;

  const [profileRes, legacyRes, legacyMapRes] = await Promise.all([
    supabase.from("profiles").select("id").ilike("email", normalized).limit(1),
    supabase.from("legacy_user_directory").select("id").ilike("email", normalized).limit(1),
    supabase.from("legacy_user_profile_links").select("id").eq("legacy_email", normalized).limit(1),
  ]);

  const inProfiles = !profileRes.error && (profileRes.data || []).length > 0;
  const inLegacy = !legacyRes.error && (legacyRes.data || []).length > 0;
  const inLegacyMapping = !legacyMapRes.error && (legacyMapRes.data || []).length > 0;

  return inProfiles || inLegacy || inLegacyMapping;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as CookieOptions),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/auth/");
  const isOnboardingRoute = pathname === "/onboarding";
  const isPublicRoute = PUBLIC_PATHS.includes(pathname) || isAuthRoute;

  if (!user && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (user) {
    const email = normalizeEmail(user.email);
    const allowedLoginEmail = await isAllowedLoginEmail(supabase, email);
    if (!allowedLoginEmail) {
      try {
        await supabase.auth.signOut();
      } catch {}

      if (pathname !== "/auth/auth-code-error") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/auth/auth-code-error";
        redirectUrl.searchParams.set(
          "error",
          "Acesso restrito. Use e-mail @upe.br ou cadastro prévio na lista institucional.",
        );
        return NextResponse.redirect(redirectUrl);
      }

      return response;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, campus_id")
      .eq("id", user.id)
      .maybeSingle();

    const role = normalizeRole(profile?.role, user.email);
    const homeForRole = getHomeForRole(role);

    if (!profileError) {
      const needsOnboarding =
        (role === "solicitante" || role === "chefia" || role === "superadmin") && !profile?.campus_id;

      if (needsOnboarding && !isOnboardingRoute && !isAuthRoute) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/onboarding";
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }

      if (!needsOnboarding && isOnboardingRoute) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = homeForRole;
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }
    }

    if (pathname === "/" || pathname === "/login") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = profileError || !profile?.campus_id ? "/onboarding" : homeForRole;
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      if (role !== "admin" && role !== "superadmin") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = homeForRole;
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }
    }

    if (pathname === "/chefia" || pathname.startsWith("/chefia/") || pathname === "/triagem" || pathname.startsWith("/triagem/")) {
      if (role === "solicitante" || role === "admin") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = homeForRole;
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }
    }

    if (
      isSolicitantePath(pathname) &&
      !(
        role === "solicitante" ||
        role === "superadmin" ||
        (role === "admin" && isDfdDetailPath(pathname))
      )
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = homeForRole;
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
