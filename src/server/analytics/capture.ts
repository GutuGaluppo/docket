import "server-only";

import { PostHog } from "posthog-node";

import { POSTHOG_EU_HOST } from "@/lib/analytics/config";
import type { EventName } from "@/lib/analytics/events";

/**
 * The two events that belong to a known user.
 *
 * Signing up and stamping a first entry both happen on the server, for someone
 * who is already authenticated, so they are sent from here with the user id as
 * the identifier. No cookie is involved and no browser is asked to remember
 * anything — this is first-party processing of an action the account owner
 * deliberately took.
 *
 * Inert without a key, like every other outbound integration in this codebase.
 */

let client: PostHog | null = null;

function analytics(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  client ??= new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? POSTHOG_EU_HOST,
    // A server action must not wait on analytics to answer the user.
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

/**
 * Never throws and never blocks the caller's result. An analytics outage is not
 * a reason a person cannot stamp an application.
 */
export async function captureForUser(userId: string, event: EventName): Promise<void> {
  const posthog = analytics();
  if (!posthog) return;

  try {
    posthog.capture({ distinctId: userId, event });
    await posthog.flush();
  } catch {
    // Swallowed on purpose — see above.
  }
}
