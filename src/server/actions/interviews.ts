"use server";

import { revalidatePath } from "next/cache";

import { requireScope, UnauthenticatedError } from "@/server/auth/session";
import {
  createInterview,
  deleteInterview,
  rotateCalendarToken,
} from "@/server/db/queries/interviews";
import {
  interviewIdSchema,
  interviewInputSchema,
  zonedToInstant,
} from "@/lib/validation/interview";

export type InterviewResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function scheduleInterview(input: unknown): Promise<InterviewResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (error) {
    if (error instanceof UnauthenticatedError) return { ok: false, error: "Sign in first." };
    throw error;
  }

  const parsed = interviewInputSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      error: flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0] ?? "Check the form.",
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
    };
  }

  const values = parsed.data;
  const created = await createInterview(scope, {
    applicationId: values.applicationId,
    title: values.title,
    // Stored as an instant; the wall clock the user typed is interpreted in
    // their own zone, not the server's.
    startsAt: zonedToInstant(values.startsAtLocal, values.timezone),
    durationMinutes: values.durationMinutes,
    location: values.location || null,
    notes: values.notes || null,
    remindMinutes: values.remindMinutes,
    timezone: values.timezone || null,
  });

  if (!created) return { ok: false, error: "That application does not exist." };

  revalidatePath("/calendar");
  revalidatePath("/board");
  return { ok: true };
}

export async function cancelInterview(input: unknown): Promise<InterviewResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (error) {
    if (error instanceof UnauthenticatedError) return { ok: false, error: "Sign in first." };
    throw error;
  }

  const parsed = interviewIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown interview." };

  const removed = await deleteInterview(scope, parsed.data.id);
  if (!removed) return { ok: false, error: "That interview does not exist." };

  revalidatePath("/calendar");
  revalidatePath("/board");
  return { ok: true };
}

/**
 * Invalidates the old subscription URL. Anyone still holding it — a shared
 * link, an old device — stops receiving the feed immediately.
 */
export async function resetCalendarFeed(): Promise<InterviewResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (error) {
    if (error instanceof UnauthenticatedError) return { ok: false, error: "Sign in first." };
    throw error;
  }

  await rotateCalendarToken(scope);
  revalidatePath("/calendar");
  return { ok: true, message: "New link generated. Re-subscribe on each device." };
}
