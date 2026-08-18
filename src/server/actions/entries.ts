"use server";

import { revalidatePath } from "next/cache";

import { createEntry, deleteEntry, updateEntry } from "@/server/db/queries/applications";
import { requireScope, UnauthenticatedError } from "@/server/auth/session";
import { captureForUser } from "@/server/analytics/capture";
import { EVENTS } from "@/lib/analytics/events";
import { deleteEntrySchema, editEntrySchema, entryInputSchema } from "@/lib/validation/entry";

export type ActionResult =
  { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Order matters and is the same in every action: session first, then Zod, then
 * the query. A server action is reachable by anyone who can craft a POST — the
 * client-side resolver is a convenience, never the check.
 */
export async function stampApplication(input: unknown): Promise<ActionResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (error) {
    if (error instanceof UnauthenticatedError) return { ok: false, error: "Sign in first." };
    throw error;
  }

  const parsed = entryInputSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      error: flat.formErrors[0] ?? "Some fields need attention.",
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
    };
  }

  const values = parsed.data;
  const created = await createEntry(scope, {
    company: values.company,
    website: values.website || null,
    position: values.position,
    city: values.city || null,
    country: values.country || null,
    notes: values.notes || null,
    jobDescription: values.jobDescription || null,
    timezone: values.timezone || null,
    tags: values.tags,
  });

  // Nº 1 is the last step of the funnel in section 3: the point where a visitor
  // has become someone who uses the thing. Fired once per account by definition
  // of the protocol number.
  if (created.protocolNumber === 1) {
    await captureForUser(scope.userId, EVENTS.firstEntryStamped);
  }

  revalidatePath("/docket");
  return { ok: true };
}

export async function editEntry(input: unknown): Promise<ActionResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (error) {
    if (error instanceof UnauthenticatedError) return { ok: false, error: "Sign in first." };
    throw error;
  }

  const parsed = editEntrySchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      error: flat.formErrors[0] ?? "Some fields need attention.",
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
    };
  }

  const values = parsed.data;
  const updated = await updateEntry(scope, values.id, {
    company: values.company,
    website: values.website || null,
    position: values.position,
    city: values.city || null,
    country: values.country || null,
    notes: values.notes || null,
    jobDescription: values.jobDescription || null,
    timezone: values.timezone || null,
    tags: values.tags,
  });

  // Same reply for a row that is gone and a row that belongs to someone else:
  // the answer must not tell a stranger which.
  if (!updated) return { ok: false, error: "Entry not found." };

  revalidatePath("/docket");
  revalidatePath("/board");
  return { ok: true };
}

export async function removeEntry(input: unknown): Promise<ActionResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (error) {
    if (error instanceof UnauthenticatedError) return { ok: false, error: "Sign in first." };
    throw error;
  }

  const parsed = deleteEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown entry." };

  // A miss is indistinguishable from someone else's id on purpose: the reply
  // must not tell a stranger whether the row exists.
  const removed = await deleteEntry(scope, parsed.data.id);
  if (!removed) return { ok: false, error: "Entry not found." };

  revalidatePath("/docket");
  return { ok: true };
}
