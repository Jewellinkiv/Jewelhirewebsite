import { headers } from "next/headers";
import { getCurrentSession } from "@/lib/local-api-store";
import { AccessDeniedError } from "@/lib/server/access-errors";
import {
  authRequired,
  readSessionCookie,
  revalidateJewelLinkSession,
  revalidateNativeSession,
  UnauthenticatedError,
  type AuthSession,
} from "@/lib/server/auth";
import { locationIdInScope } from "@/lib/server/location-scope";

export { AccessDeniedError } from "@/lib/server/access-errors";

export type SessionContext = Omit<
  AuthSession,
  "version" | "exp" | "nativeAuthEpoch" | "upstreamAssurance"
> & { upstreamUserId?: string };

function sessionContext(session: AuthSession): SessionContext {
  const {
    version: _version,
    exp: _exp,
    nativeAuthEpoch: _nativeAuthEpoch,
    upstreamAssurance: _upstreamAssurance,
    ...context
  } = session;
  void _version;
  void _exp;
  void _nativeAuthEpoch;
  return {
    ...context,
    ...(_upstreamAssurance?.userId ? { upstreamUserId: _upstreamAssurance.userId } : {}),
  };
}

export function browserSessionContext(session: SessionContext) {
  const { upstreamUserId: _upstreamUserId, ...context } = session;
  void _upstreamUserId;
  return context;
}

const STAGING_SESSIONS: Record<string, SessionContext> = {
  sissys: {
    userId: "user-hiring-manager",
    name: "Jordan Smith",
    email: "jordan@email.com",
    role: "store_owner",
    storeIds: ["store-sissys-little-rock"],
    storeRoles: { "store-sissys-little-rock": "store_owner" },
    locationScopes: { "store-sissys-little-rock": { allLocations: true, locationIds: [] } },
    activeStoreId: "store-sissys-little-rock",
    authSource: "native",
    guardrails: {
      phase: "phase_1_single_store",
      applicantScope: "store_private",
      marketplace: false,
      candidateReviews: false,
    },
  },
  harbor: {
    userId: "user-harbor-owner",
    name: "Leo Park",
    email: "leo@harborgold.com",
    role: "store_owner",
    storeIds: ["store-harbor-memphis"],
    storeRoles: { "store-harbor-memphis": "store_owner" },
    locationScopes: { "store-harbor-memphis": { allLocations: true, locationIds: [] } },
    activeStoreId: "store-harbor-memphis",
    authSource: "native",
    guardrails: {
      phase: "phase_1_single_store",
      applicantScope: "store_private",
      marketplace: false,
      candidateReviews: false,
    },
  },
  applicant: {
    userId: "user-applicant-maya",
    name: "Maya Chen",
    email: "maya.chen@email.com",
    role: "associate",
    storeIds: [],
    storeRoles: {},
    locationScopes: {},
    activeStoreId: "",
    authSource: "native",
    guardrails: {
      phase: "phase_1_single_store",
      applicantScope: "store_private",
      marketplace: false,
      candidateReviews: false,
    },
  },
  admin: {
    userId: "user-admin",
    name: "JewelHire Admin",
    email: "admin@jewelhire.local",
    role: "admin",
    storeIds: ["store-sissys-little-rock", "store-harbor-memphis"],
    storeRoles: {},
    locationScopes: {},
    activeStoreId: "store-sissys-little-rock",
    authSource: "native",
    guardrails: {
      phase: "phase_1_single_store",
      applicantScope: "store_private",
      marketplace: false,
      candidateReviews: false,
    },
  },
  manager: {
    userId: "user-sissys-manager",
    name: "Sissy's Manager",
    email: "manager@jewelhire.local",
    role: "manager",
    storeIds: ["store-sissys-little-rock"],
    storeRoles: { "store-sissys-little-rock": "manager" },
    locationScopes: { "store-sissys-little-rock": { allLocations: true, locationIds: [] } },
    activeStoreId: "store-sissys-little-rock",
    authSource: "native",
    guardrails: {
      phase: "phase_1_single_store",
      applicantScope: "store_private",
      marketplace: false,
      candidateReviews: false,
    },
  },
  manager_limited: {
    userId: "user-sissys-limited-manager",
    name: "Sissy's Little Rock Manager",
    email: "little-rock-manager@jewelhire.local",
    role: "manager",
    storeIds: ["store-sissys-little-rock"],
    storeRoles: { "store-sissys-little-rock": "manager" },
    locationScopes: { "store-sissys-little-rock": { allLocations: false, locationIds: ["little-rock"] } },
    activeStoreId: "store-sissys-little-rock",
    authSource: "native",
    guardrails: {
      phase: "phase_1_single_store",
      applicantScope: "store_private",
      marketplace: false,
      candidateReviews: false,
    },
  },
};

