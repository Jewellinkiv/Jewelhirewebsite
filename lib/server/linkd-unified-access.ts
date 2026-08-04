import { timingSafeEqual } from "node:crypto";
import { findLinkdUnifiedSession, type AuthSession, type StoreMembershipRole } from "@/lib/server/auth";

const OPAQUE = /^[A-Za-z0-9_-]{32,160}$/;
const CLIENT_ID = /^[a-z][a-z0-9-]{1,62}$/;
const CLIENT_SECRET = /^[A-Za-z0-9_-]{43}$/;
const TARGET_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

type LinkdTokenPayload = {
  data?: {
    spoke?: unknown;
    spokePrincipalId?: unknown;
    spokeCompanyId?: unknown;
    spokeLocationId?: unknown;
    roles?: unknown;
    authorizationVersion?: unknown;
  };
};

type LinkdRuntimeConfig = {
  authority: URL;
  clientId: string;
  clientSecret: string;
  callbackUrl: URL;
  manifestPublishSecret: string;
};

function runtimeConfig(): LinkdRuntimeConfig | undefined {
  if (process.env.LINKD_UNIFIED_ACCESS_ENABLED !== "1") return undefined;
  const clientId = process.env.LINKD_UNIFIED_ACCESS_JEWELHIRE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.LINKD_UNIFIED_ACCESS_JEWELHIRE_CLIENT_SECRET?.trim() || "";
  const publishSecret = process.env.LINKD_UNIFIED_ACCESS_MANIFEST_PUBLISH_SECRET?.trim() || "";
  if (!CLIENT_ID.test(clientId) || !CLIENT_SECRET.test(clientSecret) || !CLIENT_SECRET.test(publishSecret)) return undefined;
  try {
    const authority = new URL(process.env.LINKD_UNIFIED_ACCESS_API_BASE_URL || "");
    const callbackUrl = new URL(process.env.LINKD_UNIFIED_ACCESS_JEWELHIRE_CALLBACK_URL || "");
    if (
      authority.protocol !== "https:" || authority.username || authority.password || authority.pathname !== "/" || authority.search || authority.hash
      || callbackUrl.protocol !== "https:" || callbackUrl.username || callbackUrl.password || callbackUrl.search || callbackUrl.hash
    ) return undefined;
    return { authority, clientId, clientSecret, callbackUrl, manifestPublishSecret: publishSecret };
  } catch {
    return undefined;
  }
}

function exactCallbackForRequest(config: LinkdRuntimeConfig, request: Request) {
  const received = new URL(request.url);
  return received.protocol === config.callbackUrl.protocol
    && received.host === config.callbackUrl.host
    && received.pathname === config.callbackUrl.pathname
    && !received.hash;
}

function safeRoleKeys(value: unknown): StoreMembershipRole[] | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) return undefined;
  if (!value.every((role) => role === "store_owner" || role === "manager")) return undefined;
  return [...new Set(value)] as StoreMembershipRole[];
}

function parseExchange(payload: unknown) {
  const data = (payload as LinkdTokenPayload | null)?.data;
  if (!data || data.spoke !== "jewelhire") return undefined;
  const principalId = typeof data.spokePrincipalId === "string" ? data.spokePrincipalId : "";
  const companyId = typeof data.spokeCompanyId === "string" ? data.spokeCompanyId : "";
  const locationId = typeof data.spokeLocationId === "string" ? data.spokeLocationId : "";
  const roles = safeRoleKeys(data.roles);
  const authorizationVersion = typeof data.authorizationVersion === "number"
    ? data.authorizationVersion
    : Number.NaN;
  const version = authorizationVersion;
  if (!TARGET_ID.test(principalId) || !TARGET_ID.test(companyId) || !TARGET_ID.test(locationId) || !roles || !Number.isSafeInteger(version) || version < 1) return undefined;
  return { principalId, companyId, locationId, roles, authorizationVersion };
}

async function boundedJson(response: Response): Promise<unknown | undefined> {
  const length = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > 32_768) return undefined;
  const reader = response.body?.getReader();
  if (!reader) return undefined;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > 32_768) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return undefined;
  }
}

export async function exchangeLinkdUnifiedCode(request: Request): Promise<AuthSession | undefined> {
  const config = runtimeConfig();
  const url = new URL(request.url);
  const codes = url.searchParams.getAll("code");
  const states = url.searchParams.getAll("state");
  if (
    !config
    || !exactCallbackForRequest(config, request)
    || [...url.searchParams.keys()].some((key) => key !== "code" && key !== "state")
    || codes.length !== 1
    || states.length !== 1
    || !OPAQUE.test(codes[0] || "")
    || !OPAQUE.test(states[0] || "")
  ) return undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(new URL("/api/unified-access/token", config.authority), {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authorizationCode: codes[0],
        state: states[0],
        redirectUri: config.callbackUrl.toString(),
      }),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) return undefined;
    const exchange = parseExchange(await boundedJson(response));
    if (!exchange) return undefined;
    return findLinkdUnifiedSession({
      localUserId: exchange.principalId,
      companyId: exchange.companyId,
      locationId: exchange.locationId,
      roleKeys: exchange.roles,
      authorizationVersion: exchange.authorizationVersion,
      // The server rebuilds the exact local binding on every request. Keeping
      // this session short also bounds authorization changes before the next
      // Linkd code exchange and projection acknowledgement.
      expiresAt: Math.floor(Date.now() / 1000) + 15 * 60,
    });
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export function linkdManifestPublicationSecretMatches(value: string | null): boolean {
  const expected = runtimeConfig()?.manifestPublishSecret;
  if (!expected || !value) return false;
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function jewelHireCapabilityManifest() {
  return {
    schemaVersion: "1.0" as const,
    spoke: "jewelhire" as const,
    manifestVersion: "jewelhire-store-roles-v1",
    roleAssignmentMode: "single" as const,
    roles: [
      { key: "store_owner", label: "Store owner", permissionKeys: [] },
      { key: "manager", label: "Manager", permissionKeys: [] },
    ],
    // JewelHire currently enforces its capability matrix through these exact
    // two store membership roles. Do not expose imaginary independent toggles.
    permissions: [] as { key: string; label: string; scope: "company" | "location" | "both" }[],
  };
}

export function linkdCapabilityPublication() {
  const config = runtimeConfig();
  if (!config) return undefined;
  return { config, manifest: jewelHireCapabilityManifest() };
}
