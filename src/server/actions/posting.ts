"use server";

import { requireScope, UnauthenticatedError } from "@/server/auth/session";
import { resolvePosting } from "@/server/posting/resolve";
import { createLimiter } from "@/server/rate-limit";
import type { PostingResult } from "@/lib/posting/types";

/**
 * Reads a job advert the user pasted a link to, and hands back a draft.
 *
 * Nothing is written. The action produces a suggestion for the form and stops
 * there — the entry is only ever created by the person pressing Stamp, after
 * they have seen what was filled in. That separation is deliberate and is the
 * reason a wrong guess here is a nuisance rather than a corrupted register.
 */

/**
 * One paste every couple of seconds, twenty an hour per account. Shares the
 * limiter with the contact form; see rate-limit.ts for what a per-instance
 * counter can and cannot promise.
 */
const limiter = createLimiter({
  minGapMs: 2_000,
  windowMs: 60_000,
  perKey: 20,
  perInstance: 300,
});

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
  if (limiter.exceeded(scope.userId)) {
    return { ok: false, reason: "unreachable", message: "One link at a time — try again shortly." };
  }

  return await resolvePosting(input);
}
