import "server-only";

import type { Resume } from "@/lib/resume/schema";
import { resumeElements } from "@/lib/resume/target";
import { hasResumeContent } from "@/lib/resume/text";
import { computeCoverage } from "@/lib/tailoring/coverage";
import { gapSuggestions, suggestionTargetKey } from "@/lib/tailoring/gaps";
import { hasJobContent, readJobDescription } from "@/lib/tailoring/heuristics";
import { sortSuggestions } from "@/lib/tailoring/queue";
import { groundSuggestions } from "@/lib/tailoring/safety";
import type { ModelAnalysis } from "@/lib/tailoring/schema";
import type {
  CoverageReport,
  JobAnalysis,
  JobMatch,
  JobRequirement,
  ResumeSuggestion,
  TailoringAnalysis,
} from "@/lib/tailoring/types";

import { isModelConfigured, requestAnalysis } from "./model";

/**
 * One reading of one CV against one advert, assembled.
 *
 *     advert ──▶ deterministic reading ──┐
 *                                        ├──▶ merged JobAnalysis ──▶ coverage ──▶ JobMatch
 *     advert + CV ──▶ model ─────────────┘            │
 *                          │                          └──▶ gaps (deterministic)
 *                          └──▶ rewrites ──▶ grounding ──▶ suggestions ──▶ sorted
 *
 * The two halves do different work on purpose. The model reads prose — it can
 * tell that "you will own the reliability of the checkout" is a responsibility
 * and that "TS" means TypeScript — and it can rewrite a sentence in the
 * person's own voice. Everything after that is arithmetic the application owns,
 * so the figure on screen can be recomputed after every applied change without
 * another request, and two readings of the same document agree.
 *
 * The model is optional at every step. With no key configured, the reading is
 * the deterministic one and the product is whole apart from the rewrites.
 */

const MAX_SUGGESTIONS = 24;

function withIds(
  requirements: ModelAnalysis["jobAnalysis"]["requiredSkills"],
  prefix: string,
): JobRequirement[] {
  return requirements.map((requirement, position) => ({
    id: `${prefix}-${position}`,
    text: requirement.text,
    importance: requirement.importance,
    kind: requirement.kind,
    terms: requirement.terms.length > 0 ? requirement.terms : [requirement.text],
  }));
}

/**
 * The model's reading, where it produced one; the deterministic reading where
 * it did not.
 *
 * Per list rather than wholesale: a model that returns skills but forgets
 * keywords should not cost the keywords the advert plainly repeats.
 */
export function mergeAnalysis(base: JobAnalysis, model: ModelAnalysis["jobAnalysis"]): JobAnalysis {
  const required = withIds(model.requiredSkills, "m-req");
  const preferred = withIds(model.preferredSkills, "m-pref");
  const responsibilities = withIds(model.responsibilities, "m-resp");
  const qualifications = withIds(model.experienceRequirements, "m-qual");

  return {
    roleTitle: model.roleTitle || base.roleTitle,
    requiredSkills: required.length > 0 ? required : base.requiredSkills,
    preferredSkills: preferred.length > 0 ? preferred : base.preferredSkills,
    responsibilities: responsibilities.length > 0 ? responsibilities : base.responsibilities,
    experienceRequirements:
      qualifications.length > 0 ? qualifications : base.experienceRequirements,
    keywords:
      model.keywords.length > 0
        ? model.keywords.map((keyword, position) => ({ ...keyword, id: `m-kw-${position}` }))
        : base.keywords,
    inferredSeniority: model.inferredSeniority || base.inferredSeniority,
    domain: model.domain || base.domain,
  };
}

/**
 * The model's recommendations and the deterministic gaps, in one list.
 *
 * A gap the model already reported is not reported twice: the model's version
 * is kept, because it read the sentence the requirement came from. What the
 * deterministic pass adds is everything the model did not mention — and it is
 * added rather than trusted away, because a model that returns three
 * recommendations for a CV with nine gaps has not made the other six untrue.
 */
export function mergeSuggestions(
  fromModel: ResumeSuggestion[],
  fromGaps: ResumeSuggestion[],
): ResumeSuggestion[] {
  const seen = new Set(
    fromModel.map((suggestion) => `${suggestion.type}:${suggestionTargetKey(suggestion)}`),
  );
  const claimed = new Set(
    fromModel.flatMap((suggestion) =>
      (suggestion.relatedKeywords ?? []).map((keyword) => keyword.toLowerCase()),
    ),
  );

  const extra = fromGaps.filter((suggestion) => {
    if (seen.has(`${suggestion.type}:${suggestionTargetKey(suggestion)}`)) return false;
    return !(suggestion.relatedKeywords ?? []).some((keyword) =>
      claimed.has(keyword.toLowerCase()),
    );
  });

  return [...fromModel, ...extra].slice(0, MAX_SUGGESTIONS);
}

/** The figure and the coverage behind it, for a document that has already been read. */
export function recompute(
  resume: Resume,
  jobAnalysis: JobAnalysis,
): { jobMatch: JobMatch; coverage: CoverageReport } {
  return computeCoverage(resume, jobAnalysis);
}

export type AnalysisFailure = { ok: false; reason: "empty-resume" | "empty-job" };
export type AnalysisSuccess = { ok: true; analysis: TailoringAnalysis };

export async function analyze(input: {
  resume: Resume;
  jobDescription: string;
}): Promise<AnalysisSuccess | AnalysisFailure> {
  if (!hasResumeContent(input.resume)) return { ok: false, reason: "empty-resume" };
  if (!hasJobContent(input.jobDescription)) return { ok: false, reason: "empty-job" };

  const deterministic = readJobDescription(input.jobDescription);

  const model = isModelConfigured() ? await requestAnalysis(input) : null;
  const degraded = Boolean(model && !model.ok && model.reason !== "unconfigured");

  const jobAnalysis = model?.ok
    ? mergeAnalysis(deterministic, model.data.jobAnalysis)
    : deterministic;
  const { jobMatch, coverage } = computeCoverage(input.resume, jobAnalysis);

  const fromModel = model?.ok
    ? groundSuggestions(
        input.resume,
        model.data.suggestions.map((suggestion, position) => ({
          ...suggestion,
          id: `m-${position + 1}`,
          source: "model" as const,
          status: "pending" as const,
        })),
      ).suggestions
    : [];

  const fromGaps = gapSuggestions({ resume: input.resume, analysis: jobAnalysis, coverage });
  const order = resumeElements(input.resume).map((element) => element.key);

  return {
    ok: true,
    analysis: {
      jobAnalysis,
      coverage,
      jobMatch,
      suggestions: sortSuggestions(mergeSuggestions(fromModel, fromGaps), order),
      source: model?.ok ? "model" : "heuristic",
      analyzedAt: new Date().toISOString(),
      ...(degraded ? { degraded: true } : {}),
    },
  };
}
