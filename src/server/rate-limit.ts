import "server-only";

/**
 * A window counter, honest about what it is.
 *
 * Serverless gives every cold start its own memory, so this bounds what a
 * single instance will do, not what an account can do overall. That is a brake
 * on a runaway loop and a mistyped script, not a quota — a determined caller
 * spread across instances is not stopped here.
 *
 * It is written down rather than papered over because the two callers have
 * different exposure. Reading a pasted link costs an outbound request. Sending
 * a contact email costs the operator's sending reputation, which is not
 * something the operator gets to refund. The real control for the second is a
 * rate rule at the edge, in front of the function; this is what the application
 * can enforce on its own in the meantime.
 */
export type RateLimit = {
  /** Smallest gap between two accepted calls with the same key. */
  minGapMs: number;
  /** Length of the window the cap applies to. */
  windowMs: number;
  /** Accepted calls per key within the window. */
  perKey: number;
  /** Accepted calls across every key within the window, for this instance. */
  perInstance: number;
};

export type Limiter = {
  /** True when the call should be refused. */
  exceeded(key: string, now?: number): boolean;
};

export function createLimiter(limit: RateLimit): Limiter {
  const byKey = new Map<string, number[]>();
  let all: number[] = [];

  const recent = (times: readonly number[], now: number) =>
    times.filter((at) => now - at < limit.windowMs);

  return {
    exceeded(key, now = Date.now()) {
      all = recent(all, now);
      if (all.length >= limit.perInstance) return true;

      const hits = recent(byKey.get(key) ?? [], now);
      const last = hits[hits.length - 1];
      if (hits.length >= limit.perKey) return true;
      if (last !== undefined && now - last < limit.minGapMs) return true;

      hits.push(now);
      byKey.set(key, hits);
      all.push(now);

      // Unbounded growth is its own denial of service; the map is a cache, and
      // dropping it costs at most one extra accepted call per key.
      if (byKey.size > 5_000) byKey.clear();
      return false;
    },
  };
}
