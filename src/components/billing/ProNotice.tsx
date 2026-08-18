"use client";

import { useEffect } from "react";

import { capture } from "@/lib/analytics/client";
import { EVENTS, type ProLimit } from "@/lib/analytics/events";

/**
 * What a capped feature says instead of showing itself.
 *
 * Two jobs, and the second is why it exists at all. The first is not to lie: a
 * cap on a plan nobody can leave would read as a paywall with the door bricked
 * up, so the notice says plainly that Pro is not on sale yet and points at the
 * one channel that does work.
 *
 * The second is measurement. There is no evidence yet that anyone wants Pro,
 * and a payment integration is a week of work plus an identity check that takes
 * days. Every render of this component is one account saying it reached for a
 * paid feature — which is the evidence, arriving before the week is spent
 * rather than after.
 */
export function ProNotice({
  limit,
  title,
  children,
}: {
  limit: ProLimit;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    capture(EVENTS.proLimitReached, { limit });
  }, [limit]);

  return (
    <section className="review-note" role="note">
      <p className="eyebrow mb-1.5 text-mark-ink">Pro — not on sale yet</p>
      <h2 className="mb-2 text-md font-bold tracking-[-0.01em]">{title}</h2>
      <div className="max-w-[56ch] text-sm leading-relaxed text-ink">{children}</div>
      {/*
        Ink, not muted. On the gold wash over the dark surface, --muted measures
        3.98:1 — under the 4.5:1 this size needs. Hierarchy is carried by the rule
        above and the smaller size instead of by a lighter colour.
      */}
      <p className="mt-3 border-t border-mark-edge pt-3 text-xs leading-relaxed text-ink">
        Checkout is still being built. Nothing you have entered is affected, and nothing is deleted.
        If this is the feature you would pay for, say so through the contact link in the footer —
        that is what decides which one is finished first.
      </p>
    </section>
  );
}
