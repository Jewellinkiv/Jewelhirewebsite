import { NextResponse } from "next/server";
import { jewelLinkStateCookieName, jewelLinkStateCookieSecure, randomState } from "@/lib/server/auth";
import { safeSameOriginPath } from "@/lib/server/safe-redirect";

const STATE_TTL_SECONDS = 5 * 60;

function clearState(response: NextResponse) {
  response.cookies.set(jewelLinkStateCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: jewelLinkStateCookieSecure(),
    path: "/",
    maxAge: 0,
  });
  return response;
}

function loginError(request: Request) {
  const login = new URL("/login", request.url);
  login.searchParams.set("error", "jewellink_config");
  return clearState(NextResponse.redirect(login, { headers: { "Cache-Control": "no-store" } }));
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
  const state = randomState();
  const destination = new URL("/integrations/jewelhire/launch", jewelLink);
  destination.searchParams.set("state", state);
  const returnTo = safeSameOriginPath(new URL(request.url).searchParams.get("next"));
  if (returnTo) destination.searchParams.set("returnTo", returnTo);
  const response = NextResponse.redirect(destination, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(jewelLinkStateCookieName(), state, {
    httpOnly: true,
    sameSite: "lax",
    secure: jewelLinkStateCookieSecure(),
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
  return response;
}
