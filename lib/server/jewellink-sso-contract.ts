import { timingSafeEqual } from "node:crypto";

export const JEWELLINK_STATE_PATTERN = /^[A-Za-z0-9._~-]{1,128}$/;
export const JEWELLINK_SSO_MAX_AGE_SECONDS = 8 * 60 * 60;

const CLOCK_SKEW_MS = 60_000;
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

export type JewelLinkUpstreamAssurance = {
  amr: string[];
  authTime: string;
  mfaVerifiedAt: string;
  upstreamSessionId: string;
};

type AssuranceValidation =
  | { ok: true; sessionExpiresAt: number; assurance: JewelLinkUpstreamAssurance }
  | { ok: false };

function instant(value: unknown) {
  if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value)) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function validJewelLinkState(value: unknown): value is string {
  return typeof value === "string" && JEWELLINK_STATE_PATTERN.test(value);
}

function sameState(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

// SSO succeeds only when the browser cookie, callback URL, and one-time-code
// claims are all bound to exactly the same launch state. A cleared/missing
// cookie therefore also rejects callback replay in the original browser.
export function jewelLinkStateMatches(input: { urlState: unknown; cookieState: unknown; claimState: unknown }) {
  if (!validJewelLinkState(input.urlState) || !validJewelLinkState(input.cookieState) || !validJewelLinkState(input.claimState)) {
    return false;
  }
  return sameState(input.urlState, input.cookieState) && sameState(input.urlState, input.claimState);
}

export function validateJewelLinkAssurance(value: unknown, nowMs = Date.now()): AssuranceValidation {
  if (!value || typeof value !== "object") return { ok: false };
  const assurance = value as Partial<JewelLinkUpstreamAssurance>;
  if (!Array.isArray(assurance.amr) || !assurance.amr.every((method) => typeof method === "string")) return { ok: false };
  const methods = assurance.amr.map((method) => method.trim().toLowerCase());
  const uniqueMethods = new Set(methods);
  // JewelLink's contract is deliberately exact: a password-authenticated
  // session with a completed MFA challenge. Reject duplicates and unknown AMR
  // values so a weaker or differently interpreted method cannot drift in.
  if (
    methods.length !== 2
    || uniqueMethods.size !== 2
    || !uniqueMethods.has("pwd")
    || !uniqueMethods.has("mfa")
  ) {
    return { ok: false };
  }
  if (typeof assurance.upstreamSessionId !== "string" || !assurance.upstreamSessionId.trim() || assurance.upstreamSessionId.length > 256) {
    return { ok: false };
  }

  const authTime = instant(assurance.authTime);
  const mfaVerifiedAt = instant(assurance.mfaVerifiedAt);
  if (authTime === undefined || mfaVerifiedAt === undefined) return { ok: false };
  if (authTime > nowMs + CLOCK_SKEW_MS || mfaVerifiedAt > nowMs + CLOCK_SKEW_MS) return { ok: false };
  if (mfaVerifiedAt + CLOCK_SKEW_MS < authTime) return { ok: false };

  // Cap against both authentication instants. This is deliberately stricter
  // than treating a late MFA timestamp as a fresh, unbounded password session.
  const sessionExpiresAtMs = Math.min(authTime, mfaVerifiedAt) + JEWELLINK_SSO_MAX_AGE_SECONDS * 1000;
  if (sessionExpiresAtMs <= nowMs) return { ok: false };

  return {
    ok: true,
    sessionExpiresAt: Math.floor(sessionExpiresAtMs / 1000),
    assurance: {
      amr: ["pwd", "mfa"],
      authTime: assurance.authTime!,
      mfaVerifiedAt: assurance.mfaVerifiedAt!,
      upstreamSessionId: assurance.upstreamSessionId.trim(),
    },
  };
}

export function nativeAuthAllowed(input: { nativeAuthEnabled: boolean; isPlatformAdmin: boolean }) {
  // The platform-admin allowlist is authorization, not an MFA bypass. Those
  // identities authenticate only through the MFA-backed JewelLink SSO path.
  return input.nativeAuthEnabled && !input.isPlatformAdmin;
}

const JEWELLINK_ELIGIBLE_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "DIRECTOR",
  "MANAGER",
  "CONSULTANT",
  "STUDENT",
]);

