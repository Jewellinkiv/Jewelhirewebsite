const MAX_LOCAL_REDIRECT_LENGTH = 2_048;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const VALIDATION_ORIGIN = "https://same-origin.invalid";

/**
 * Return a path only when both its received and percent-decoded forms remain
 * same-origin paths. URLSearchParams has already decoded one layer before most
 * callers reach this helper, so validating the decoded form also closes `%5c`,
 * encoded `//`, control-character, and malformed-encoding redirect tricks.
 */
export function safeSameOriginPath(value: unknown): string | undefined {
  if (typeof value !== "string" || !value || value.length > MAX_LOCAL_REDIRECT_LENGTH) return undefined;

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return undefined;
  }

  for (const candidate of [value, decoded]) {
    if (
      !candidate.startsWith("/")
      || candidate.startsWith("//")
      || candidate.includes("\\")
      || CONTROL_CHARACTERS.test(candidate)
    ) {
      return undefined;
    }

    try {
      if (new URL(candidate, VALIDATION_ORIGIN).origin !== VALIDATION_ORIGIN) return undefined;
    } catch {
      return undefined;
    }
  }

  return value;
}

export function safeSameOriginPathOrRoot(value: unknown): string {
  return safeSameOriginPath(value) || "/";
}
