import "server-only";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { importResultSchema, type ResumeImportResult } from "@/lib/resume/import";
import { parseResume, type Resume } from "@/lib/resume/schema";
import { analysisSchema, resumeChangeSchema } from "@/lib/tailoring/schema";
import type { ResumeChange, TailoringAnalysis } from "@/lib/tailoring/types";
import { db } from "@/server/db";
import {
  applications,
  resumeAnalyses,
  resumeChanges,
  resumeImports,
  resumes,
  users,
} from "@/server/db/schema";
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

export type ResumeSource = "pdf" | "manual" | "duplicate";

export type ResumeRecord = {
  id: string;
  title: string;
  source: ResumeSource;
  originalFileName: string | null;
  content: Resume;
  original: Resume;
  updatedAt: Date;
  lastUsedAt: Date | null;
};

export type AnalysisRecord = {
  id: string;
  resumeId: string;
  applicationId: string | null;
  jobDescription: string;
  /** The two documents as they were when this ran. See lib/tailoring/fingerprint. */
  resumeFingerprint: string;
  jobFingerprint: string;
  /** And what read them: the algorithm, and the instructions. */
  scoringVersion: string;
  promptVersion: string;
  analysis: TailoringAnalysis;
  createdAt: Date;
};

const RESUME_COLUMNS = {
  id: resumes.id,
  title: resumes.title,
  source: resumes.source,
  originalFileName: resumes.originalFileName,
  content: resumes.content,
  original: resumes.original,
  updatedAt: resumes.updatedAt,
  lastUsedAt: resumes.lastUsedAt,
} as const;

function toRecord(row: {
  id: string;
  title: string;
  source: string;
  originalFileName: string | null;
  content: unknown;
  original: unknown;
  updatedAt: Date;
  lastUsedAt: Date | null;
}): ResumeRecord | null {
  const content = parseResume(row.content);
  if (!content) return null;
  return {
    id: row.id,
    title: row.title,
    source: (["pdf", "manual", "duplicate"].includes(row.source)
      ? row.source
      : "manual") as ResumeSource,
    originalFileName: row.originalFileName,
    content,
    original: parseResume(row.original) ?? content,
    updatedAt: row.updatedAt,
    lastUsedAt: row.lastUsedAt,
  };
}

/**
 * The CV the editor opens on.
 *
 * The pointer on the account decides, and the most recently touched document is
 * the fallback for an account that has never chosen — which is every account
 * that had one CV before there was a library. A pointer at a document that is
 * gone reads as no pointer at all, so deleting the active CV lands on the empty
 * state rather than on somebody else's row.
 */
export async function getResume(scope: Scope): Promise<ResumeRecord | null> {
  const [account] = await db
    .select({ activeResumeId: users.activeResumeId })
    .from(users)
    .where(eq(users.id, scope.userId))
    .limit(1);

  if (account?.activeResumeId) {
    const chosen = await getResumeById(scope, account.activeResumeId);
    if (chosen) return chosen;
  }

  const rows = await db
    .select(RESUME_COLUMNS)
    .from(resumes)
    .where(scope.owned(resumes.userId))
    .orderBy(desc(resumes.updatedAt))
    .limit(2);

  // With nothing chosen, one document is unambiguous and several are not.
  // Opening the most recent of several would be a silent choice, and section 18
  // is explicit that switching documents is never something to do quietly — so
  // an account that has just deleted the one it was using lands on the library.
  return rows.length === 1 ? toRecord(rows[0]!) : null;
}

export async function getResumeById(scope: Scope, id: string): Promise<ResumeRecord | null> {
  const [row] = await db
    .select(RESUME_COLUMNS)
    .from(resumes)
    .where(scope.owned(resumes.userId, eq(resumes.id, id)))
    .limit(1);

  return row ? toRecord(row) : null;
}

/**
 * Points the editor at one document. Null clears it, which is what deleting the
 * active CV does — the empty state is a legitimate place to be.
 */
