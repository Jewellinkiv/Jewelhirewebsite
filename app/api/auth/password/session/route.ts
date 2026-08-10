import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/server/auth";
import { loginWithPassword } from "@/lib/server/password-auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";
import type { AuthSession } from "@/lib/server/auth";
import { safeSameOriginPathOrRoot } from "@/lib/server/safe-redirect";

export const runtime = "nodejs";

const MAX_LOGIN_BODY_BYTES = 16_384;
const MAX_LOGIN_EMAIL_LENGTH = 254;
const MAX_LOGIN_PASSWORD_LENGTH = 1_024;
const MAX_LOGIN_NEXT_LENGTH = 2_048;

function destinationForSession(next: string, session: AuthSession) {
  const safe = safeSameOriginPathOrRoot(next);
  if (safe !== "/") return safe;
  if (session.role === "admin") return "/admin";
  if (session.role === "associate") return "/portal";
  return "/dashboard";
}

function appBaseUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

async function readBoundedText(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_LOGIN_BODY_BYTES) {
    return "";
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_LOGIN_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return "";
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return "";
  }
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") || "";
  const text = await readBoundedText(request);
  if (!text) return {};
  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  return {};
}

function redirectToLogin(request: Request, next: string, error: string) {
  const url = new URL("/login", appBaseUrl(request));
  url.searchParams.set("next", safeSameOriginPathOrRoot(next));
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  // Throttle password attempts per IP to blunt brute forcing. On limit, bounce
  // back to the login form with a generic error rather than a raw 429. This
  // check deliberately happens before reading the attacker-controlled body.
  const throttle = await rateLimit(`login:${clientIp(request)}`, 20, 900);
  if (!throttle.ok) {
    return redirectToLogin(request, "/dashboard", "too_many");
  }

  const body = await readBody(request);
  const email = typeof body.email === "string" && body.email.length <= MAX_LOGIN_EMAIL_LENGTH
    ? body.email
    : "";
  const password = typeof body.password === "string" && body.password.length <= MAX_LOGIN_PASSWORD_LENGTH
    ? body.password
    : "";
  const next = typeof body.next === "string" && body.next.length <= MAX_LOGIN_NEXT_LENGTH
    ? body.next
    : "/dashboard";

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
