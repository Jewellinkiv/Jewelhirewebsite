// Small shared helpers for auth route handlers.

import { isIP } from "node:net";

function trustedProxyHops() {
  const configured = process.env.JEWELHIRE_TRUSTED_PROXY_HOPS?.trim();
  if (!configured) return process.env.NODE_ENV === "production" ? undefined : 0;
  if (!/^\d+$/.test(configured)) return undefined;
  const value = Number(configured);
  return Number.isSafeInteger(value) && value >= 0 && value <= 8 ? value : undefined;
}

// Google proxies append to X-Forwarded-For rather than trusting or replacing
// caller-supplied values. Select from the trusted right edge, never the
// spoofable left edge. Production fails closed to a shared "unknown" bucket
// until the exact proxy-hop count is explicitly configured and canary-checked.
export function clientIp(request: Request): string {
  const hops = trustedProxyHops();
  if (hops === undefined) return "unknown";
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const chain = xff.split(",").map((part) => part.trim());
    const candidate = chain[chain.length - 1 - hops];
    if (candidate && isIP(candidate)) return candidate;
  }
  if (process.env.NODE_ENV !== "production") {
    const direct = request.headers.get("x-real-ip")?.trim();
    if (direct && isIP(direct)) return direct;
  }
  return "unknown";
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
