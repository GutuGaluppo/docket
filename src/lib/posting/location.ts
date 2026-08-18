import { COUNTRIES, fold, resolveCity } from "@/lib/cities";
import type { PostingPartial } from "./types";

const COUNTRY_BY_KEY = new Map<string, string>();
for (const country of COUNTRIES) {
  for (const key of [country.name, ...(country.aliases ?? [])]) {
    COUNTRY_BY_KEY.set(fold(key), country.name);
  }
}

/** Noise every board puts in the same field as the place. */
const NOISE = /^(remote|hybrid|on[- ]?site|full[- ]?time|part[- ]?time|contract|permanent)$/i;

/**
 * Boards hand location over as one free string: "Berlin, Germany",
 * "Remote — Berlin", "Berlin / Munich", "London, UK (Hybrid)".
 *
 * Only pieces the city base recognises are kept. A fragment we cannot place is
 * dropped rather than written into the register, because a wrong city is worse
 * than an empty one — the person can always type it, and the review step is
 * where they would have to correct it anyway.
 */
export function splitLocation(raw: string): PostingPartial {
  const value = raw.replace(/\(.*?\)/g, " ").trim();
  if (!value) return {};

  const parts = value
    .split(/[,/|·•]|\s[-–—]\s/)
    .map((part) => part.trim())
    .filter((part) => part && !NOISE.test(part));

  let city = "";
  let country = "";

  for (const part of parts) {
    if (!city) {
      const match = resolveCity(part);
      if (match) {
        city = match.city;
        country = country || match.country;
        continue;
      }
    }
    if (!country) {
      const named = COUNTRY_BY_KEY.get(fold(part));
      if (named) country = named;
    }
  }

  const out: PostingPartial = {};
  if (city) out.city = city;
  if (country) out.country = country;
  return out;
}
