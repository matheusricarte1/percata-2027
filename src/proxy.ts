import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canUseSolicitanteWorkspace,
  getHomeForRole,
  normalizeRole,
} from "@/lib/access";
import {
  ACCESS_DENIED_MESSAGE,
  getLoginAccessDecision,
  normalizeLoginEmail,
} from "@/lib/login-access";
import {
  ACCESS_LOCK_KEY,
  ACCESS_LOCK_PATH,
  normalizeAccessLock,
  shouldBlockForAccessLock,
} from "@/lib/system-access";

const PUBLIC_PATHS = [
  "/",
  "/login",
  ACCESS_LOCK_PATH,
  "/verificar-dfd",
  "/api/health",
  "/api/dfd/verify",
  "/api/dev/audit-login",
];
const SOLICITANTE_PATHS = ["/minhas-dfds", "/nova-dfd", "/catalogo", "/historico", "/dfd"];

function isSolicitantePath(pathname: string): boolean {
  return SOLICITANTE_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isDfdDetailPath(pathname: string): boolean {
  return pathname === "/dfd" || pathname.startsWith("/dfd/");
}

function isAccessLockBypassPath(pathname: string): boolean {
  return (
    pathname === ACCESS_LOCK_PATH ||
    pathname === "/login" ||
    pathname === "/api/health" ||
    pathname.startsWith("/auth/")
  );
}

async function loadAccessLock(supabase: any) {
  const { data, error } = await supabase
    .from("app_system_settings")
    .select("value")
    .eq("key", ACCESS_LOCK_KEY)
    .maybeSingle();

  if (error) return normalizeAccessLock(null);
  return normalizeAccessLock(data?.value);
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE!,
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
  const historicoSegments = pathname.split("/").filter(Boolean);
  if (
    historicoSegments[0] === "historico" &&
    historicoSegments.length === 2 &&
    historicoSegments[1] !== "codigo"
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/historico/codigo/${encodeURIComponent(
      historicoSegments[1],
    )}`;
    redirectUrl.search = search;
    return NextResponse.redirect(redirectUrl);
  }
  const isAuthRoute = pathname.startsWith("/auth/");
  const isOnboardingRoute = pathname === "/onboarding";
  const isPublicRoute = PUBLIC_PATHS.includes(pathname) || isAuthRoute;
  const preAuthAccessLock = await loadAccessLock(supabase);

  if (!user && preAuthAccessLock.enabled && !isAccessLockBypassPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: preAuthAccessLock.message, code: "GLOBAL_ACCESS_LOCK" },
        { status: 423 },
      );
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = ACCESS_LOCK_PATH;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (!user && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (user) {
    const email = normalizeLoginEmail(user.email);
    const loginAccess = await getLoginAccessDecision(supabase, email);
    if (!loginAccess.allowed) {
      try {
        await supabase.auth.signOut();
      } catch {}

      if (pathname !== "/auth/auth-code-error") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/auth/auth-code-error";
        redirectUrl.searchParams.set(
          "error",
          ACCESS_DENIED_MESSAGE,
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
    const accessLock = preAuthAccessLock;

    // Campus alone is not enough to complete the institutional context. The
    // onboarding flow requires at least one department; laboratories remain
    // optional. Keep this check server-side so a profile cannot bypass the
    // onboarding gate by having only `profiles.campus_id` populated.
    let hasDepartment = false;
    if (!profileError && (role === "solicitante" || role === "chefia" || role === "superadmin")) {
      const { data: departmentUnit, error: departmentError } = await supabase
        .from("user_units")
        .select("unit_id")
        .eq("user_id", user.id)
        .eq("unit_type", "departamento")
        .limit(1)
        .maybeSingle();

      hasDepartment = !departmentError && Boolean(departmentUnit?.unit_id);
    }

    if (shouldBlockForAccessLock(accessLock, role, pathname)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: accessLock.message, code: "GLOBAL_ACCESS_LOCK" },
          { status: 423 },
        );
      }

      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = ACCESS_LOCK_PATH;
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    if (!profileError) {
      const needsOnboarding =
        (role === "solicitante" || role === "chefia" || role === "superadmin") &&
        (!profile?.campus_id || !hasDepartment);

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
        canUseSolicitanteWorkspace(role) ||
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
