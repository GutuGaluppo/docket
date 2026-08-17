import "server-only";

import { and, asc, count, desc, eq, exists, ilike, or, sql } from "drizzle-orm";

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
const tagsAgg = sql<string[]>`coalesce(
  (select array_agg(t.tag order by t.position, t.tag)
     from ${applicationTags} t
    where t.application_id = ${applications.id}),
  '{}'
)`;

const tagsText = sql`coalesce(
  (select string_agg(t.tag, ', ' order by t.position, t.tag)
     from ${applicationTags} t
    where t.application_id = ${applications.id}),
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
function searchFilter(term: string) {
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

export async function listEntries(
  scope: Scope,
  options: { search?: string; sort?: SortField; direction?: SortDirection } = {},
): Promise<Entry[]> {
  const term = options.search?.trim();
  const where = scope.owned(applications.userId, term ? searchFilter(term) : undefined);

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
      stage: sql<string | null>`(select s.name from ${stages} s where s.id = ${applications.stageId})`,
      createdAt: applications.createdAt,
      timezone: applications.timezone,
      tags: tagsAgg,
    })
    .from(applications)
    .where(where)
    .orderBy(orderBy(options.sort ?? "createdAt", options.direction ?? "desc"));

  return rows;
}

export async function getEntryCounts(scope: Scope): Promise<{ total: number; thisMonth: number }> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totals] = await db
    .select({
      total: count(),
      thisMonth: sql<number>`count(*) filter (where ${applications.createdAt} >= ${startOfMonth.toISOString()})`,
    })
    .from(applications)
    .where(scope.owned(applications.userId));

  return { total: Number(totals?.total ?? 0), thisMonth: Number(totals?.thisMonth ?? 0) };
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
export async function createEntry(scope: Scope, input: NewEntryInput): Promise<{ id: string }> {
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
    .returning({ id: applications.id });

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

/** Returns false when the id does not belong to the scope — never throws a leak. */
export async function deleteEntry(scope: Scope, id: string): Promise<boolean> {
  const deleted = await db
    .delete(applications)
    .where(scope.owned(applications.userId, eq(applications.id, id)))
    .returning({ id: applications.id });

  return deleted.length > 0;
}

export async function getEntry(scope: Scope, id: string): Promise<Entry | null> {
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
      stage: sql<string | null>`(select s.name from ${stages} s where s.id = ${applications.stageId})`,
      createdAt: applications.createdAt,
      timezone: applications.timezone,
      tags: tagsAgg,
    })
    .from(applications)
    .where(scope.owned(applications.userId, eq(applications.id, id)))
    .limit(1);

  return row ?? null;
}
