import { createHmac, randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import {
  finalizePasswordResetTokenReplacement,
  preparePasswordResetTokenReplacement,
  type PasswordResetDeliveryOutcome,
} from "@/lib/server/action-tokens";
import { authSecret } from "@/lib/server/auth";
import { notifyPasswordReset } from "@/lib/server/notifications";
import { findActiveUserByEmail } from "@/lib/server/password-auth";
import { publicAppUrl } from "@/lib/server/public-url";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp, validEmail } from "@/lib/server/request";

const MAX_REQUEST_BODY_BYTES = 4_096;
const MAX_EMAIL_LENGTH = 254;
const RESET_REQUESTS_PER_EMAIL_PER_HOUR = 3;
const NEUTRAL_RESPONSE_MINIMUM_MS = 600;
const NEUTRAL_RESPONSE_JITTER_MS = 100;

export type AfterResponseScheduler = (task: () => Promise<void>) => void;

function normalizedEmail(input: unknown) {
  if (typeof input !== "string") return "";
  const email = input.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH || !validEmail(email)) return "";
  return email;
}

function emailRateLimitBucket(email: string) {
  // Keep normalized email addresses out of the shared limiter table. HMAC also
  // prevents a read-only database leak from becoming an offline email oracle.
  const digest = createHmac("sha256", authSecret())
    .update("password-reset-email\0")
    .update(email)
    .digest("base64url");
  return `reset-request-email:${digest}`;
}

async function readBoundedJson(request: Request): Promise<Record<string, unknown>> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_REQUEST_BODY_BYTES) {
    return {};
  }
  if (!request.body) return {};

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return {};
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

async function neutralResponse(notBefore: number) {
  const remaining = notBefore - Date.now();
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function deliverAndFinalizePasswordReset(input: {
  userId: string;
  email: string;
  name: string;
  resetUrl: string;
  tokenId: string;
}) {
  let outcome: PasswordResetDeliveryOutcome = "ambiguous";
  try {
    const notification = await notifyPasswordReset({
      toEmail: input.email,
      name: input.name,
      resetUrl: input.resetUrl,
    });
    outcome = notification.delivery;
  } catch {
    // An unexpected exception after provider dispatch begins is ambiguous: the
    // message may already have been accepted, so keep its bearer redeemable.
    outcome = "ambiguous";
  }

  try {
    await finalizePasswordResetTokenReplacement({
      userId: input.userId,
      tokenId: input.tokenId,
      outcome,
    });
  } catch (error) {
    // A pending token is redeemable by design, so settlement failure remains
    // fail-safe for a possibly delivered bearer. Log no email, token, or ID.
    console.error("[password-reset] Background delivery settlement failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
  }
}

async function processPasswordResetRequest(input: {
  email: string;
}) {
  try {
    const user = await findActiveUserByEmail(input.email);
    if (!user) return;

    const candidate = await preparePasswordResetTokenReplacement({
      userId: user.id,
      email: user.email,
      ttlMinutes: 60,
    });
    const resetUrl = `${publicAppUrl()}/reset-password#token=${encodeURIComponent(candidate.token)}`;
    await deliverAndFinalizePasswordReset({
      userId: user.id,
      email: user.email,
      name: user.name,
      resetUrl,
      tokenId: candidate.tokenId,
    });
  } catch (error) {
    // Background lookup or candidate persistence failures cannot affect the
    // already-sent neutral response. Never log the mailbox or bearer.
    console.error("[password-reset] Background reset request failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
  }
}

// The scheduler must run tasks only after the response is sent (Next.js `after`
// in production). Provider latency is therefore absent from the public timing
// signal, and provider I/O never owns a database connection or row lock.
export async function handlePasswordResetRequest(
  request: Request,
  scheduleAfterResponse: AfterResponseScheduler,
) {
  const notBefore = Date.now()
    + NEUTRAL_RESPONSE_MINIMUM_MS
    + randomInt(NEUTRAL_RESPONSE_JITTER_MS + 1);
  try {
    // Enforce the client bucket before touching an attacker-controlled body.
    const ipLimit = await rateLimit(`reset-request:${clientIp(request)}`, 8, 900);
    if (!ipLimit.ok) return await neutralResponse(notBefore);

    const body = await readBoundedJson(request);
    const email = normalizedEmail(body.email);
    if (!email) return await neutralResponse(notBefore);

    const emailLimit = await rateLimit(
      emailRateLimitBucket(email),
      RESET_REQUESTS_PER_EMAIL_PER_HOUR,
      60 * 60,
    );
    if (!emailLimit.ok) return await neutralResponse(notBefore);

    // Schedule the account lookup as well as provider delivery after the
    // response. Known and unknown mailboxes therefore perform the same public
    // request work; no user-row lock or pool client crosses the response.
    scheduleAfterResponse(() => processPasswordResetRequest({
      email,
    }));
  } catch {
    // Limiter and scheduler failures never change the public
    // account-enumeration contract.
  }
  return neutralResponse(notBefore);
}
