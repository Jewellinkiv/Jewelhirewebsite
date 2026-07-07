import { createHmac, timingSafeEqual } from "node:crypto";
import { authSecret } from "@/lib/server/auth";
import type { CalendarProvider } from "@/lib/server/calendar/types";

// Stateless, tamper-proof OAuth state: carries the storeId through the provider
// round-trip signed with AUTH_SECRET, so the callback can attach the connection
// to the right store without server-side state.

type StatePayload = { storeId: string; provider: CalendarProvider; nonce: string };

export function signState(payload: StatePayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", authSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyState(state: string): StatePayload | null {
  const [data, sig] = (state || "").split(".");
  if (!data || !sig) return null;
  const expected = createHmac("sha256", authSecret()).update(data).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as StatePayload;
  } catch {
    return null;
  }
}
