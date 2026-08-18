import { describe, expect, it, vi } from "vitest";

import { resolvePosting } from "./resolve";

/**
 * These cases must be settled before a socket is ever opened, so the test
 * replaces fetch with a spy and asserts it was never called. A regression that
 * moved the URL check after the request would still "work" — and would be an
 * SSRF — so the assertion is on the absence of the call, not on the message.
 */
describe("resolvePosting — decided without touching the network", () => {
  const withoutNetwork = async (raw: string) => {
    const spy = vi.spyOn(globalThis, "fetch");
    try {
      const result = await resolvePosting(raw);
      expect(spy, `fetch was called for ${raw}`).not.toHaveBeenCalled();
      return result;
    } finally {
      spy.mockRestore();
    }
  };

  it("refuses the cloud metadata address", async () => {
    const result = await withoutNetwork("http://169.254.169.254/latest/meta-data/");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("private-host");
  });

  it("refuses loopback and private space", async () => {
    for (const raw of ["http://127.0.0.1:5432", "http://10.1.2.3/x", "http://[::1]/"]) {
      const result = await withoutNetwork(raw);
      expect(result.ok, raw).toBe(false);
    }
  });

  it("refuses a non-web scheme", async () => {
    const result = await withoutNetwork("file:///etc/passwd");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("scheme");
  });

  it("refuses a board that does not allow it, and says what to do instead", async () => {
    const result = await withoutNetwork("https://www.linkedin.com/jobs/view/123");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("blocked-host");
      expect(result.message).toMatch(/copy the advert text/i);
    }
  });

  it("treats an empty box as a prompt", async () => {
    const result = await withoutNetwork("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty");
  });
});
