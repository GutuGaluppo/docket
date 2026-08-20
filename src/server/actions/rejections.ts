"use server";

import { revalidatePath } from "next/cache";

import { requireScope, UnauthenticatedError } from "@/server/auth/session";
import { fileRejection, reopenApplication } from "@/server/db/queries/rejections";
import { fileRejectionSchema, reopenSchema } from "@/lib/validation/rejection";
import type { Scope } from "@/server/db/queries/scope";

export type RejectionActionResult = { ok: true; message: string } | { ok: false; error: string };

async function scopeOrError(): Promise<Scope | RejectionActionResult> {
  try {
    return await requireScope();
  } catch (error) {
    if (error instanceof UnauthenticatedError) return { ok: false, error: "Sign in first." };
    throw error;
  }
}

const isFailure = (value: Scope | RejectionActionResult): value is RejectionActionResult =>
  "ok" in value;

/**
 * Every screen the entry could have been read from is revalidated, because
 * filing a refusal moves it out of three of them at once: it leaves the
 * register, it leaves the board, and it appears in the archive.
 */
function revalidateEverywhere() {
  revalidatePath("/docket");
  revalidatePath("/board");
  revalidatePath("/archive");
  revalidatePath("/analytics");
}

export async function fileAsRejected(input: unknown): Promise<RejectionActionResult> {
  const scope = await scopeOrError();
  if (isFailure(scope)) return scope;

  const parsed = fileRejectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown entry." };

  const result = await fileRejection(scope, parsed.data.id, parsed.data.reason || null);
  if (!result.ok) return { ok: false, error: result.reason };

  revalidateEverywhere();
  return { ok: true, message: `${result.company} filed in the archive.` };
}

export async function reopenEntry(input: unknown): Promise<RejectionActionResult> {
  const scope = await scopeOrError();
  if (isFailure(scope)) return scope;

  const parsed = reopenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown entry." };

  const result = await reopenApplication(scope, parsed.data.id);
  if (!result.ok) return { ok: false, error: result.reason };

  revalidateEverywhere();
  return { ok: true, message: `${result.company} is back in the register.` };
}
