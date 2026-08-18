import type { EventName, EventProps } from "./events";

/**
 * How PostHog is allowed to behave here.
 *
 * The privacy policy says, in the product's own words: "There is no
 * advertising, tracking or profiling cookie, so there is no consent banner to
 * click." That sentence is published, it is one of the reasons people sign up,
 * and instrumentation is not allowed to quietly make it false. So the analytics
 * are built to keep it true rather than the sentence rewritten to accommodate
 * them.
 *
 * Everything below follows from that one commitment:
 *
 *   · `persistence: "memory"` — no cookie, no localStorage, nothing written to
 *     the visitor's device. Under §25 TDDDG there is nothing stored or read on
 *     terminal equipment, which is what the consent requirement attaches to.
 *   · `person_profiles: "identified_only"` — an anonymous visitor never becomes
 *     a person record. Counting is not profiling.
 *   · `autocapture: false` — clicks, form fields and rage-clicks are not
 *     collected. Only the six declared events exist.
 *   · Session recording off. Recording a page is the opposite of the promise.
 *   · `$ip` dropped before the request leaves the browser.
 *   · EU ingestion host, so the data lands under the same jurisdiction as the
 *     database and the hosting.
 *
 * The cost is real and worth stating: with no persistent identifier, an
 * anonymous visitor cannot be joined to the account they later create. Step
 * counts across the whole funnel are available; a single person's path through
 * it is not. The two identified events share a user id, so that half does join.
 */

export const POSTHOG_EU_HOST = "https://eu.i.posthog.com";

export type AnalyticsSettings = {
  api_host: string;
  persistence: "memory";
  person_profiles: "identified_only";
  autocapture: false;
  capture_pageview: false;
  capture_pageleave: false;
  disable_session_recording: true;
  disable_surveys: true;
  sanitize_properties: (properties: Record<string, unknown>) => Record<string, unknown>;
};

/** Properties PostHog adds on its own that this product does not want sent. */
const STRIPPED = ["$ip", "$initial_referrer", "$initial_referring_domain"] as const;

export function analyticsSettings(host: string = POSTHOG_EU_HOST): AnalyticsSettings {
  return {
    api_host: host,
    persistence: "memory",
    person_profiles: "identified_only",
    autocapture: false,
    // Pageviews are sent by name from the pages that matter, so a route the
    // funnel does not ask about produces no event at all.
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
    sanitize_properties: (properties) => {
      const clean = { ...properties };
      for (const key of STRIPPED) delete clean[key];
      return clean;
    },
  };
}

/**
 * A property may only ever be a value from a closed set declared in this
 * codebase — never anything a person typed, and never anything derived from it.
 *
 * The rule used to be "no properties at all", which was the same guarantee
 * stated less precisely. What it is really protecting is that nothing a visitor
 * wrote is transmitted: the pasted job advert is the obvious case, and the
 * landing promises under the field that it never leaves the browser, so
 * `hero_detector_used` still carries nothing and encodes "a real advert" in
 * whether it fires. Naming which of three known caps someone reached carries no
 * personal data by construction — the value cannot be anything but one of three
 * literals — and without it the count cannot answer the question it exists for.
 */
export function eventPayload<N extends EventName>(
  name: N,
  props?: N extends keyof EventProps ? EventProps[N] : never,
): { event: EventName; properties?: Record<string, string> } {
  return props ? { event: name, properties: { ...props } } : { event: name };
}
