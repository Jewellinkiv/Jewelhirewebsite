import { createHmac, timingSafeEqual } from "node:crypto";
import { authSecret } from "@/lib/server/auth";

type PreviewPayload = {
  v: 1;
  storeId: string;
  slug: string;
  exp: number;
};

function sign(payload: string) {
  return createHmac("sha256", authSecret()).update(`public-page-preview:${payload}`).digest("base64url");
}

export function createPublicPreviewToken(input: { storeId: string; slug: string; ttlHours?: number }) {
  const payload: PreviewPayload = {
    v: 1,
    storeId: input.storeId,
    slug: input.slug,
    exp: Math.floor(Date.now() / 1000) + Math.max(1, Math.min(input.ttlHours || 24, 72)) * 60 * 60,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyPublicPreviewToken(token: string, expectedSlug: string): PreviewPayload | undefined {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || token.length > 1_024) return undefined;
  const expected = sign(encoded);
  const suppliedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<PreviewPayload>;
    if (payload.v !== 1 || !payload.storeId || payload.slug !== expectedSlug || !payload.exp) return undefined;
    if (payload.exp * 1_000 <= Date.now()) return undefined;
    return payload as PreviewPayload;
  } catch {
    return undefined;
  }
}
