import type { MetadataRoute } from "next";

/**
 * Closed to crawlers until there is something public to crawl.
 *
 * Every route today is the register or a redirect to sign-in. Indexing now
 * would make an empty login screen the first thing anyone searching for Docket
 * finds, and that impression is expensive to replace later.
 *
 * When the landing page ships, this becomes `allow: "/"` with the app routes
 * still disallowed — and the X-Robots-Tag header in next.config.ts has to go on
 * the same commit, or it will keep overriding this file.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
