import { createVerify } from "node:crypto";

type FirebaseJwtHeader = {
  alg?: string;
  kid?: string;
};

type FirebaseJwtPayload = {
  aud?: string;
  iss?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certCache: { expiresAt: number; certs: Record<string, string> } | undefined;

function decodeBase64UrlJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function firebaseProjectId() {
  return process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
}

export function firebaseAuthConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  );
}

export function firebaseClientConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  };
}

async function getFirebaseCerts() {
  if (certCache && certCache.expiresAt > Date.now()) return certCache.certs;
  const response = await fetch(CERTS_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load Firebase auth certificates.");
  const certs = (await response.json()) as Record<string, string>;
  const maxAge = Number((response.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1] || 300);
  certCache = { certs, expiresAt: Date.now() + Math.max(60, maxAge - 30) * 1000 };
  return certs;
}

function verifySignature(input: { signingInput: string; signature: string; cert: string }) {
  const verifier = createVerify("RSA-SHA256");
  verifier.update(input.signingInput);
  verifier.end();
  return verifier.verify(input.cert, Buffer.from(input.signature, "base64url"));
}

export async function verifyFirebaseIdToken(idToken: string) {
  const projectId = firebaseProjectId();
  if (!projectId) throw new Error("Firebase project id is not configured.");

  const parts = idToken.split(".");
  if (parts.length !== 3) return undefined;
  const [encodedHeader, encodedPayload, signature] = parts;
  const header = decodeBase64UrlJson<FirebaseJwtHeader>(encodedHeader);
  const payload = decodeBase64UrlJson<FirebaseJwtPayload>(encodedPayload);
  if (header.alg !== "RS256" || !header.kid) return undefined;

  const cert = (await getFirebaseCerts())[header.kid];
  if (!cert || !verifySignature({ signingInput: `${encodedHeader}.${encodedPayload}`, signature, cert })) {
    return undefined;
  }

  const now = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  if (payload.aud !== projectId || payload.iss !== expectedIssuer || !payload.sub) return undefined;
  if (!payload.exp || payload.exp <= now || !payload.iat || payload.iat > now + 60) return undefined;
  if (!payload.email || payload.email_verified === false) return undefined;

  return {
    uid: payload.sub,
    email: payload.email,
    name: payload.name,
  };
}
