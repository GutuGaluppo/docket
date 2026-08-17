import type { Route } from "next";

/**
 * `callbackUrl` arrives from the query string, so it is attacker-controlled.
 * Only same-origin absolute paths are allowed through — "//evil.com" and
 * "https://evil.com" both fall back to the docket. The cast is the one place
 * where a runtime-checked string becomes a typed route.
 */
export function safeInternalPath(candidate: string | undefined, fallback = "/docket"): Route {
  const isInternal =
    typeof candidate === "string" && candidate.startsWith("/") && !candidate.startsWith("//");
  return (isInternal ? candidate : fallback) as Route;
}
