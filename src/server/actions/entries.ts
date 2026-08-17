"use server";

import { revalidatePath } from "next/cache";

import { createEntry, deleteEntry } from "@/server/db/queries/applications";
import { requireScope, UnauthenticatedError } from "@/server/auth/session";
import { deleteEntrySchema, entryInputSchema } from "@/lib/validation/entry";

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
  await createEntry(scope, {
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

  revalidatePath("/docket");
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
