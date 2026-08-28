import { JOB_MATCH_WEIGHTS } from "./score";
import type { ResumeSuggestion, SuggestionPriority, SuggestionType } from "./types";

/**
 * What the reader sees first, and what they can narrow it down to.
 *
 * A list of twelve recommendations in the order a model happened to emit them
 * is a list nobody finishes. The order below is the product's opinion about
 * where an hour of editing pays best: what the advert insists on, then what
 * moves the most of the score, then the order the document reads in — so
 * working down the panel is also working down the page.
 */

export const SUGGESTION_FILTERS = [
  { id: "all", label: "All" },
  { id: "high", label: "High priority" },
  { id: "skills", label: "Skills" },
  { id: "experience", label: "Experience" },
  { id: "keywords", label: "Keywords" },
  { id: "ats", label: "ATS" },
] as const;

export type SuggestionFilter = (typeof SUGGESTION_FILTERS)[number]["id"];

const BY_FILTER: Record<Exclude<SuggestionFilter, "all" | "high">, SuggestionType[]> = {
  skills: ["skill_alignment", "missing_requirement"],
  experience: ["experience_relevance", "weak_wording", "missing_evidence", "irrelevant_content"],
  keywords: ["missing_keyword", "summary_alignment"],
  ats: ["ats_readability"],
};

export function matchesFilter(suggestion: ResumeSuggestion, filter: SuggestionFilter): boolean {
  if (filter === "all") return true;
  if (filter === "high") return suggestion.priority === "high";
  return BY_FILTER[filter].includes(suggestion.type);
}

/** The number beside each filter, counted over the same list the filter would show. */
export function filterCounts(
  suggestions: readonly ResumeSuggestion[],
): Record<SuggestionFilter, number> {
  const counts = Object.fromEntries(SUGGESTION_FILTERS.map((filter) => [filter.id, 0])) as Record<
    SuggestionFilter,
    number
  >;

  for (const suggestion of suggestions) {
    for (const filter of SUGGESTION_FILTERS) {
      if (matchesFilter(suggestion, filter.id)) counts[filter.id] += 1;
    }
  }

  return counts;
}

const PRIORITY_RANK: Record<SuggestionPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * How much of the score a recommendation could touch: the summed weight of the
 * dimensions it says it affects. A rewrite that moves skills and keywords
 * outranks one that moves keywords alone, and one that claims to move nothing
 * sorts last within its priority.
 */
export function expectedImpact(suggestion: ResumeSuggestion): number {
  return suggestion.affects.reduce((total, dimension) => total + JOB_MATCH_WEIGHTS[dimension], 0);
}

/**
 * Sorted for reading. `order` is the document order of every addressable
 * element, so the final tie-break walks the CV from the top instead of falling
 * back to whatever order the ids were minted in.
 */
export function sortSuggestions(
  suggestions: readonly ResumeSuggestion[],
  order: readonly string[],
): ResumeSuggestion[] {
  const position = new Map(order.map((key, index) => [key, index]));

  return [...suggestions].sort((a, b) => {
    // Anything already dealt with sinks, whatever else it scores on.
    const settled = (suggestion: ResumeSuggestion) =>
      suggestion.status === "pending" ? 0 : suggestion.status === "dismissed" ? 2 : 1;
    const bySettled = settled(a) - settled(b);
    if (bySettled !== 0) return bySettled;

    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (byPriority !== 0) return byPriority;

    const byImpact = expectedImpact(b) - expectedImpact(a);
    if (Math.abs(byImpact) > 0.001) return byImpact;

    const byRequirement = Number(b.requiresConfirmation) - Number(a.requiresConfirmation);
    if (byRequirement !== 0) return byRequirement;

    const aPosition = position.get(targetKeyOf(a)) ?? Number.MAX_SAFE_INTEGER;
    const bPosition = position.get(targetKeyOf(b)) ?? Number.MAX_SAFE_INTEGER;
    return aPosition - bPosition;
  });
}

function targetKeyOf(suggestion: ResumeSuggestion): string {
  return [
    suggestion.targetSectionId,
    suggestion.targetEntryId,
    suggestion.targetFieldId,
    suggestion.targetItemId,
  ]
    .filter(Boolean)
    .join("/");
}
