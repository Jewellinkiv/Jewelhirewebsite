import { NextResponse } from "next/server";
import { OAUTH_NEXT_COOKIE, OAUTH_STATE_COOKIE, randomState } from "@/lib/server/auth";

function appBaseUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

function safeNext(value: unknown) {
  if (typeof value !== "string") return "/";
  let decoded = "";
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return "/";
  }
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !decoded.includes("\\") ? value : "/";
}

export function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: { code: "oauth_not_configured", message: "GOOGLE_CLIENT_ID is not configured." } }, { status: 503 });
  }

  const url = new URL(request.url);
  const state = randomState();
  const next = url.searchParams.get("next") || "/";
  const redirectUri = `${appBaseUrl(request)}/api/auth/google/callback`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authUrl);
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(OAUTH_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 600 });
  response.cookies.set(OAUTH_NEXT_COOKIE, safeNext(next), { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 600 });
  return response;
}
