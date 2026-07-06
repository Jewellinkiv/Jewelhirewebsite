import { NextResponse } from "next/server";
import { consumeActionToken, invalidateActionTokens } from "@/lib/server/action-tokens";
import { setPassword, isStrongPassword } from "@/lib/server/password-auth";
import { findSessionForGoogleUser, setSessionCookie } from "@/lib/server/auth";

export const runtime = "nodejs";

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

  const subject = await consumeActionToken({ purpose: "password_reset", token });
  if (!subject) {
    return NextResponse.json(
      { error: { code: "invalid_token", message: "This reset link is invalid or has expired. Request a new one." } },
      { status: 400 },
    );
  }

  await setPassword(subject.userId, password);
  // Invalidate any other outstanding reset links for this user.
  await invalidateActionTokens("password_reset", subject.userId);

  // Auto-login: mint a fresh session so they land straight in. If the account is
  // not active, findSessionForGoogleUser returns nothing — route them to sign in
  // rather than reporting a logged-in landing they don't actually have.
  const session = await findSessionForGoogleUser({ email: subject.email });
  const response = NextResponse.json({ ok: true, role: session?.role ?? "associate", next: session ? undefined : "/login" });
  if (session) setSessionCookie(response, session);
  return response;
}
