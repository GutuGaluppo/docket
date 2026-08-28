import { z } from "zod";

import { resumeSchema } from "@/lib/resume/schema";

/**
 * One schema per use case, shared by the editor and the actions behind it.
 *
 * The same rule the entry form follows applies here and matters more: a server
 * action is a public endpoint whoever called it, and these ones carry a whole
 * document. Nothing below trusts a shape because a component produced it.
 */

export const createResumeSchema = z.object({
  title: z.string().trim().max(120).optional().default("My CV"),
  /** The pasted CV. Empty means "start me an empty one". */
  text: z.string().max(60_000).optional().default(""),
});

/**
 * Reading a pasted CV over a document that was started empty. Separate from
 * `createResumeSchema` because it names a row that already exists, and separate
 * from `saveResumeSchema` because what arrives is text rather than structure.
 */
export const replaceResumeSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().min(1).max(60_000),
});

/** Naming one document. All any library action needs beyond a new title. */
export const resumeIdSchema = z.object({ id: z.string().min(1).max(64) });

export const renameResumeSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1, "Give this CV a name.").max(120),
});

/**
 * Copying one. The title is optional because the interface offers a default —
 * naming a copy before making it is a decision nobody has enough information
 * for yet.
 */
export const duplicateResumeSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().max(120).optional(),
  /** Whether the copy becomes the document the editor opens on. */
  activate: z.boolean().optional().default(true),
});

export const saveResumeSchema = z.object({
  id: z.string().min(1).max(64),
  resume: resumeSchema,
});

/**
 * An advert either comes from an entry in the register or is pasted here. Both
 * are accepted; when an entry is named, the advert stored with it wins, because
 * the register is the record and this page is a reader of it.
 */
/**
 * Confirming a PDF import. The document is sent back whole rather than by id,
 * because the review screen is editable: what is confirmed is what the person
 * corrected, not what the reading produced.
 */
export const confirmImportSchema = z.object({
  importId: z.string().min(1).max(64),
  resume: resumeSchema,
});

export const discardImportSchema = z.object({ importId: z.string().min(1).max(64) });

export const analyzeSchema = z.object({
  resumeId: z.string().min(1).max(64),
  applicationId: z.string().max(64).optional(),
  jobDescription: z.string().max(50_000).optional().default(""),
});

export const applySuggestionSchema = z.object({
  analysisId: z.string().min(1).max(64),
  suggestionId: z.string().min(1).max(64),
  /** What is actually written: the model's wording, or the person's edit of it. */
  text: z.string().trim().min(1).max(1_200),
  edited: z.boolean().optional().default(false),
});

export const suggestionStatusSchema = z.object({
  analysisId: z.string().min(1).max(64),
  suggestionId: z.string().min(1).max(64),
  status: z.enum(["dismissed", "pending"]),
});

export const undoChangeSchema = z.object({
  changeId: z.string().min(1).max(64),
  analysisId: z.string().max(64).optional(),
});

export type CreateResumeInput = z.output<typeof createResumeSchema>;
export type SaveResumeInput = z.output<typeof saveResumeSchema>;
