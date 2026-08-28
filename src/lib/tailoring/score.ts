import type {
  Contribution,
  CoverageReport,
  DimensionExplanation,
  JobAnalysis,
  JobMatch,
  JobMatchDimension,
  JobMatchExplanation,
  JobRequirement,
  RequirementCategory,
  RequirementImportance,
  RequirementMatch,
} from "./types";

/**
 * The figure on screen, and the only place it is decided.
 *
 * Three rules hold this module together.
 *
 * The first: **nothing here asks a model for a number.** What arrives is a
 * verdict per requirement — strong, partial, missing — with the lines of the CV
 * that justify it. The arithmetic over those verdicts is local, which is what
 * makes the result reproducible and what makes "why is this 69%?" a question
 * with an answer.
 *
 * The second: **every weight is in this file.** Re-balancing is an edit to a
 * table, and the tables are checked at load: weights that do not sum to one are
 * a bug that should not be discoverable only in production.
 *
 * The third: **absence of a nice-to-have is cheap.** A requirement under "added
 * bonus" is worth a third of one under "you must have", so a strong candidate
 * missing an optional tool loses a point or two rather than a grade.
 */

/**
 * Bumped whenever the arithmetic or the matching changes.
 *
 * It is part of what makes a stored reading current: a figure computed by an
 * older algorithm is not a stale reading of the same documents, it is an answer
 * to a different question, and showing it beside a new one would be comparing
 * two things that were never comparable.
 *
 * 1 — first release: lexical matching, frequency keywords.
 * 2 — evidence-based matching, categories, discriminative keywords.
 */
export const JOB_MATCH_SCORING_VERSION = "2";

/** What a requirement is worth, by how insistently the advert asks for it. */
export const REQUIREMENT_WEIGHTS: Record<RequirementImportance, number> = {
  required: 1,
  important: 0.75,
  /**
   * "Added bonus" is a real signal and a small one. At 0.35 a candidate who
   * meets everything else and has never touched the optional tool loses about a
   * point of the overall figure, which is the intended cost of not having it.
   */
  preferred: 0.35,
};

/** What a verdict is worth. Three states, because a classifier can tell these apart. */
export const MATCH_VALUES: Record<RequirementMatch, number> = {
  strong: 1,
  partial: 0.5,
  missing: 0,
};

export const JOB_MATCH_WEIGHTS = {
  skillsMatch: 0.3,
  experienceRelevance: 0.3,
  keywordCoverage: 0.2,
  roleAlignment: 0.2,
} as const satisfies Record<JobMatchDimension, number>;

// A table that does not sum to one is a table that quietly rescales every
// figure the product has ever shown.
const WEIGHT_SUM = Object.values(JOB_MATCH_WEIGHTS).reduce((total, weight) => total + weight, 0);
if (Math.abs(WEIGHT_SUM - 1) > 1e-9) {
  throw new Error(`JOB_MATCH_WEIGHTS must sum to 1, got ${WEIGHT_SUM}`);
}

/**
 * What Role Alignment is made of.
 *
 * Section 25 asks for the whole picture — title, seniority, trajectory,
 * responsibilities, product context, collaboration — and resting it on one or
 * two soft-skill requirements makes it swing between 0 and 100 on a single
 * phrase. These four signals are read together, each renormalised away when the
 * advert did not provide it.
 */
export const ROLE_SIGNAL_WEIGHTS = {
  /** Collaboration, ownership: the requirements that describe a way of working. */
  softSkills: 0.4,
  title: 0.3,
  seniority: 0.15,
  domain: 0.15,
} as const;

