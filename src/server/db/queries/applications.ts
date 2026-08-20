import "server-only";

import { and, asc, count, desc, eq, exists, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { applications, applicationTags, stages, statusEvents } from "@/server/db/schema";
import type { Scope } from "./scope";
import { DEFAULT_STAGES, getFirstStageId } from "./stages";

export type SortField =
  "protocolNumber" | "company" | "position" | "stack" | "location" | "createdAt";
export type SortDirection = "asc" | "desc";

export type Entry = {
  id: string;
  protocolNumber: number;
  company: string;
  website: string | null;
  position: string;
  city: string | null;
  country: string | null;
  notes: string | null;
  stage: string | null;
  createdAt: Date;
  timezone: string | null;
  tags: string[];
};

/** Tags aggregated in SQL so a listing is one round trip, not one per row. */
export const tagsAgg = sql<string[]>`coalesce(
  (select array_agg(t.tag order by t.position, t.tag)
     from ${applicationTags} t
    where t.application_id = ${applications}."id"),
  '{}'
)`;

const tagsText = sql`coalesce(
  (select string_agg(t.tag, ', ' order by t.position, t.tag)
     from ${applicationTags} t
    where t.application_id = ${applications}."id"),
  ''
)`;

const locationText = sql`concat_ws(', ', ${applications.city}, ${applications.country})`;

function orderBy(field: SortField, direction: SortDirection) {
  const dir = direction === "asc" ? asc : desc;
  switch (field) {
    case "company":
      return dir(applications.company);
    case "position":
      return dir(applications.position);
    case "stack":
      return direction === "asc" ? sql`${tagsText} asc` : sql`${tagsText} desc`;
    case "location":
      return direction === "asc" ? sql`${locationText} asc` : sql`${locationText} desc`;
    case "protocolNumber":
      return dir(applications.protocolNumber);
    case "createdAt":
    default:
      return dir(applications.createdAt);
  }
}

/** Matches the prototype's single search box: company, position, stack, place, notes. */
export function searchFilter(term: string) {
  const like = `%${term}%`;
  return or(
    ilike(applications.company, like),
    ilike(applications.position, like),
    ilike(applications.city, like),
    ilike(applications.country, like),
    ilike(applications.notes, like),
    exists(
      db
        .select({ one: sql`1` })
        .from(applicationTags)
        .where(
          and(eq(applicationTags.applicationId, applications.id), ilike(applicationTags.tag, like)),
        ),
    ),
  );
}

/**
 * Which half of the register a listing reads.
 *
 * "open" is the default everywhere, and it is the whole point of the archive:
 * a docket that keeps showing the companies that already said no is a list of
 * disappointments, not a register of what is still in play. Nothing is deleted
 * to achieve it — `rejected` reads the same rows back.
 */
export type EntryFilter = "open" | "rejected" | "all";

export function filterClause(filter: EntryFilter) {
  if (filter === "open") return isNull(applications.rejectedAt);
  if (filter === "rejected") return isNotNull(applications.rejectedAt);
  return undefined;
}

export async function listEntries(
  scope: Scope,
  options: {
    search?: string;
    sort?: SortField;
    direction?: SortDirection;
    filter?: EntryFilter;
  } = {},
): Promise<Entry[]> {
  const term = options.search?.trim();
  const where = scope.owned(
    applications.userId,
    term ? searchFilter(term) : undefined,
    filterClause(options.filter ?? "open"),
  );

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
      stage: sql<
        string | null
      >`(select s.name from ${stages} s where s.id = ${applications.stageId})`,
      createdAt: applications.createdAt,
      timezone: applications.timezone,
      tags: tagsAgg,
    })
    .from(applications)
    .where(where)
    .orderBy(orderBy(options.sort ?? "createdAt", options.direction ?? "desc"));

  return rows;
}

