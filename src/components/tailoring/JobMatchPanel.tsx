"use client";

import {
  DIMENSION_HINTS,
  DIMENSION_LABELS,
  DIMENSION_ORDER,
  matchLabel,
} from "@/lib/tailoring/score";
import type { JobMatchExplanation } from "@/lib/tailoring/types";

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

      {state.analysis && <WhyThisFigure explanation={state.analysis.explanation} />}
    </section>
  );
}

/**
 * The working, kept.
 *
 * A percentage nobody can take apart is a percentage nobody can act on — and
 * one that disagrees with the recommendations beside it is worse than none. The
 * figure is arithmetic over requirements, so the requirements are what is shown
 * here: what was asked for, what the CV evidences, and what it does not.
 *
 * Folded away by default because it is long, and never behind a developer flag
 * because it is the most useful thing on the panel.
 */
function WhyThisFigure({ explanation }: { explanation: JobMatchExplanation }) {
  const groups: Array<{ label: string; names: string[]; tone?: string }> = [
    { label: "Evidenced", names: explanation.strong, tone: "strong" },
    { label: "Mentioned, not shown", names: explanation.partial, tone: "partial" },
    { label: "Not in the CV", names: explanation.missing, tone: "missing" },
  ];

  return (
    <details className="cv-why-figure">
      <summary>Why this figure?</summary>

      <div className="cv-why-body">
        {explanation.warnings.length > 0 && (
          <p className="cv-confirm">{explanation.warnings.join(" ")}</p>
        )}

        <ul className="cv-why-dimensions">
          {explanation.dimensions.map((dimension) => (
            <li key={dimension.dimension}>
              <span>{DIMENSION_LABELS[dimension.dimension]}</span>
              <span className="cv-why-arithmetic">
                {dimension.score === null
                  ? "nothing to measure"
                  : `${dimension.earned.toFixed(1)} of ${dimension.possible.toFixed(1)} → ${dimension.score}%`}
              </span>
            </li>
          ))}
        </ul>

        {groups.map((group) =>
          group.names.length === 0 ? null : (
            <div key={group.label} className="cv-why-group" data-tone={group.tone}>
              <span className="eyebrow text-faint">
                {group.label} ({group.names.length})
              </span>
              <p>{group.names.join(" · ")}</p>
            </div>
          ),
        )}

        {explanation.keywords.missed.length > 0 && (
          <div className="cv-why-group">
            <span className="eyebrow text-faint">
              Terminology the advert uses and this CV does not ({explanation.keywords.missed.length}
              )
            </span>
            <p>{explanation.keywords.missed.join(" · ")}</p>
          </div>
        )}
      </div>
    </details>
  );
}