/** Which dimension each kind of requirement is evidence for. */
const DIMENSION_OF: Record<RequirementCategory, JobMatchDimension> = {
  skill: "skillsMatch",
  tool: "skillsMatch",
  practice: "skillsMatch",
  experience: "experienceRelevance",
  responsibility: "experienceRelevance",
  domain: "experienceRelevance",
  soft_skill: "roleAlignment",
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

export const DIMENSION_HINTS: Record<JobMatchDimension, string> = {
  skillsMatch: "The technologies, tools and practices the advert asks for, evidenced in the CV.",
  experienceRelevance: "The work and the setting: responsibilities, scope and the kind of product.",
  keywordCoverage: "Whether the terms that make this role specific appear in context.",
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
    const weight = JOB_MATCH_WEIGHTS[dimension];
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

/* -------------------------------------------------------------------------- */

/**
 * The whole figure, from verdicts to percentage, with its working kept.
 *
 * Three of the four dimensions are the same arithmetic over different
 * requirements: what was asked for, weighted by how much it was asked for,
 * against what the CV evidences. Keyword coverage is the fourth and is computed
 * from the keyword list rather than from requirements — see below.
 */
export function scoreAnalysis(
  analysis: JobAnalysis,
  coverage: CoverageReport,
): { jobMatch: JobMatch; explanation: JobMatchExplanation } {
  const verdicts = new Map(coverage.requirements.map((entry) => [entry.requirementId, entry]));
  const byDimension = new Map<JobMatchDimension, Contribution[]>();

  for (const requirement of analysis.requirements) {
    const dimension = DIMENSION_OF[requirement.category];
    const match = verdicts.get(requirement.id)?.match ?? "missing";
    const weight = REQUIREMENT_WEIGHTS[requirement.importance];

    const contribution: Contribution = {
      requirementId: requirement.id,
      name: requirement.name,
      importance: requirement.importance,
      match,
      weight,
      earned: weight * MATCH_VALUES[match],
    };

    byDimension.set(dimension, [...(byDimension.get(dimension) ?? []), contribution]);
  }

  const dimensions: DimensionExplanation[] = [];
  const parts: Parts = {};

  for (const dimension of DIMENSION_ORDER) {
    if (dimension === "keywordCoverage") continue;

    if (dimension === "roleAlignment") {
      const contributions = byDimension.get(dimension) ?? [];
      const role = scoreRoleAlignment(contributions, coverage.roleSignals);
      parts.roleAlignment = role.score;
      dimensions.push({
        dimension,
        score: role.score === null ? null : clampScore(role.score),
        earned: role.earned,
        possible: role.possible,
        contributions,
      });
      continue;
    }

    const contributions = byDimension.get(dimension) ?? [];
    const possible = contributions.reduce((total, entry) => total + entry.weight, 0);
    const earned = contributions.reduce((total, entry) => total + entry.earned, 0);
    // Nothing asked for is nothing measured, and nothing measured is not zero.
    const score = possible > 0 ? (earned / possible) * 100 : null;

    parts[dimension] = score;
    dimensions.push({
      dimension,
      score: score === null ? null : clampScore(score),
      earned,
      possible,
      contributions,
    });
  }

  const keywords = scoreKeywords(analysis, coverage);
  parts.keywordCoverage = keywords.score;
  dimensions.push({
    dimension: "keywordCoverage",
    score: keywords.score === null ? null : clampScore(keywords.score),
    earned: keywords.earned,
    possible: keywords.possible,
    contributions: [],
  });

  const jobMatch = toJobMatch(parts);

  const named = (match: RequirementMatch) =>
    analysis.requirements
      .filter((requirement) => (verdicts.get(requirement.id)?.match ?? "missing") === match)
      .map((requirement) => requirement.name);

  const explanation: JobMatchExplanation = {
    dimensions: DIMENSION_ORDER.map((dimension) =>
      dimensions.find((entry) => entry.dimension === dimension)!,
    ),
    strong: named("strong"),
    partial: named("partial"),
    missing: named("missing"),
    keywords: keywords.detail,
    warnings: [],
  };

  explanation.warnings = sanityCheck(analysis, coverage, jobMatch);

  return { jobMatch, explanation };
}

/**
 * Role alignment: four signals, weighted, renormalised over whatever the advert
 * gave.
 *
 * The soft-skill requirements are one of the four rather than the whole, which
 * is what stops a single matched phrase — "worked with the designers" — from
 * declaring a junior agency CV a perfect fit for a senior fintech role.
 */
function scoreRoleAlignment(
  contributions: readonly Contribution[],
  signals: CoverageReport["roleSignals"],
): { score: number | null; earned: number; possible: number } {
  const parts: Array<{ value: number; weight: number }> = [];

  const possibleSoft = contributions.reduce((total, entry) => total + entry.weight, 0);
  const earnedSoft = contributions.reduce((total, entry) => total + entry.earned, 0);
  if (possibleSoft > 0) {
    parts.push({
      value: (earnedSoft / possibleSoft) * 100,
      weight: ROLE_SIGNAL_WEIGHTS.softSkills,
    });
  }

  if (signals.title !== null) {
    parts.push({ value: signals.title * 100, weight: ROLE_SIGNAL_WEIGHTS.title });
  }
  if (signals.seniority !== null) {
    parts.push({ value: signals.seniority * 100, weight: ROLE_SIGNAL_WEIGHTS.seniority });
  }
  if (signals.domain !== null) {
    parts.push({ value: signals.domain * 100, weight: ROLE_SIGNAL_WEIGHTS.domain });
  }

  if (parts.length === 0) return { score: null, earned: 0, possible: 0 };

  const weight = parts.reduce((total, part) => total + part.weight, 0);
  const value = parts.reduce((total, part) => total + part.value * part.weight, 0) / weight;

  return { score: value, earned: (value / 100) * weight, possible: weight };
}

/**
 * Keyword coverage: the terms that make this role specific, not every word the
 * advert happens to repeat.
 *
 * A primary keyword counts double, and each one counts once however many times
 * it appears — repeating "React" six times in a CV is not six times the
 * evidence, and a scorer that thought so would be teaching people to stuff.
 */
function scoreKeywords(
  analysis: JobAnalysis,
  coverage: CoverageReport,
): {
  score: number | null;
  earned: number;
  possible: number;
  detail: { matched: string[]; missed: string[] };
} {
  const weightOf = (weight: "primary" | "secondary") => (weight === "primary" ? 2 : 1);
  const found = new Set(coverage.keywords);

  let earned = 0;
  let possible = 0;
  const matched: string[] = [];
  const missed: string[] = [];

  for (const keyword of analysis.keywords) {
    const weight = weightOf(keyword.weight);
    possible += weight;
    if (found.has(keyword.id)) {
      earned += weight;
      matched.push(keyword.text);
    } else {
      missed.push(keyword.text);
    }
  }

  return {
    score: possible > 0 ? (earned / possible) * 100 : null,
    earned,
    possible,
    detail: { matched, missed },
  };
}

/**
 * A check on the arithmetic, not on the candidate.
 *
 * If nearly everything the advert insists on is evidenced and the figure still
 * comes out low, the aggregation is wrong — that is a bug, and it should say so
 * where a developer will see it rather than being discovered by somebody
 * wondering why their CV scored 55.
 */
export function sanityCheck(
  analysis: JobAnalysis,
  coverage: CoverageReport,
  jobMatch: JobMatch,
): string[] {
  const verdicts = new Map(coverage.requirements.map((entry) => [entry.requirementId, entry]));
  const warnings: string[] = [];

  const required = analysis.requirements.filter(
    (requirement) => requirement.importance === "required",
  );
  const strongRequired = required.filter(
    (requirement) => verdicts.get(requirement.id)?.match === "strong",
  );

  if (required.length >= 3) {
    const share = strongRequired.length / required.length;
    if (share >= 0.9 && jobMatch.overallScore < 60) {
      warnings.push(
        `${strongRequired.length} of ${required.length} required requirements are evidenced, but the overall figure is ${jobMatch.overallScore}. The aggregation is probably wrong.`,
      );
    }
  }

  const answered = coverage.requirements.filter((entry) => entry.match !== "missing").length;
  if (analysis.requirements.length > 0 && answered === 0 && jobMatch.overallScore > 20) {
    warnings.push("Nothing is evidenced, yet the figure is above zero.");
  }

  return warnings;
}

/** Every requirement of the advert, in one list. */
export function requirementsOf(analysis: JobAnalysis): JobRequirement[] {
  return analysis.requirements;
}
