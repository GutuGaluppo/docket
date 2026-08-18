"use server";

import { revalidatePath } from "next/cache";

import { requireScope, UnauthenticatedError } from "@/server/auth/session";
import { canUseFollowUps } from "@/server/billing/limits";
import { setFollowUpDays } from "@/server/db/queries/reminders";
import { followUpSchema } from "@/lib/validation/settings";

export type SettingsResult = { ok: true; message: string } | { ok: false; error: string };

export async function updateFollowUps(input: unknown): Promise<SettingsResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (error) {
    if (error instanceof UnauthenticatedError) return { ok: false, error: "Sign in first." };
    throw error;
  }

  const parsed = followUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick one of the options." };

  // Turning them off is always allowed: a cap must never trap someone into a
  // setting they cannot undo.
  const wantsOn = parsed.data.days !== 0;
  if (wantsOn) {
    const verdict = await canUseFollowUps(scope);
    if (!verdict.allowed) return { ok: false, error: verdict.reason };
  }

  // Zero is the off switch; stored as null so "never asked for it" and "turned
  // it off" are the same state in the database.
  const days = parsed.data.days === 0 ? null : parsed.data.days;
  await setFollowUpDays(scope, days);

  revalidatePath("/settings");
  return {
    ok: true,
    message: days === null ? "Follow-up reminders are off." : `Reminders after ${days} days.`,
  };
}
