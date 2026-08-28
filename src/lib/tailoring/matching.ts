import type { Resume } from "@/lib/resume/schema";
import { resumeElements, type ResumeArea, type ResumeElement } from "@/lib/resume/target";

import { containsAny, containsTerm, keyTerms, normalize } from "./match";
import { scoreAnalysis } from "./score";
import type {
  CoverageReport,
  JobAnalysis,
  JobMatch,
  JobMatchExplanation,
  JobRequirement,
  MatchEvidence,
  RequirementMatchResult,
  RoleSignals,
} from "./types";

/**
 * The comparison itself, without a model: what the advert asks for, set against
 * what the CV actually says, with the lines that say it.
 *
 * This is the floor. Where a model is configured it classifies instead — it can
 * see that "took the search rankings from a rebuild" is evidence for technical
 * SEO — and its verdicts arrive in exactly this shape, so everything after this
 * point is the same code either way.
 *
 * What makes the floor worth having is `equivalences.ts`: the requirement
 * arrives with the other ways of saying it, so "server-rendered rebuild"
 * answers SSR and "usable with a screen reader" answers accessibility. Without
 * that, matching is string comparison against the advert's own vocabulary,
 * which scores paraphrase as absence — and paraphrase is what a real CV is
 * written in.
 */

/** Where a hit was found, and how much that place is worth believing. */
type Hit = { element: ResumeElement; term: string };

const EVIDENCE_SOURCE: Record<ResumeArea, MatchEvidence["source"]> = {
  headline: "profile",
  summary: "profile",
  experience: "experience",
  skills: "skills",
  education: "education",
  other: "profile",
};

/** Categories a skills list can prove on its own. */
const CLAIMABLE = new Set(["skill", "tool", "practice"]);

/**
 * Categories a summary can prove on its own.
 *
 * These are statements about a career rather than about a task: "eight years
 * shipping consumer-facing products for banks" is where a person says what kind
 * of work they have done, and demanding it again inside a bullet would be the
 * same lexical strictness that scored paraphrase as absence. A responsibility
 * is not on the list — nobody demonstrates "owns component architecture" by
 * writing it in their summary.
 */
const PROFILE_PROVABLE = new Set(["domain", "soft_skill", "experience"]);

const MAX_EVIDENCE = 3;

function evidenceFrom(hit: Hit): MatchEvidence {
  return {
    key: hit.element.key,
    target: hit.element.target,
    source: EVIDENCE_SOURCE[hit.element.area],
    // Enough to recognise the line, not the whole document.
    text: hit.element.text.slice(0, 240),
  };
}

/**
 * One requirement, answered from the document.
 *
 * The verdict depends on where the evidence is as well as whether it exists. A
 * technology named inside a role is work someone did; the same technology in a
 * skills list is a claim, which for a tool or a practice is credible on its own
 * and for a responsibility is not — nobody demonstrates "owns component
 * architecture" by listing it.
 */
export function matchRequirement(
  elements: readonly ResumeElement[],
  requirement: JobRequirement,
): RequirementMatchResult {
  const terms = [requirement.name, ...requirement.aliases].filter(
    (term) => term.trim().length >= 2,
  );

  const hits: Hit[] = [];

  for (const element of elements) {
    if (!element.text.trim()) continue;
    const haystack = normalize(element.text);

    for (const term of terms) {
      if (!containsTerm(haystack, term)) continue;
      hits.push({ element, term });
      break;
    }
  }

  if (hits.length === 0) {
    return { requirementId: requirement.id, match: "missing", evidence: [], confidence: 0.9 };
  }

  const provingArea = (hit: Hit) => {
    if (hit.element.area === "experience") return true;
    if (hit.element.area === "skills") return CLAIMABLE.has(requirement.category);
    if (hit.element.area === "summary" || hit.element.area === "headline") {
      return PROFILE_PROVABLE.has(requirement.category);
    }
    return false;
  };

  const proving = hits.filter(provingArea);
  const chosen = (proving.length > 0 ? proving : hits).slice(0, MAX_EVIDENCE);

  // A hit on the requirement's own name is a surer reading than one on an
  // alias, and the confidence says so without changing what it is worth.
  const byName = chosen.some((hit) => hit.term.toLowerCase() === requirement.name.toLowerCase());

  return {
    requirementId: requirement.id,
    match: proving.length > 0 ? "strong" : "partial",
    evidence: chosen.map(evidenceFrom),
    confidence: byName ? 0.9 : 0.7,
    reasoning:
      proving.length > 0
        ? `Found in the ${EVIDENCE_SOURCE[chosen[0]!.element.area]} section as "${chosen[0]!.term}".`
        : `Mentioned as "${chosen[0]!.term}", but not where it would count as evidence of doing the work.`,
  };
}

