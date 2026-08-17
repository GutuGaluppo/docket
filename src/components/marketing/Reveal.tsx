"use client";

import { useEffect, useRef } from "react";

/**
 * A section that fades up once, when it first comes into view.
 *
 * The hidden state lives behind `@media (scripting: enabled)` in globals.css,
 * so a browser with JavaScript off never hides anything — it just renders the
 * page. `prefers-reduced-motion` is honoured by the same stylesheet rather than
 * by a check here, which keeps the behaviour in one place.
 */
export function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      node.dataset.shown = "true";
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.dataset.shown = "true";
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);

    /**
     * Safety net. The hidden state is opacity 0, so anything that stops the
     * observer from firing — a thrown effect, a browser quirk, a restored
     * bfcache page — would hide the section for good. A marketing page that
     * silently blanks itself is worse than one that never animated.
     */
    const failsafe = setTimeout(() => {
      node.dataset.shown = "true";
      observer.disconnect();
    }, 2500);

    return () => {
      clearTimeout(failsafe);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
