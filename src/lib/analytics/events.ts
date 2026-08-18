/**
 * The events the funnel is made of, and nothing else.
 *
 * Section 3 of the brief names them and names the funnel they answer:
 * hero → detector used → account created → first entry stamped. Keeping the
 * list closed is what stops analytics from turning into a second, undeclared
 * copy of the register — every event here is a count of something happening,
 * never a record of what was in it.
 */
export const EVENTS = {
  landingView: "landing_view",
  heroDetectorUsed: "hero_detector_used",
  pricingView: "pricing_view",
  signupStarted: "signup_started",
  signupCompleted: "signup_completed",
  firstEntryStamped: "first_entry_stamped",
  proLimitReached: "pro_limit_reached",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/**
 * The capped features, named. A closed set, because it is the only thing any
 * event is allowed to carry — see `config.ts` on why properties are limited to
 * enumerations rather than forbidden outright.
 */
export const PRO_LIMITS = ["stages", "follow-ups", "analytics"] as const;
export type ProLimit = (typeof PRO_LIMITS)[number];

export type EventProps = { [EVENTS.proLimitReached]: { limit: ProLimit } };

/** Fired from the browser, without an account and without an identity. */
export const ANONYMOUS_EVENTS: readonly EventName[] = [
  EVENTS.landingView,
  EVENTS.heroDetectorUsed,
  EVENTS.pricingView,
  EVENTS.signupStarted,
  EVENTS.proLimitReached,
];

/** Fired from the server, for a user who is already known. */
export const IDENTIFIED_EVENTS: readonly EventName[] = [
  EVENTS.signupCompleted,
  EVENTS.firstEntryStamped,
];
