import { NextResponse } from "next/server";
import {
  createAssociateUserAndLinkProfile,
  getClaimableInvite,
  userExistsForEmail,
  verifyInviteClaim,
} from "@/lib/server/invite-claim";
import { isStrongPassword, setPassword } from "@/lib/server/password-auth";
import { createSessionToken, findSessionForGoogleUser, SESSION_COOKIE } from "@/lib/server/auth";

export const runtime = "nodejs";

const CLAIMABLE = new Set(["sent", "started"]);

// Preview: is this claim link valid, and does the email already have an account?
export async function GET(request: Request) {
  const url = new URL(request.url);
  const inviteId = url.searchParams.get("inviteId") || "";
  const token = url.searchParams.get("t") || "";
  if (!verifyInviteClaim(inviteId, token)) return NextResponse.json({ valid: false });
  const invite = await getClaimableInvite(inviteId);
  if (!invite || invite.expired || !CLAIMABLE.has(invite.status)) return NextResponse.json({ valid: false });
  return NextResponse.json({
    valid: true,
    existingAccount: await userExistsForEmail(invite.email),
    next: `/bundle/${inviteId}`,
  });
}

// Claim: create the applicant's account (associate), set a password, log them in.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const inviteId = typeof body.inviteId === "string" ? body.inviteId : "";
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name : "";

  if (!verifyInviteClaim(inviteId, token)) {
    return NextResponse.json({ error: { code: "invalid_link", message: "This claim link is invalid." } }, { status: 400 });
  }
  const invite = await getClaimableInvite(inviteId);
  if (!invite || invite.expired || !CLAIMABLE.has(invite.status)) {
    return NextResponse.json(
      { error: { code: "invite_unavailable", message: "This JewelCert link has expired or is no longer available." } },
      { status: 400 },
    );
  }

  const next = `/bundle/${inviteId}`;
  // Already has an account — send them to sign in rather than resetting a password.
  if (await userExistsForEmail(invite.email)) {
    return NextResponse.json({ existingAccount: true, next });
  }
  if (!isStrongPassword(password)) {
    return NextResponse.json(
      { error: { code: "weak_password", message: "Use at least 12 characters, including a letter and a number." } },
      { status: 400 },
    );
  }

  const userId = await createAssociateUserAndLinkProfile({ email: invite.email, name });
  await setPassword(userId, password);

  const session = await findSessionForGoogleUser({ email: invite.email });
  const response = NextResponse.json({ ok: true, next });
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
