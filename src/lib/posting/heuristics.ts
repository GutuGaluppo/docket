import { normalizeDomain } from "@/lib/company/domain";
import { isBoardHost } from "./adapters";
import { documentTitle, firstHeading, metaContent, stripTags } from "./html";
import { splitLocation } from "./location";
import type { PostingPartial } from "./types";

/**
 * The last layer: what can be read off a page that published no structured data.
 *
 * It is deliberately the least ambitious of the three. Anything it cannot
 * establish confidently it leaves empty, because the cost of the two outcomes
 * is not symmetric — an empty field costs a few seconds of typing, while a
 * position silently recorded as "Cookie Preferences" costs the register its
 * credibility. Every rule here either reads a value the page declared about
 * itself, or reads nothing.
 */

/** Subdomains that belong to the hiring flow rather than the company. */
const HOST_PREFIXES =
  /^(www|careers?|jobs?|apply|hire|hiring|work|working|talent|recruiting|join|boards?|vagas|emprego)\./;

/** "careers.loudly.com" → "loudly.com". */
export function hostBrand(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const trimmed = host.replace(HOST_PREFIXES, "");
  return trimmed.includes(".") ? trimmed : host;
}

const SEPARATORS = /\s+(?:[|·•‐‑–—-]|at|@|em|na|no)\s+/i;

/**
 * "Senior Frontend Developer | Loudly" → both halves.
 *
 * The convention across boards is position first, employer last. When a title
 * has no separator it is treated as the position alone: guessing which half is
 * which would be inventing information, and the position is the half a person
 * would rather see already filled.
 */
export function splitTitle(title: string): { position: string; company: string } {
  const clean = title.replace(/\s+/g, " ").trim();
  if (!clean) return { position: "", company: "" };

  const parts = clean
    .split(SEPARATORS)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return { position: clean, company: "" };

  const position = parts[0] ?? "";
  const company = parts[parts.length - 1] ?? "";
  // A trailing "Careers" or "Jobs" is the page's section, not an employer.
  if (/^(careers?|jobs?|job board|open positions?|vacancies)$/i.test(company)) {
    return { position, company: "" };
  }
  return { position, company };
}

/** The advert body, taken only from an element that claims to be the content. */
function mainText(html: string): string {
  const region =
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<[^>]+\brole\s*=\s*["']main["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i)?.[1] ??
    "";
  const text = region ? stripTags(region) : "";
  // Too short to be an advert means we found a wrapper, not the content.
  return text.length >= 240 ? text : "";
}

export function draftFromPage(html: string, url: URL): PostingPartial {
  const draft: PostingPartial = {};

  const ogTitle = metaContent(html, "og:title");
  const heading = firstHeading(html);
  const title = documentTitle(html);

  const fromTitle = splitTitle(ogTitle || title);
  const position = heading || fromTitle.position;
  if (position) draft.position = position;

  const company =
    metaContent(html, "og:site_name") || metaContent(html, "application-name") || fromTitle.company;
  if (company) draft.company = company;

  // Only the employer's own host can stand in for the employer's website; a
  // board's domain would put "greenhouse.io" in the column and fetch the wrong
  // logo for every entry.
  if (!isBoardHost(url.hostname)) {
    const brand = normalizeDomain(hostBrand(url.hostname));
    if (brand) draft.website = brand;
  }

  const body =
    mainText(html) || metaContent(html, "og:description") || metaContent(html, "description");
  if (body) draft.jobDescription = body;

  // A place is only accepted where the page labelled one as such.
  const labelled = stripTags(html).match(
    /^[ \t]*(?:location|standort|ort|localidade|localização|ubicación|lieu)[ \t]*[::][ \t]*(.+)$/im,
  );
  const place = labelled?.[1] ? splitLocation(labelled[1]) : {};

  return { ...draft, ...place };
}
