import { analyticsSettings, POSTHOG_EU_HOST } from "./config";
import type { EventName, EventProps } from "./events";

/**
 * PostHog, loaded only if it is ever needed and never before the browser is
 * free.
 *
 * A static import put roughly 80 kB into the first load of every page,
 * including the landing — the one page the brief holds to Lighthouse 100 and an
 * LCP under 1.2s. Analytics earning its place on the critical path of a page
 * whose entire job is to load fast is the wrong trade, so the module is a
 * dynamic import behind an idle callback:
 *
 *   · nothing is fetched until the first event is captured, so a page that
 *     reports nothing costs nothing;
 *   · the fetch waits for idle, so it never competes with rendering;
 *   · events captured before it finishes are not lost — they resolve onto the
 *     same promise and are sent when it settles;
 *   · without a key the promise resolves to null and no request is ever made.
 */

/**
 * Only the one method this module ever calls. Structural rather than imported:
 * naming the SDK's own type here would need an `import type` from posthog-js in
 * a module whose whole point is that posthog-js is not referenced until an
 * event is actually captured.
 */
type Handle = { capture: (event: EventName, properties?: Record<string, string>) => unknown };

let ready: Promise<Handle | null> | null = null;

function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve();
    if (typeof window.requestIdleCallback === "function") {
      // The timeout is the ceiling: on a page that never goes idle the callback
      // still runs, so an event is delayed rather than dropped.
      window.requestIdleCallback(() => resolve(), { timeout: 3_000 });
    } else {
      window.setTimeout(resolve, 1_200);
    }
  });
}

function load(): Promise<Handle | null> {
  ready ??= (async () => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return null;

    await whenIdle();
    const { default: posthog } = await import("posthog-js");
    posthog.init(key, analyticsSettings(process.env.NEXT_PUBLIC_POSTHOG_HOST ?? POSTHOG_EU_HOST));
    return posthog;
  })();
  return ready;
}

/**
 * Fire and forget. Nothing here can reject into the caller, because no counter
 * is worth breaking a page over — an ad blocker, an offline visitor and a
 * missing key all end the same way: silently.
 */
export function capture<N extends EventName>(
  event: N,
  ...props: N extends keyof EventProps ? [EventProps[N]] : []
): void {
  const properties = props[0] as Record<string, string> | undefined;
  void load()
    .then((posthog) => posthog?.capture(event, properties))
    .catch(() => {});
}
