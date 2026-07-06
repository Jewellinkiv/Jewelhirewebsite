import { NextResponse } from "next/server";
import { isStrongPassword, setPassword } from "@/lib/server/password-auth";
import { createAssociateUserAndLinkProfile, userExistsForEmail } from "@/lib/server/invite-claim";
import { findSessionForGoogleUser, isConfiguredAdminEmail, setSessionCookie } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { validEmail } from "@/lib/server/request";

export const runtime = "nodejs";

// Free applicant signup: create an associate account (email + password) and log
// in. Adopts any applicant_profile already created for that email (e.g. from a
// public job application) so prior applications/invites show up.
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "applicant-signup", { limit: 12, windowSeconds: 3600 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name : "";

  if (!validEmail(email)) {
    return NextResponse.json({ error: { code: "invalid_email", message: "Enter a valid email address." } }, { status: 400 });
  }
  // Configured admin emails resolve to an admin session via the env allowlist —
  // never let one be claimed through unauthenticated self-service signup.
  if (isConfiguredAdminEmail(email)) {
    return NextResponse.json(
      { error: { code: "use_sso", message: "This email is managed. Please sign in with Google." } },
      { status: 403 },
    );
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
  if (session) setSessionCookie(response, session);
  return response;
}
