import { describe, expect, it } from "vitest";

import { interviewInputSchema, reminderLabel, zonedToInstant } from "./interview";

describe("zonedToInstant", () => {
  it("resolves a wall clock in a named zone to the right instant", () => {
    // 14:00 in Berlin during CEST is 12:00 UTC.
    expect(zonedToInstant("2026-08-20T14:00", "Europe/Berlin").toISOString()).toBe(
      "2026-08-20T12:00:00.000Z",
    );
  });

  it("handles the same wall clock in a different zone", () => {
    // 14:00 in São Paulo (UTC-3) is 17:00 UTC.
    expect(zonedToInstant("2026-08-20T14:00", "America/Sao_Paulo").toISOString()).toBe(
      "2026-08-20T17:00:00.000Z",
    );
  });

  it("handles winter time, when Berlin is one hour off summer", () => {
    expect(zonedToInstant("2026-01-20T14:00", "Europe/Berlin").toISOString()).toBe(
      "2026-01-20T13:00:00.000Z",
    );
  });

  it("handles a half-hour offset zone", () => {
    // India is UTC+5:30 year round.
    expect(zonedToInstant("2026-08-20T14:00", "Asia/Kolkata").toISOString()).toBe(
      "2026-08-20T08:30:00.000Z",
    );
  });

  it("handles a 45-minute offset zone", () => {
    // Nepal is UTC+5:45.
    expect(zonedToInstant("2026-08-20T14:00", "Asia/Kathmandu").toISOString()).toBe(
      "2026-08-20T08:15:00.000Z",
    );
  });

  it("handles a zone ahead of the date line", () => {
    expect(zonedToInstant("2026-08-20T09:00", "Pacific/Auckland").toISOString()).toBe(
      "2026-08-19T21:00:00.000Z",
    );
  });
});

describe("interviewInputSchema", () => {
  const valid = {
    applicationId: "app-1",
    title: "Technical interview",
    startsAtLocal: "2026-08-20T14:00",
    timezone: "Europe/Berlin",
  };

  it("fills in the defaults", () => {
    const parsed = interviewInputSchema.parse(valid);
    expect(parsed.durationMinutes).toBe(60);
    expect(parsed.remindMinutes).toBe(60);
    expect(parsed.location).toBe("");
  });

  it("rejects a malformed date", () => {
    expect(interviewInputSchema.safeParse({ ...valid, startsAtLocal: "tomorrow" }).success).toBe(
      false,
    );
  });

  it("rejects an empty title", () => {
    expect(interviewInputSchema.safeParse({ ...valid, title: "   " }).success).toBe(false);
  });

  it("coerces the numeric fields the form sends as strings", () => {
    const parsed = interviewInputSchema.parse({
      ...valid,
      durationMinutes: "45",
      remindMinutes: "15",
    });
    expect(parsed.durationMinutes).toBe(45);
    expect(parsed.remindMinutes).toBe(15);
  });
});

describe("reminderLabel", () => {
  it("reads as plain English at every step", () => {
    expect(reminderLabel(0)).toBe("No alert");
    expect(reminderLabel(15)).toBe("15 minutes before");
    expect(reminderLabel(60)).toBe("1 hour before");
    expect(reminderLabel(120)).toBe("2 hours before");
    expect(reminderLabel(1440)).toBe("1 day before");
  });
});
