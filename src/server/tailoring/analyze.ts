import "server-only";

import type { Resume } from "@/lib/resume/schema";
import { resumeElements } from "@/lib/resume/target";
import { hasResumeContent } from "@/lib/resume/text";
import { gapSuggestions, suggestionTargetKey } from "@/lib/tailoring/gaps";
import { hasJobContent, readJobDescription } from "@/lib/tailoring/heuristics";
import { computeCoverage, matchResume, scoreWithVerdicts } from "@/lib/tailoring/matching";
import { sortSuggestions } from "@/lib/tailoring/queue";
import { groundSuggestions } from "@/lib/tailoring/safety";
import type { ModelReading } from "@/lib/tailoring/schema";
import { JOB_MATCH_SCORING_VERSION } from "@/lib/tailoring/score";
import type { AnalysisStepId } from "@/lib/tailoring/steps";
import type {
  CoverageReport,
  JobAnalysis,
  JobMatch,
  JobMatchExplanation,
  RequirementMatchResult,
  ResumeSuggestion,
  TailoringAnalysis,
} from "@/lib/tailoring/types";

import { isModelConfigured, requestReading, ANALYSIS_PROMPT_VERSION } from "./model";

/**
 * One reading of one CV against one advert, assembled.
 *
 *     advert ──▶ requirements ──┐
 *                               ├──▶ verdict per requirement ──▶ arithmetic ──▶ Job Match
 *     CV ────────────────────────┘         (with evidence)
 *
 * The division of labour is the whole design. A model reads prose: it can tell
 * that "Employment" and "Work History" are the same heading, that "took the
 * search rankings from a rebuild" is evidence for technical SEO, and that an
 * "added bonus" is worth less than a "must have". What it is never asked for is
 * a number — there is no field for one in the schema it answers in.
 *
 * The arithmetic is local, and that is what makes the figure explainable, cheap
 * to recompute after every applied change, and identical for the same two
 * documents twice running.
 */

export type StepReporter = (step: AnalysisStepId) => void | Promise<void>;

export type AnalysisFailure = {
  ok: false;
  reason: "empty-resume" | "empty-job" | "cancelled";
};

export type AnalysisSuccess = { ok: true; analysis: TailoringAnalysis };

/** The figure and its working, for a document that has already been read. */
export function recompute(
  resume: Resume,
  jobAnalysis: JobAnalysis,
): { jobMatch: JobMatch; coverage: CoverageReport; explanation: JobMatchExplanation } {
  return computeCoverage(resume, jobAnalysis);
}

/**
 * The model's reading of the advert, with ids of this application's own.
 *
 * An id from a generated answer is not something to store or to match on, so
 * the model's ids live exactly as long as it takes to re-key its verdicts
 * against them. A verdict naming a requirement that does not exist is dropped
 * rather than guessed at.
 */
export function adoptReading(reading: ModelReading): {
  jobAnalysis: JobAnalysis;
  verdicts: RequirementMatchResult[];
} {
  const idMap = new Map<string, string>();

  const requirements = reading.jobAnalysis.requirements.map((requirement, index) => {
    const id = `req-${index}`;
    idMap.set(requirement.id, id);
    return {
      id,
      name: requirement.name,
      category: requirement.category,
      importance: requirement.importance,
      aliases: requirement.aliases,
      sourceText: requirement.sourceText,
    };
  });

  const verdicts = reading.matches.flatMap((match): RequirementMatchResult[] => {
    const requirementId = idMap.get(match.requirementId);
    if (!requirementId) return [];

    return [
      {
        requirementId,
        match: match.match,
        confidence: match.confidence,
        evidence: match.evidence.map((entry) => ({
          key: entry.key,
          source: entry.source,
          text: entry.text,
        })),
        reasoning: match.reasoning,
      },
    ];
  });

  return {
    jobAnalysis: {
      roleTitle: reading.jobAnalysis.roleTitle,
      requirements,
      keywords: reading.jobAnalysis.keywords.map((keyword, index) => ({
        ...keyword,
        id: `kw-${index}`,
      })),
      inferredSeniority: reading.jobAnalysis.inferredSeniority,
      domain: reading.jobAnalysis.domain,
    },
    verdicts,
  };
}