export async function setActiveResume(scope: Scope, id: string | null): Promise<boolean> {
  if (id) {
    const owned = await getResumeById(scope, id);
    if (!owned) return false;
  }

  await db.update(users).set({ activeResumeId: id }).where(eq(users.id, scope.userId));

  return true;
}

export async function createResume(
  scope: Scope,
  input: {
    title: string;
    content: Resume;
    source?: ResumeSource;
    originalFileName?: string | null;
  },
): Promise<ResumeRecord> {
  const [row] = await db
    .insert(resumes)
    .values({
      userId: scope.userId,
      title: input.title,
      source: input.source ?? "manual",
      originalFileName: input.originalFileName ?? null,
      content: input.content,
      // The document as it arrived. Never written again — see the schema.
      original: input.content,
    })
    .returning(RESUME_COLUMNS);

  return toRecord(row!)!;
}

/** A copy that shares nothing with what it was copied from. */
export async function duplicateResume(
  scope: Scope,
  id: string,
  input: { title: string; content: Resume },
): Promise<ResumeRecord | null> {
  const owned = await getResumeById(scope, id);
  if (!owned) return null;

  const [row] = await db
    .insert(resumes)
    .values({
      userId: scope.userId,
      title: input.title,
      source: "duplicate",
      originalFileName: owned.originalFileName,
      content: input.content,
      original: input.content,
    })
    .returning(RESUME_COLUMNS);

  return toRecord(row!)!;
}

/**
 * Permanent, and everything that belonged to this document alone goes with it:
 * its readings, its change history and the file it was imported from all
 * cascade from this row. What is shared with anything else — the entries in the
 * register the readings pointed at — is not touched.
 */
export async function deleteResume(scope: Scope, id: string): Promise<boolean> {
  // The pointer goes first: a row deleted while the account still names it
  // would leave the editor holding an address with nothing behind it.
  await db
    .update(users)
    .set({ activeResumeId: null })
    .where(and(eq(users.id, scope.userId), eq(users.activeResumeId, id)));

  const removed = await db
    .delete(resumes)
    .where(scope.owned(resumes.userId, eq(resumes.id, id)))
    .returning({ id: resumes.id });

  return removed.length > 0;
}

/** Records that a document was read against an advert. */
export async function markResumeUsed(scope: Scope, id: string): Promise<void> {
  await db
    .update(resumes)
    .set({ lastUsedAt: new Date() })
    .where(scope.owned(resumes.userId, eq(resumes.id, id)));
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

/**
 * The library: every CV this account holds, with what it takes to tell them
 * apart, and nothing it takes to render one.
 *
 * The documents themselves are deliberately not selected. A library of eight
 * CVs is eight structured documents, and the screen showing their names has no
 * use for a single bullet of any of them.
 */
export type LibraryEntry = {
  id: string;
  title: string;
  source: ResumeSource;
  originalFileName: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
  active: boolean;
  /** How many adverts this CV has been read against. */
  comparisons: number;
  /** The most recent reading, when there is one. */
  latest: {
    score: number | null;
    company: string | null;
    position: string | null;
    at: Date;
  } | null;
};

export async function listResumes(scope: Scope): Promise<LibraryEntry[]> {
  const [account] = await db
    .select({ activeResumeId: users.activeResumeId })
    .from(users)
    .where(eq(users.id, scope.userId))
    .limit(1);

  const rows = await db
    .select({
      id: resumes.id,
      title: resumes.title,
      source: resumes.source,
      originalFileName: resumes.originalFileName,
      createdAt: resumes.createdAt,
      updatedAt: resumes.updatedAt,
      lastUsedAt: resumes.lastUsedAt,
    })
    .from(resumes)
    .where(scope.owned(resumes.userId))
    .orderBy(desc(resumes.updatedAt))
    .limit(100);

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);

  const counted = await db
    .select({ resumeId: resumeAnalyses.resumeId, total: sql<number>`count(*)::int` })
    .from(resumeAnalyses)
    .where(scope.owned(resumeAnalyses.userId, inArray(resumeAnalyses.resumeId, ids)))
    .groupBy(resumeAnalyses.resumeId);

  const readings = await db
    .select({
      resumeId: resumeAnalyses.resumeId,
      createdAt: resumeAnalyses.createdAt,
      result: resumeAnalyses.result,
      company: applications.company,
      position: applications.position,
    })
    .from(resumeAnalyses)
    .leftJoin(applications, eq(applications.id, resumeAnalyses.applicationId))
    .where(scope.owned(resumeAnalyses.userId, inArray(resumeAnalyses.resumeId, ids)))
    .orderBy(desc(resumeAnalyses.createdAt))
    .limit(200);

  const comparisons = new Map(counted.map((row) => [row.resumeId, row.total]));
  const latest = new Map<string, LibraryEntry["latest"]>();

  for (const reading of readings) {
    if (latest.has(reading.resumeId)) continue;
    const parsed = analysisSchema.safeParse(reading.result);
    latest.set(reading.resumeId, {
      score: parsed.success ? parsed.data.jobMatch.overallScore : null,
      company: reading.company,
      position: reading.position,
      at: reading.createdAt,
    });
  }

  const activeId =
    account?.activeResumeId && ids.includes(account.activeResumeId)
      ? account.activeResumeId
      : rows.length === 1
        ? rows[0]!.id
        : null;

  return rows.map((row) => ({
    ...row,
    source: (["pdf", "manual", "duplicate"].includes(row.source)
      ? row.source
      : "manual") as ResumeSource,
    active: row.id === activeId,
    comparisons: comparisons.get(row.id) ?? 0,
    latest: latest.get(row.id) ?? null,
  }));
}

