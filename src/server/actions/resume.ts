"use server";

import { revalidatePath } from "next/cache";

import { cloneResume } from "@/lib/resume/edit";
import { blankResume, type Resume } from "@/lib/resume/schema";
import { parseResumeText } from "@/lib/resume/parse";
import { hasResumeContent } from "@/lib/resume/text";
import { applySuggestion, revertChange } from "@/lib/tailoring/apply";
import type { JobMatch, ResumeChange, TailoringAnalysis } from "@/lib/tailoring/types";
import {
  applySuggestionSchema,
  confirmImportSchema,
  createResumeSchema,
  discardImportSchema,
  duplicateResumeSchema,
  renameResumeSchema,
  replaceResumeSchema,
  resumeIdSchema,
  saveResumeSchema,
  suggestionStatusSchema,
  undoChangeSchema,
} from "@/lib/validation/resume";
import { requireScope, UnauthenticatedError } from "@/server/auth/session";
import {
  confirmImport,
  createResume,
  deleteChange,
  deleteImport,
  deleteResume,
  duplicateResume,
  getAnalysis,
  getChange,
  getImport,
  getResume,
  getResumeById,
  recordChange,
  renameResume,
  replaceResumeDocument,
  saveResumeContent,
  setActiveResume,
  updateAnalysisResult,
} from "@/server/db/queries/resumes";
import type { Scope } from "@/server/db/queries/scope";
import { recompute } from "@/server/tailoring/analyze";

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

  const content = parsed.data.text.trim() ? parseResumeText(parsed.data.text) : blankResume();
  const record = await createResume(scope, {
    title: parsed.data.title,
    content,
    source: "manual",
  });

  // A document nobody is looking at is not much use: whatever was just created
  // is what the editor opens on.
  await setActiveResume(scope, record.id);

  revalidatePath("/cv");
  return { ok: true, id: record.id, title: record.title, resume: record.content };
}

export type SelectResumeResult = { ok: true } | ResumeError;

/**
 * Which CV the editor opens on.
 *
 * A pointer on the account rather than a flag on the rows: two rows can both
 * claim to be active and only one of them can be. Switching is always explicit
 * — nothing here ever chooses a document on somebody's behalf.
 */
export async function selectResume(input: unknown): Promise<SelectResumeResult> {
  const scope = await scopeOrError();
  if (isError(scope)) return scope;

  const parsed = resumeIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That CV could not be opened." };

  const chosen = await setActiveResume(scope, parsed.data.id);
  if (!chosen) return { ok: false, error: "That CV was not found." };

  revalidatePath("/cv");
  return { ok: true };
}

export type RenameResumeResult = { ok: true; title: string } | ResumeError;

export async function renameResumeDocument(input: unknown): Promise<RenameResumeResult> {
  const scope = await scopeOrError();
  if (isError(scope)) return scope;

  const parsed = renameResumeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "That name could not be saved." };
  }

  const renamed = await renameResume(scope, parsed.data.id, parsed.data.title);
  if (!renamed) return { ok: false, error: "That CV was not found." };

  revalidatePath("/cv");
  return { ok: true, title: parsed.data.title };
}

export type DuplicateResumeResult = { ok: true; id: string; title: string } | ResumeError;

/**
 * A copy that shares nothing with the document it came from.
 *
 * This is what "save as a new version" is made of, and the reason section 10
 * asks for it: a CV tailored to one advert is not the CV to send to the next
 * one, and the way to keep both is to have both. Every id inside the copy is
 * minted again, so a recommendation aimed at one document can never resolve
 * against the other.
 */
export async function duplicateResumeDocument(input: unknown): Promise<DuplicateResumeResult> {
  const scope = await scopeOrError();
  if (isError(scope)) return scope;

  const parsed = duplicateResumeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That CV could not be copied." };

  const source = await getResumeById(scope, parsed.data.id);
  if (!source) return { ok: false, error: "That CV was not found." };

  const title = parsed.data.title?.trim() || `${source.title} copy`;
  const copy = await duplicateResume(scope, source.id, {
    title: title.slice(0, 120),
    content: cloneResume(source.content),
  });

  if (!copy) return { ok: false, error: "That CV could not be copied." };
  if (parsed.data.activate) await setActiveResume(scope, copy.id);

  revalidatePath("/cv");
  return { ok: true, id: copy.id, title: copy.title };
}

export type DeleteResumeResult = { ok: true } | ResumeError;

/**
 * Permanent, and said so on the button that does it.
 *
 * Everything belonging to this document alone goes with it — its readings, its
 * change history, and the PDF it was imported from — because the interface
 * calls this permanent deletion and section 47 is explicit that what the
 * interface says has to be what happens. What is shared with anything else, the
 * entries in the register its readings pointed at, is untouched.
 *
 * Deleting the document the editor was open on clears the pointer rather than
 * moving it: landing on the library is a legitimate place to be, and quietly
 * opening a different CV is the kind of silent switch this feature does not do.
 */
export async function deleteResumeDocument(input: unknown): Promise<DeleteResumeResult> {
  const scope = await scopeOrError();
  if (isError(scope)) return scope;

  const parsed = resumeIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That CV could not be deleted." };

  const removed = await deleteResume(scope, parsed.data.id);
  if (!removed) return { ok: false, error: "That CV was not found." };

  revalidatePath("/cv");
  return { ok: true };
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
  const active = await getResume(scope);

  /**
   * An empty document is a false start rather than a CV: somebody took the
   * "create one manually" door, changed their mind and uploaded instead. The
   * import lands in it rather than beside it, so the library does not collect
   * blanks. Anything with writing in it is left alone and this becomes a second
   * document — which is the point of having a library at all.
   */
  const reuse = active && !hasResumeContent(active.content) ? active : null;

  const resumeId = reuse
    ? (await replaceResumeDocument(scope, reuse.id, content))
      ? reuse.id
      : null
    : (
        await createResume(scope, {
          title: documentName(record.fileName),
          content,
          source: "pdf",
          originalFileName: record.fileName,
        })
      ).id;

  if (!resumeId) return { ok: false, error: "That CV could not be saved." };

  await confirmImport(scope, record.id, resumeId);
  await setActiveResume(scope, resumeId);

  revalidatePath("/cv");
  return { ok: true, resume: content };
}

/**
 * A file name, read as a name.
 *
 * "Augusto_Galuppo_CV.pdf" is what the file is called; "Augusto Galuppo CV" is
 * what the document is called. Nobody should have to name a CV before importing
 * one, so this is the opening guess and renaming it is one click away.
 */
function documentName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.pdf$/i, "");
  const spaced = withoutExtension.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (spaced || "My CV").slice(0, 120);
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
