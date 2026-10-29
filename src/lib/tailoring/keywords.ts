import type { Resume } from "@/lib/resume/schema";
import { resumeElements } from "@/lib/resume/target";

import { containsAny, normalize } from "./match";
import type { JobKeyword, KeywordWeight } from "./types";

/**
 * The advert's vocabulary, checked against the document as it reads right now.
 *
 * The stored reading says which keywords the CV had when it was read; this says
 * which it has after the sentence somebody typed a second ago. It is the same
 * test `matchResume` runs — the term or one of its aliases, as a whole word —
 * so the list and the figure can never disagree about whether a word is there.
 */
export type KeywordStatus = {
  id: string;
  text: string;
  weight: KeywordWeight;
  occurrences: number;
  /** The spelling the CV actually uses, when it uses one. */
  foundAs: string | null;
};

export function keywordCoverage(
  resume: Resume,
  keywords: readonly JobKeyword[],
): KeywordStatus[] {
  const whole = normalize(
    resumeElements(resume)
      .map((element) => element.text)
      .join(" "),
  );

  return keywords.map((keyword) => ({
    id: keyword.id,
    text: keyword.text,
    weight: keyword.weight,
    occurrences: keyword.occurrences,
    foundAs: containsAny(whole, [keyword.text, ...(keyword.aliases ?? [])]),
  }));
}

/**
 * Ordered for working down: the advert's primary terms first, and within each
 * weight the ones still missing, most repeated first — repetition is the
 * advert's own emphasis, so it is the order a reader would fix them in.
 */
export function sortKeywords(list: readonly KeywordStatus[]): KeywordStatus[] {
  const weightRank: Record<KeywordWeight, number> = { primary: 0, secondary: 1 };
  return [...list].sort(
    (a, b) =>
      weightRank[a.weight] - weightRank[b.weight] ||
      Number(a.foundAs !== null) - Number(b.foundAs !== null) ||
      b.occurrences - a.occurrences ||
      a.text.localeCompare(b.text),
  );
}

export function keywordTally(list: readonly KeywordStatus[]): { found: number; total: number } {
  return { found: list.filter((keyword) => keyword.foundAs !== null).length, total: list.length };
}

/** The terms worth marking on the page: every keyword spelling the document already uses. */
export function highlightTerms(list: readonly KeywordStatus[]): string[] {
  return [...new Set(list.map((keyword) => keyword.foundAs).filter((term): term is string => !!term))];
}