/* -------------------------------------------------------------------------- */

const ANALYSIS_COLUMNS = {
  id: resumeAnalyses.id,
  resumeId: resumeAnalyses.resumeId,
  applicationId: resumeAnalyses.applicationId,
  jobDescription: resumeAnalyses.jobDescription,
  resumeFingerprint: resumeAnalyses.resumeFingerprint,
  jobFingerprint: resumeAnalyses.jobFingerprint,
  scoringVersion: resumeAnalyses.scoringVersion,
  promptVersion: resumeAnalyses.promptVersion,
  result: resumeAnalyses.result,
  createdAt: resumeAnalyses.createdAt,
} as const;

function toAnalysisRecord(row: {
  id: string;
  resumeId: string;
  applicationId: string | null;
  jobDescription: string;
  resumeFingerprint: string;
  jobFingerprint: string;
  scoringVersion: string;
  promptVersion: string;
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
    resumeFingerprint: row.resumeFingerprint,
    jobFingerprint: row.jobFingerprint,
    scoringVersion: row.scoringVersion,
    promptVersion: row.promptVersion,
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
    .select(ANALYSIS_COLUMNS)
    .from(resumeAnalyses)
    .where(scope.owned(resumeAnalyses.userId, eq(resumeAnalyses.resumeId, resumeId)))
    .orderBy(desc(resumeAnalyses.createdAt))
    .limit(1);

  return row ? toAnalysisRecord(row) : null;
}

export async function getAnalysis(scope: Scope, id: string): Promise<AnalysisRecord | null> {
  const [row] = await db
    .select(ANALYSIS_COLUMNS)
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
    resumeFingerprint: string;
    jobFingerprint: string;
    scoringVersion: string;
    promptVersion: string;
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
      resumeFingerprint: input.resumeFingerprint,
      jobFingerprint: input.jobFingerprint,
      scoringVersion: input.scoringVersion,
      promptVersion: input.promptVersion,
      result: input.analysis,
      model: input.model,
    })
    .returning(ANALYSIS_COLUMNS);

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

/** How many adverts one CV has been read against, for the delete confirmation. */
export async function countAnalysesFor(scope: Scope, resumeId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(resumeAnalyses)
    .where(scope.owned(resumeAnalyses.userId, eq(resumeAnalyses.resumeId, resumeId)));

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
