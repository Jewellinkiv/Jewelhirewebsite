import { NextResponse } from "next/server";
import { completePasswordReset, isStrongPassword } from "@/lib/server/password-auth";
import { findSessionForVerifiedNativeCredential, setSessionCookie } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const MAX_RESET_COMPLETION_BODY_BYTES = 2_048;

async function readBoundedJson(request: Request): Promise<Record<string, unknown>> {
  const contentLength = request.headers.get("content-length");
  if (
    contentLength
    && /^\d+$/.test(contentLength)
    && Number(contentLength) > MAX_RESET_COMPLETION_BODY_BYTES
  ) {
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
      if (total > MAX_RESET_COMPLETION_BODY_BYTES) {
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

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "password-reset", { limit: 12, windowSeconds: 900 });
  if (limited) return limited;

  const body = await readBoundedJson(request);
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!isStrongPassword(password)) {
    return NextResponse.json(
      { error: { code: "weak_password", message: "Use at least 12 characters, including a letter and a number." } },
      { status: 400 },
    );
  }

  const result = await completePasswordReset({ token, password });
  if (!result.ok && result.reason === "invalid_token") {
    return NextResponse.json(
      { error: { code: "invalid_token", message: "This reset link is invalid or has expired. Request a new one." } },
      { status: 400 },
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: { code: "jewellink_required", message: "This account must continue with JewelLink and complete MFA to sign in." } },
      { status: 403 },
    );
  }

  try {
    // Credential replacement and token consumption already committed. Session
    // hydration is best-effort and must never make a successful reset look safe
    // to retry if authorization/session infrastructure is temporarily down.
    const session = await findSessionForVerifiedNativeCredential({
      email: result.email,
      userId: result.userId,
      nativeAuthEpoch: result.nativeAuthEpoch,
    });
    const signedIn = session?.userId === result.userId;
    const response = NextResponse.json({
      ok: true,
      role: signedIn ? session.role : "associate",
      next: signedIn ? undefined : "/login",
    });
    if (signedIn && session) setSessionCookie(response, session);
    return response;
  } catch (error) {
    console.error("[password-reset] Password changed but session hydration failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ ok: true, role: "associate", next: "/login" });
  }
}
