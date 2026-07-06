import { createHash } from "node:crypto";

// Cloudinary config is read from the standard CLOUDINARY_URL env var
// (cloudinary://<api_key>:<api_secret>@<cloud_name>). The api_secret NEVER
// leaves the server — it's only used here to sign upload requests. The browser
// uploads directly to Cloudinary with the signature, so large videos don't pass
// through our (size-capped) app server.

type CloudinaryConfig = { apiKey: string; apiSecret: string; cloudName: string };

function parseCloudinaryUrl(): CloudinaryConfig | null {
  const m = (process.env.CLOUDINARY_URL || "").match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  return m ? { apiKey: m[1], apiSecret: m[2], cloudName: m[3] } : null;
}

export function cloudinaryConfigured(): boolean {
  return parseCloudinaryUrl() !== null;
}

// Non-secret bits the client needs to POST to Cloudinary (cloud name + api key).
export function cloudinaryPublicConfig(): { cloudName: string; apiKey: string } | null {
  const c = parseCloudinaryUrl();
  return c ? { cloudName: c.cloudName, apiKey: c.apiKey } : null;
}

// Cloudinary signature: sort the params, join as k=v&k=v, append the api_secret,
// SHA-1 hex. Only the params passed here are signed (and thus enforced).
export function signCloudinaryParams(params: Record<string, string | number>): string {
  const c = parseCloudinaryUrl();
  if (!c) throw new Error("CLOUDINARY_URL is not configured.");
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + c.apiSecret).digest("hex");
}
