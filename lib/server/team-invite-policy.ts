export const TEAM_INVITES_DISABLED_MESSAGE =
  "Team onboarding is temporarily unavailable while JewelHire completes secure invitation setup.";

export class TeamInvitesDisabledError extends Error {
  constructor() {
    super(TEAM_INVITES_DISABLED_MESSAGE);
    this.name = "TeamInvitesDisabledError";
  }
}

/**
 * Server-only policy: never import this module from a Client Component or
 * expose its environment value through a client-visible variable. Team
 * invitations are intentionally opt-in in production. Development and
 * test keep the existing fixtures usable unless the gate is explicitly set.
 * Any explicit value other than `1` fails closed.
 */
export function teamInvitesEnabled(
  env: Readonly<{ JEWELHIRE_TEAM_INVITES_ENABLED?: string; NODE_ENV?: string }> = process.env,
) {
  const configured = env.JEWELHIRE_TEAM_INVITES_ENABLED?.trim();
  if (configured !== undefined) return configured === "1";
  return env.NODE_ENV !== "production";
}

export function assertTeamInvitesEnabled() {
  if (!teamInvitesEnabled()) throw new TeamInvitesDisabledError();
}
