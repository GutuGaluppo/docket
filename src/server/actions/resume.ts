"use server";

import { revalidatePath } from "next/cache";

import { blankResume, type Resume } from "@/lib/resume/schema";
import { parseResumeText } from "@/lib/resume/parse";
import { hasResumeContent } from "@/lib/resume/text";
import { applySuggestion, revertChange } from "@/lib/tailoring/apply";
import type { JobMatch, ResumeChange, TailoringAnalysis } from "@/lib/tailoring/types";
import {
  analyzeSchema,
  applySuggestionSchema,
  confirmImportSchema,
  createResumeSchema,
  discardImportSchema,
  replaceResumeSchema,
  saveResumeSchema,
  suggestionStatusSchema,
  undoChangeSchema,
} from "@/lib/validation/resume";
import { requireScope, UnauthenticatedError } from "@/server/auth/session";
import { canAnalyzeResume } from "@/server/billing/limits";
import { getEntry } from "@/server/db/queries/applications";
import {
  confirmImport,
  countAnalysesThisMonth,
  createResume,
  deleteImport,
  getImport,
  deleteChange,
  getAnalysis,
  getChange,
  getResume,
  recordChange,
  replaceResumeDocument,
  saveResumeContent,
  saveAnalysis,
  updateAnalysisResult,
} from "@/server/db/queries/resumes";
import type { Scope } from "@/server/db/queries/scope";
import { analyze, recompute } from "@/server/tailoring/analyze";
import { isModelConfigured, modelName } from "@/server/tailoring/model";

/**
 * Every write the CV editor makes, and the order they all follow: session,
 * then Zod, then the query. Same as the register's actions, for the same
 * reason — none of these is reachable only from the button that renders it.
 *
 * Two rules are enforced here rather than in the interface, because the
 * interface is not where a guarantee can live:
 *
 *   · nothing is ever applied without an explicit call to `applyResumeSuggestion`
 *     carrying the text to write. There is no path from a reading to a changed
 *     document; the analysis action returns recommendations and writes nothing.
 *   · the figure is recomputed from the stored reading of the advert against
 *     the document as it now is. It is never taken from a client, and never
 *     re-asked of the model — which is what makes it free to update on every
 *     change, and what stops it from drifting when nothing changed.
 */

export type ResumeError = { ok: false; error: string };

async function scopeOrError(): Promise<Scope | ResumeError> {
  try {
    return await requireScope();
  } catch (error) {
    if (error instanceof UnauthenticatedError) return { ok: false, error: "Sign in first." };
    throw error;
  }
}

const isError = (value: unknown): value is ResumeError =>
  typeof value === "object" && value !== null && "ok" in value && value.ok === false;

/* -------------------------------------------------------------------------- */

export type CreateResumeResult =
  { ok: true; id: string; title: string; resume: Resume } | ResumeError;

/** Starts a document, either from pasted text or empty. */
export async function createResumeDocument(input: unknown): Promise<CreateResumeResult> {
  const scope = await scopeOrError();
  if (isError(scope)) return scope;

  const parsed = createResumeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That CV could not be read." };

  const existing = await getResume(scope);
  if (existing) return { ok: false, error: "There is already a CV on this account." };

  const content = parsed.data.text.trim() ? parseResumeText(parsed.data.text) : blankResume();
  const record = await createResume(scope, { title: parsed.data.title, content });

  revalidatePath("/cv");
  return { ok: true, id: record.id, title: record.title, resume: record.content };
}

export type ReplaceResumeResult = { ok: true; resume: Resume } | ResumeError;

/**
 * The way back from "start an empty one instead".
 *
 * Someone who takes the empty door and then realises they would rather paste
 * the CV they already have would otherwise be stuck typing one out: the
 * document exists, so the opening screen never shows again, and `createResume`
 * refuses a second one.
 *
 * It is allowed only while the document is still empty, which is what makes it
 * safe to rewrite the original copy along with the working one. A document with
 * anything in it is a document somebody wrote, and this action will not
 * overwrite it — the reply says so rather than quietly succeeding.
 */
export async function replaceResumeWithText(input: unknown): Promise<ReplaceResumeResult> {
  const scope = await scopeOrError();
  if (isError(scope)) return scope;

  const parsed = replaceResumeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That CV could not be read." };

  const resume = await getResume(scope);
  if (!resume || resume.id !== parsed.data.id)
    return { ok: false, error: "That CV was not found." };

  if (hasResumeContent(resume.content)) {
    return {
      ok: false,
      error: "This CV already has something in it, so it will not be replaced.",
    };
  }

  const content = parseResumeText(parsed.data.text);
  const replaced = await replaceResumeDocument(scope, resume.id, content);
  if (!replaced) return { ok: false, error: "That CV was not found." };

  revalidatePath("/cv");
  return { ok: true, resume: content };
}

