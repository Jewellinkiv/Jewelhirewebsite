// Mock session/role context used by local development fallbacks. Swap for
// JewelLink SSO/session later.

export type AppRole = "store_owner" | "manager" | "associate" | "admin";

export interface SessionUser {
  name: string;
  initials: string;
  email: string;
  role: AppRole;
}

// Default viewer for local development.
export const SESSION: SessionUser = {
  name: "Jordan Smith",
  initials: "JS",
  email: "jordan@email.com",
  role: "associate",
};
