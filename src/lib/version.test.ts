import { describe, expect, it } from "vitest";

import { APP_VERSION } from "./version";

/**
 * The version is written by hand and read by strangers, so the one thing worth
 * guarding is that it stays a version. "0.2" and "v0.2.0" both look right in a
 * diff and both make the footer wrong.
 */
describe("APP_VERSION", () => {
  it("is semver, with no decoration", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  });
});