const OWNER_ONLY_OPERATION_PREFIXES = [
  "billing.",
  "calendar.",
  "integrations.",
  "invite_settings.",
  "settings.",
  "store.transfer_admin",
  "store.update",
  "theme.update",
  "users.",
];

function ownerOnlyOperation(operation: string) {
  return OWNER_ONLY_OPERATION_PREFIXES.some((prefix) => operation === prefix || operation.startsWith(prefix));
}

async function storeMembershipAccess(
  storeId: string,
  operation: string,
  providedSession?: SessionContext,
) {
  const session = providedSession || await getSessionContext();
  if (session.role === "admin") return { session, membershipRole: undefined, locationScope: undefined };
  const membershipRole = session.storeRoles[storeId];
  if (!membershipRole) {
    throw new AccessDeniedError(`Store ${storeId} is not in scope for ${operation}`);
  }
  if (membershipRole === "manager" && ownerOnlyOperation(operation)) {
    throw new AccessDeniedError(`Store owner role required for ${operation}`);
  }
  return { session, membershipRole, locationScope: session.locationScopes[storeId] };
}

function sessionOverrideEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.JEWELHIRE_ENABLE_SESSION_OVERRIDE === "1";
}

async function sessionOverrideKey() {
  if (!sessionOverrideEnabled()) return "";
  try {
    return (await headers()).get("x-jewelhire-session")?.trim().toLowerCase() || "";
  } catch {
    return "";
  }
}

async function revalidateCurrentCookieSession(): Promise<SessionContext> {
  const session = await readSessionCookie();
  if (session?.authSource === "jewellink_sso") {
    const revalidated = await revalidateJewelLinkSession(session);
    if (!revalidated) throw new UnauthenticatedError("Your JewelLink access is no longer active. Continue with JewelLink to sign in again.");
    return sessionContext(revalidated);
  }
  if (session?.authSource === "native") {
    const revalidated = await revalidateNativeSession(session);
    if (!revalidated) throw new UnauthenticatedError("This sign-in is no longer active. Continue with JewelLink if your account is managed there.");
    return sessionContext(revalidated);
  }
  if (authRequired()) throw new UnauthenticatedError();
  return getCurrentSession();
}

export async function getSessionContext(): Promise<SessionContext> {
  const override = STAGING_SESSIONS[await sessionOverrideKey()];
  if (override) return override;
  return revalidateCurrentCookieSession();
}

export async function canAccessStore(storeId?: string | null) {
  if (!storeId) return false;
  const session = await getSessionContext();
  const role = session.role as string;
  return role === "admin" || session.storeIds.includes(storeId);
}

export async function requireStoreAccess(
  storeId: string,
  operation: string,
  providedSession?: SessionContext,
) {
  const { membershipRole, locationScope } = await storeMembershipAccess(storeId, operation, providedSession);
  // Selected-location managers must fail closed until each data query accepts
  // the allowed location IDs. All-location managers are fully usable now;
  // subsequent integration work will make individual operations location-aware.
  if (membershipRole === "manager" && locationScope && !locationScope.allLocations) {
    throw new AccessDeniedError(`Location-scoped manager access is not enabled for ${operation}`);
  }
  return storeId;
}

