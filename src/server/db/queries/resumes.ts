import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { importResultSchema, type ResumeImportResult } from "@/lib/resume/import";
import { parseResume, type Resume } from "@/lib/resume/schema";
import { analysisSchema, resumeChangeSchema } from "@/lib/tailoring/schema";
import type { ResumeChange, TailoringAnalysis } from "@/lib/tailoring/types";
import { db } from "@/server/db";
import { resumeAnalyses, resumeChanges, resumeImports, resumes } from "@/server/db/schema";
import type { Scope } from "@/server/db/queries/scope";

/**
 * The only place the tailoring tables are touched.
 *
 * Two things are worth stating about the JSON columns. They are validated on
 * the way out, not only on the way in: a document written by an older version
 * of the schema must not reach a component as an unchecked shape, and a row
 * that fails to parse is treated as absent rather than crashing the page a
 * person keeps their CV on. And they are read whole, because that is how the
 * editor uses them — nothing here queries inside a document.
 */

export type ResumeRecord = {
  id: string;
  title: string;
  content: Resume;
  original: Resume;
  updatedAt: Date;
};

export type AnalysisRecord = {
  id: string;
  resumeId: string;
  applicationId: string | null;
  jobDescription: string;
  analysis: TailoringAnalysis;
  createdAt: Date;
};

function toRecord(row: {
  id: string;
  title: string;
  content: unknown;
  original: unknown;
  updatedAt: Date;
}): ResumeRecord | null {
  const content = parseResume(row.content);
  if (!content) return null;
  return {
    id: row.id,
    title: row.title,
    content,
    original: parseResume(row.original) ?? content,
    updatedAt: row.updatedAt,
  };
}

export async function getResume(scope: Scope): Promise<ResumeRecord | null> {
  const [row] = await db
    .select({
      id: resumes.id,
      title: resumes.title,
      content: resumes.content,
      original: resumes.original,
      updatedAt: resumes.updatedAt,
    })
    .from(resumes)
    .where(scope.owned(resumes.userId))
    .orderBy(desc(resumes.updatedAt))
    .limit(1);

  return row ? toRecord(row) : null;
}

export async function createResume(
  scope: Scope,
  input: { title: string; content: Resume },
): Promise<ResumeRecord> {
  const [row] = await db
    .insert(resumes)
    .values({
      userId: scope.userId,
      title: input.title,
      content: input.content,
      // The document as it arrived. Never written again — see the schema.
      original: input.content,
    })
    .returning({
      id: resumes.id,
      title: resumes.title,
      content: resumes.content,
      original: resumes.original,
      updatedAt: resumes.updatedAt,
    });

  return toRecord(row!)!;
}

/** Writes the working document. The original column is deliberately untouched. */
export async function saveResumeContent(
  scope: Scope,
  id: string,
  content: Resume,
): Promise<boolean> {
  const updated = await db
    .update(resumes)
    .set({ content, updatedAt: new Date() })
    .where(scope.owned(resumes.userId, eq(resumes.id, id)))
    .returning({ id: resumes.id });

  return updated.length > 0;
}

/**
 * Reads a pasted CV over a document, replacing the original copy along with it.
 *
 * The one write in this module that touches `original`, and the reason it is a
 * function of its own rather than an argument to `saveResumeContent`: that
 * column is the copy every applied change is recoverable back to, so a path
 * that overwrites it has to be visible at the call site. The caller is
 * responsible for refusing when the document holds anything — an empty document
 * never "arrived", so there is nothing to preserve a copy of.
 */
export async function replaceResumeDocument(
  scope: Scope,
  id: string,
  content: Resume,
): Promise<boolean> {
  const updated = await db
    .update(resumes)
    .set({ content, original: content, updatedAt: new Date() })
    .where(scope.owned(resumes.userId, eq(resumes.id, id)))
    .returning({ id: resumes.id });

  return updated.length > 0;
}

export async function renameResume(scope: Scope, id: string, title: string): Promise<boolean> {
  const updated = await db
    .update(resumes)
    .set({ title, updatedAt: new Date() })
    .where(scope.owned(resumes.userId, eq(resumes.id, id)))
    .returning({ id: resumes.id });

  return updated.length > 0;
}

/* -------------------------------------------------------------------------- */

function toAnalysisRecord(row: {
  id: string;
  resumeId: string;
  applicationId: string | null;
  jobDescription: string;
  result: unknown;
  createdAt: Date;
}): AnalysisRecord | null {
  const parsed = analysisSchema.safeParse(row.result);
  if (!parsed.success) return null;

  return {
    id: row.id,
    resumeId: row.resumeId,
    applicationId: row.applicationId,
    jobDescription: row.jobDescription,
    analysis: parsed.data as TailoringAnalysis,
    createdAt: row.createdAt,
  };
}

