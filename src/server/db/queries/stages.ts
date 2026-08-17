import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { applications, stages, type Stage, type StageKind } from "@/server/db/schema";
import type { Scope } from "./scope";

/**
 * The funnel every docket starts with. First and last are fixed points the
 * board reasons about; the two in between are examples the user is expected to
 * rename or delete.
 */
export const DEFAULT_STAGES: ReadonlyArray<{ name: string; kind: StageKind }> = [
  { name: "Application sent", kind: "start" },
  { name: "Screening", kind: "middle" },
  { name: "Interviewing", kind: "middle" },
  { name: "Offer received", kind: "won" },
  { name: "Closed", kind: "lost" },
];

/** Gap between positions, so a column can be inserted without renumbering. */
const STEP = 100;

export async function listStages(scope: Scope): Promise<Stage[]> {
  return db
    .select()
    .from(stages)
    .where(scope.owned(stages.userId))
    .orderBy(asc(stages.position), asc(stages.createdAt));
}

/**
 * Idempotent seed. Runs on the first board view and before the first entry is
 * stamped, so an account always has somewhere to put a card.
 */
export async function ensureStages(scope: Scope): Promise<Stage[]> {
  const existing = await listStages(scope);
  if (existing.length > 0) return existing;

  await db
    .insert(stages)
    .values(
      DEFAULT_STAGES.map((stage, index) => ({
        userId: scope.userId,
        name: stage.name,
        kind: stage.kind,
        position: (index + 1) * STEP,
      })),
    )
    .onConflictDoNothing();

  return listStages(scope);
}

export async function getFirstStageId(scope: Scope): Promise<string | null> {
  const all = await ensureStages(scope);
  return all[0]?.id ?? null;
}

export async function createStage(scope: Scope, name: string): Promise<Stage | null> {
  const all = await ensureStages(scope);
  // New columns land before the terminal ones — nobody adds a step after the offer.
  const lastMiddle = [...all].reverse().find((s) => s.kind === "middle" || s.kind === "start");
  const next = all.find((s) => s.position > (lastMiddle?.position ?? 0));
  const position = next
    ? Math.floor(((lastMiddle?.position ?? 0) + next.position) / 2)
    : (all.at(-1)?.position ?? 0) + STEP;

  const [row] = await db
    .insert(stages)
    .values({ userId: scope.userId, name, kind: "middle", position })
    .returning();

  return row ?? null;
}

export async function renameStage(scope: Scope, id: string, name: string): Promise<boolean> {
  const updated = await db
    .update(stages)
    .set({ name })
    .where(scope.owned(stages.userId, eq(stages.id, id)))
    .returning({ id: stages.id });
  return updated.length > 0;
}

/**
 * Deleting a column moves its cards to the neighbour on the left rather than
 * dropping them — losing an application because a column was tidied away would
 * be the worst possible outcome for this product.
 */
export async function deleteStage(
  scope: Scope,
  id: string,
): Promise<{ ok: true; moved: number } | { ok: false; reason: string }> {
  const all = await ensureStages(scope);
  const target = all.find((s) => s.id === id);
  if (!target) return { ok: false, reason: "That column no longer exists." };
  if (target.kind !== "middle") {
    return { ok: false, reason: "The first and last columns cannot be removed." };
  }

  const fallback = [...all].reverse().find((s) => s.position < target.position) ?? all[0];
  if (!fallback) return { ok: false, reason: "No column left to move the entries to." };

  const moved = await db
    .update(applications)
    .set({ stageId: fallback.id, updatedAt: new Date() })
    .where(scope.owned(applications.userId, eq(applications.stageId, id)))
    .returning({ id: applications.id });

  await db.delete(stages).where(scope.owned(stages.userId, eq(stages.id, id)));

  return { ok: true, moved: moved.length };
}

/** Moves a column one slot left or right by swapping positions with its neighbour. */
export async function moveStage(
  scope: Scope,
  id: string,
  direction: "left" | "right",
): Promise<boolean> {
  const all = await ensureStages(scope);
  const index = all.findIndex((s) => s.id === id);
  if (index === -1) return false;

  const swapIndex = direction === "left" ? index - 1 : index + 1;
  const current = all[index];
  const other = all[swapIndex];
  if (!current || !other) return false;

  await db
    .update(stages)
    .set({ position: other.position })
    .where(scope.owned(stages.userId, eq(stages.id, current.id)));
  await db
    .update(stages)
    .set({ position: current.position })
    .where(scope.owned(stages.userId, eq(stages.id, other.id)));

  return true;
}

export async function countStages(scope: Scope): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(stages)
    .where(scope.owned(stages.userId));
  return Number(row?.n ?? 0);
}
