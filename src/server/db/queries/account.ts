import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  applications,
  applicationTags,
  resumeAnalyses,
  resumeImports,
  resumes,
  stages,
  statusEvents,
  users,
} from "@/server/db/schema";
import type { Scope } from "./scope";

export type AccountExport = {
  exportedAt: string;
  account: { id: string; name: string | null; email: string; createdAt: string };
  entries: Array<{
    protocolNumber: number;
    company: string;
    website: string | null;
    position: string;
    city: string | null;
    country: string | null;
    notes: string | null;
    stage: string | null;
    tags: string[];
    jobDescription: string | null;
    createdAt: string;
    /** Null unless the application was filed in the rejection archive. */
    rejectedAt: string | null;
    rejectedAtStage: string | null;
    rejectionNote: string | null;
    history: Array<{ stage: string; occurredAt: string; note: string | null }>;
  }>;
  /**
   * The CV, if there is one, and every reading of it. Absent rather than empty
   * on an account that never opened the section — a key that is always there
   * suggests the product holds a CV for everyone, and it does not.
   */
  cv?: {
    title: string;
    /** The document as it currently reads. */
    content: unknown;
    /** The document as it arrived, before any recommendation was applied. */
    original: unknown;
    updatedAt: string;
    readings: Array<{
      analyzedAt: string;
      jobDescription: string;
      /** The whole stored reading: requirements, coverage, figure, recommendations. */
      result: unknown;
    }>;
    /**
     * The documents a CV was imported from, named rather than included: the
     * files themselves are megabytes of base64 that the person already has a
     * copy of, and an export nobody can open is worse than one that says what
     * is held and how to ask for it.
     */
    importedFrom: Array<{ fileName: string; pageCount: number; importedAt: string }>;
  };
};

/** Everything the user owns, in one document. GDPR art. 20 / LGPD art. 18. */
export async function exportAccount(scope: Scope): Promise<AccountExport> {
  const [account] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, scope.userId))
    .limit(1);

  if (!account) throw new Error("Account not found");

  const rows = await db
    .select({
      protocolNumber: applications.protocolNumber,
      company: applications.company,
      website: applications.website,
      position: applications.position,
      city: applications.city,
      country: applications.country,
      notes: applications.notes,
      stage: sql<
        string | null
      >`(select s.name from ${stages} s where s.id = ${applications.stageId})`,
      jobDescription: applications.jobDescription,
      createdAt: applications.createdAt,
      rejectedAt: applications.rejectedAt,
      rejectedAtStage: applications.rejectedAtStage,
      rejectionNote: applications.rejectionNote,
      tags: sql<string[]>`coalesce(
        (select array_agg(t.tag order by t.position, t.tag)
           from ${applicationTags} t
          where t.application_id = ${applications}."id"),
        '{}'
      )`,
      history: sql<Array<{ stage: string; occurredAt: string; note: string | null }>>`coalesce(
        (select json_agg(json_build_object(
                  'stage', e.stage_name,
                  'occurredAt', e.occurred_at,
                  'note', e.note
                ) order by e.occurred_at)
           from ${statusEvents} e
          where e.application_id = ${applications}."id"),
        '[]'::json
      )`,
    })
    .from(applications)
    .where(scope.owned(applications.userId))
    .orderBy(asc(applications.protocolNumber));

  const [cv] = await db
    .select({
      title: resumes.title,
      content: resumes.content,
      original: resumes.original,
      updatedAt: resumes.updatedAt,
      id: resumes.id,
    })
    .from(resumes)
    .where(scope.owned(resumes.userId))
    .orderBy(asc(resumes.createdAt))
    .limit(1);

  const readings = cv
    ? await db
        .select({
          analyzedAt: resumeAnalyses.createdAt,
          jobDescription: resumeAnalyses.jobDescription,
          result: resumeAnalyses.result,
        })
        .from(resumeAnalyses)
        .where(scope.owned(resumeAnalyses.userId, eq(resumeAnalyses.resumeId, cv.id)))
        .orderBy(asc(resumeAnalyses.createdAt))
    : [];

  const imports = cv
    ? await db
        .select({
          fileName: resumeImports.fileName,
          pageCount: resumeImports.pageCount,
          importedAt: resumeImports.createdAt,
        })
        .from(resumeImports)
        .where(scope.owned(resumeImports.userId))
        .orderBy(asc(resumeImports.createdAt))
    : [];

  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: account.id,
      name: account.name,
      email: account.email,
      createdAt: account.createdAt.toISOString(),
    },
    entries: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      history: row.history ?? [],
      tags: row.tags ?? [],
    })),
    ...(cv
      ? {
          cv: {
            title: cv.title,
            content: cv.content,
            original: cv.original,
            updatedAt: cv.updatedAt.toISOString(),
            readings: readings.map((reading) => ({
              analyzedAt: reading.analyzedAt.toISOString(),
              jobDescription: reading.jobDescription,
              result: reading.result,
            })),
            importedFrom: imports.map((item) => ({
              fileName: item.fileName,
              pageCount: item.pageCount,
              importedAt: item.importedAt.toISOString(),
            })),
          },
        }
      : {}),
  };
}

/**
 * Hard delete. Sessions, accounts, applications, tags, status events, the CV,
 * its readings and its change history all cascade from `users`, so removing the
 * row removes the person entirely.
 */
export async function deleteAccount(scope: Scope): Promise<void> {
  await db.delete(users).where(eq(users.id, scope.userId));
}
