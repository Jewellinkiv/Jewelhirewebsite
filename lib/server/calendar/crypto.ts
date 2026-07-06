import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { authSecret } from "@/lib/server/auth";

// AES-256-GCM encryption for calendar OAuth tokens at rest. The key is derived
// deterministically from AUTH_SECRET (already a strong, required secret) so we
// don't introduce a new key to manage. Ciphertext format: v1:iv:tag:data (b64url).

function key(): Buffer {
  return createHash("sha256").update(`calendar-token-enc:${authSecret()}`).digest();
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptToken(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted token");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
}
