import type { EventName } from "./events";

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
 * Events carry no properties. The one signal that could carry text — what was
 * pasted into the hero detector — is exactly the one the landing promises never
 * leaves the browser, so "a real ad was pasted" is encoded in whether the event
 * fires at all rather than in anything it carries.
 */
export function eventPayload(name: EventName): { event: EventName } {
  return { event: name };
}