export async function requireLocationScopedStoreAccess(storeId: string, operation: string) {
  const { session, membershipRole, locationScope } = await storeMembershipAccess(storeId, operation);
  if (membershipRole !== "manager" || locationScope?.allLocations) {
    return { storeId, locationIds: undefined as string[] | undefined, session };
  }
  if (!locationScope) throw new AccessDeniedError(`No location scope exists for store ${storeId}`);
  if (locationScope.locationIds.length === 0) {
    throw new AccessDeniedError(`No locations are in scope for ${operation}`);
  }
  return { storeId, locationIds: locationScope.locationIds, session };
}

export async function requireAdminAccess(operation: string) {
  const session = await getSessionContext();
  if (session.role !== "admin") {
    throw new AccessDeniedError(`Admin role required for ${operation}`);
  }
  return session;
}

export async function requireApplicantSelf(operation: string) {
  const session = await getSessionContext();
  if (session.role !== "associate") {
    throw new AccessDeniedError(`Applicant role required for ${operation}`);
  }
  const email = session.email.trim().toLowerCase();
  if (!email) {
    throw new AccessDeniedError(`Applicant email required for ${operation}`);
  }
  return { session, email };
}

export type RecipientOrStoreAccessInput = {
  storeId?: string | null;
  recipientEmail?: string | null;
  externalUserId?: string | null;
  applicationSource?: string | null;
  resourceLocation?: string | null;
  operation: string;
};

export function assertRecipientOrStoreAccess(
  session: SessionContext,
  input: RecipientOrStoreAccessInput,
) {
  const role = session.role as string;

  if (role === "admin") return session;
  if (recipientIdentityMatches(session, input)) return session;
  if (input.storeId) {
    const membershipRole = session.storeRoles[input.storeId];
    if (membershipRole === "store_owner") return session;
    if (membershipRole === "manager") {
      const locationScope = session.locationScopes[input.storeId];
      if (!locationScope) {
        throw new AccessDeniedError(`No location scope exists for store ${input.storeId}`);
      }
      if (locationScope.allLocations) return session;
      if (
        locationScope.locationIds.length > 0
        && locationIdInScope(input.resourceLocation, locationScope.locationIds)
      ) {
        return session;
      }
    }
  }

  throw new AccessDeniedError(`Not authorized for ${input.operation}`);
}

export async function requireRecipientOrStoreAccess(input: RecipientOrStoreAccessInput) {
  return assertRecipientOrStoreAccess(await getSessionContext(), input);
}

export function recipientIdentityMatches(
  session: Pick<SessionContext, "email" | "authSource" | "upstreamUserId">,
  input: {
    recipientEmail?: string | null;
    externalUserId?: string | null;
    applicationSource?: string | null;
  },
) {
  const externalUserId = input.externalUserId?.trim() || "";
  const externallyManaged = Boolean(externalUserId) || input.applicationSource === "jewellink_employee";
  if (externallyManaged) {
    return Boolean(
      externalUserId
      && session.authSource === "jewellink_sso"
      && session.upstreamUserId === externalUserId
    );
  }

  const recipientEmail = input.recipientEmail?.trim().toLowerCase();
  const sessionEmail = session.email.trim().toLowerCase();
  return Boolean(recipientEmail && sessionEmail === recipientEmail);
}

export async function activeStoreId() {
  return (await getSessionContext()).activeStoreId;
}

export async function storeLocationScope(storeId: string) {
  const session = await getSessionContext();
  if (session.role === "admin" || session.storeRoles[storeId] === "store_owner") return undefined;
  const scope = session.locationScopes[storeId];
  if (!scope) throw new AccessDeniedError(`No location scope exists for store ${storeId}`);
  if (scope.allLocations) return undefined;
  return scope.locationIds;
}
