export function publicAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://app.jewelhire.com").replace(/\/$/, "");
}

export function absolutePublicUrl(path: string) {
  return new URL(path, `${publicAppUrl()}/`).toString();
}

export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
