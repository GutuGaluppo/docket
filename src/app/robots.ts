import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * The landing page is the only thing worth indexing. Everything else is either
 * behind a session or a redirect into one.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/docket", "/board", "/calendar", "/analytics", "/settings", "/api/", "/sign-in", "/monitoring"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
