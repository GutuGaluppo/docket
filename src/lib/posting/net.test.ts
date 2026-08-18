import { describe, expect, it } from "vitest";

import { isBlockedAddress } from "./net";

/**
 * These are the addresses that make the difference between a link reader and an
 * open proxy into the platform's own network, so they are asserted one by one
 * rather than by a rule.
 */
describe("isBlockedAddress", () => {
  it("blocks the cloud metadata address in every form it can be written", () => {
    expect(isBlockedAddress("169.254.169.254")).toBe(true);
    expect(isBlockedAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isBlockedAddress("::ffff:a9fe:a9fe")).toBe(true);
  });

  it("blocks loopback, private and link-local space", () => {
    for (const ip of [
      "127.0.0.1",
      "127.1.1.1",
      "10.0.0.1",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "0.0.0.0",
      "100.64.0.1",
      "::1",
      "::",
      "fe80::1",
      "fc00::1",
      "fd12:3456::1",
      "ff02::1",
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("lets public addresses through", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "93.184.216.34", "2606:4700::1111"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("blocks anything it cannot parse — an unreadable address is not a licence to connect", () => {
    for (const ip of ["", "  ", "not-an-ip", "999.1.1.1", "1.2.3", "::gg", "1:2:3"]) {
      expect(isBlockedAddress(ip), JSON.stringify(ip)).toBe(true);
    }
  });

  it("blocks the 6to4 range, which tunnels to arbitrary v4", () => {
    expect(isBlockedAddress("2002:7f00:1::")).toBe(true);
  });
});
