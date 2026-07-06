import { NextResponse } from "next/server";
import { consumeActionToken, invalidateActionTokens, isActionTokenValid } from "@/lib/server/action-tokens";
import { isStrongPassword, setPassword } from "@/lib/server/password-auth";
import { findSessionForGoogleUser, setSessionCookie } from "@/lib/server/auth";

export const runtime = "nodejs";

function nextForRole(role?: string) {
  if (role === "associate") return "/portal";
  if (role === "admin") return "/admin";
  return "/";
}

// GET: lightweight preview to tell the claim page whether the token is still
// valid, WITHOUT consuming it. POST performs the one-shot consume + set password.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const valid = await isActionTokenValid({ purpose: "account_claim", token });
  return NextResponse.json({ valid });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!isStrongPassword(password)) {
    return NextResponse.json(
      { error: { code: "weak_password", message: "Use at least 12 characters, including a letter and a number." } },
      { status: 400 },
    );
  }

  const claim = await consumeActionToken({ purpose: "account_claim", token });
  if (!claim) {
    return NextResponse.json(
      { error: { code: "invalid_token", message: "This link is invalid or has expired. Request a new one." } },
      { status: 400 },
    );
  }

  await setPassword(claim.userId, password);
  // Any other outstanding claim/reset tokens for this user are now moot.
  await invalidateActionTokens("account_claim", claim.userId);

  const session = await findSessionForGoogleUser({ email: claim.email });
  // If the account isn't active (findSessionForGoogleUser returns nothing), don't
  // claim a logged-in landing — send them to sign in.
  const response = NextResponse.json({ ok: true, next: session ? nextForRole(session.role) : "/login" });
  if (session) setSessionCookie(response, session);
  return response;
}
