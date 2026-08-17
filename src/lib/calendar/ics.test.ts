import { describe, expect, it } from "vitest";

import { buildCalendar, foldLine, toIcsUtc, type CalendarEvent } from "./ics";

const stamp = new Date("2026-08-17T10:00:00.000Z");

const base: CalendarEvent = {
  uid: "abc@docket.app",
  sequence: 0,
  title: "Technical interview — Loudly",
  startsAt: new Date("2026-08-20T13:30:00.000Z"),
  durationMinutes: 60,
  location: "Zoom",
  description: "Senior Frontend Developer",
  remindMinutes: 60,
};

const lines = (ics: string) => ics.split("\r\n");

describe("toIcsUtc", () => {
  it("emits UTC basic format", () => {
    expect(toIcsUtc(new Date("2026-08-17T13:45:09.123Z"))).toBe("20260817T134509Z");
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:short")).toBe("SUMMARY:short");
  });

  it("folds past 75 octets with a leading space on continuations", () => {
    const folded = foldLine("SUMMARY:" + "a".repeat(200));
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(parts[0]?.length).toBe(75);
  });

  it("never splits a multi-byte character in half", () => {
    const folded = foldLine("SUMMARY:" + "é".repeat(80));
    // Round-tripping proves no replacement characters were introduced.
    expect(folded.replace(/\r\n /g, "")).toBe("SUMMARY:" + "é".repeat(80));
  });
});

describe("buildCalendar", () => {
  it("wraps events in a valid VCALENDAR envelope", () => {
    const out = lines(buildCalendar([base], { stamp }));
    expect(out[0]).toBe("BEGIN:VCALENDAR");
    expect(out).toContain("VERSION:2.0");
    expect(out).toContain("END:VCALENDAR");
    expect(out.at(-2)).toBe("END:VCALENDAR");
  });

  it("uses CRLF, which strict clients require", () => {
    const ics = buildCalendar([base], { stamp });
    expect(ics.includes("\r\n")).toBe(true);
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it("writes start and end from the duration", () => {
    const out = lines(buildCalendar([base], { stamp }));
    expect(out).toContain("DTSTART:20260820T133000Z");
    expect(out).toContain("DTEND:20260820T143000Z");
  });

  it("emits a VALARM so both Google and Apple raise an alert", () => {
    const out = lines(buildCalendar([base], { stamp }));
    expect(out).toContain("BEGIN:VALARM");
    expect(out).toContain("TRIGGER:-PT60M");
    expect(out).toContain("ACTION:DISPLAY");
    expect(out).toContain("END:VALARM");
  });

  it("omits the alarm when no reminder was asked for", () => {
    const out = lines(buildCalendar([{ ...base, remindMinutes: 0 }], { stamp }));
    expect(out).not.toContain("BEGIN:VALARM");
  });

  it("escapes the characters the spec reserves", () => {
    const out = buildCalendar(
      [{ ...base, title: "Interview; round 2, final", description: "line1\nline2" }],
      { stamp },
    );
    expect(out).toContain("SUMMARY:Interview\\; round 2\\, final");
    expect(out).toContain("DESCRIPTION:line1\\nline2");
  });

  it("keeps the uid and bumps sequence so edits replace rather than duplicate", () => {
    const out = lines(buildCalendar([{ ...base, sequence: 3 }], { stamp }));
    expect(out).toContain("UID:abc@docket.app");
    expect(out).toContain("SEQUENCE:3");
  });

  it("drops optional fields instead of writing empty ones", () => {
    const out = lines(buildCalendar([{ ...base, location: null, description: null }], { stamp }));
    expect(out.some((l) => l.startsWith("LOCATION"))).toBe(false);
    expect(out.some((l) => l.startsWith("DESCRIPTION:"))).toBe(true); // only inside VALARM
  });

  it("tells clients how often to poll", () => {
    const out = lines(buildCalendar([], { stamp }));
    expect(out).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT1H");
    expect(out).toContain("X-PUBLISHED-TTL:PT1H");
  });

  it("produces an empty but valid calendar with no events", () => {
    const out = lines(buildCalendar([], { stamp }));
    expect(out).toContain("BEGIN:VCALENDAR");
    expect(out.some((l) => l.startsWith("BEGIN:VEVENT"))).toBe(false);
  });

  it("carries every event given to it", () => {
    const out = buildCalendar([base, { ...base, uid: "second@docket.app" }], { stamp });
    expect(out.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});
