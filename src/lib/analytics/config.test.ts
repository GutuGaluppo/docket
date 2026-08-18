import { describe, expect, it } from "vitest";

import { analyticsSettings, eventPayload, POSTHOG_EU_HOST } from "./config";
import { ANONYMOUS_EVENTS, EVENTS, IDENTIFIED_EVENTS } from "./events";

/**
 * The privacy policy tells visitors there is no tracking or profiling cookie
 * and therefore no consent banner. That sentence is only true while the
 * settings below stay as they are, so it is asserted rather than trusted to a
 * comment: a future change that turns persistence back on fails here, next to
 * the reason it must not.
 */
describe("analytics settings keep the published promise", () => {
  const settings = analyticsSettings();

  it("writes nothing to the visitor's device", () => {
    expect(settings.persistence).toBe("memory");
  });

  it("never builds a person profile from an anonymous visit", () => {
    expect(settings.person_profiles).toBe("identified_only");
  });

  it("collects only the declared events", () => {
    expect(settings.autocapture).toBe(false);
    expect(settings.capture_pageview).toBe(false);
    expect(settings.capture_pageleave).toBe(false);
  });

  it("records neither the session nor surveys", () => {
    expect(settings.disable_session_recording).toBe(true);
    expect(settings.disable_surveys).toBe(true);
  });

  it("strips the IP and the referrer before anything is sent", () => {
    const clean = settings.sanitize_properties({
      $ip: "203.0.113.9",
      $initial_referrer: "https://example.com/",
      $initial_referring_domain: "example.com",
      $current_url: "https://docket.click/",
    });
    expect(clean).not.toHaveProperty("$ip");
    expect(clean).not.toHaveProperty("$initial_referrer");
    expect(clean).not.toHaveProperty("$initial_referring_domain");
    expect(clean.$current_url).toBe("https://docket.click/");
  });

  it("sends to the EU host unless told otherwise", () => {
    expect(settings.api_host).toBe(POSTHOG_EU_HOST);
    expect(POSTHOG_EU_HOST).toContain("eu.");
    expect(analyticsSettings("https://self.hosted.example").api_host).toBe(
      "https://self.hosted.example",
    );
  });
});

describe("the event list stays closed", () => {
  it("is exactly the six the funnel asks for", () => {
    expect(Object.values(EVENTS).sort()).toEqual(
      [
        "first_entry_stamped",
        "hero_detector_used",
        "landing_view",
        "pricing_view",
        "signup_completed",
        "signup_started",
      ].sort(),
    );
  });

  it("splits into anonymous and identified with nothing left over", () => {
    expect([...ANONYMOUS_EVENTS, ...IDENTIFIED_EVENTS].sort()).toEqual(
      Object.values(EVENTS).sort(),
    );
    // An anonymous event must never be one that belongs to a known account.
    for (const event of ANONYMOUS_EVENTS) {
      expect(IDENTIFIED_EVENTS).not.toContain(event);
    }
  });

  it("carries no properties — a count, never a copy of what was counted", () => {
    expect(eventPayload(EVENTS.heroDetectorUsed)).toEqual({ event: "hero_detector_used" });
  });
});
