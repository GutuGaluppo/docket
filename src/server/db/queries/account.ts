import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { applications, applicationTags, statusEvents, users } from "@/server/db/schema";
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
    status: string;
    tags: string[];
    jobDescription: string | null;
    createdAt: string;
    history: Array<{ status: string; occurredAt: string; note: string | null }>;
  }>;
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
      status: applications.status,
      jobDescription: applications.jobDescription,
      createdAt: applications.createdAt,
      tags: sql<string[]>`coalesce(
        (select array_agg(t.tag order by t.position, t.tag)
           from ${applicationTags} t
          where t.application_id = ${applications.id}),
        '{}'
      )`,
      history: sql<Array<{ status: string; occurredAt: string; note: string | null }>>`coalesce(
        (select json_agg(json_build_object(
                  'status', e.status,
                  'occurredAt', e.occurred_at,
                  'note', e.note
                ) order by e.occurred_at)
           from ${statusEvents} e
          where e.application_id = ${applications.id}),
        '[]'::json
      )`,
    })
    .from(applications)
    .where(scope.owned(applications.userId))
    .orderBy(asc(applications.protocolNumber));

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
      history: row.history ?? [],
      tags: row.tags ?? [],
    })),
  };
}

/**
 * Hard delete. Sessions, accounts, applications, tags and status events all
 * cascade from `users`, so removing the row removes the person entirely.
 */
export async function deleteAccount(scope: Scope): Promise<void> {
  await db.delete(users).where(eq(users.id, scope.userId));
}