export type ConfirmImportResult = { ok: true; resume: Resume } | ResumeError;

/**
 * The end of the import: the reviewed document becomes the CV.
 *
 * What is written is what the person confirmed, corrections included — the
 * reading is a proposal and the review is where it stops being one. From here
 * the structured document is the source of truth for everything: the editor
 * writes it, the analysis reads it, and the PDF is only where it came from.
 *
 * The imported version is preserved as the document's original copy, which is
 * what makes every later change reversible back to what was imported.
 */
export async function confirmResumeImport(input: unknown): Promise<ConfirmImportResult> {
  const scope = await scopeOrError();
  if (isError(scope)) return scope;

  const parsed = confirmImportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That import could not be confirmed." };

  const record = await getImport(scope, parsed.data.importId);
  if (!record) return { ok: false, error: "That import was not found." };

  const content = parsed.data.resume;
  const existing = await getResume(scope);

  if (existing && hasResumeContent(existing.content)) {
    return {
      ok: false,
      error: "There is already a CV on this account, so this import was not applied.",
    };
  }

  const resumeId = existing
    ? (await replaceResumeDocument(scope, existing.id, content))
      ? existing.id
      : null
    : (await createResume(scope, { title: record.fileName || "My CV", content })).id;

  if (!resumeId) return { ok: false, error: "That CV could not be saved." };

  await confirmImport(scope, record.id, resumeId);

  revalidatePath("/cv");
  return { ok: true, resume: content };
}

export type DiscardImportResult = { ok: true } | ResumeError;

/** Throws away a reading nobody confirmed, the stored file with it. */
export async function discardResumeImport(input: unknown): Promise<DiscardImportResult> {
  const scope = await scopeOrError();
  if (isError(scope)) return scope;

  const parsed = discardImportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That import could not be discarded." };

  await deleteImport(scope, parsed.data.importId);

  revalidatePath("/cv");
  return { ok: true };
}

export type SaveResumeResult = { ok: true } | ResumeError;

/**
 * Writes the working document.
 *
 * Called on a debounce while the person types, so it is deliberately the
 * cheapest action here: one validated write, no reading of the advert, no
 * model. What it does not do is touch the original — that column is the copy
 * every change is recoverable back to.
 */
export async function saveResume(input: unknown): Promise<SaveResumeResult> {
  const scope = await scopeOrError();
  if (isError(scope)) return scope;

  const parsed = saveResumeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Those changes could not be saved." };

  const saved = await saveResumeContent(scope, parsed.data.id, parsed.data.resume);
  if (!saved) return { ok: false, error: "That CV was not found." };

  return { ok: true };
}

/* -------------------------------------------------------------------------- */

export type AnalyzeResult =
  | {
      ok: true;
      analysisId: string;
      jobDescription: string;
      applicationId: string | null;
      analysis: TailoringAnalysis;
    }
  | ResumeError;

/**
 * Reads one CV against one advert. The only action that can cost money, and
 * the only one the monthly cap counts.
 */
export async function analyzeResumeAgainstJob(input: unknown): Promise<AnalyzeResult> {
  const scope = await scopeOrError();
  if (isError(scope)) return scope;

  const parsed = analyzeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That request could not be read." };

  const resume = await getResume(scope);
  if (!resume || resume.id !== parsed.data.resumeId) {
    return { ok: false, error: "That CV was not found." };
  }

  // The register is the record: when an entry is named, its stored advert is
  // the one read, whatever the browser sent alongside it.
  let jobDescription = parsed.data.jobDescription;
  let applicationId: string | null = null;

  if (parsed.data.applicationId) {
    const entry = await getEntry(scope, parsed.data.applicationId);
    if (!entry) return { ok: false, error: "That entry was not found." };
    if (!entry.jobDescription) {
      return { ok: false, error: "That entry has no job description stored with it." };
    }
    jobDescription = entry.jobDescription;
    applicationId = entry.id;
  }

  const used = await countAnalysesThisMonth(scope);
  const verdict = await canAnalyzeResume(scope, used);
  if (!verdict.allowed) return { ok: false, error: verdict.reason };

  const result = await analyze({ resume: resume.content, jobDescription });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "empty-resume"
          ? "There is not enough in the CV yet to compare against anything."
          : "Paste the job description — there is not enough of it to read.",
    };
  }

  const record = await saveAnalysis(scope, {
    resumeId: resume.id,
    applicationId,
    jobDescription,
    analysis: result.analysis,
    model: result.analysis.source === "model" && isModelConfigured() ? modelName() : "heuristic",
  });

  revalidatePath("/cv");
  return {
    ok: true,
    analysisId: record.id,
    jobDescription,
    applicationId,
    analysis: record.analysis,
  };
}