/**
 * The model's recommendations and the deterministic gaps, in one list.
 *
 * A gap the model already reported is not reported twice — its version is kept,
 * because it read the sentence the requirement came from. What the deterministic
 * pass adds is everything the model did not mention, and it is added rather than
 * trusted away: a model that returns three recommendations for a CV with nine
 * gaps has not made the other six untrue.
 */
export function mergeSuggestions(
  fromModel: ResumeSuggestion[],
  fromGaps: ResumeSuggestion[],
): ResumeSuggestion[] {
  const seen = new Set(
    fromModel.map((suggestion) => `${suggestion.type}:${suggestionTargetKey(suggestion)}`),
  );
  const claimed = new Set(
    fromModel.flatMap((suggestion) => [
      ...(suggestion.requirementId ? [suggestion.requirementId] : []),
      ...(suggestion.relatedKeywords ?? []).map((keyword) => keyword.toLowerCase()),
    ]),
  );

  const extra = fromGaps.filter((suggestion) => {
    if (seen.has(`${suggestion.type}:${suggestionTargetKey(suggestion)}`)) return false;
    if (suggestion.requirementId && claimed.has(suggestion.requirementId)) return false;
    return !(suggestion.relatedKeywords ?? []).some((keyword) =>
      claimed.has(keyword.toLowerCase()),
    );
  });

  return [...fromModel, ...extra].slice(0, MAX_SUGGESTIONS);
}

const MAX_SUGGESTIONS = 24;

export async function analyze(input: {
  resume: Resume;
  jobDescription: string;
  onStep?: StepReporter;
  signal?: AbortSignal;
}): Promise<AnalysisSuccess | AnalysisFailure> {
  const report = async (step: AnalysisStepId) => {
    await input.onStep?.(step);
  };

  const cancelled = () => input.signal?.aborted === true;

  if (!hasResumeContent(input.resume)) return { ok: false, reason: "empty-resume" };
  if (!hasJobContent(input.jobDescription)) return { ok: false, reason: "empty-job" };

  await report("resume");

  await report("job");
  const deterministic = readJobDescription(input.jobDescription);

  if (cancelled()) return { ok: false, reason: "cancelled" };

  // The long stage, and the only one that leaves the machine.
  await report("compare");
  const reading = isModelConfigured()
    ? await requestReading({
        resume: input.resume,
        jobDescription: input.jobDescription,
        signal: input.signal,
      })
    : null;

  if (cancelled()) return { ok: false, reason: "cancelled" };

  const degraded = Boolean(reading && !reading.ok && reading.reason !== "unconfigured");
  const adopted = reading?.ok ? adoptReading(reading.data) : null;

  const jobAnalysis =
    adopted && adopted.jobAnalysis.requirements.length > 0 ? adopted.jobAnalysis : deterministic;

  await report("score");

  /**
   * Keywords are matched here whoever read the advert.
   *
   * Keyword coverage is a claim about the words in the document, and whether a
   * word is in a document is not a judgement — asking a model for it would be
   * paying for a string search and getting a less reliable one.
   */
  const lexical = matchResume(input.resume, jobAnalysis);

  const scored =
    adopted && adopted.verdicts.length > 0
      ? scoreWithVerdicts(jobAnalysis, adopted.verdicts, lexical.keywords, lexical.roleSignals)
      : computeCoverage(input.resume, jobAnalysis);

  await report("suggestions");

  const fromModel = reading?.ok
    ? groundSuggestions(
        input.resume,
        reading.data.suggestions.map((suggestion, position) => ({
          ...suggestion,
          id: `m-${position + 1}`,
          source: "model" as const,
          status: "pending" as const,
        })),
      ).suggestions
    : [];

  const fromGaps = gapSuggestions({
    resume: input.resume,
    analysis: jobAnalysis,
    coverage: scored.coverage,
  });

  const order = resumeElements(input.resume).map((element) => element.key);

  return {
    ok: true,
    analysis: {
      jobAnalysis,
      coverage: scored.coverage,
      jobMatch: scored.jobMatch,
      explanation: scored.explanation,
      suggestions: sortSuggestions(mergeSuggestions(fromModel, fromGaps), order),
      source: adopted ? "model" : "heuristic",
      analyzedAt: new Date().toISOString(),
      ...(degraded ? { degraded: true } : {}),
    },
  };
}

export { ANALYSIS_PROMPT_VERSION, JOB_MATCH_SCORING_VERSION };
