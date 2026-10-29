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
export function JobMatchPanel({ jobLabel }: { jobLabel?: string }) {
  const { state, runAnalysis, modelConfigured } = useTailoring();
  const { jobMatch, status, lastDelta } = state;

  const score = jobMatch?.overallScore ?? null;
  const shown = score !== null && status !== "idle";

  return (
    <section className="tl-card cv-match" aria-labelledby="job-match-heading">
      <div className="tl-score">
        <ScoreRing value={shown ? score : null} />
        <div className="tl-score-body">
          <h2 id="job-match-heading" className="tl-card-title">
            Job Match
          </h2>
          <p className="tl-score-band">{shown ? matchLabel(score) : "Not read yet"}</p>
          {jobLabel && <p className="tl-score-job">{jobLabel}</p>}
          {lastDelta !== null && lastDelta !== 0 && shown && (
            <span
              className="cv-match-delta"
              data-direction={lastDelta > 0 ? "up" : "down"}
              aria-label={`${lastDelta > 0 ? "up" : "down"} ${Math.abs(lastDelta)} points since the last change`}
            >
              {lastDelta > 0 ? "↑ +" : "↓ "}
              {lastDelta}
            </span>
          )}
        </div>
      </div>

      {status !== "idle" && (
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
      )}

      <div className="cv-match-status" aria-live="polite">
        {status === "analyzing" && (
          <p className="cv-status-line">Reading the CV against the advert…</p>
        )}

        {status === "ready" && (
          <p className="cv-status-line text-muted">
            Updates as you edit.
            {state.analysis?.source === "heuristic" &&
              (modelConfigured
                ? " Written without the model this time."
                : " Structural reading only — no model is configured.")}
          </p>
        )}

        {status === "stale" && (
          <p className="cv-status-line">
            <span className="cv-flagged">The advert changed since this reading.</span>{" "}
            <button
              type="button"
              className="link-quiet"
              onClick={runAnalysis}
              suppressHydrationWarning
            >
              Tailor to the new advert
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
            Choose an advert and press Tailor to see how well this CV answers it.
          </p>
        )}
      </div>

      {state.analysis && <WhyThisFigure explanation={state.analysis.explanation} />}

      <p className="cv-match-caveat">
        An estimate of how closely this CV answers this advert — not an ATS score, and not a
        prediction.
      </p>
    </section>
  );
}

/**
 * The figure as a dial. The arc is decoration; the number inside it is the
 * figure, and it is the only part a screen reader is given.
 */
function ScoreRing({ value }: { value: number | null }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const fraction = value === null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  const band = value === null ? "none" : value >= 60 ? "high" : value >= 40 ? "mid" : "low";

  return (
    <div className="tl-ring" data-band={band}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle className="tl-ring-track" cx="32" cy="32" r={radius} />
        <circle
          className="tl-ring-fill"
          cx="32"
          cy="32"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </svg>
      <span className="tl-ring-value">{value === null ? "—" : value}</span>
    </div>
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
