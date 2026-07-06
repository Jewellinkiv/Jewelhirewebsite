import { NextResponse } from "next/server";
import { isStrongPassword, setPassword } from "@/lib/server/password-auth";
import { createAssociateUserAndLinkProfile, userExistsForEmail } from "@/lib/server/invite-claim";
import { createSessionToken, findSessionForGoogleUser, SESSION_COOKIE } from "@/lib/server/auth";

export const runtime = "nodejs";

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Free applicant signup: create an associate account (email + password) and log
// in. Adopts any applicant_profile already created for that email (e.g. from a
// public job application) so prior applications/invites show up.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name : "";

  if (!validEmail(email)) {
    return NextResponse.json({ error: { code: "invalid_email", message: "Enter a valid email address." } }, { status: 400 });
  }
  if (!isStrongPassword(password)) {
    return NextResponse.json(
      { error: { code: "weak_password", message: "Use at least 12 characters, including a letter and a number." } },
      { status: 400 },
    );
  }
  if (await userExistsForEmail(email)) {
    return NextResponse.json(
      { error: { code: "account_exists", message: "An account with this email already exists. Sign in instead." } },
      { status: 409 },
    );
  }

  const userId = await createAssociateUserAndLinkProfile({ email, name });
  await setPassword(userId, password);

  const session = await findSessionForGoogleUser({ email });
  const response = NextResponse.json({ ok: true, next: "/portal" });
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
