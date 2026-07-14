import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/server/auth";
import { loginWithPassword } from "@/lib/server/password-auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";
import type { AuthSession } from "@/lib/server/auth";
import { safeSameOriginPathOrRoot } from "@/lib/server/safe-redirect";

export const runtime = "nodejs";

function destinationForSession(next: string, session: AuthSession) {
  const safe = safeSameOriginPathOrRoot(next);
  if (safe !== "/") return safe;
  if (session.role === "admin") return "/admin";
  if (session.role === "associate") return "/portal";
  return "/";
}

function appBaseUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

async function readBody(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await request.json().catch(() => null)) || {};
  }
  const form = await request.formData().catch(() => null);
  return Object.fromEntries(form?.entries() || []);
}

function redirectToLogin(request: Request, next: string, error: string) {
  const url = new URL("/login", appBaseUrl(request));
  url.searchParams.set("next", safeSameOriginPathOrRoot(next));
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  const body = await readBody(request);
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const next = typeof body.next === "string" ? body.next : "/";

  // Throttle password attempts per IP to blunt brute forcing. On limit, bounce
  // back to the login form with a generic error rather than a raw 429.
  const throttle = await rateLimit(`login:${clientIp(request)}`, 20, 900);
  if (!throttle.ok) {
    return redirectToLogin(request, next, "too_many");
  }

  const result = await loginWithPassword({ email, password });
  if (!result.ok) {
    const error = result.code === "config"
      ? "password_config"
      : result.code === "jewellink_required"
        ? "jewellink_required"
        : "password";
    return redirectToLogin(request, next, error);
  }

  const response = NextResponse.redirect(new URL(destinationForSession(next, result.session), appBaseUrl(request)), { status: 303 });
  setSessionCookie(response, result.session);
  return response;
}
