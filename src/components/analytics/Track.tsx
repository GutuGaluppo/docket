"use client";

import { useEffect, useRef } from "react";

import { capture } from "@/lib/analytics/client";
import type { EventName } from "@/lib/analytics/events";

/**
 * Fires one named event and renders nothing.
 *
 * Two modes, because the funnel asks two different questions. `mount` answers
 * "this page was opened"; `visible` answers "this section was actually reached",
 * which is the honest reading of a pricing view on a page where pricing is a
 * section rather than a route.
 *
 * Both fire at most once. With no key, or with the request blocked, every call
 * is a no-op, so nothing here can fail the page.
 */
export function Track({ event, on = "mount" }: { event: EventName; on?: "mount" | "visible" }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    const send = () => {
      if (fired.current) return;
      fired.current = true;
      capture(event);
    };

    if (on === "mount") {
      send();
      return;
    }

    const node = anchor.current;
    // No observer means no way to tell whether the section was reached; not
    // firing is better than firing for everyone who loaded the page.
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            send();
            observer.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [event, on]);

  return on === "visible" ? <span ref={anchor} aria-hidden className="block h-0" /> : null;
}
