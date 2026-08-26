import type { ResumeSectionId } from "@/lib/resume/schema";
import type { ResumeTarget } from "@/lib/resume/target";

/**
 * What a job advert turns into before anything is compared against it.
 *
 * The advert itself is prose, and prose cannot be scored or pointed at. The
 * analysis is the structured reading of it: the things being asked for, how
 * strongly each one is asked for, and the words the advert keeps returning to.
 * Both the score and every recommendation are derived from this object, so two
 * runs that read the advert the same way score it the same way.
 */

export type RequirementImportance = "required" | "important" | "preferred";

/** Where a requirement expects its evidence to be found in the CV. */
export type RequirementKind = "skill" | "responsibility" | "qualification";

export type JobRequirement = {
  id: string;
  text: string;
  importance: RequirementImportance;
  kind: RequirementKind;
  /**
   * The spellings that count as evidence for this requirement — "TypeScript",
   * "TS", "typed JavaScript". This list is what makes matching approximate
   * meaning rather than characters: the reading of the advert decides what
   * counts, and the matcher only asks whether any of it is present.
   */
  terms: string[];
};

export type KeywordWeight = "primary" | "secondary";

export type JobKeyword = {
  id: string;
  text: string;
  weight: KeywordWeight;
  /** How often the advert says it. Repetition is the advert's own emphasis. */
  occurrences: number;
};

export type JobAnalysis = {
  roleTitle: string;
  requiredSkills: JobRequirement[];
  preferredSkills: JobRequirement[];
  responsibilities: JobRequirement[];
  experienceRequirements: JobRequirement[];
  keywords: JobKeyword[];
  inferredSeniority: string;
  domain: string;
};

/* -------------------------------------------------------------------------- */

export type JobMatchDimension =
  "skillsMatch" | "experienceRelevance" | "keywordCoverage" | "roleAlignment";

/**
 * A dimension is null when the advert gave nothing to measure it with — an
 * advert that lists no keywords cannot be said to have 0% keyword coverage.
 * Null is shown as "—" and its weight is redistributed over the dimensions
 * that do have evidence, so an unmeasurable category never drags the figure
 * down as if it had failed.
 */
export type JobMatch = { overallScore: number } & Record<JobMatchDimension, number | null>;

/**
 * `idle`    — not enough of a CV or an advert to compare.
 * `analyzing` — a reading is in flight.
 * `ready`   — the figure on screen describes the document on screen.
 * `stale`   — the CV changed after the last reading of the advert.
 * `error`   — the reading failed; the editor keeps everything it had.
 */
export type JobMatchStatus = "idle" | "analyzing" | "ready" | "stale" | "error";

/* -------------------------------------------------------------------------- */

export type SuggestionType =
  | "missing_keyword"
  | "skill_alignment"
  | "experience_relevance"
  | "weak_wording"
  | "missing_evidence"
  | "summary_alignment"
  | "ats_readability"
  | "irrelevant_content"
  | "missing_requirement";

export type SuggestionPriority = "high" | "medium" | "low";

export type SuggestionStatus = "pending" | "applied" | "dismissed" | "edited";

/** Who wrote it: the deterministic reading, or the model. */
export type SuggestionSource = "heuristic" | "model";

export type ResumeSuggestion = {
  id: string;

  targetSectionId: ResumeSectionId;
  targetEntryId?: string;
  targetFieldId?: string;
  targetItemId?: string;

  type: SuggestionType;
  priority: SuggestionPriority;

  title: string;
  reason: string;

  /** The text as it stands. Kept in step with the document, never guessed. */
  currentText?: string;
  /**
   * The replacement, when one can be written from what the CV already says.
   * Absent on purpose whenever the honest answer is a gap: a requirement the
   * person does not meet has no suggested text, because writing one would be
   * inventing the experience.
   */
  suggestedText?: string;

  relatedKeywords?: string[];
  /** Which parts of the score this could move. Empty when that is not knowable. */
  affects: JobMatchDimension[];
  /**
   * True when the change depends on something only the person can confirm —
   * a result, a number, a responsibility the CV does not record.
   */
  requiresConfirmation: boolean;
  source: SuggestionSource;

  status: SuggestionStatus;
};

/* -------------------------------------------------------------------------- */

/** How well one requirement is answered by the CV as it currently reads. */
export type RequirementCoverage = {
  requirementId: string;
  status: "strong" | "partial" | "missing";
  /** The spelling that was found, when one was. */
  matchedTerm?: string;
};

export type CoverageReport = {
  requirements: RequirementCoverage[];
  /** Keyword ids present in the CV. */
  keywords: string[];
};

/** One reading of one CV against one advert. */
export type TailoringAnalysis = {
  jobAnalysis: JobAnalysis;
  suggestions: ResumeSuggestion[];
  jobMatch: JobMatch;
  coverage: CoverageReport;
  source: SuggestionSource;
  /** ISO timestamp of the reading. */
  analyzedAt: string;
  /**
   * Set when the model was configured but could not be reached, so the reading
   * fell back to the deterministic one. The interface says so rather than
   * passing a thinner result off as the full one.
   */
  degraded?: boolean;
};

/**
 * One applied change, and everything needed to take it back.
 *
 * The address is kept twice on purpose. `targetId` is the flattened key, which
 * is what the interface matches on; `target` is the structured address, which
 * is what Undo writes through — flattening loses the difference between an
 * entry id and a field id, and a restore that guesses wrong would put the old
 * text somewhere it never was.
 */
export type ResumeChange = {
  id: string;
  suggestionId?: string;
  targetId: string;
  target: ResumeTarget;
  previousValue: string;
  nextValue: string;
  createdAt: string;
};
