"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { capture } from "@/lib/analytics/client";
import { EVENTS } from "@/lib/analytics/events";
import { detectStack } from "@/lib/stack-detector";

/**
 * The thesis, demonstrated rather than promised.
 *
 * This is the only interactive thing on the landing page, and it is the product
 * itself: the same pure module the app uses, running in the visitor's browser.
 * No account and no network call — paste any real job ad and it answers before
 * you finish reading this sentence.
 *
 * One event is emitted the first time the box holds something other than the
 * sample, and it carries no properties. The pasted text never leaves the
 * browser, which is what the label under the field promises; whether a real ad
 * was pasted is encoded in the firing condition, not in anything transmitted.
 */
const SAMPLE = `Senior Frontend Engineer (m/f/d) — Berlin, hybrid

You'll work with React, TypeScript and Next.js on a design system used by
every team in the company. The backend is Node.js with GraphQL, deployed on
AWS behind Kubernetes. We test with Playwright and care about accessibility.

Nice to have: experience with PostgreSQL, and an eye for CI/CD.`;

/** Long enough that idle typing does not read as a pasted advert. */
const REAL_AD = 120;

export function HeroDetector() {
  const [text, setText] = useState(SAMPLE);
  const tags = useMemo(() => detectStack(text), [text]);
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;
    if (text === SAMPLE || text.trim().length < REAL_AD) return;
    reported.current = true;
    capture(EVENTS.heroDetectorUsed);
  }, [text]);

  return (
    <div className="flex flex-col gap-3" suppressHydrationWarning>
      <label className="field-label" htmlFor="hero-detector">
        Paste any job ad
        <span className="field-hint">nothing is sent anywhere</span>
      </label>

      <textarea
        id="hero-detector"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={9}
        spellCheck={false}
        suppressHydrationWarning
        data-form-type="other"
        className="field-textarea min-h-[196px] font-mono text-[13px] leading-relaxed"
      />

      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow text-stamp">
          {tags.length === 0
            ? "No technology recognised"
            : `${tags.length} ${tags.length === 1 ? "technology" : "technologies"} recognised`}
        </span>
        {text !== SAMPLE && (
          <button type="button" className="link-quiet" onClick={() => setText(SAMPLE)}>
            Reset
          </button>
        )}
      </div>

      <div className="flex min-h-12 flex-wrap items-start gap-2">
        {tags.length === 0 ? (
          <span className="text-sm text-faint">
            Delete the text above and paste an ad you are actually looking at.
          </span>
        ) : (
          tags.map((tag) => (
            <span key={tag} className="tag text-[13px]">
              {tag}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