export function jewelLinkRoleAllowedForIdentity(input: { role: string; isPlatformAdmin: boolean }) {
  // Accept only the exact, versioned upstream role contract. SUPER_ADMIN is an
  // authentication eligibility marker, not a local authorization grant, and is
  // accepted only for an independently configured JewelHire platform-admin
  // email. No unknown, legacy, differently-cased, or whitespace-padded role is
  // allowed to fall through as an applicant.
  return JEWELLINK_ELIGIBLE_ROLES.has(input.role)
    && (input.role !== "SUPER_ADMIN" || input.isPlatformAdmin);
}

export function jewelLinkIdentityProvisionAction(input: {
  linkedUserId?: string | null;
  emailUserId?: string | null;
  linkedNativeAuthEnabled?: boolean;
}) {
  if (input.linkedUserId) {
    // A successful retained-account claim is a durable ownership boundary. Keep
    // the upstream subject for audit history, but never let SSO take the local
    // identity back once native access has been explicitly enabled.
    if (input.linkedNativeAuthEnabled) return "conflict" as const;
    return input.emailUserId && input.emailUserId !== input.linkedUserId ? "conflict" as const : "update" as const;
  }
  return input.emailUserId ? "conflict" as const : "insert" as const;
}

export function standaloneClaimEntitlementAllowed(input: {
  source: string | null | undefined;
  status: string | null | undefined;
  expiresAt?: string | Date | null;
}, nowMs = Date.now()) {
  if (input.source === "jewellink_included" || input.status !== "active") return false;
  if (!input.expiresAt) return Boolean(input.source);
  const expiresAt = input.expiresAt instanceof Date ? input.expiresAt.getTime() : Date.parse(input.expiresAt);
  return Boolean(input.source) && Number.isFinite(expiresAt) && expiresAt > nowMs;
}

export function standaloneCompanyAccessAllowed(input: {
  companyId: string | null | undefined;
  companyStatus: string | null | undefined;
  entitlementSource?: string | null;
  entitlementStatus?: string | null;
  entitlementExpiresAt?: string | Date | null;
  subscriptionStatus?: string | null;
  subscriptionExpiresAt?: string | Date | null;
}, nowMs = Date.now()) {
  if (!input.companyId) return true;
  if (input.companyStatus !== "active" && input.companyStatus !== "trialing") return false;
  const directEntitlement = standaloneClaimEntitlementAllowed({
    source: input.entitlementSource,
    status: input.entitlementStatus,
    expiresAt: input.entitlementExpiresAt,
  }, nowMs);
  const subscriptionStatusAllowed = input.subscriptionStatus === "active" || input.subscriptionStatus === "trialing";
  if (!subscriptionStatusAllowed) return directEntitlement;
  if (!input.subscriptionExpiresAt) return true;
  const subscriptionExpiresAt = input.subscriptionExpiresAt instanceof Date
    ? input.subscriptionExpiresAt.getTime()
    : Date.parse(input.subscriptionExpiresAt);
  return directEntitlement || (Number.isFinite(subscriptionExpiresAt) && subscriptionExpiresAt > nowMs);
}

export type StandaloneStoreMembershipAccess = {
  storeId: string;
  storeCompanyId: string;
  storeCompanyStatus: string | null | undefined;
  storeEntitlementSource?: string | null;
  storeEntitlementStatus?: string | null;
  storeEntitlementExpiresAt?: string | Date | null;
  storeSubscriptionStatus?: string | null;
  storeSubscriptionExpiresAt?: string | Date | null;
};

/**
 * Entitlement is organization-owned, so a user's paid primary company must
 * never authorize a membership in another company. Keep only memberships whose
 * own store company is currently entitled; callers then rebuild every store and
 * role claim from this filtered set.
 */
export function entitledStandaloneStoreMemberships<T extends StandaloneStoreMembershipAccess>(
  memberships: readonly T[],
  nowMs = Date.now(),
) {
  return memberships.filter((membership) => standaloneCompanyAccessAllowed({
    companyId: membership.storeCompanyId,
    companyStatus: membership.storeCompanyStatus,
    entitlementSource: membership.storeEntitlementSource,
    entitlementStatus: membership.storeEntitlementStatus,
    entitlementExpiresAt: membership.storeEntitlementExpiresAt,
    subscriptionStatus: membership.storeSubscriptionStatus,
    subscriptionExpiresAt: membership.storeSubscriptionExpiresAt,
  }, nowMs));
}
