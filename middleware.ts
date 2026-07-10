import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "jewelhire_session";

function requiresAuth() {
  if (process.env.JEWELHIRE_REQUIRE_AUTH === "0") return false;
  return process.env.JEWELHIRE_REQUIRE_AUTH === "1" || process.env.AUTH_MODE === "google";
}

function sessionOverrideEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.JEWELHIRE_ENABLE_SESSION_OVERRIDE === "1";
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/signup/") ||
    pathname === "/claim-account" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/jewelcert/claim/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/stripe/webhook" ||
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/careers/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname === "/robots.txt"
  );
}

export function middleware(request: NextRequest) {
  if (!requiresAuth() || isPublicPath(request.nextUrl.pathname)) return NextResponse.next();
  if (sessionOverrideEnabled() && request.headers.has("x-jewelhire-session")) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

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
