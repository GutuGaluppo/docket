import { describe, expect, it } from "vitest";

import { BILLING_ENABLED, LIMITS } from "./limits";

/**
 * The caps are enforced before there is any way to buy Pro, which is a
 * deliberate and reversible choice — see the comment on BILLING_ENABLED. These
 * assertions pin the shape of section 7 of the brief so a limit cannot drift
 * quietly: what the free plan keeps, and what it does not.
 *
 * The functions themselves take a Scope and read the database, so they are
 * covered by the tenant-isolation integration test rather than here.
 */
describe("plan entitlements match section 7", () => {
  it("never caps the thing the habit is made of", () => {
    // "Candidaturas ilimitadas (essa é a aposta: hábito primeiro)."
    expect(LIMITS.free.entries).toBe(Infinity);
    expect(LIMITS.pro.entries).toBe(Infinity);
  });

  it("keeps three columns on the free plan", () => {
    // Applied, interviewing, closed. Custom columns are what Pro sells.
    expect(LIMITS.free.stages).toBe(3);
    expect(LIMITS.pro.stages).toBe(Infinity);
  });

  it("puts the two features that automate on the paid side", () => {
    expect(LIMITS.free.followUpReminders).toBe(false);
    expect(LIMITS.free.analytics).toBe(false);
    expect(LIMITS.pro.followUpReminders).toBe(true);
    expect(LIMITS.pro.analytics).toBe(true);
  });

  it("gives teams at least everything pro has", () => {
    expect(LIMITS.teams.stages).toBe(LIMITS.pro.stages);
    expect(LIMITS.teams.followUpReminders).toBe(LIMITS.pro.followUpReminders);
    expect(LIMITS.teams.analytics).toBe(LIMITS.pro.analytics);
  });

  it("is switched on — the caps are live before checkout exists", () => {
    // If this ever reads false again it should be because someone decided to
    // turn the caps off, not because a refactor lost the line.
    expect(BILLING_ENABLED).toBe(true);
  });
});
