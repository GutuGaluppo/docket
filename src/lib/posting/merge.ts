import { resolveCity } from "@/lib/cities";
import { normalizeDomain } from "@/lib/company/domain";
import {
  EMPTY_VALUES,
  POSTING_FIELDS,
  type PostingDraft,
  type PostingField,
  type PostingPartial,
  type PostingSource,
} from "./types";

/** Long enough to be a description, short enough that nobody scrolls for a minute. */
const MAX_DESCRIPTION = 12_000;
const MAX_SHORT_FIELD = 160;

function tidy(field: PostingField, value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (field === "jobDescription") {
    const text = value
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION).trimEnd()}…` : text;
  }
  if (field === "website") return normalizeDomain(clean);
  return clean.slice(0, MAX_SHORT_FIELD);
}

export type Contribution = { source: PostingSource; partial: PostingPartial };

/**
 * First non-empty wins, in the order the contributions are given.
 *
 * Contributions are listed most to least trustworthy — a board's own API, then
 * the page's structured data, then what could be guessed from the page text —
 * so a lower layer can only fill a gap, never overwrite. That ordering is the
 * reason the heuristic layer is safe to have at all.
 */
export function mergeDraft(contributions: readonly Contribution[]): PostingDraft {
  const values = { ...EMPTY_VALUES };
  const filled: PostingField[] = [];
  const sources: PostingSource[] = [];

  for (const { source, partial } of contributions) {
    let used = false;
    for (const field of POSTING_FIELDS) {
      if (values[field]) continue;
      const value = tidy(field, partial[field] ?? "");
      if (!value) continue;
      values[field] = value;
      filled.push(field);
      used = true;
    }
    if (used && !sources.includes(source)) sources.push(source);
  }

  // A city we recognise carries its country with it, which is how the form
  // behaves when a person types one. The deduction never overrides a country
  // the advert stated itself.
  if (values.city) {
    const match = resolveCity(values.city);
    if (match) {
      values.city = match.city;
      if (!values.country) {
        values.country = match.country;
        filled.push("country");
      }
    }
  }

  return { values, filled: [...new Set(filled)], sources };
}
