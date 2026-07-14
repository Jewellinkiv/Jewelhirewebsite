import { NextResponse } from "next/server";
import { findActiveUserByEmail } from "@/lib/server/password-auth";
import { createActionToken } from "@/lib/server/action-tokens";
import { notifyPasswordReset } from "@/lib/server/notifications";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

function appBaseUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

// Always responds { ok: true } regardless of whether the email exists, so the
// endpoint can't be used to enumerate accounts.
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "reset-request", { limit: 8, windowSeconds: 900 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const ok = NextResponse.json({ ok: true });
  if (!email) return ok;
  try {
    const user = await findActiveUserByEmail(email);
    if (user) {
      const token = await createActionToken({ purpose: "password_reset", userId: user.id, email: user.email, ttlMinutes: 60 });
      const resetUrl = `${appBaseUrl(request)}/reset-password?token=${encodeURIComponent(token)}`;
      await notifyPasswordReset({ toEmail: user.email, name: user.name, resetUrl });
    }
  } catch {
    // Swallow so failures don't leak account existence or internal errors.
  }
  return ok;
}
