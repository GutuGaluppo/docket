"use server";

import { requireScope, UnauthenticatedError } from "@/server/auth/session";
import { resolvePosting } from "@/server/posting/resolve";
import type { PostingResult } from "@/lib/posting/types";

/**
 * Reads a job advert the user pasted a link to, and hands back a draft.
 *
 * Nothing is written. The action produces a suggestion for the form and stops
 * there — the entry is only ever created by the person pressing Stamp, after
 * they have seen what was filled in. That separation is deliberate and is the
 * reason a wrong guess here is a nuisance rather than a corrupted register.
 */

/** One paste per two seconds per session, and twenty in a window. */
const RECENT = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_IN_WINDOW = 20;
const MIN_GAP_MS = 2_000;

/**
 * Best-effort, per-instance: serverless gives every cold start its own copy, so
 * this is a brake on a runaway loop rather than a quota. A real quota belongs in
 * the database, and is worth adding the day this endpoint is worth abusing.
 */
function throttled(userId: string): boolean {
  const now = Date.now();
  const hits = (RECENT.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
  const last = hits[hits.length - 1];
  if (hits.length >= MAX_IN_WINDOW) return true;
  if (last !== undefined && now - last < MIN_GAP_MS) return true;
  hits.push(now);
  RECENT.set(userId, hits);
  if (RECENT.size > 500) RECENT.clear();
  return false;
}

export async function draftFromLink(input: unknown): Promise<PostingResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return { ok: false, reason: "blocked-host", message: "Sign in first." };
    }
    throw error;
  }

  if (typeof input !== "string") {
    return { ok: false, reason: "malformed", message: "Paste the link to the job advert." };
  }
  if (input.length > 2_000) {
    return { ok: false, reason: "malformed", message: "That link is too long to be real." };
  }
  if (throttled(scope.userId)) {
    return { ok: false, reason: "unreachable", message: "One link at a time — try again shortly." };
  }

  return await resolvePosting(input);
}
