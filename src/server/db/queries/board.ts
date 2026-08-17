import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { applications, applicationTags, interviews, stages, statusEvents } from "@/server/db/schema";
import type { Scope } from "./scope";

/**
 * The query layer is the components' API for these shapes too. Re-exported
 * here so the board does not have to import the schema, which ESLint forbids
 * precisely so nothing outside this folder can reach a table.
 */
export type { Stage, StageKind } from "@/server/db/schema";
import type { Stage } from "@/server/db/schema";
import { ensureStages } from "./stages";

export type BoardCard = {
  id: string;
  protocolNumber: number;
  company: string;
  website: string | null;
  position: string;
  city: string | null;
  country: string | null;
  createdAt: Date;
  timezone: string | null;
  tags: string[];
  stageId: string | null;
  /** Next scheduled interview, so a card can show what it is waiting for. */
  nextInterviewAt: Date | null;
};

export type BoardColumn = { stage: Stage; cards: BoardCard[] };

const tagsAgg = sql<string[]>`coalesce(
  (select array_agg(t.tag order by t.position, t.tag)
     from ${applicationTags} t
    where t.application_id = ${applications.id}),
  '{}'
)`;

const nextInterview = sql<Date | null>`(
  select min(i.starts_at) from ${interviews} i
   where i.application_id = ${applications.id} and i.starts_at >= now()
)`;

/**
 * The whole board in two queries. Cards whose stage was never set — entries
 * stamped before the board existed — fall into the first column rather than
 * disappearing.
 */
export async function getBoard(scope: Scope): Promise<BoardColumn[]> {
  const columns = await ensureStages(scope);
  const first = columns[0];

  const rows = await db
    .select({
      id: applications.id,
      protocolNumber: applications.protocolNumber,
      company: applications.company,
      website: applications.website,
      position: applications.position,
      city: applications.city,
      country: applications.country,
      createdAt: applications.createdAt,
      timezone: applications.timezone,
      stageId: applications.stageId,
      tags: tagsAgg,
      nextInterviewAt: nextInterview,
    })
    .from(applications)
    .where(scope.owned(applications.userId))
    .orderBy(asc(applications.protocolNumber));

  return columns.map((stage) => ({
    stage,
    cards: rows.filter((row) =>
      row.stageId ? row.stageId === stage.id : stage.id === first?.id,
    ),
  }));
}

/**
 * Moves a card and appends to the history. The stage name is copied onto the
 * event so the record still reads correctly after a column is renamed or
 * deleted — status_events is append-only and must stay legible on its own.
 */
export async function moveCard(
  scope: Scope,
  applicationId: string,
  stageId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [stage] = await db
    .select({ id: stages.id, name: stages.name })
    .from(stages)
    .where(scope.owned(stages.userId, eq(stages.id, stageId)))
    .limit(1);

  if (!stage) return { ok: false, reason: "That column does not exist." };

  const updated = await db
    .update(applications)
    .set({ stageId: stage.id, updatedAt: new Date() })
    .where(scope.owned(applications.userId, eq(applications.id, applicationId)))
    .returning({ id: applications.id });

  if (updated.length === 0) return { ok: false, reason: "That entry does not exist." };

  await db.insert(statusEvents).values({
    applicationId,
    stageId: stage.id,
    stageName: stage.name,
  });

  return { ok: true };
}

/** How many entries sit in each column — the counters above the board. */
export async function getBoardCounts(scope: Scope): Promise<Map<string, number>> {
  const columns = await ensureStages(scope);
  const first = columns[0];

  const rows = await db
    .select({ stageId: applications.stageId, n: sql<number>`count(*)` })
    .from(applications)
    .where(scope.owned(applications.userId))
    .groupBy(applications.stageId);

  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.stageId ?? first?.id;
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + Number(row.n));
  }
  return counts;
}

/** History for one entry, newest first. */
export async function getHistory(scope: Scope, applicationId: string) {
  return db
    .select({
      id: statusEvents.id,
      stageName: statusEvents.stageName,
      occurredAt: statusEvents.occurredAt,
      note: statusEvents.note,
    })
    .from(statusEvents)
    .innerJoin(applications, eq(statusEvents.applicationId, applications.id))
    .where(scope.owned(applications.userId, eq(applications.id, applicationId)))
    .orderBy(asc(statusEvents.occurredAt));
}
