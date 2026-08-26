import type { Resume } from "@/lib/resume/schema";
import { resumeText, type ResumeText } from "@/lib/resume/text";

import { containsAny, containsTerm, keyTerms, normalize } from "./match";
import { toJobMatch } from "./score";
import type {
  CoverageReport,
  JobAnalysis,
  JobMatch,
  JobRequirement,
  RequirementCoverage,
  RequirementImportance,
} from "./types";

/**
 * The comparison itself: what the advert asks for, set against what the CV
 * actually says.
 *
 * This module is pure and deterministic, and that is a product decision rather
 * than a convenience. The score has to be able to change the instant a bullet
 * is edited — before any model has been asked anything, and without spending a
 * request to find out. So the model's job ends at reading the advert; from
 * there the arithmetic is local, repeatable, and cheap enough to run on every
 * applied change.
 *
 *     job advert ──model or heuristics──▶ JobAnalysis
 *                                             │
 *     CV ─────────────────────────────────────┼──▶ coverage ──▶ JobMatch
 *                                             │
 *                       (re-run locally after every edit)
 */

/** How much a requirement counts, by how insistently the advert asks for it. */
const IMPORTANCE_WEIGHT: Record<RequirementImportance, number> = {
  required: 1,
  important: 0.7,
  /**
   * A "nice to have" that is missing barely costs anything — section 5 is
   * explicit that an optional skill must not be penalised as if it were
   * mandatory — but finding one still pays.
   */
  preferred: 0.4,
};

/** Evidence in the work history is worth more than a claim in a list. */
const EVIDENCE_VALUE = { strong: 1, partial: 0.6, missing: 0 } as const;

const KEYWORD_WEIGHT = { primary: 2, secondary: 1 } as const;

type Index = { areas: ResumeText; normalized: Record<keyof ResumeText, string> };

function index(resume: Resume): Index {
  const areas = resumeText(resume);
  const normalized = Object.fromEntries(
    Object.entries(areas).map(([area, text]) => [area, normalize(text)]),
  ) as Record<keyof ResumeText, string>;
  return { areas, normalized };
}

/** The spellings that count as evidence, falling back to the words of the requirement. */
function termsOf(requirement: JobRequirement): string[] {
  const declared = requirement.terms.filter((term) => term.trim().length >= 2);
  return declared.length > 0 ? declared : keyTerms(requirement.text).slice(0, 6);
}

/**
 * One requirement, answered.
 *
 * A skill is strong when it appears inside the work history and partial when it
 * only appears in a list — the difference between "I have used this" and "I
 * have written this down". A responsibility is strong when most of what
 * describes it is present, because a sentence rarely matches a sentence.
 */
export function coverRequirement(
  resumeIndex: Index,
  requirement: JobRequirement,
): RequirementCoverage {
  const terms = termsOf(requirement);
  if (terms.length === 0) {
    return { requirementId: requirement.id, status: "missing" };
  }

  if (requirement.kind === "skill") {
    const inWork = containsAny(resumeIndex.normalized.experience, terms);
    if (inWork) return { requirementId: requirement.id, status: "strong", matchedTerm: inWork };

    const claimed =
      containsAny(resumeIndex.normalized.skills, terms) ??
      containsAny(resumeIndex.normalized.summary, terms) ??
      containsAny(resumeIndex.normalized.headline, terms) ??
      containsAny(resumeIndex.normalized.education, terms);
    if (claimed) return { requirementId: requirement.id, status: "partial", matchedTerm: claimed };

    return { requirementId: requirement.id, status: "missing" };
  }

  const hits = terms.filter((term) => containsTerm(resumeIndex.normalized.all, term));
  const share = hits.length / terms.length;
  const inWork = hits.some((term) => containsTerm(resumeIndex.normalized.experience, term));

  if (share >= 0.6 && inWork) {
    return { requirementId: requirement.id, status: "strong", matchedTerm: hits[0] };
  }
  if (share >= 0.3 || (hits.length > 0 && inWork)) {
    return { requirementId: requirement.id, status: "partial", matchedTerm: hits[0] };
  }
  return { requirementId: requirement.id, status: "missing" };
}

/** Weighted share of the evidence a set of requirements asked for. Null when it asked for nothing. */
function dimension(
  requirements: JobRequirement[],
  coverage: Map<string, RequirementCoverage>,
): number | null {
  if (requirements.length === 0) return null;

  let earned = 0;
  let possible = 0;
  for (const requirement of requirements) {
    const weight = IMPORTANCE_WEIGHT[requirement.importance];
    const status = coverage.get(requirement.id)?.status ?? "missing";
    earned += EVIDENCE_VALUE[status] * weight;
    possible += weight;
  }

  return possible === 0 ? null : (earned / possible) * 100;
}

