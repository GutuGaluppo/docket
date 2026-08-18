import { normalizeDomain } from "@/lib/company/domain";
import { stripTags } from "./html";
import type { PostingPartial } from "./types";

/**
 * schema.org/JobPosting, which most boards already publish.
 *
 * This layer carries the feature. Google requires a JobPosting block to index a
 * vacancy in Google Jobs, so Greenhouse, Lever, Ashby, Workday, Personio,
 * SmartRecruiters and most careers pages built in the last decade emit one —
 * with exactly the fields the register asks for. Reading it is not scraping and
 * not inference: it is the publisher's own machine-readable copy of the advert.
 */

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** JSON-LD lets almost every field be a value, an array of values, or an object. */
function firstString(value: unknown, ...keys: string[]): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item, ...keys);
      if (found) return found;
    }
    return "";
  }
  if (isObject(value)) {
    for (const key of keys) {
      const found = firstString(value[key], ...keys);
      if (found) return found;
    }
  }
  return "";
}

function typeOf(node: Json): string[] {
  const raw = node["@type"];
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === "string");
  return [];
}

/** Walks @graph, arrays and nested nodes to find every JobPosting in the document. */
export function findJobPostings(parsed: unknown, depth = 0): Json[] {
  if (depth > 6) return [];
  if (Array.isArray(parsed)) return parsed.flatMap((item) => findJobPostings(item, depth + 1));
  if (!isObject(parsed)) return [];

  const found: Json[] = [];
  if (typeOf(parsed).some((t) => t.toLowerCase() === "jobposting")) found.push(parsed);
  for (const key of ["@graph", "mainEntity", "itemListElement", "item"]) {
    if (key in parsed) found.push(...findJobPostings(parsed[key], depth + 1));
  }
  return found;
}

/** Reads the blocks a page shipped; malformed JSON is skipped, never thrown. */
export function postingsFromBlocks(blocks: readonly string[]): Json[] {
  const found: Json[] = [];
  for (const block of blocks) {
    try {
      found.push(...findJobPostings(JSON.parse(block) as unknown));
    } catch {
      // A page with one broken block usually has a good one next to it.
    }
  }
  return found;
}

function locationOf(node: Json): { city: string; country: string } {
  // jobLocation is a Place wrapping a PostalAddress, but it is also allowed to
  // be an array, or the address inline. firstString walks whichever it got.
  const place = node["jobLocation"] ?? node["address"];
  const city = firstString(place, "address", "addressLocality");
  const rawCountry = firstString(place, "address", "addressCountry", "name");
  // schema.org allows a two-letter code here; a code is not a country name, and
  // the register would rather hold nothing than hold "DE" in a name column.
  const country = /^[A-Z]{2}$/.test(rawCountry) ? "" : rawCountry;
  return { city: city.trim(), country: country.trim() };
}

export function draftFromPosting(node: Json): PostingPartial {
  const org = node["hiringOrganization"];
  const { city, country } = locationOf(node);

  const website = firstString(org, "sameAs", "url");
  const description = firstString(node, "description");

  const draft: PostingPartial = {
    position: firstString(node, "title", "name"),
    company: firstString(org, "name", "legalName"),
    website: website ? normalizeDomain(website) : "",
    city,
    country,
    // The description is HTML in practice, whatever the spec says.
    jobDescription: description ? stripTags(description) : "",
  };

  return draft;
}

/** The best of the postings a page declared — usually there is exactly one. */
export function draftFromJsonLd(blocks: readonly string[]): PostingPartial {
  const postings = postingsFromBlocks(blocks);
  if (postings.length === 0) return {};

  let best: PostingPartial = {};
  let bestScore = -1;
  for (const posting of postings) {
    const draft = draftFromPosting(posting);
    const score = Object.values(draft).filter(Boolean).length;
    if (score > bestScore) {
      best = draft;
      bestScore = score;
    }
  }
  return best;
}
