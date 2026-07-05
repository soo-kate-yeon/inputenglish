import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// SPEC-WEB-001 Phase 1, Task 1.3 (REQ-WEB-001-W1, EC-001-A) — new protected
// route prefixes (learning/billing/account) redirect unauthenticated users to
// /login instead of the legacy /home fallback. Additive only: existing /api
// passthrough, /auth, /, /home exemptions, and cookie refresh logic are
// unchanged (AC-NFR-3 regression guard).
const LOGIN_PROTECTED_PREFIXES = ["/learning", "/billing", "/account"];

// Public entry points a logged-out visitor must be able to reach directly —
// the middleware's legacy /home fallback (below) would otherwise redirect
// away from these before they ever render.
const PUBLIC_EXEMPT_PATHS = [
  "/login",
  "/onboarding",
  "/privacy",
  "/support",
  "/terms",
];

function isLoginProtectedPath(pathname: string): boolean {
  return LOGIN_PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isPublicExemptPath(pathname: string): boolean {
  return PUBLIC_EXEMPT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

// Single dispatch for "where does an unauthenticated user go for path X" —
// keeps the two redirect targets (new /login gate vs. the legacy /home
// fallback) as one ordered decision instead of two independently-maintained
// conditionals over the same pathname.
function unauthenticatedRedirectTarget(pathname: string): string | null {
  if (isLoginProtectedPath(pathname)) {
    return "/login";
  }
  if (
    !pathname.startsWith("/auth") &&
    pathname !== "/" &&
    pathname !== "/home" &&
    !isPublicExemptPath(pathname)
  ) {
    return "/home";
  }
  return null;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
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
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow API routes to be accessed without authentication
  if (request.nextUrl.pathname.startsWith("/api")) {
    return response;
  }

  if (!user) {
    const target = unauthenticatedRedirectTarget(request.nextUrl.pathname);
    if (target) {
      const url = request.nextUrl.clone();
      url.pathname = target;
      return NextResponse.redirect(url);
    }
  }

  return response;
}