export type EntryCounts = {
  /** Every entry ever stamped. The register is numbered, so this never falls. */
  total: number;
  thisMonth: number;
  /** Still waiting on an answer — the rows the docket actually lists. */
  open: number;
  /** Filed in the archive. */
  rejected: number;
};

/**
 * The figures above the register count everything, including what is filed.
 * A docket that reported a smaller total the day a company said no would be
 * lying about how much work was done — the archive changes where an entry is
 * read, never whether it happened.
 */
export async function getEntryCounts(scope: Scope): Promise<EntryCounts> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totals] = await db
    .select({
      total: count(),
      thisMonth: sql<number>`count(*) filter (where ${applications.createdAt} >= ${startOfMonth.toISOString()})`,
      rejected: sql<number>`count(*) filter (where ${applications.rejectedAt} is not null)`,
    })
    .from(applications)
    .where(scope.owned(applications.userId));

  const total = Number(totals?.total ?? 0);
  const rejected = Number(totals?.rejected ?? 0);

  return {
    total,
    thisMonth: Number(totals?.thisMonth ?? 0),
    open: total - rejected,
    rejected,
  };
}

export type NewEntryInput = {
  company: string;
  website: string | null;
  position: string;
  city: string | null;
  country: string | null;
  notes: string | null;
  jobDescription: string | null;
  timezone?: string | null;
  tags: string[];
  createdAt?: Date;
};

/**
 * The protocol number is computed inside the INSERT so two concurrent stamps
 * cannot claim the same Nº; the unique index on (user_id, protocol_number) is
 * the backstop if they still collide.
 */
export async function createEntry(
  scope: Scope,
  input: NewEntryInput,
): Promise<{ id: string; protocolNumber: number }> {
  // Every entry starts in the first column of the board.
  const stageId = await getFirstStageId(scope);

  const nextNumber = sql<number>`(
    select coalesce(max(a.protocol_number), 0) + 1
      from ${applications} a
     where a.user_id = ${scope.userId}
  )`;

  const [row] = await db
    .insert(applications)
    .values({
      userId: scope.userId,
      protocolNumber: nextNumber,
      company: input.company,
      website: input.website,
      position: input.position,
      city: input.city,
      country: input.country,
      notes: input.notes,
      jobDescription: input.jobDescription,
      timezone: input.timezone ?? null,
      stageId,
      ...(input.createdAt ? { createdAt: input.createdAt, updatedAt: input.createdAt } : {}),
    })
    // The number comes back because Nº 1 is how the caller knows this was the
    // account's first entry, without a second query for it.
    .returning({ id: applications.id, protocolNumber: applications.protocolNumber });

  if (!row) throw new Error("Insert returned no row");

  if (input.tags.length > 0) {
    await db.insert(applicationTags).values(
      input.tags.map((tag, position) => ({
        applicationId: row.id,
        tag,
        position,
      })),
    );
  }

  await db.insert(statusEvents).values({
    applicationId: row.id,
    stageId,
    stageName: DEFAULT_STAGES[0]?.name ?? "Application sent",
    ...(input.createdAt ? { occurredAt: input.createdAt } : {}),
  });

  return row;
}

/**
 * Bulk insert for the import path.
 *
 * Creating entries one at a time cost four round trips each — resolve the first
 * stage, insert the row, insert the tags, insert the event — so a 500-row CSV
 * meant two thousand requests to Neon and a serverless function that ran out of
 * time long before it ran out of rows. This does it in four, regardless of size.
 *
 * Protocol numbers are read once and assigned in sequence. A concurrent stamp
 * could in theory claim the same number; the unique index on
 * (user_id, protocol_number) is what stops it becoming a duplicate.
 */
