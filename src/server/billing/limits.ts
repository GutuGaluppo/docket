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
type Entitlements = {
  entries: number;
  stages: number;
  followUpReminders: boolean;
  analytics: boolean;
};

export const LIMITS = {
  free: {
    /** Section 7: registering applications is never capped — the habit comes first. */
    entries: Infinity,
    /** Applied, interviewing, closed. Custom columns are what Pro sells. */
    stages: 3,
    followUpReminders: false,
    analytics: false,
  },
  pro: { entries: Infinity, stages: Infinity, followUpReminders: true, analytics: true },
  teams: { entries: Infinity, stages: Infinity, followUpReminders: true, analytics: true },
} as const satisfies Record<Plan, Entitlements>;

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
 * On, deliberately, before checkout exists.
 *
 * The argument for waiting was that a cap with nothing to buy is a dead end.
 * The argument for not waiting is stronger: every account that arrives while
 * the caps are off forms the habit with the whole product, and taking a feature
 * away from someone who already uses it is worse than never having offered it.
 * The dead end is answered by saying so plainly — see ProNotice, which states
 * that Pro is not on sale yet and points at the contact form.
 *
 * That turns each cap into the measurement phase 4 is missing: today there is
 * no evidence anyone wants Pro, and `pro_limit_reached` is how that evidence
 * arrives before a week is spent on a payment adapter.
 *
 * Setting this to false restores the everything-is-free behaviour in one line.
 */
export const BILLING_ENABLED = true;

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

/**
 * Whether the scheduled job may contact this account at all.
 *
 * Section 7 puts follow-up reminders on the paid side, and an email is the one
 * capped feature that acts on its own — a column nobody may add is inert, but a
 * reminder sent to someone who is not entitled to it cannot be taken back. The
 * cron therefore filters on the plan in SQL as well; this function is what the
 * settings screen and its action agree with.
 */
export async function canUseFollowUps(scope: Scope): Promise<LimitVerdict> {
  if (!BILLING_ENABLED) return { allowed: true };

  const plan = await getPlan(scope);
  if (LIMITS[plan].followUpReminders) return { allowed: true };
  return {
    allowed: false,
    reason: "Follow-up reminders are a Pro feature.",
  };
}

export async function canUseAnalytics(scope: Scope): Promise<LimitVerdict> {
  if (!BILLING_ENABLED) return { allowed: true };

  const plan = await getPlan(scope);
  if (LIMITS[plan].analytics) return { allowed: true };
  return {
    allowed: false,
    reason: "Response-rate analytics is a Pro feature.",
  };
}
