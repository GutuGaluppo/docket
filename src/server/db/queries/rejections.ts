import "server-only";

import { desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { applications, interviews, stages, statusEvents } from "@/server/db/schema";
import type { Scope } from "./scope";
import { searchFilter, tagsAgg } from "./applications";
import { ensureStages } from "./stages";

/**
 * The rejection archive.
 *
 * A refusal is filed, never deleted. The entry keeps its protocol number, its
 * stamp and its history; what changes is where it is read. Everything that
 * means "still in play" — the register, the board, the follow-up cron — reads
 * `rejected_at is null`, and this module is the other side of that line.
 */

export type Rejection = {
  id: string;
  protocolNumber: number;
  company: string;
  website: string | null;
  position: string;
  city: string | null;
  country: string | null;
  notes: string | null;
  createdAt: Date;
  timezone: string | null;
  tags: string[];
  rejectedAt: Date;
  /** The column the process had reached. Null for an entry filed from nowhere. */
  rejectedAtStage: string | null;
  rejectionNote: string | null;
  /** How far it actually got: an interview that happened is the honest measure. */
  interviewCount: number;
};

/**
 * The outer column is written `${applications}."id"`, not `${applications.id}`.
 * A `sql` fragment used directly as a select field renders its columns without
 * the table name, and a bare `"id"` inside this subquery would bind to
 * `interviews.id` — which is never an application id, so the count would
 * silently be zero for everyone. See correlated.test.ts.
 */
const interviewCount = sql<number>`(
  select count(*) from ${interviews} i where i.application_id = ${applications}."id"
)`;

/**
 * Newest refusal first. The archive is read the way bad news arrives — the most
 * recent one is the one being thought about — which is the opposite of the
 * register, where the protocol number sets the order.
 */
export async function listRejections(
  scope: Scope,
  options: { search?: string } = {},
): Promise<Rejection[]> {
  const term = options.search?.trim();

  const rows = await db
    .select({
      id: applications.id,
      protocolNumber: applications.protocolNumber,
      company: applications.company,
      website: applications.website,
      position: applications.position,
      city: applications.city,
      country: applications.country,
      notes: applications.notes,
      createdAt: applications.createdAt,
      timezone: applications.timezone,
      tags: tagsAgg,
      rejectedAt: applications.rejectedAt,
      rejectedAtStage: applications.rejectedAtStage,
      rejectionNote: applications.rejectionNote,
      interviewCount,
    })
    .from(applications)
    .where(
      scope.owned(
        applications.userId,
        isNotNull(applications.rejectedAt),
        term ? searchFilter(term) : undefined,
      ),
    )
    .orderBy(desc(applications.rejectedAt), desc(applications.protocolNumber));

  // `rejectedAt` is nullable on the table and not null in every row this query
  // can return; the predicate above is what makes the cast true.
  return rows.map((row) => ({
    ...row,
    rejectedAt: row.rejectedAt as Date,
    interviewCount: Number(row.interviewCount),
  }));
}

export type RejectionCounts = {
  total: number;
  /** Filed without a single interview ever having been scheduled. */
  beforeAnyInterview: number;
  /** Refusals filed since the first of this month. */
  thisMonth: number;
};

/**
 * The two numbers worth reading above an archive.
 *
 * "Before any interview" is the one that answers the question people actually
 * ask themselves — whether the applications are dying at the door or after
 * someone has met them — and those are two different problems with two
 * different fixes.
 */
export async function getRejectionCounts(scope: Scope): Promise<RejectionCounts> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  /**
   * The interviews are joined as a grouped subquery rather than counted with a
   * correlated one, so that everything inside `filter (where …)` is a plain
   * column reference — the one shape Postgres is unambiguous about allowing
   * there.
   */
  const booked = db
    .select({
      applicationId: interviews.applicationId,
      n: sql<number>`count(*)`.as("n"),
    })
    .from(interviews)
    .groupBy(interviews.applicationId)
    .as("booked");

  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      beforeAnyInterview: sql<number>`count(*) filter (where ${isNull(booked.n)})`,
      thisMonth: sql<number>`count(*) filter (where ${applications.rejectedAt} >= ${startOfMonth.toISOString()})`,
    })
    .from(applications)
    .leftJoin(booked, eq(booked.applicationId, applications.id))
    .where(scope.owned(applications.userId, isNotNull(applications.rejectedAt)));

  return {
    total: Number(row?.total ?? 0),
    beforeAnyInterview: Number(row?.beforeAnyInterview ?? 0),
    thisMonth: Number(row?.thisMonth ?? 0),
  };
}

