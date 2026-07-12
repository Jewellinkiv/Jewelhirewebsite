export const LEGAL_POLICY_VERSION = "2026-07-11";
export const PRIVACY_POLICY_VERSION = "2026-07-11";
export const TERMS_VERSION = "2026-07-11";

export function currentLegalConsentPayload() {
  return {
    legalConsent: true,
    legalPolicyVersion: LEGAL_POLICY_VERSION,
  } as const;
}

export function acceptsCurrentLegalTerms(body: unknown) {
  if (!body || typeof body !== "object") return false;
  const candidate = body as { legalConsent?: unknown; legalPolicyVersion?: unknown };
  return candidate.legalConsent === true && candidate.legalPolicyVersion === LEGAL_POLICY_VERSION;
}
