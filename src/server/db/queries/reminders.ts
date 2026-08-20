import "server-only";

import { asc, eq, inArray, isNotNull, notExists, or, isNull, and, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { applications, reminders, stages, subscriptions, users } from "@/server/db/schema";
import { BILLING_ENABLED } from "@/server/billing/limits";
import type { Scope } from "./scope";

export type DueApplication = {
  id: string;
  protocolNumber: number;
  company: string;
  position: string;
  createdAt: Date;
  daysWaiting: number;
};

export type DueBatch = {
  userId: string;
  email: string;
  name: string | null;
  followUpDays: number;
  applications: DueApplication[];
};

/**
 * Applications that have sat in the first column past the user's chosen
 * threshold and have never been nudged about.
 *
 * Runs from the cron with no session, so it is scoped by the job's own
 * predicates rather than by a Scope — every row it returns is joined back to
 * the user it belongs to, and the caller only ever emails that address.
 *
 * The plan is filtered here, in SQL, rather than trusted to the settings screen.
 * Reminders are the one capped feature that acts on its own: a column nobody may
 * add is inert until someone clicks, but an email sent to an account that is not
 * entitled to it has already happened by the time anyone notices. A row whose
 * `follow_up_days` was set while the caps were off stays in the database and
 * simply stops matching.
 */
export async function findDueReminders(limit = 500): Promise<DueBatch[]> {
  // scope-exempt: a scheduled job has no session; ownership travels on the join.
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      followUpDays: users.followUpDays,
      id: applications.id,
      protocolNumber: applications.protocolNumber,
      company: applications.company,
      position: applications.position,
      createdAt: applications.createdAt,
      daysWaiting: sql<number>`floor(extract(epoch from (now() - ${applications.createdAt})) / 86400)`,
    })
    .from(applications)
    .innerJoin(users, eq(applications.userId, users.id))
    // Left join, not inner: an account that never had a subscription has no row
    // at all, and an inner join would drop it even with the caps switched off.
    // A missing row fails the plan filter below on its own, which is the free
    // plan by another name.
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .leftJoin(stages, eq(applications.stageId, stages.id))
    .where(
      and(
        isNotNull(users.followUpDays),
        // Section 7 puts reminders on the paid side. Left out entirely when the
        // caps are off, so flipping BILLING_ENABLED restores the old behaviour
        // here too rather than leaving the cron on a stale rule.
        ...(BILLING_ENABLED
          ? [
              inArray(subscriptions.plan, ["pro", "teams"] as const),
              inArray(subscriptions.status, ["active", "trialing"] as const),
            ]
          : []),
        // Still untouched: either in a start column, or never assigned one.
        or(eq(stages.kind, "start"), isNull(applications.stageId)),
        // Never nudge about an application that has already been refused. The
        // answer arrived; a reminder to chase it would be the cruellest
        // possible email this product could send.
        isNull(applications.rejectedAt),
        sql`${applications.createdAt} <= now() - make_interval(days => ${users.followUpDays})`,
        notExists(
          db
            .select({ one: sql`1` })
            .from(reminders)
            .where(eq(reminders.applicationId, applications.id)),
        ),
      ),
    )
    .orderBy(asc(users.id), asc(applications.protocolNumber))
    .limit(limit);

  const batches = new Map<string, DueBatch>();
  for (const row of rows) {
    if (row.followUpDays === null) continue;
    const batch = batches.get(row.userId) ?? {
      userId: row.userId,
      email: row.email,
      name: row.name,
      followUpDays: row.followUpDays,
      applications: [],
    };
    batch.applications.push({
      id: row.id,
      protocolNumber: row.protocolNumber,
      company: row.company,
      position: row.position,
      createdAt: row.createdAt,
      daysWaiting: Number(row.daysWaiting),
    });
    batches.set(row.userId, batch);
  }
  return [...batches.values()];
}

/**
 * Claims the work before the email goes out, not after.
 *
 * Between the two failure modes — nudging someone twice about the same dead
 * application, or missing one nudge — the duplicate is the one that erodes
 * trust. So the claim is written first; if the send then fails, `release`
 * removes it and the next run tries again.
 */
export async function claimReminders(applicationIds: readonly string[]): Promise<string[]> {
  if (applicationIds.length === 0) return [];
  // scope-exempt: ids come from findDueReminders, which joined them to their owner.
  const claimed = await db
    .insert(reminders)
    .values(applicationIds.map((applicationId) => ({ applicationId })))
    .onConflictDoNothing()
    .returning({ applicationId: reminders.applicationId });
  return claimed.map((row) => row.applicationId);
}

export async function releaseReminders(applicationIds: readonly string[]): Promise<void> {
  if (applicationIds.length === 0) return;
  // scope-exempt: undoing a claim this job just made, by the same ids.
  await db.delete(reminders).where(inArray(reminders.applicationId, applicationIds));
}

/* --------------------------------------------------------------------------- */

export async function getFollowUpDays(scope: Scope): Promise<number | null> {
  const [row] = await db
    .select({ days: users.followUpDays })
    .from(users)
    .where(eq(users.id, scope.userId))
    .limit(1);
  return row?.days ?? null;
}

export async function setFollowUpDays(scope: Scope, days: number | null): Promise<void> {
  await db.update(users).set({ followUpDays: days }).where(eq(users.id, scope.userId));
}
