import { describe, expect, it } from "vitest";

import { answerDelay, daysToAnswer, doorRate, howFarItGot } from "./rejection";

const stamped = new Date("2026-01-01T09:00:00Z");
const days = (n: number) => new Date(stamped.getTime() + n * 86_400_000);

describe("daysToAnswer", () => {
  it("counts whole days", () => {
    expect(daysToAnswer(stamped, days(12))).toBe(12);
  });

  it("counts a same-day refusal as zero", () => {
    expect(daysToAnswer(stamped, new Date("2026-01-01T23:59:00Z"))).toBe(0);
  });

  // A refusal recorded before the stamp is a clock skew or a corrected import,
  // not a negative wait. The register would rather say "the same day".
  it("never goes negative", () => {
    expect(daysToAnswer(stamped, days(-5))).toBe(0);
  });
});

describe("answerDelay", () => {
  it("says the same day when there was no wait", () => {
    expect(answerDelay(stamped, stamped)).toBe("the same day");
  });

  it("keeps the singular for one day", () => {
    expect(answerDelay(stamped, days(1))).toBe("after 1 day");
  });

  it("pluralises the rest", () => {
    expect(answerDelay(stamped, days(34))).toBe("after 34 days");
  });
});

describe("howFarItGot", () => {
  it("names the applications that never got in the door", () => {
    expect(howFarItGot(0)).toBe("No interview");
  });

  it("counts the interviews that did happen", () => {
    expect(howFarItGot(1)).toBe("1 interview");
    expect(howFarItGot(3)).toBe("3 interviews");
  });
});

describe("doorRate", () => {
  it("is null with nothing filed — 0% would be a claim", () => {
    expect(doorRate(0, 0)).toBeNull();
  });

  it("rounds to whole percent", () => {
    expect(doorRate(3, 2)).toBe(67);
    expect(doorRate(4, 1)).toBe(25);
  });
});
