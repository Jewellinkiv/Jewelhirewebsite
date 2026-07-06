import { NextResponse } from "next/server";
import { consumeActionToken } from "@/lib/server/action-tokens";
import { setPassword, isStrongPassword } from "@/lib/server/password-auth";
import { createSessionToken, findSessionForGoogleUser, SESSION_COOKIE } from "@/lib/server/auth";

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

  // Auto-login: mint a fresh session for the user so they land straight in.
  const session = await findSessionForGoogleUser({ email: subject.email });
  const response = NextResponse.json({ ok: true, role: session?.role ?? "associate" });
  if (session) {
    response.cookies.set(SESSION_COOKIE, createSessionToken(session), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  return response;
}
