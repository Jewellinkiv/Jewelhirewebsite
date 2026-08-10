import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: { root: workspaceRoot },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/marketing/index.html" },
      ],
    };
  },
  // Applicants & candidates are one record — retire the old /candidates routes.
  // Legacy associate routes are superseded by the unified portal (/portal/*).
  async redirects() {
    return [
      { source: "/candidates", destination: "/applicants", permanent: true },
      { source: "/candidates/:id", destination: "/applicants/:id", permanent: true },
      { source: "/resume", destination: "/portal/resume", permanent: true },
      { source: "/my-applications", destination: "/portal/applications", permanent: true },
      { source: "/assessment", destination: "/portal/invites", permanent: true },
    ];
  },
};

export default nextConfig;
