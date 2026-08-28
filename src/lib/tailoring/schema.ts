import { z } from "zod";

import { SECTION_IDS } from "@/lib/resume/schema";

/**
 * The shape a model answer has to arrive in, and the shape a reading is stored
 * in.
 *
 * A model answer is untrusted input in the ordinary sense — it arrives over the
 * network, it is generated, and it is not bound by the prompt that asked for
 * it. Parsing it with the same rigour as a form post is the cheapest half of
 * making the feature safe.
 *
 * Note what a model is never allowed to send: a score. There is no field for
 * one in any schema below. It reads the advert into requirements and it
 * classifies evidence; the arithmetic belongs to `score.ts`, where it can be
 * explained and tested.
 */

const short = (max: number) => z.string().trim().max(max);

export const requirementImportance = z.enum(["required", "important", "preferred"]);

export const requirementCategory = z.enum([
  "skill",
  "tool",
  "practice",
  "experience",
  "responsibility",
  "domain",
  "soft_skill",
]);

export const requirementMatch = z.enum(["strong", "partial", "missing"]);

/** What a model may return when reading an advert. Ids are minted locally. */
export const modelRequirementSchema = z.object({
  name: short(120).min(1),
  category: requirementCategory.default("skill"),
  importance: requirementImportance.default("important"),
  /** Other ways of saying it. Bounded so one requirement cannot flood the matcher. */
  aliases: z.array(short(60)).max(12).default([]),
  sourceText: short(300).default(""),
});

export const modelKeywordSchema = z.object({
  text: short(60).min(1),
  weight: z.enum(["primary", "secondary"]).default("secondary"),
  occurrences: z.number().int().min(0).max(999).default(1),
  aliases: z.array(short(60)).max(12).default([]),
});

export const modelJobAnalysisSchema = z.object({
  roleTitle: short(160).default(""),
  requirements: z.array(modelRequirementSchema).max(60).default([]),
  keywords: z.array(modelKeywordSchema).max(30).default([]),
  inferredSeniority: short(60).default(""),
  domain: short(80).default(""),
});

/* -------------------------------------------------------------------------- */

export const evidenceSchema = z.object({
  key: short(200).optional(),
  source: z.enum(["profile", "experience", "skills", "project", "education"]).default("experience"),
  text: z.string().trim().max(400),
});

/**
 * One verdict from the model.
 *
 * `confidence` is how sure it is of the verdict, not what the verdict is worth:
 * a strong match at 0.7 scores exactly as a strong match at 0.99. Keeping the
 * two apart is what stops a model's hedging from quietly becoming a score.
 */
export const modelMatchSchema = z.object({
  requirementId: short(64).min(1),
  match: requirementMatch,
  confidence: z.number().min(0).max(1).default(0.8),
  evidence: z.array(evidenceSchema).max(4).default([]),
  reasoning: short(240).optional(),
});

export const modelClassificationSchema = z.object({
  matches: z.array(modelMatchSchema).max(80).default([]),
});

export type ModelJobAnalysis = z.output<typeof modelJobAnalysisSchema>;
export type ModelClassification = z.output<typeof modelClassificationSchema>;

/* -------------------------------------------------------------------------- */

export const suggestionType = z.enum([
  "missing_keyword",
  "skill_alignment",
  "experience_relevance",
  "weak_wording",
  "missing_evidence",
  "summary_alignment",
  "ats_readability",
  "irrelevant_content",
  "missing_requirement",
]);

export const jobMatchDimension = z.enum([
  "skillsMatch",
  "experienceRelevance",
  "keywordCoverage",
  "roleAlignment",
]);

export const modelSuggestionSchema = z.object({
  targetSectionId: z.enum(SECTION_IDS),
  targetEntryId: short(64).optional(),
  targetFieldId: short(64).optional(),
  targetItemId: short(64).optional(),

  type: suggestionType,
  priority: z.enum(["high", "medium", "low"]).default("medium"),

  title: short(120).min(1),
  reason: short(600).min(1),

  suggestedText: z.string().trim().max(1_200).optional(),
  relatedKeywords: z.array(short(60)).max(10).optional(),
  requirementId: short(64).optional(),
  affects: z.array(jobMatchDimension).max(4).default([]),
  requiresConfirmation: z.boolean().default(false),
});

/** What the rewriting call may return: recommendations, and nothing else. */
export const modelAnalysisSchema = z.object({
  suggestions: z.array(modelSuggestionSchema).max(30).default([]),
});

export type ModelAnalysis = z.output<typeof modelAnalysisSchema>;