/**
 * Every requirement, and every keyword, answered from the document.
 *
 * Deterministic and pure, which is a product decision rather than a
 * convenience: the figure has to be able to change the instant a bullet is
 * edited, before any model has been asked anything and without spending a
 * request to find out.
 */
export function matchResume(resume: Resume, analysis: JobAnalysis): CoverageReport {
  const elements = resumeElements(resume);
  const whole = normalize(elements.map((element) => element.text).join(" "));

  return {
    roleSignals: readRoleSignals(elements, whole, analysis),
    requirements: analysis.requirements.map((requirement) =>
      matchRequirement(elements, requirement),
    ),
    /**
     * Once each, however many times it appears: repetition is not evidence.
     * Aliases count, because the question is whether the terminology is in the
     * document and not whether the person guessed the advert's spelling.
     */
    keywords: analysis.keywords
      .filter((keyword) => containsAny(whole, [keyword.text, ...(keyword.aliases ?? [])]))
      .map((keyword) => keyword.id),
  };
}

export type CoverageResult = {
  jobMatch: JobMatch;
  coverage: CoverageReport;
  explanation: JobMatchExplanation;
};

/**
 * The whole comparison, in one pass over the document.
 *
 * Called after every applied change, which is what makes the figure honest: it
 * moves when the text moves and stays put when it does not.
 */
export function computeCoverage(resume: Resume, analysis: JobAnalysis): CoverageResult {
  const coverage = matchResume(resume, analysis);
  const { jobMatch, explanation } = scoreAnalysis(analysis, coverage);
  return { jobMatch, coverage, explanation };
}

/**
 * The same, for verdicts that came from a model: the classification is theirs,
 * the arithmetic is ours, and a requirement the model failed to answer is
 * missing rather than absent from the sum.
 */
export function scoreWithVerdicts(
  analysis: JobAnalysis,
  verdicts: readonly RequirementMatchResult[],
  keywords: readonly string[],
  roleSignals: RoleSignals,
): CoverageResult {
  const answered = new Map(verdicts.map((verdict) => [verdict.requirementId, verdict]));

  const coverage: CoverageReport = {
    requirements: analysis.requirements.map(
      (requirement): RequirementMatchResult =>
        answered.get(requirement.id) ?? {
          requirementId: requirement.id,
          match: "missing",
          evidence: [],
          confidence: 0.5,
        },
    ),
    keywords: [...keywords],
    roleSignals,
  };

  const { jobMatch, explanation } = scoreAnalysis(analysis, coverage);
  return { jobMatch, coverage, explanation };
}

/**
 * The three whole-document signals behind Role Alignment.
 *
 * They are read here rather than in `score.ts` because they are the only part
 * of the figure that needs the CV itself rather than the verdicts — and because
 * a model, when one is configured, should be able to leave them to the same
 * arithmetic instead of forming an opinion about somebody's seniority.
 *
 * Each is null when the advert did not say: an advert that never names a level
 * cannot find a CV wanting for not matching it.
 */
export function readRoleSignals(
  elements: readonly ResumeElement[],
  whole: string,
  analysis: JobAnalysis,
): RoleSignals {
  const areaText = (area: ResumeArea) =>
    normalize(
      elements
        .filter((element) => element.area === area)
        .map((element) => element.text)
        .join(" "),
    );

  const headline = areaText("headline");
  const summary = areaText("summary");
  const experience = areaText("experience");

  const titleTerms = keyTerms(analysis.roleTitle).slice(0, 6);
  const title =
    titleTerms.length === 0
      ? null
      : titleTerms.reduce((total, term) => {
          // Where the CV says it decides how much it is saying it: a job title
          // is a claim about identity, and the headline is where it is made.
          if (containsTerm(headline, term)) return total + 1;
          if (containsTerm(summary, term)) return total + 0.7;
          if (containsTerm(experience, term)) return total + 0.5;
          return total;
        }, 0) / titleTerms.length;

  const seniority = analysis.inferredSeniority.trim()
    ? containsTerm(whole, analysis.inferredSeniority)
      ? 1
      : // Absent is a weak signal rather than a failure: plenty of CVs never
        // spell out a level and are read at the right one anyway.
        0.4
    : null;

  const domainTerms = [
    analysis.domain,
    ...analysis.requirements
      .filter((requirement) => requirement.category === "domain")
      .flatMap((requirement) => [requirement.name, ...requirement.aliases]),
  ].filter((term) => term.trim().length > 0);

  const domain =
    domainTerms.length === 0 ? null : containsAny(whole, domainTerms) !== null ? 1 : 0.3;

  return { title: title === null ? null : Math.min(1, title), seniority, domain };
}
