import type { JobMatch, JobMatchDimension } from "./types";

/**
 * The figure on screen, and the only place it is decided.
 *
 * Two rules hold this module together. The first: the overall score is never
 * asked of the model. It is arithmetic over the four dimensions, so the same
 * CV and the same advert always produce the same number, and applying a change
 * moves it only when the change actually moved a dimension. The second: the
 * weights and the wording live here as data, so re-balancing them later is an
 * edit to a table rather than a hunt through the interface.
 */

export const MATCH_WEIGHTS: Record<JobMatchDimension, number> = {
  skillsMatch: 0.3,
  experienceRelevance: 0.3,
  keywordCoverage: 0.2,
  roleAlignment: 0.2,
};

export const DIMENSION_ORDER: readonly JobMatchDimension[] = [
  "skillsMatch",
  "experienceRelevance",
  "keywordCoverage",
  "roleAlignment",
];

export const DIMENSION_LABELS: Record<JobMatchDimension, string> = {
  skillsMatch: "Skills match",
  experienceRelevance: "Experience relevance",
  keywordCoverage: "Keyword coverage",
  roleAlignment: "Role alignment",
};

/** What each dimension is actually measuring, said in one line to the reader. */
export const DIMENSION_HINTS: Record<JobMatchDimension, string> = {
  skillsMatch: "How many of the skills the advert asks for are evidenced in the CV.",
  experienceRelevance: "How closely the work described answers the responsibilities listed.",
  keywordCoverage: "Whether the terms the advert keeps returning to appear in context.",
  roleAlignment: "Whether the profile reads as the professional the advert describes.",
};

/**
 * The bands, low to high. Held as a table because the wording is a product
 * decision that will be revisited, and because the interface must not invent a
 * fifth verdict of its own.
 */
export const MATCH_BANDS: ReadonlyArray<{ min: number; max: number; label: string }> = [
  { min: 0, max: 39, label: "Low alignment" },
  { min: 40, max: 59, label: "Moderate alignment" },
  { min: 60, max: 79, label: "Strong alignment" },
  { min: 80, max: 100, label: "Excellent alignment" },
];

export function matchLabel(score: number): string {
  const value = clampScore(score);
  const band = MATCH_BANDS.find((candidate) => value >= candidate.min && value <= candidate.max);
  return band?.label ?? MATCH_BANDS[0]!.label;
}

/** Every score that reaches the interface has been through here: 0–100, integer. */
export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

type Parts = Partial<Record<JobMatchDimension, number | null | undefined>>;

/**
 * The weighted average of whatever could be measured.
 *
 * A dimension the advert gave no evidence for is not zero — it is unknown, and
 * scoring it as zero would punish a CV for the advert's silence. Its weight is
 * removed and the remaining weights are renormalised, which is why a reading
 * with only two live dimensions still lands on the same 0–100 scale.
 */
export function overallScore(parts: Parts): number {
  let weighted = 0;
  let total = 0;

  for (const dimension of DIMENSION_ORDER) {
    const value = parts[dimension];
    if (value === null || value === undefined || !Number.isFinite(value)) continue;
    const weight = MATCH_WEIGHTS[dimension];
    weighted += clampScore(value) * weight;
    total += weight;
  }

  if (total === 0) return 0;
  return clampScore(weighted / total);
}

/** Assembles the object the interface reads, overall figure included. */
export function toJobMatch(parts: Parts): JobMatch {
  const dimensions = Object.fromEntries(
    DIMENSION_ORDER.map((dimension) => {
      const value = parts[dimension];
      return [
        dimension,
        value === null || value === undefined || !Number.isFinite(value) ? null : clampScore(value),
      ];
    }),
  ) as Record<JobMatchDimension, number | null>;

  return { ...dimensions, overallScore: overallScore(parts) };
}

export const EMPTY_MATCH: JobMatch = toJobMatch({});

/** The move the last change caused. Zero is a real answer and is shown as one. */
export function scoreDelta(before: JobMatch | null, after: JobMatch | null): number {
  if (!before || !after) return 0;
  return after.overallScore - before.overallScore;
}
