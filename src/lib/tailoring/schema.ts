import { z } from "zod";

import { SECTION_IDS } from "@/lib/resume/schema";

/**
 * The shape a model answer has to arrive in, and the shape a reading is stored
 * in.
 *
 * A model answer is untrusted input in the ordinary sense — it arrives over the
 * network, it is generated, and it is not bound by the prompt that asked for
 * it. Parsing it with the same rigour as a form post is the cheapest half of
 * making the feature safe; `safety.ts` is the other half, and it runs on what
 * comes out of here.
 *
 * Everything the model may not decide is absent from these schemas: there is no
 * `id`, no `status`, no `overallScore`. Ids are minted locally so two runs
 * cannot collide, status belongs to the person, and the overall figure is
 * arithmetic the application owns.
 */

const short = (max: number) => z.string().trim().max(max);

export const requirementImportance = z.enum(["required", "important", "preferred"]);
export const requirementKind = z.enum(["skill", "responsibility", "qualification"]);

export const modelRequirementSchema = z.object({
  text: short(300).min(1),
  importance: requirementImportance.default("important"),
  kind: requirementKind.default("skill"),
  /** Alternative spellings that count as evidence. Bounded so one requirement cannot flood the matcher. */
  terms: z.array(short(60)).max(12).default([]),
});

export const modelKeywordSchema = z.object({
  text: short(60).min(1),
  weight: z.enum(["primary", "secondary"]).default("secondary"),
  occurrences: z.number().int().min(0).max(999).default(1),
});

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
  affects: z.array(jobMatchDimension).max(4).default([]),
  requiresConfirmation: z.boolean().default(false),
});

export const modelAnalysisSchema = z.object({
  jobAnalysis: z.object({
    roleTitle: short(160).default(""),
    requiredSkills: z.array(modelRequirementSchema).max(40).default([]),
    preferredSkills: z.array(modelRequirementSchema).max(40).default([]),
    responsibilities: z.array(modelRequirementSchema).max(20).default([]),
    experienceRequirements: z.array(modelRequirementSchema).max(10).default([]),
    keywords: z.array(modelKeywordSchema).max(30).default([]),
    inferredSeniority: short(60).default(""),
    domain: short(80).default(""),
  }),
  suggestions: z.array(modelSuggestionSchema).max(30).default([]),
});

export type ModelAnalysis = z.output<typeof modelAnalysisSchema>;

/* -------------------------------------------------------------------------- */

const requirementSchema = modelRequirementSchema.extend({ id: z.string().min(1).max(64) });

export const jobAnalysisSchema = z.object({
  roleTitle: z.string().max(160).default(""),
  requiredSkills: z.array(requirementSchema).default([]),
  preferredSkills: z.array(requirementSchema).default([]),
  responsibilities: z.array(requirementSchema).default([]),
  experienceRequirements: z.array(requirementSchema).default([]),
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
        status: z.enum(["strong", "partial", "missing"]),
        matchedTerm: z.string().max(80).optional(),
      }),
    )
    .default([]),
  keywords: z.array(z.string().max(64)).default([]),
});

/** One stored reading, as it is written to and read back from the database. */
export const analysisSchema = z.object({
  jobAnalysis: jobAnalysisSchema,
  suggestions: z.array(suggestionSchema).default([]),
  jobMatch: jobMatchSchema,
  coverage: coverageSchema,
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
