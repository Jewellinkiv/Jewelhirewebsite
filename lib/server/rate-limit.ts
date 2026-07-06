import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/server/postgres";
import { clientIp } from "@/lib/server/request";

// Postgres fixed-window rate limiter, shared across Cloud Run instances. One
// atomic upsert per call increments the counter for the current window; callers
// compare the returned count against their limit.

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

export async function rateLimit(bucket: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  try {
    const pool = getPostgresPool();
    const res = await pool.query<{ count: number; window_start: Date }>(
      `insert into rate_limit_hits (bucket, window_start, count)
       values ($1, to_timestamp(floor(extract(epoch from now()) / $2) * $2), 1)
       on conflict (bucket, window_start) do update set count = rate_limit_hits.count + 1
       returning count, window_start`,
      [bucket, windowSeconds],
    );
    const count = Number(res.rows[0]?.count ?? 1);
    const windowStartMs = res.rows[0]?.window_start ? new Date(res.rows[0].window_start).getTime() : Date.now();
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs + windowSeconds * 1000 - Date.now()) / 1000));

    // Opportunistic cleanup of stale windows so the table can't grow unbounded.
    if (Math.random() < 0.02) {
      await pool.query(`delete from rate_limit_hits where window_start < now() - interval '1 day'`).catch(() => {});
    }
    return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds };
  } catch {
    // Fail open: a limiter DB hiccup must never lock legitimate users out.
    return { ok: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

// Enforce a per-endpoint, per-client-IP limit. Returns a 429 response when the
// limit is exceeded, or null to let the handler proceed.
export async function enforceRateLimit(
  request: Request,
  name: string,
  opts: { limit: number; windowSeconds: number },
): Promise<NextResponse | null> {
  const r = await rateLimit(`${name}:${clientIp(request)}`, opts.limit, opts.windowSeconds);
  if (r.ok) return null;
  return NextResponse.json(
    { error: { code: "rate_limited", message: "Too many attempts. Please wait a moment and try again." } },
    { status: 429, headers: { "Retry-After": String(r.retryAfterSeconds) } },
  );
}
