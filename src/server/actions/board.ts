"use server";

import { revalidatePath } from "next/cache";

import { requireScope, UnauthenticatedError } from "@/server/auth/session";
import { moveCard } from "@/server/db/queries/board";
import {
  countStages,
  createStage,
  deleteStage,
  moveStage,
  renameStage,
} from "@/server/db/queries/stages";
import { canAddStage } from "@/server/billing/limits";
import {
  createStageSchema,
  moveCardSchema,
  moveStageSchema,
  renameStageSchema,
  stageIdSchema,
} from "@/lib/validation/board";
import type { Scope } from "@/server/db/queries/scope";

export type BoardResult = { ok: true; message?: string } | { ok: false; error: string };

async function scopeOrError(): Promise<Scope | BoardResult> {
  try {
    return await requireScope();
  } catch (error) {
    if (error instanceof UnauthenticatedError) return { ok: false, error: "Sign in first." };
    throw error;
  }
}

const isFailure = (value: Scope | BoardResult): value is BoardResult => "ok" in value;

export async function moveApplication(input: unknown): Promise<BoardResult> {
  const scope = await scopeOrError();
  if (isFailure(scope)) return scope;

  const parsed = moveCardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown entry or column." };

  const result = await moveCard(scope, parsed.data.applicationId, parsed.data.stageId);
  if (!result.ok) return { ok: false, error: result.reason };

  revalidatePath("/board");
  revalidatePath("/docket");
  if (!result.filed) return { ok: true };

  // The card is about to disappear from under the cursor that dropped it, so
  // the move says where it went.
  revalidatePath("/archive");
  return { ok: true, message: "Filed as rejected. It is in the archive now." };
}

export async function addStage(input: unknown): Promise<BoardResult> {
  const scope = await scopeOrError();
  if (isFailure(scope)) return scope;

  const parsed = createStageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Give the column a name." };
  }

  // Plan limits are decided here, never in the component.
  const verdict = await canAddStage(scope, await countStages(scope));
  if (!verdict.allowed) return { ok: false, error: verdict.reason };

  const stage = await createStage(scope, parsed.data.name);
  if (!stage) return { ok: false, error: "Could not add that column." };

  revalidatePath("/board");
  return { ok: true };
}

export async function editStage(input: unknown): Promise<BoardResult> {
  const scope = await scopeOrError();
  if (isFailure(scope)) return scope;

  const parsed = renameStageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Give the column a name." };
  }

  const ok = await renameStage(scope, parsed.data.id, parsed.data.name);
  if (!ok) return { ok: false, error: "That column no longer exists." };

  revalidatePath("/board");
  return { ok: true };
}

export async function removeStage(input: unknown): Promise<BoardResult> {
  const scope = await scopeOrError();
  if (isFailure(scope)) return scope;

  const parsed = stageIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown column." };

  const result = await deleteStage(scope, parsed.data.id);
  if (!result.ok) return { ok: false, error: result.reason };

  revalidatePath("/board");
  return {
    ok: true,
    message:
      result.moved > 0
        ? `Column removed. ${result.moved} ${result.moved === 1 ? "entry" : "entries"} moved to the previous column.`
        : "Column removed.",
  };
}

export async function reorderStage(input: unknown): Promise<BoardResult> {
  const scope = await scopeOrError();
  if (isFailure(scope)) return scope;

  const parsed = moveStageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown column." };

  const ok = await moveStage(scope, parsed.data.id, parsed.data.direction);
  if (!ok) return { ok: false, error: "That column cannot move any further." };

  revalidatePath("/board");
  return { ok: true };
}
