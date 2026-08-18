import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { EVENTS } from "./events";

/**
 * The privacy policy counts the events out loud — "Seven things are counted" —
 * and then names them. That sentence is a statement about what leaves the
 * browser, made to people deciding whether to sign up, so it is not allowed to
 * drift from the code.
 *
 * It already did once: `pro_limit_reached` was added and the policy went on
 * saying six. Nothing failed, because prose is not type-checked. This is the
 * check that would have caught it.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const POLICY = "src/app/(marketing)/privacy/page.tsx";
const policy = readFileSync(join(root, POLICY), "utf8");

const NUMBERS: Record<string, number> = {
  One: 1,
  Two: 2,
  Three: 3,
  Four: 4,
  Five: 5,
  Six: 6,
  Seven: 7,
  Eight: 8,
  Nine: 9,
  Ten: 10,
};

describe("the privacy policy and the event list agree", () => {
  it("counts out loud the number of events that exist", () => {
    const stated = policy.match(/(\w+) things are counted/);
    expect(stated, `${POLICY} no longer states how many things are counted`).toBeTruthy();

    const spelled = NUMBERS[stated?.[1] ?? ""];
    expect(spelled, `"${stated?.[1]}" is not a number this test can read`).toBeDefined();
    expect(
      spelled,
      `${POLICY} says ${stated?.[1]?.toLowerCase()} events; the code declares ${Object.keys(EVENTS).length}.`,
    ).toBe(Object.keys(EVENTS).length);
  });

  it("still promises no cookie and no consent banner", () => {
    // The whole instrumentation is built around this sentence; if it is ever
    // edited out, the settings in config.ts were the wrong shape all along.
    expect(policy).toMatch(/no consent banner/i);
    expect(policy).toMatch(/no cookie, no local\s+storage/i);
  });
});
