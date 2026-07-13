import { NextResponse } from "next/server";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : undefined;
}

function loginError(request: Request) {
  const login = new URL("/login", request.url);
  login.searchParams.set("error", "jewellink_config");
  return NextResponse.redirect(login, { headers: { "Cache-Control": "no-store" } });
}

export function GET(request: Request) {
  const raw = process.env.JEWELLINK_URL?.trim();
  if (!raw) return loginError(request);
  let jewelLink: URL;
  try {
    jewelLink = new URL(raw);
  } catch {
    return loginError(request);
  }
  if (process.env.NODE_ENV === "production" && jewelLink.protocol !== "https:") return loginError(request);
  const destination = new URL("/api/integrations/jewelhire/sso/start", jewelLink);
  const returnTo = safeNext(new URL(request.url).searchParams.get("next"));
  if (returnTo) destination.searchParams.set("returnTo", returnTo);
  return NextResponse.redirect(destination, { headers: { "Cache-Control": "no-store" } });
}