/* -------------------------------------------------------------------------- */

export type ApplyResult =
  { ok: true; resume: Resume; change: ResumeChange; jobMatch: JobMatch } | ResumeError;

/**
 * Writes one recommendation into the document.
 *
 * The text comes from the caller because Edit exists: what is applied is what
 * was on screen, which may be the model's sentence or the person's rewrite of
 * it. Either way the result is recorded as a change of theirs.
 */
export async function applyResumeSuggestion(input: unknown): Promise<ApplyResult> {
  const scope = await scopeOrError();
  if (isError(scope)) return scope;

  const parsed = applySuggestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That change could not be applied." };

  const [record, resume] = await Promise.all([
    getAnalysis(scope, parsed.data.analysisId),
    getResume(scope),
  ]);
  if (!record || !resume || record.resumeId !== resume.id) {
    return { ok: false, error: "That reading was not found." };
  }

  const suggestion = record.analysis.suggestions.find(
    (candidate) => candidate.id === parsed.data.suggestionId,
  );
  if (!suggestion) return { ok: false, error: "That recommendation was not found." };

  const applied = applySuggestion(resume.content, suggestion, parsed.data.text);
  if (!applied) {
    return { ok: false, error: "That part of the CV has changed since the reading." };
  }

  const { jobMatch, coverage } = recompute(applied.resume, record.analysis.jobAnalysis);

  const analysis: TailoringAnalysis = {
    ...record.analysis,
    jobMatch,
    coverage,
    suggestions: record.analysis.suggestions.map((candidate) =>
      candidate.id === suggestion.id
        ? {
            ...candidate,
            status: parsed.data.edited ? "edited" : "applied",
            currentText: parsed.data.text,
          }
        : candidate,
    ),
  };

  await Promise.all([
    saveResumeContent(scope, resume.id, applied.resume),
    recordChange(scope, {
      resumeId: resume.id,
      analysisId: record.id,
      change: applied.change,
    }),
    updateAnalysisResult(scope, record.id, analysis),
  ]);

  revalidatePath("/cv");
  return { ok: true, resume: applied.resume, change: applied.change, jobMatch };
}

export type StatusResult = { ok: true } | ResumeError;

/**
 * Dismissing, and putting a dismissed card back.
 *
 * Writes nothing to the document and nothing to the figure: section 20 is
 * explicit that declining a recommendation must not cost anything, because a
 * recommendation the person judged wrong was never evidence of a worse CV.
 */
export async function setSuggestionStatus(input: unknown): Promise<StatusResult> {
  const scope = await scopeOrError();
  if (isError(scope)) return scope;

  const parsed = suggestionStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That recommendation could not be updated." };

  const record = await getAnalysis(scope, parsed.data.analysisId);
  if (!record) return { ok: false, error: "That reading was not found." };

  const analysis: TailoringAnalysis = {
    ...record.analysis,
    suggestions: record.analysis.suggestions.map((candidate) =>
      candidate.id === parsed.data.suggestionId
        ? { ...candidate, status: parsed.data.status }
        : candidate,
    ),
  };

  await updateAnalysisResult(scope, record.id, analysis);
  return { ok: true };
}

export type UndoResult = { ok: true; resume: Resume; jobMatch: JobMatch | null } | ResumeError;

/** Puts one applied change back, and moves the figure to match. */
export async function undoResumeChange(input: unknown): Promise<UndoResult> {
  const scope = await scopeOrError();
  if (isError(scope)) return scope;

  const parsed = undoChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That change could not be undone." };

  const [change, resume] = await Promise.all([
    getChange(scope, parsed.data.changeId),
    getResume(scope),
  ]);
  if (!change || !resume) return { ok: false, error: "That change was not found." };

  const reverted = revertChange(resume.content, change);
  if (!reverted) {
    return {
      ok: false,
      error: "That part of the CV no longer exists, so there is nothing to restore.",
    };
  }

  await Promise.all([
    saveResumeContent(scope, resume.id, reverted),
    deleteChange(scope, change.id),
  ]);

  const record = parsed.data.analysisId ? await getAnalysis(scope, parsed.data.analysisId) : null;
  if (!record) {
    revalidatePath("/cv");
    return { ok: true, resume: reverted, jobMatch: null };
  }

  const { jobMatch, coverage } = recompute(reverted, record.analysis.jobAnalysis);

  await updateAnalysisResult(scope, record.id, {
    ...record.analysis,
    jobMatch,
    coverage,
    suggestions: record.analysis.suggestions.map((candidate) =>
      candidate.id === change.suggestionId ? { ...candidate, status: "pending" } : candidate,
    ),
  });

  revalidatePath("/cv");
  return { ok: true, resume: reverted, jobMatch };
}