/**
 * Whether the CV reads as the professional the advert describes.
 *
 * Four signals, each optional, each renormalised away when the advert did not
 * provide it: the title, the seniority, the domain, and how much of what is
 * being asked for is visible at the top of the document rather than buried on
 * page two.
 */
function roleAlignment(resumeIndex: Index, analysis: JobAnalysis): number | null {
  const signals: Array<{ value: number; weight: number }> = [];

  const titleTerms = keyTerms(analysis.roleTitle).slice(0, 6);
  if (titleTerms.length > 0) {
    const scored: number[] = titleTerms.map((term) => {
      if (containsTerm(resumeIndex.normalized.headline, term)) return 1;
      if (containsTerm(resumeIndex.normalized.summary, term)) return 0.7;
      if (containsTerm(resumeIndex.normalized.experience, term)) return 0.5;
      return 0;
    });
    const total = scored.reduce((sum, value) => sum + value, 0);
    signals.push({ value: (total / titleTerms.length) * 100, weight: 0.5 });
  }

  if (analysis.inferredSeniority.trim()) {
    const present = containsAny(resumeIndex.normalized.all, keyTerms(analysis.inferredSeniority));
    // Absent seniority is a weak signal, not a failure: plenty of CVs never
    // spell out a level and are read at the right one anyway.
    signals.push({ value: present ? 100 : 40, weight: 0.2 });
  }

  if (analysis.domain.trim()) {
    const present = containsAny(resumeIndex.normalized.all, keyTerms(analysis.domain));
    signals.push({ value: present ? 100 : 40, weight: 0.15 });
  }

  const headlineAndSummary = `${resumeIndex.normalized.headline} ${resumeIndex.normalized.summary}`;
  if (analysis.requiredSkills.length > 0) {
    const visible = analysis.requiredSkills.filter((requirement) =>
      containsAny(headlineAndSummary, termsOf(requirement)),
    ).length;
    // Capped: a summary is not supposed to list everything, so answering a
    // third of what is asked for already reads as a targeted profile.
    const share = Math.min(1, visible / Math.max(1, Math.ceil(analysis.requiredSkills.length / 3)));
    signals.push({ value: share * 100, weight: 0.15 });
  }

  if (signals.length === 0) return null;

  const weight = signals.reduce((sum, signal) => sum + signal.weight, 0);
  return signals.reduce((sum, signal) => sum + signal.value * signal.weight, 0) / weight;
}

export type CoverageResult = { jobMatch: JobMatch; coverage: CoverageReport };

/**
 * The whole comparison, in one pass over the document.
 *
 * Called on every reading of the advert and again after every applied change,
 * which is what makes the figure honest: it moves when the text moves and stays
 * put when it does not.
 */
export function computeCoverage(resume: Resume, analysis: JobAnalysis): CoverageResult {
  const resumeIndex = index(resume);

  const all = [
    ...analysis.requiredSkills,
    ...analysis.preferredSkills,
    ...analysis.responsibilities,
    ...analysis.experienceRequirements,
  ];

  const requirements = all.map((requirement) => coverRequirement(resumeIndex, requirement));
  const byId = new Map(requirements.map((entry) => [entry.requirementId, entry]));

  const keywords = analysis.keywords
    .filter((keyword) => containsTerm(resumeIndex.normalized.all, keyword.text))
    .map((keyword) => keyword.id);

  const keywordCoverage = (() => {
    if (analysis.keywords.length === 0) return null;
    const found = new Set(keywords);
    let earned = 0;
    let possible = 0;
    for (const keyword of analysis.keywords) {
      const weight = KEYWORD_WEIGHT[keyword.weight];
      possible += weight;
      if (found.has(keyword.id)) earned += weight;
    }
    return possible === 0 ? null : (earned / possible) * 100;
  })();

  const jobMatch = toJobMatch({
    skillsMatch: dimension([...analysis.requiredSkills, ...analysis.preferredSkills], byId),
    experienceRelevance: dimension(
      [...analysis.responsibilities, ...analysis.experienceRequirements],
      byId,
    ),
    keywordCoverage,
    roleAlignment: roleAlignment(resumeIndex, analysis),
  });

  return { jobMatch, coverage: { requirements, keywords } };
}

/** Every requirement of the advert, in one list, with its coverage attached. */
export function requirementsOf(analysis: JobAnalysis): JobRequirement[] {
  return [
    ...analysis.requiredSkills,
    ...analysis.preferredSkills,
    ...analysis.responsibilities,
    ...analysis.experienceRequirements,
  ];
}
