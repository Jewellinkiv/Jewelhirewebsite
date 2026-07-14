import { validJewelLinkAccessFingerprint } from "@/lib/server/jewellink-sso-contract";

const INTROSPECTION_TIMEOUT_MS = 3_000;

export type JewelLinkSessionBinding = {
  userId: string;
  upstreamSessionId: string;
  accessFingerprint: string;
};

function configuredJewelLinkUrl() {
  const raw = process.env.JEWELLINK_URL?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return undefined;
    return url;
  } catch {
    return undefined;
  }
}

/**
 * Revalidates one JewelLink-issued authorization snapshot. There is
 * deliberately no positive cache: a role, account, company, or location-scope
 * revocation takes effect on the next protected JewelHire request. Network and
 * upstream failures fail closed after a short bounded timeout.
 */
export async function introspectJewelLinkSession(binding: JewelLinkSessionBinding) {
  const secret = process.env.JEWELLINK_SSO_SHARED_SECRET || process.env.JEWELHIRE_SSO_SHARED_SECRET || "";
  const baseUrl = configuredJewelLinkUrl();
  if (
    !secret
    || !baseUrl
    || !binding.userId
    || !binding.upstreamSessionId
    || !validJewelLinkAccessFingerprint(binding.accessFingerprint)
  ) return false;

  const endpoint = new URL("/api/integrations/jewelhire/sso/introspect", baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INTROSPECTION_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify(binding),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const body = await response.json().catch(() => null) as { active?: unknown } | null;
    return body?.active === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
