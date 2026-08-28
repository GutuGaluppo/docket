import type { ResumeSectionId } from "@/lib/resume/schema";
import type { ResumeTarget } from "@/lib/resume/target";

/**
 * What a job advert turns into before anything is compared against it, and what
 * a comparison turns into before anything is scored.
 *
 * The shape is the argument. An advert becomes a flat list of requirements,
 * each with a category, an importance and the words that count as evidence for
 * it; a comparison becomes one verdict per requirement, with the lines of the
 * CV that justify it. Only then does arithmetic happen — which is what makes
 * the figure explainable, and what stops a model from being asked to invent it.
 */

export type RequirementImportance = "required" | "important" | "preferred";

/**
 * What kind of thing is being asked for. It decides which dimension a
 * requirement scores in, and how its evidence is judged: a tool named in a
 * skills list is a claim worth believing, while a responsibility named there is
 * not.
 */
export type RequirementCategory =
  "skill" | "tool" | "practice" | "experience" | "responsibility" | "domain" | "soft_skill";

export type JobRequirement = {
  /** Stable within one reading of one advert. Everything downstream refers to this. */
  id: string;
  /** Short, canonical: "React", "technical SEO", "design systems". */
  name: string;
  category: RequirementCategory;
  importance: RequirementImportance;
  /**
   * Other ways of saying it, any one of which counts as evidence. This is what
   * makes matching semantic rather than lexical — see `equivalences.ts`.
   */
  aliases: string[];
  /** The sentence of the advert it came from, kept so the reading can be justified. */
  sourceText: string;
};

export type KeywordWeight = "primary" | "secondary";

export type JobKeyword = {
  id: string;
  text: string;
  weight: KeywordWeight;
  /** How often the advert says it. Repetition is the advert's own emphasis. */
  occurrences: number;
  /**
   * The other ways of saying it, so coverage is a question about the
   * terminology rather than about spelling — section 17 forbids resting any of
   * this on substring matching.
   */
  aliases?: string[];
};

export type JobAnalysis = {
  roleTitle: string;
  /** One flat list: the category says what each one is. */
  requirements: JobRequirement[];
  keywords: JobKeyword[];
  inferredSeniority: string;
  domain: string;
};

/* -------------------------------------------------------------------------- */

/**
 * How well one requirement is answered. Three states rather than a number,
 * because a classifier — human or model — can tell these apart reliably and
 * cannot reliably tell 0.62 from 0.71.
 */
export type RequirementMatch = "strong" | "partial" | "missing";

/** A line of the CV that justifies a verdict. */
export type MatchEvidence = {
  /** The addressable element it came from, when it came from one. */
  key?: string;
  target?: ResumeTarget;
  source: "profile" | "experience" | "skills" | "project" | "education";
  text: string;
};

export type RequirementMatchResult = {
  requirementId: string;
  match: RequirementMatch;
  evidence: MatchEvidence[];
  /**
   * How sure the classifier is of the verdict — not how many points it is
   * worth. A strong match at 0.7 confidence still scores as a strong match.
   */
  confidence: number;
  /** One short sentence, fit to show a person. Never a chain of thought. */
  reasoning?: string;
};

/**
 * The three things about a CV that are true of the document as a whole rather
 * than of any one requirement: whether it is written as this role, at this
 * level, in this field. Null where the advert did not say.
 */
export type RoleSignals = {
  /** How much of the advert's job title the CV's own title answers, 0 to 1. */
  title: number | null;
  seniority: number | null;
  domain: number | null;
};

export type CoverageReport = {
  requirements: RequirementMatchResult[];
  /** Keyword ids found in the CV. */
  keywords: string[];
  roleSignals: RoleSignals;
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

/** One requirement's arithmetic, kept so the figure can be taken apart. */
export type Contribution = {
  requirementId: string;
  name: string;
  importance: RequirementImportance;
  match: RequirementMatch;
  /** What the requirement was worth. */
  weight: number;
  /** What it earned: weight × the value of its match. */
  earned: number;
};

export type DimensionExplanation = {
  dimension: JobMatchDimension;
  score: number | null;
  earned: number;
  possible: number;
  contributions: Contribution[];
};

/**
 * Everything needed to answer "why is this Job Match 69%?" without re-running
 * anything: what each dimension was made of, and where the points went.
 */
export type JobMatchExplanation = {
  dimensions: DimensionExplanation[];
  strong: string[];
  partial: string[];
  missing: string[];
  keywords: { matched: string[]; missed: string[] };
  /** Set when the arithmetic disagrees with the evidence — see `sanityCheck`. */
  warnings: string[];
};

/**
 * `idle`    — not enough of a CV or an advert to compare.
 * `analyzing` — a reading is in flight.
 * `ready`   — the figure on screen describes the document on screen.
 * `stale`   — the CV, the advert or the scoring changed after the last reading.
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
  /** The requirement this came from, so a gap and its advice cannot disagree. */
  requirementId?: string;
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

/** One reading of one CV against one advert. */
export type TailoringAnalysis = {
  jobAnalysis: JobAnalysis;
  suggestions: ResumeSuggestion[];
  jobMatch: JobMatch;
  coverage: CoverageReport;
  explanation: JobMatchExplanation;
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