/**
 * One reading, in one answer.
 *
 * The advert becomes requirements, each requirement gets a verdict against the
 * CV with the lines that justify it, and the wording changes come back
 * alongside. Splitting these into separate requests would triple the cost of a
 * reading to ask the same model about the same two documents three times, and
 * the second half depends on the first — a verdict is about a requirement, so
 * whatever produced the requirement is the thing that should judge it.
 *
 * The model supplies its own requirement ids so that its verdicts can refer to
 * them. Those ids are re-keyed on arrival: an id from a generated answer is not
 * something the rest of the application should be storing.
 */
export const modelReadingSchema = z.object({
  jobAnalysis: modelJobAnalysisSchema.extend({
    requirements: z
      .array(modelRequirementSchema.extend({ id: short(64).min(1) }))
      .max(60)
      .default([]),
  }),
  matches: z.array(modelMatchSchema).max(80).default([]),
  suggestions: z.array(modelSuggestionSchema).max(30).default([]),
});

export type ModelReading = z.output<typeof modelReadingSchema>;

/* -------------------------------------------------------------------------- */

const requirementSchema = modelRequirementSchema.extend({ id: z.string().min(1).max(64) });

export const jobAnalysisSchema = z.object({
  roleTitle: z.string().max(160).default(""),
  requirements: z.array(requirementSchema).default([]),
  keywords: z.array(modelKeywordSchema.extend({ id: z.string().min(1).max(64) })).default([]),
  inferredSeniority: z.string().max(60).default(""),
  domain: z.string().max(80).default(""),
});

export const suggestionSchema = modelSuggestionSchema.extend({
  id: z.string().min(1).max(64),
  currentText: z.string().max(4_000).optional(),
  source: z.enum(["heuristic", "model"]).default("model"),
  status: z.enum(["pending", "applied", "dismissed", "edited"]).default("pending"),
});

const score = z.number().min(0).max(100).nullable();

export const jobMatchSchema = z.object({
  overallScore: z.number().min(0).max(100),
  skillsMatch: score,
  experienceRelevance: score,
  keywordCoverage: score,
  roleAlignment: score,
});

export const coverageSchema = z.object({
  requirements: z
    .array(
      z.object({
        requirementId: z.string().max(64),
        match: requirementMatch,
        evidence: z.array(evidenceSchema.extend({ target: z.unknown().optional() })).default([]),
        confidence: z.number().min(0).max(1).default(0.8),
        reasoning: z.string().max(240).optional(),
      }),
    )
    .default([]),
  keywords: z.array(z.string().max(64)).default([]),
  roleSignals: z
    .object({
      title: z.number().min(0).max(1).nullable().default(null),
      seniority: z.number().min(0).max(1).nullable().default(null),
      domain: z.number().min(0).max(1).nullable().default(null),
    })
    .default(() => ({ title: null, seniority: null, domain: null })),
});

const contributionSchema = z.object({
  requirementId: z.string().max(64),
  name: z.string().max(160),
  importance: requirementImportance,
  match: requirementMatch,
  weight: z.number(),
  earned: z.number(),
});

export const explanationSchema = z.object({
  dimensions: z
    .array(
      z.object({
        dimension: jobMatchDimension,
        score: score,
        earned: z.number(),
        possible: z.number(),
        contributions: z.array(contributionSchema).default([]),
      }),
    )
    .default([]),
  strong: z.array(z.string().max(160)).default([]),
  partial: z.array(z.string().max(160)).default([]),
  missing: z.array(z.string().max(160)).default([]),
  keywords: z
    .object({
      matched: z.array(z.string().max(60)).default([]),
      missed: z.array(z.string().max(60)).default([]),
    })
    .default(() => ({ matched: [], missed: [] })),
  warnings: z.array(z.string().max(300)).default([]),
});

/** One stored reading, as it is written to and read back from the database. */
export const analysisSchema = z.object({
  jobAnalysis: jobAnalysisSchema,
  suggestions: z.array(suggestionSchema).default([]),
  jobMatch: jobMatchSchema,
  coverage: coverageSchema,
  explanation: explanationSchema,
  source: z.enum(["heuristic", "model"]).default("heuristic"),
  analyzedAt: z.string().max(40),
  degraded: z.boolean().optional(),
});

export const resumeTargetSchema = z.object({
  sectionId: z.enum(SECTION_IDS),
  entryId: z.string().max(64).optional(),
  fieldId: z.string().max(64).optional(),
  itemId: z.string().max(64).optional(),
});

export const resumeChangeSchema = z.object({
  id: z.string().min(1).max(64),
  suggestionId: z.string().max(64).optional(),
  targetId: z.string().max(200),
  target: resumeTargetSchema,
  previousValue: z.string().max(4_000),
  nextValue: z.string().max(4_000),
  createdAt: z.string().max(40),
});