export async function createEntries(
  scope: Scope,
  rows: readonly NewEntryInput[],
): Promise<{ inserted: number }> {
  if (rows.length === 0) return { inserted: 0 };

  const stageId = await getFirstStageId(scope);
  const stageName = DEFAULT_STAGES[0]?.name ?? "Application sent";

  const [highest] = await db
    .select({ max: sql<number>`coalesce(max(${applications.protocolNumber}), 0)` })
    .from(applications)
    .where(scope.owned(applications.userId));
  const startAt = Number(highest?.max ?? 0);

  const inserted = await db
    .insert(applications)
    .values(
      rows.map((input, index) => ({
        userId: scope.userId,
        protocolNumber: startAt + index + 1,
        company: input.company,
        website: input.website,
        position: input.position,
        city: input.city,
        country: input.country,
        notes: input.notes,
        jobDescription: input.jobDescription,
        timezone: input.timezone ?? null,
        stageId,
        ...(input.createdAt ? { createdAt: input.createdAt, updatedAt: input.createdAt } : {}),
      })),
    )
    .returning({ id: applications.id });

  const tagValues = inserted.flatMap((row, index) =>
    (rows[index]?.tags ?? []).map((tag, position) => ({
      applicationId: row.id,
      tag,
      position,
    })),
  );
  if (tagValues.length > 0) {
    await db.insert(applicationTags).values(tagValues).onConflictDoNothing();
  }

  await db.insert(statusEvents).values(
    inserted.map((row, index) => ({
      applicationId: row.id,
      stageId,
      stageName,
      ...(rows[index]?.createdAt ? { occurredAt: rows[index]!.createdAt } : {}),
    })),
  );

  return { inserted: inserted.length };
}

/** Returns false when the id does not belong to the scope — never throws a leak. */
export async function deleteEntry(scope: Scope, id: string): Promise<boolean> {
  const deleted = await db
    .delete(applications)
    .where(scope.owned(applications.userId, eq(applications.id, id)))
    .returning({ id: applications.id });

  return deleted.length > 0;
}

/** What the edit screen needs on top of a listing row. */
export type EntryDetail = Entry & { jobDescription: string | null };

export async function getEntry(scope: Scope, id: string): Promise<EntryDetail | null> {
  const [row] = await db
    .select({
      id: applications.id,
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
      createdAt: applications.createdAt,
      timezone: applications.timezone,
      jobDescription: applications.jobDescription,
      tags: tagsAgg,
    })
    .from(applications)
    .where(scope.owned(applications.userId, eq(applications.id, id)))
    .limit(1);

  return row ?? null;
}

export type EditEntryInput = Omit<NewEntryInput, "createdAt">;

/**
 * Corrects an entry. The number and the stamp are not among the fields.
 *
 * A docket is a numbered register, and what makes it one is that the number and
 * the moment are not up for revision — an entry whose date can be moved is a
 * note, not a record. Everything a person can get wrong about a job they applied
 * to is editable; the two facts the register itself asserts are not.
 *
 * The stage is left alone too: moving an application through the funnel is the
 * board's job, and it writes a status event when it happens. Correcting a
 * company name should not look like progress.
 */
export async function updateEntry(
  scope: Scope,
  id: string,
  input: EditEntryInput,
): Promise<boolean> {
  const [row] = await db
    .update(applications)
    .set({
      company: input.company,
      website: input.website,
      position: input.position,
      city: input.city,
      country: input.country,
      notes: input.notes,
      jobDescription: input.jobDescription,
      updatedAt: new Date(),
    })
    .where(scope.owned(applications.userId, eq(applications.id, id)))
    .returning({ id: applications.id });

  if (!row) return false;

  // Tags are positional and replaced wholesale: reconciling them one by one
  // would cost more round trips than rewriting a list that is never long.
  // scope-exempt: the id came back from the scoped update directly above.
  await db.delete(applicationTags).where(eq(applicationTags.applicationId, row.id));
  if (input.tags.length > 0) {
    await db.insert(applicationTags).values(
      input.tags.map((tag, position) => ({
        applicationId: row.id,
        tag,
        position,
      })),
    );
  }

  return true;
}
