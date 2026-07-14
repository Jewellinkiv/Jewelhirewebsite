import { NextResponse } from "next/server";
import { isActionTokenValid } from "@/lib/server/action-tokens";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "account-claim-preview", { limit: 100, windowSeconds: 900 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const valid = await isActionTokenValid({ purpose: "account_claim", token });
  return NextResponse.json(
    { valid },
    { headers: { "cache-control": "no-store, max-age=0" } },
  );
}
