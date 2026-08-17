import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Only what is public. The register, the board and the calendar are behind a
 * session and have nothing to offer a crawler.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 }];
}
