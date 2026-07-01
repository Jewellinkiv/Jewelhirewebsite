// Mock session/role context (Phase 1 — no real auth). The current viewer and the
// portal switcher use this. Swap for JewelLink SSO/session later.

export type AppRole = "store_owner" | "associate" | "admin";

export interface SessionUser {
  name: string;
  initials: string;
  email: string;
  role: AppRole;
}

// Default viewer. (A dev role switcher in the shells can point at the other portals.)
export const SESSION: SessionUser = {
  name: "Jordan Smith",
  initials: "JS",
  email: "jordan@email.com",
  role: "associate",
};

export const PORTAL_LINKS: { role: AppRole; label: string; href: string }[] = [
  { role: "store_owner", label: "Store", href: "/" },
  { role: "associate", label: "My portal", href: "/portal" },
  { role: "admin", label: "Admin", href: "/admin" },
];