/** The reading the page reopens on: the most recent one for this CV. */
export async function getLatestAnalysis(
  scope: Scope,
  resumeId: string,
): Promise<AnalysisRecord | null> {
  const [row] = await db
    .select({
      id: resumeAnalyses.id,
      resumeId: resumeAnalyses.resumeId,
      applicationId: resumeAnalyses.applicationId,
      jobDescription: resumeAnalyses.jobDescription,
      result: resumeAnalyses.result,
      createdAt: resumeAnalyses.createdAt,
    })
    .from(resumeAnalyses)
    .where(scope.owned(resumeAnalyses.userId, eq(resumeAnalyses.resumeId, resumeId)))
    .orderBy(desc(resumeAnalyses.createdAt))
    .limit(1);

  return row ? toAnalysisRecord(row) : null;
}

export async function getAnalysis(scope: Scope, id: string): Promise<AnalysisRecord | null> {
  const [row] = await db
    .select({
      id: resumeAnalyses.id,
      resumeId: resumeAnalyses.resumeId,
      applicationId: resumeAnalyses.applicationId,
      jobDescription: resumeAnalyses.jobDescription,
      result: resumeAnalyses.result,
      createdAt: resumeAnalyses.createdAt,
    })
    .from(resumeAnalyses)
    .where(scope.owned(resumeAnalyses.userId, eq(resumeAnalyses.id, id)))
    .limit(1);

  return row ? toAnalysisRecord(row) : null;
}

export async function saveAnalysis(
  scope: Scope,
  input: {
    resumeId: string;
    applicationId: string | null;
    jobDescription: string;
    analysis: TailoringAnalysis;
    model: string;
  },
): Promise<AnalysisRecord> {
  const [row] = await db
    .insert(resumeAnalyses)
    .values({
      userId: scope.userId,
      resumeId: input.resumeId,
      applicationId: input.applicationId,
      jobDescription: input.jobDescription,
      result: input.analysis,
      model: input.model,
    })
    .returning({
      id: resumeAnalyses.id,
      resumeId: resumeAnalyses.resumeId,
      applicationId: resumeAnalyses.applicationId,
      jobDescription: resumeAnalyses.jobDescription,
      result: resumeAnalyses.result,
      createdAt: resumeAnalyses.createdAt,
    });

  return toAnalysisRecord(row!)!;
}

/** Writes back a reading whose figure or suggestion statuses have moved. */
export async function updateAnalysisResult(
  scope: Scope,
  id: string,
  analysis: TailoringAnalysis,
): Promise<boolean> {
  const updated = await db
    .update(resumeAnalyses)
    .set({ result: analysis })
    .where(scope.owned(resumeAnalyses.userId, eq(resumeAnalyses.id, id)))
    .returning({ id: resumeAnalyses.id });

  return updated.length > 0;
}

/**
 * How many readings this account has started in the current calendar month.
 * The cap is applied on the server, where it cannot be argued with.
 */
export async function countAnalysesThisMonth(scope: Scope): Promise<number> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(resumeAnalyses)
    .where(scope.owned(resumeAnalyses.userId, gte(resumeAnalyses.createdAt, monthStart)));

  return row?.total ?? 0;
}

/* -------------------------------------------------------------------------- */

export async function listChanges(scope: Scope, resumeId: string): Promise<ResumeChange[]> {
  const rows = await db
    .select({
      id: resumeChanges.id,
      suggestionId: resumeChanges.suggestionId,
      targetId: resumeChanges.targetId,
      target: resumeChanges.target,
      previousValue: resumeChanges.previousValue,
      nextValue: resumeChanges.nextValue,
      createdAt: resumeChanges.createdAt,
    })
    .from(resumeChanges)
    .where(scope.owned(resumeChanges.userId, eq(resumeChanges.resumeId, resumeId)))
    .orderBy(desc(resumeChanges.createdAt))
    .limit(200);

  return rows.flatMap((row) => {
    const parsed = resumeChangeSchema.safeParse({
      ...row,
      suggestionId: row.suggestionId ?? undefined,
      createdAt: row.createdAt.toISOString(),
    });
    return parsed.success ? [parsed.data as ResumeChange] : [];
  });
}

export async function recordChange(
  scope: Scope,
  input: { resumeId: string; analysisId: string | null; change: ResumeChange },
): Promise<void> {
  await db.insert(resumeChanges).values({
    id: input.change.id,
    userId: scope.userId,
    resumeId: input.resumeId,
    analysisId: input.analysisId,
    suggestionId: input.change.suggestionId ?? null,
    targetId: input.change.targetId,
    target: input.change.target,
    previousValue: input.change.previousValue,
    nextValue: input.change.nextValue,
  });
}

