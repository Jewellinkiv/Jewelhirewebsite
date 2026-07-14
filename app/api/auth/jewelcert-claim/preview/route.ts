import { NextResponse } from "next/server";
import {
  getClaimableInvite,
  isInviteClaimTokenCandidate,
  isInviteIdCandidate,
  isClaimableInviteStatus,
  userExistsForEmail,
  verifyInviteClaim,
} from "@/lib/server/invite-claim";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

// The claim bearer is accepted only in a JSON body. It must never be placed in
// this endpoint's URL, where infrastructure and browser history can retain it.
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "jewelcert-claim-preview", { limit: 100, windowSeconds: 900 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const inviteId = typeof body.inviteId === "string" ? body.inviteId : "";
  const token = typeof body.token === "string" ? body.token : "";
  if (!isInviteIdCandidate(inviteId) || !isInviteClaimTokenCandidate(token)) {
    return NextResponse.json({ valid: false }, { headers: { "Cache-Control": "no-store" } });
  }

  const invite = await getClaimableInvite(inviteId);
  if (!invite || invite.expired || !isClaimableInviteStatus(invite.status)) {
    return NextResponse.json({ valid: false }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!verifyInviteClaim(inviteId, invite.email, token)) {
    return NextResponse.json({ valid: false }, { headers: { "Cache-Control": "no-store" } });
  }
  const next = `/bundle/${inviteId}`;
  if (invite.requiresJewelLink) {
    return NextResponse.json(
      {
        valid: true,
        existingAccount: true,
        jewellinkRequired: true,
        next,
        loginPath: `/login?error=jewellink_required&next=${encodeURIComponent(next)}`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      valid: true,
      existingAccount: await userExistsForEmail(invite.email),
      next,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
