import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { subscriptions } from "@/server/db/schema";
import type { Scope } from "@/server/db/queries/scope";

export type Plan = "free" | "pro" | "teams";

/**
 * Plan limits, decided on the server. The UI only ever reflects what this
 * module already ruled — it never computes an entitlement of its own.
 *
 * Phase 4 wires the payment provider; until then every account resolves to the
 * free plan and the checks below are already in the call path, so switching
 * them on is a data change rather than a code change.
 */
export const LIMITS = {
  free: {
    /** Section 7: registering applications is never capped — the habit comes first. */
    entries: Infinity,
    /** Applied, interviewing, closed. Custom columns are what Pro sells. */
    stages: 3,
    interviewReminders: false,
  },
  pro: { entries: Infinity, stages: Infinity, interviewReminders: true },
  teams: { entries: Infinity, stages: Infinity, interviewReminders: true },
} as const satisfies Record<Plan, { entries: number; stages: number; interviewReminders: boolean }>;

export async function getPlan(scope: Scope): Promise<Plan> {
  const [row] = await db
    .select({ plan: subscriptions.plan, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.userId, scope.userId))
    .limit(1);

  if (!row) return "free";
  // Expired Pro reads as free for entitlement, but nothing is ever deleted:
  // section 7 — Pro features go read-only, data stays.
  const active = row.status === "active" || row.status === "trialing";
  return active ? row.plan : "free";
}

export type LimitVerdict = { allowed: true } | { allowed: false; reason: string };

/**
 * Phase 4 has not shipped, so there is no way to buy Pro and no way to leave
 * the free plan. Enforcing the free caps now would gate a feature behind a
 * purchase that cannot be made. The checks stay in the call path and switch on
 * with this flag the day checkout works.
 */
export const BILLING_ENABLED = false;

export async function canAddStage(scope: Scope, current: number): Promise<LimitVerdict> {
  if (!BILLING_ENABLED) return { allowed: true };

  const plan = await getPlan(scope);
  const max = LIMITS[plan].stages;
  if (current < max) return { allowed: true };
  return {
    allowed: false,
    reason: `The free plan keeps ${max} columns. Pro adds as many as your process needs.`,
  };
}
