import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "jewelhire_session";
const DEV_DEMO_ROLE_COOKIE = "jewelhire_dev_demo_role";
const DEV_DEMO_ROLES = new Set(["sissys", "harbor", "applicant", "admin", "manager", "manager_limited"]);

function requiresAuth() {
  if (process.env.JEWELHIRE_REQUIRE_AUTH === "0") return false;
  return process.env.JEWELHIRE_REQUIRE_AUTH === "1" || process.env.AUTH_MODE === "google";
}

function sessionOverrideEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.JEWELHIRE_ENABLE_SESSION_OVERRIDE === "1";
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/signup/") ||
    pathname === "/claim-account" ||
    pathname === "/verify-email" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname.startsWith("/jewelcert/claim/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/integrations/jewellink/") ||
    pathname === "/api/stripe/webhook" ||
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/careers/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname === "/robots.txt"
  );
}

// Local visual QA can switch among the seeded role fixtures without creating
// accounts or sending credentials through the browser. The selector is not
// read in production, and the cookie only controls the existing dev-only
// x-jewelhire-session override.
function localDemoRole(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return "";
  const requested = request.nextUrl.searchParams.get("__demo_role")?.trim().toLowerCase();
  const remembered = request.cookies.get(DEV_DEMO_ROLE_COOKIE)?.value?.trim().toLowerCase();
  const role = requested || remembered || "";
  return DEV_DEMO_ROLES.has(role) ? role : "";
}

function nextWithLocalDemoRole(request: NextRequest) {
  const role = localDemoRole(request);
  const requestHeaders = new Headers(request.headers);
  if (role) requestHeaders.set("x-jewelhire-session", role);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (process.env.NODE_ENV !== "production" && request.nextUrl.searchParams.has("__demo_role") && role) {
    response.cookies.set(DEV_DEMO_ROLE_COOKIE, role, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
  }
  return response;
}

export function proxy(request: NextRequest) {
  const next = nextWithLocalDemoRole(request);
  if (!requiresAuth() || isPublicPath(request.nextUrl.pathname)) return next;
  if (sessionOverrideEnabled() && (request.headers.has("x-jewelhire-session") || localDemoRole(request))) return next;
  if (request.cookies.has(SESSION_COOKIE)) return next;

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
