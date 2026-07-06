import type { MetadataRoute } from "next";

// Allow crawling of the public marketing/apply surface; keep the authenticated
// app internals and API out of search indexes.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: ["/api/", "/admin", "/portal", "/settings", "/applicants", "/learn"],
      },
    ],
  };
}
