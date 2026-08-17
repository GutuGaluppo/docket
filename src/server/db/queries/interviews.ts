import "server-only";

import { and, asc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { applications, interviews, users } from "@/server/db/schema";
import type { Scope } from "./scope";

export type ScheduledInterview = {
  id: string;
  applicationId: string;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  location: string | null;
  notes: string | null;
  remindMinutes: number;
  uid: string;
  sequence: number;
  company: string;
  position: string;
  protocolNumber: number;
  timezone: string | null;
};

const SELECT = {
  id: interviews.id,
  applicationId: interviews.applicationId,
  title: interviews.title,
  startsAt: interviews.startsAt,
  durationMinutes: interviews.durationMinutes,
  location: interviews.location,
  notes: interviews.notes,
  remindMinutes: interviews.remindMinutes,
  uid: interviews.uid,
  sequence: interviews.sequence,
  company: applications.company,
  position: applications.position,
  protocolNumber: applications.protocolNumber,
  timezone: interviews.timezone,
};

/**
 * Interviews are reached through their application, and the join is what
 * enforces ownership — there is no userId on the interviews table to disagree
 * with.
 */
export async function listInterviews(
  scope: Scope,
  range?: { from: Date; to: Date },
): Promise<ScheduledInterview[]> {
  const window = range
    ? and(gte(interviews.startsAt, range.from), sql`${interviews.startsAt} < ${range.to}`)
    : undefined;

  return db
    .select(SELECT)
    .from(interviews)
    .innerJoin(applications, eq(interviews.applicationId, applications.id))
    .where(scope.owned(applications.userId, window))
    .orderBy(asc(interviews.startsAt));
}

export async function getInterview(
  scope: Scope,
  id: string,
): Promise<ScheduledInterview | null> {
  const [row] = await db
    .select(SELECT)
    .from(interviews)
    .innerJoin(applications, eq(interviews.applicationId, applications.id))
    .where(scope.owned(applications.userId, eq(interviews.id, id)))
    .limit(1);
  return row ?? null;
}

export type NewInterview = {
  applicationId: string;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  location: string | null;
  notes: string | null;
  remindMinutes: number;
  timezone: string | null;
};

export async function createInterview(
  scope: Scope,
  input: NewInterview,
): Promise<{ id: string } | null> {
  // The application must be the caller's before anything is written against it.
  const [owned] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(scope.owned(applications.userId, eq(applications.id, input.applicationId)))
    .limit(1);
  if (!owned) return null;

  const [row] = await db.insert(interviews).values(input).returning({ id: interviews.id });
  return row ?? null;
}

export async function deleteInterview(scope: Scope, id: string): Promise<boolean> {
  const [owned] = await db
    .select({ id: interviews.id })
    .from(interviews)
    .innerJoin(applications, eq(interviews.applicationId, applications.id))
    .where(scope.owned(applications.userId, eq(interviews.id, id)))
    .limit(1);
  if (!owned) return false;

  // scope-exempt: ownership proven by the scoped select immediately above.
  await db.delete(interviews).where(eq(interviews.id, id));
  return true;
}

/* ---------------------------------------------------------------------------
   Calendar feed token. The subscription URL is fetched without a session, so
   the token in the path is the credential — long, random, and revocable.
--------------------------------------------------------------------------- */

export async function getOrCreateCalendarToken(scope: Scope): Promise<string> {
  const [row] = await db
    .select({ token: users.calendarToken })
    .from(users)
    .where(eq(users.id, scope.userId))
    .limit(1);

  if (row?.token) return row.token;

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await db.update(users).set({ calendarToken: token }).where(eq(users.id, scope.userId));
  return token;
}

export async function rotateCalendarToken(scope: Scope): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await db.update(users).set({ calendarToken: token }).where(eq(users.id, scope.userId));
  return token;
}

/**
 * Feed lookup. Deliberately the only query in the codebase that resolves a
 * user from something other than a session, and it takes the full token.
 */
export async function listInterviewsByFeedToken(
  token: string,
): Promise<{ interviews: ScheduledInterview[]; userId: string } | null> {
  if (token.length < 32) return null;

  // scope-exempt: the feed has no session — the token in the URL is the credential.
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.calendarToken, token))
    .limit(1);
  if (!owner) return null;

  // scope-exempt: owner resolved from the token above; still filtered to that one user.
  const rows = await db
    .select(SELECT)
    .from(interviews)
    .innerJoin(applications, eq(interviews.applicationId, applications.id))
    .where(eq(applications.userId, owner.id))
    .orderBy(asc(interviews.startsAt));

  return { interviews: rows, userId: owner.id };
}
