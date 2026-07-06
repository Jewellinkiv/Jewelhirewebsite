// Shared password policy — imported by both client forms and server validation
// so the two can never drift. Keep this file free of server-only imports.

export const PASSWORD_MIN_LENGTH = 12;

export function isStrongPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && /[A-Za-z]/.test(password) && /\d/.test(password);
}
