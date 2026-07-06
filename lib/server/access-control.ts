import { headers } from "next/headers";
import { getCurrentSession } from "@/lib/local-api-store";
import { authRequired, readSessionCookie, UnauthenticatedError } from "@/lib/server/auth";

type SessionContext = Omit<ReturnType<typeof getCurrentSession>, "role"> & {
  role: "store_owner" | "associate" | "admin";
};

const STAGING_SESSIONS: Record<string, SessionContext> = {
  sissys: {
    userId: "user-hiring-manager",
    name: "Jordan Smith",
    email: "jordan@email.com",
    role: "store_owner",
    storeIds: ["store-sissys-little-rock"],
    activeStoreId: "store-sissys-little-rock",
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
    activeStoreId: "store-harbor-memphis",
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
    activeStoreId: "store-sissys-little-rock",
    guardrails: {
      phase: "phase_1_single_store",
      applicantScope: "store_private",
      marketplace: false,
      candidateReviews: false,
    },
  },
};

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

export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export async function getSessionContext() {
  const override = STAGING_SESSIONS[await sessionOverrideKey()];
  if (override) return override;
  const session = await readSessionCookie();
  if (session) return session;
  if (authRequired()) throw new UnauthenticatedError();
  return getCurrentSession();
}

export async function canAccessStore(storeId?: string | null) {
  if (!storeId) return false;
  const session = await getSessionContext();
  const role = session.role as string;
  return role === "admin" || session.storeIds.includes(storeId);
}

export async function requireStoreAccess(storeId: string, operation: string) {
  if (!(await canAccessStore(storeId))) {
    throw new AccessDeniedError(`Store ${storeId} is not in scope for ${operation}`);
  }
  return storeId;
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

export async function requireRecipientOrStoreAccess(input: {
  storeId?: string | null;
  recipientEmail?: string | null;
  operation: string;
}) {
  const session = await getSessionContext();
  const role = session.role as string;
  const recipientEmail = input.recipientEmail?.trim().toLowerCase();
  const sessionEmail = session.email.trim().toLowerCase();

  if (role === "admin") return session;
  if (input.storeId && session.storeIds.includes(input.storeId)) return session;
  if (recipientEmail && sessionEmail === recipientEmail) return session;

  throw new AccessDeniedError(`Not authorized for ${input.operation}`);
}

export async function activeStoreId() {
  return (await getSessionContext()).activeStoreId;
}
