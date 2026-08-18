/**
 * Just enough HTML reading for a job advert, with no parser dependency.
 *
 * A full DOM would be the right tool for a scraper; for pulling six fields out
 * of a page that is already required to publish them as structured data, it
 * would be several hundred kilobytes bought to run regexes anyway. These
 * functions are conservative: anything they cannot read confidently returns
 * empty, and the caller falls through to the next layer.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  euro: "€",
  pound: "£",
  bull: "•",
  middot: "·",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Math.min(Number(dec), 0x10ffff)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? whole);
}

/** Drops script/style wholesale, then tags, then collapses the whitespace. */
export function stripTags(html: string): string {
  const text = html
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|br)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The bodies of every <script type="application/ld+json"> on the page. */
export function jsonLdBlocks(html: string): string[] {
  const out: string[] = [];
  const pattern =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const body = match[1]?.trim();
    if (body) out.push(body);
  }
  return out;
}

/** `<meta property="og:title" content="…">`, either attribute order. */
export function metaContent(html: string, key: string): string {
  const name = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta\\b[^>]*(?:property|name)\\s*=\\s*["']${name}["'][^>]*content\\s*=\\s*["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta\\b[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${name}["']`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const hit = html.match(pattern);
    if (hit?.[1]) return decodeEntities(hit[1]).trim();
  }
  return "";
}

export function documentTitle(html: string): string {
  const hit = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return hit?.[1] ? decodeEntities(hit[1]).replace(/\s+/g, " ").trim() : "";
}

export function firstHeading(html: string): string {
  const hit = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return hit?.[1] ? stripTags(hit[1]).replace(/\s+/g, " ").trim() : "";
}
