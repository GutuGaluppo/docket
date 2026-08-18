import { describe, expect, it } from "vitest";

import { createLimiter } from "./rate-limit";

const limit = { minGapMs: 2_000, windowMs: 60_000, perKey: 3, perInstance: 10 };

describe("createLimiter", () => {
  it("lets the first call through", () => {
    expect(createLimiter(limit).exceeded("a", 0)).toBe(false);
  });

  it("refuses a second call inside the minimum gap", () => {
    const l = createLimiter(limit);
    expect(l.exceeded("a", 0)).toBe(false);
    expect(l.exceeded("a", 1_500)).toBe(true);
    expect(l.exceeded("a", 2_100)).toBe(false);
  });

  it("caps a key within the window, then lets it back in once the window passes", () => {
    const l = createLimiter(limit);
    for (const at of [0, 3_000, 6_000]) expect(l.exceeded("a", at)).toBe(false);
    expect(l.exceeded("a", 9_000)).toBe(true);
    // The first three have aged out by now.
    expect(l.exceeded("a", 70_000)).toBe(false);
  });

  it("keeps one key from spending another key's allowance", () => {
    const l = createLimiter(limit);
    expect(l.exceeded("a", 0)).toBe(false);
    expect(l.exceeded("b", 0)).toBe(false);
  });

  it("caps the instance as a whole, which is what a rotating key defeats otherwise", () => {
    const l = createLimiter(limit);
    // Ten distinct keys, one call each, all accepted.
    for (let i = 0; i < 10; i += 1) expect(l.exceeded(`k${i}`, i)).toBe(false);
    // The eleventh is refused even though its own key is untouched.
    expect(l.exceeded("fresh", 11)).toBe(true);
  });

  it("does not count a refused call against the allowance", () => {
    const l = createLimiter({ ...limit, perKey: 2 });
    expect(l.exceeded("a", 0)).toBe(false);
    expect(l.exceeded("a", 100)).toBe(true); // inside the gap
    // The refusal above must not have consumed the second slot.
    expect(l.exceeded("a", 3_000)).toBe(false);
    expect(l.exceeded("a", 6_000)).toBe(true);
  });
});
