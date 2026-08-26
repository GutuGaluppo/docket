"use client";

import {
  DIMENSION_HINTS,
  DIMENSION_LABELS,
  DIMENSION_ORDER,
  matchLabel,
} from "@/lib/tailoring/score";

import { useTailoring } from "./TailoringProvider";

/**
 * The figure, and everything that has to be true for it to be read correctly.
 *
 * It is called Job Match and never ATS Score. No two applicant tracking systems
 * score a CV the same way, most do not score at all, and a number presented as
 * "your chance of passing the filter" would be a promise this product cannot
 * keep. What is on screen is a comparison between one document and one advert,
 * computed here, and the panel says so in as many words.
 *
 * The status line matters as much as the number. A figure that quietly
 * describes a CV three edits ago is worse than no figure, so a document edited
 * since the last reading says "changed since" and offers to read it again.
 */
export function JobMatchPanel() {
  const { state, runAnalysis, modelConfigured } = useTailoring();
  const { jobMatch, status, lastDelta } = state;

  const pending = state.suggestions.filter((suggestion) => suggestion.status === "pending").length;
  const score = jobMatch?.overallScore ?? null;

  return (
    <section className="cv-match" aria-labelledby="job-match-heading">
      <div className="cv-match-figure">
        <h2 id="job-match-heading" className="eyebrow text-stamp">
          Job Match
        </h2>
        <p className="cv-match-score">
          {score === null || status === "idle" ? "—" : `${score}%`}
          {lastDelta !== null && lastDelta !== 0 && status !== "idle" && (
            <span
              className="cv-match-delta"
              data-direction={lastDelta > 0 ? "up" : "down"}
              aria-label={`${lastDelta > 0 ? "up" : "down"} ${Math.abs(lastDelta)} points since the last change`}
            >
              {lastDelta > 0 ? "↑" : "↓"} {lastDelta > 0 ? "+" : ""}
              {lastDelta}
            </span>
          )}
        </p>
        <p className="cv-match-band">{score === null ? "Not read yet" : matchLabel(score)}</p>
        <p className="cv-match-caveat">
          An estimate of how closely this CV answers this advert. It is not an ATS score and not a
          prediction — no two systems read a CV the same way.
        </p>
      </div>

      <div className="cv-match-bars">
        {DIMENSION_ORDER.map((dimension) => {
          const value = jobMatch?.[dimension] ?? null;
          return (
            <div key={dimension} className="cv-bar" title={DIMENSION_HINTS[dimension]}>
              <span className="cv-bar-label">{DIMENSION_LABELS[dimension]}</span>
              <span className="cv-bar-track" aria-hidden="true">
                <span className="cv-bar-fill" style={{ width: `${value ?? 0}%` }} />
              </span>
              <span className="cv-bar-value">
                {value === null ? "—" : `${value}%`}
                {value === null && (
                  <span className="sr-only">, nothing in the advert to measure</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="cv-match-status" aria-live="polite">
        {status === "analyzing" && (
          <p className="cv-status-line">Reading the CV against the advert…</p>
        )}

        {status === "ready" && (
          <p className="cv-status-line">
            {pending === 1 ? "1 recommendation" : `${pending} recommendations`} to review
            {state.analysis?.source === "heuristic" && (
              <>
                {" · "}
                <span className="text-muted">
                  {modelConfigured
                    ? "written without the model this time"
                    : "structural reading only — no model is configured"}
                </span>
              </>
            )}
          </p>
        )}

        {status === "stale" && (
          <p className="cv-status-line">
            <span className="cv-flagged">CV changed since the last reading.</span>{" "}
            <button
              type="button"
              className="link-quiet"
              onClick={runAnalysis}
              suppressHydrationWarning
            >
              Recalculate Job Match
            </button>
          </p>
        )}

        {status === "error" && (
          <p className="cv-status-line">
            <span className="cv-flagged">{state.error}</span> Your CV is exactly as you left it.{" "}
            <button
              type="button"
              className="link-quiet"
              onClick={runAnalysis}
              suppressHydrationWarning
            >
              Try again
            </button>
          </p>
        )}

        {status === "idle" && (
          <p className="cv-status-line text-muted">
            Add a job description to see how well this CV matches the role.
          </p>
        )}
      </div>
    </section>
  );
}
