import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/server/auth";
import { loginWithPassword } from "@/lib/server/password-auth";

export const runtime = "nodejs";

function safeNext(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
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
  url.searchParams.set("next", safeNext(next));
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  const body = await readBody(request);
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const next = typeof body.next === "string" ? body.next : "/";

  const result = await loginWithPassword({ email, password });
  if (!result.ok) {
    return redirectToLogin(request, next, result.code === "config" ? "password_config" : "password");
  }

  const response = NextResponse.redirect(new URL(safeNext(next), appBaseUrl(request)), { status: 303 });
  response.cookies.set(SESSION_COOKIE, createSessionToken(result.session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