/** Reads one change back, so Undo restores a value the database still holds. */
export async function getChange(scope: Scope, id: string): Promise<ResumeChange | null> {
  const [row] = await db
    .select({
      id: resumeChanges.id,
      suggestionId: resumeChanges.suggestionId,
      targetId: resumeChanges.targetId,
      target: resumeChanges.target,
      previousValue: resumeChanges.previousValue,
      nextValue: resumeChanges.nextValue,
      createdAt: resumeChanges.createdAt,
      resumeId: resumeChanges.resumeId,
    })
    .from(resumeChanges)
    .where(scope.owned(resumeChanges.userId, eq(resumeChanges.id, id)))
    .limit(1);

  if (!row) return null;

  const parsed = resumeChangeSchema.safeParse({
    ...row,
    suggestionId: row.suggestionId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  });

  return parsed.success ? (parsed.data as ResumeChange) : null;
}

export async function deleteChange(scope: Scope, id: string): Promise<boolean> {
  const removed = await db
    .delete(resumeChanges)
    .where(scope.owned(resumeChanges.userId, eq(resumeChanges.id, id)))
    .returning({ id: resumeChanges.id });

  return removed.length > 0;
}

/** The change a change belongs to, used to keep Undo inside one document. */
export async function changeBelongsToResume(
  scope: Scope,
  changeId: string,
  resumeId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: resumeChanges.id })
    .from(resumeChanges)
    .where(
      scope.owned(
        resumeChanges.userId,
        and(eq(resumeChanges.id, changeId), eq(resumeChanges.resumeId, resumeId)),
      ),
    )
    .limit(1);

  return Boolean(row);
}

/* -------------------------------------------------------------------------- */

export type ImportRecord = {
  id: string;
  fileName: string;
  pageCount: number;
  extractedText: string;
  result: ResumeImportResult;
  createdAt: Date;
};

function toImportRecord(row: {
  id: string;
  fileName: string;
  pageCount: number;
  extractedText: string;
  result: unknown;
  createdAt: Date;
}): ImportRecord | null {
  const parsed = importResultSchema.safeParse(row.result);
  if (!parsed.success) return null;
  return { ...row, result: parsed.data as ResumeImportResult };
}

export async function createImport(
  scope: Scope,
  input: {
    fileName: string;
    byteSize: number;
    pageCount: number;
    checksum: string;
    fileData: string | null;
    extractedText: string;
    result: ResumeImportResult;
  },
): Promise<ImportRecord> {
  const [row] = await db
    .insert(resumeImports)
    .values({ userId: scope.userId, ...input })
    .returning({
      id: resumeImports.id,
      fileName: resumeImports.fileName,
      pageCount: resumeImports.pageCount,
      extractedText: resumeImports.extractedText,
      result: resumeImports.result,
      createdAt: resumeImports.createdAt,
    });

  return toImportRecord(row!)!;
}

/** The reading a person walked away from mid-review, so the page can reopen it. */
export async function getPendingImport(scope: Scope): Promise<ImportRecord | null> {
  const [row] = await db
    .select({
      id: resumeImports.id,
      fileName: resumeImports.fileName,
      pageCount: resumeImports.pageCount,
      extractedText: resumeImports.extractedText,
      result: resumeImports.result,
      createdAt: resumeImports.createdAt,
    })
    .from(resumeImports)
    .where(scope.owned(resumeImports.userId, eq(resumeImports.status, "review")))
    .orderBy(desc(resumeImports.createdAt))
    .limit(1);

  return row ? toImportRecord(row) : null;
}

export async function getImport(scope: Scope, id: string): Promise<ImportRecord | null> {
  const [row] = await db
    .select({
      id: resumeImports.id,
      fileName: resumeImports.fileName,
      pageCount: resumeImports.pageCount,
      extractedText: resumeImports.extractedText,
      result: resumeImports.result,
      createdAt: resumeImports.createdAt,
    })
    .from(resumeImports)
    .where(scope.owned(resumeImports.userId, eq(resumeImports.id, id)))
    .limit(1);

  return row ? toImportRecord(row) : null;
}

/** Names the document the import became. The file stays as its provenance. */
export async function confirmImport(scope: Scope, id: string, resumeId: string): Promise<boolean> {
  const updated = await db
    .update(resumeImports)
    .set({ status: "confirmed", resumeId })
    .where(scope.owned(resumeImports.userId, eq(resumeImports.id, id)))
    .returning({ id: resumeImports.id });

  return updated.length > 0;
}

export async function deleteImport(scope: Scope, id: string): Promise<boolean> {
  const removed = await db
    .delete(resumeImports)
    .where(scope.owned(resumeImports.userId, eq(resumeImports.id, id)))
    .returning({ id: resumeImports.id });

  return removed.length > 0;
}