export type RejectionResult = { ok: true; company: string } | { ok: false; reason: string };

/**
 * Files a refusal.
 *
 * Three things happen at once and none of them is optional: the entry is
 * stamped as rejected, the column it had reached is copied onto it by name —
 * so the archive still reads correctly after that column is renamed — and the
 * card is moved to the terminal column so the board and the funnel agree with
 * the archive instead of contradicting it.
 *
 * A status event is appended like any other move. The history is what the
 * archive is built on: it must be able to say when the answer came and what
 * the answer was, long after the row itself was reopened or refiled.
 */
export async function fileRejection(
  scope: Scope,
  id: string,
  note: string | null,
): Promise<RejectionResult> {
  const columns = await ensureStages(scope);
  const closing = columns.find((column) => column.kind === "lost") ?? columns.at(-1) ?? null;

  const [current] = await db
    .select({
      id: applications.id,
      company: applications.company,
      rejectedAt: applications.rejectedAt,
      stageName: sql<string | null>`(
        select s.name from ${stages} s where s.id = ${applications.stageId}
      )`,
    })
    .from(applications)
    .where(scope.owned(applications.userId, eq(applications.id, id)))
    .limit(1);

  // A miss and someone else's id give the same answer, as everywhere else.
  if (!current) return { ok: false, reason: "Entry not found." };
  if (current.rejectedAt)
    return { ok: false, reason: "That application is already in the archive." };

  const reached = current.stageName ?? columns[0]?.name ?? null;
  const now = new Date();

  await db
    .update(applications)
    .set({
      rejectedAt: now,
      rejectedAtStage: reached,
      rejectionNote: note,
      updatedAt: now,
      ...(closing ? { stageId: closing.id } : {}),
    })
    .where(scope.owned(applications.userId, eq(applications.id, id)));

  await db.insert(statusEvents).values({
    applicationId: id,
    stageId: closing?.id ?? null,
    stageName: closing?.name ?? "Closed",
    occurredAt: now,
    note,
  });

  return { ok: true, company: current.company };
}

/**
 * Takes an entry back out of the archive.
 *
 * A refusal filed by mistake, or a company that came back after saying no,
 * returns to the column it was in when the refusal landed — that is what
 * `rejected_at_stage` was kept for. If that column is gone, it starts again
 * from the first one rather than from nowhere.
 *
 * The note is cleared with the rest: a reopened application is not carrying a
 * refusal any more. What was said is still in the history, which is the copy
 * that was always meant to be permanent.
 */
export async function reopenApplication(scope: Scope, id: string): Promise<RejectionResult> {
  const columns = await ensureStages(scope);

  const [current] = await db
    .select({
      company: applications.company,
      rejectedAt: applications.rejectedAt,
      rejectedAtStage: applications.rejectedAtStage,
    })
    .from(applications)
    .where(scope.owned(applications.userId, eq(applications.id, id)))
    .limit(1);

  if (!current) return { ok: false, reason: "Entry not found." };
  if (!current.rejectedAt) return { ok: false, reason: "That application is not in the archive." };

  const back =
    columns.find((column) => column.name === current.rejectedAtStage && column.kind !== "lost") ??
    columns[0];

  const now = new Date();

  await db
    .update(applications)
    .set({
      rejectedAt: null,
      rejectedAtStage: null,
      rejectionNote: null,
      stageId: back?.id ?? null,
      updatedAt: now,
    })
    .where(scope.owned(applications.userId, eq(applications.id, id)));

  await db.insert(statusEvents).values({
    applicationId: id,
    stageId: back?.id ?? null,
    stageName: back?.name ?? "Reopened",
    occurredAt: now,
    note: "Reopened from the archive",
  });

  return { ok: true, company: current.company };
}
