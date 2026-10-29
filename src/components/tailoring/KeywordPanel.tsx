"use client";

import { useMemo, useState } from "react";

import {
  highlightTerms,
  keywordCoverage,
  keywordTally,
  sortKeywords,
  type KeywordStatus,
} from "@/lib/tailoring/keywords";
import type { RequirementImportance, RequirementMatch } from "@/lib/tailoring/types";

import { useTailoring } from "./TailoringProvider";

/**
 * The advert's words, and whether the CV says them — as it reads now.
 *
 * Recomputed from the document on every edit, so typing a term into a bullet
 * ticks it here in the same keystroke. That immediacy is the point: the list
 * is where somebody goes to find what is missing, and a list that only updates
 * after a round trip is a list people stop trusting.
 */
export function useKeywords(): { list: KeywordStatus[]; terms: string[] } {
  const { state } = useTailoring();
  const keywords = state.analysis?.jobAnalysis.keywords;

  return useMemo(() => {
    const list = keywords ? sortKeywords(keywordCoverage(state.resume, keywords)) : [];
    return { list, terms: highlightTerms(list) };
  }, [state.resume, keywords]);
}

export function KeywordPanel() {
  const { state, addKeyword, busy } = useKeywordActions();
  const { list } = useKeywords();
  const [showAll, setShowAll] = useState(false);

  if (!state.analysis) return null;

  const tally = keywordTally(list);
  const missing = list.filter((keyword) => keyword.foundAs === null);
  const shown = showAll ? list : missing;

  return (
    <section className="tl-card" aria-labelledby="cv-keywords-heading">
      <header className="tl-card-head">
        <h2 id="cv-keywords-heading" className="tl-card-title">
          Keyword match
        </h2>
        <span className="tl-tally" aria-label={`${tally.found} of ${tally.total} keywords in the CV`}>
          {tally.found}/{tally.total}
        </span>
      </header>

      <div
        className="tl-meter"
        aria-hidden="true"
        style={{ ["--fill" as string]: `${tally.total ? (tally.found / tally.total) * 100 : 0}%` }}
      />

      <div className="tl-seg" role="group" aria-label="Which keywords to show">
        <button
          type="button"
          aria-pressed={!showAll}
          onClick={() => setShowAll(false)}
          suppressHydrationWarning
        >
          Missing ({missing.length})
        </button>
        <button
          type="button"
          aria-pressed={showAll}
          onClick={() => setShowAll(true)}
          suppressHydrationWarning
        >
          All ({list.length})
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="tl-note">
          {list.length === 0
            ? "This advert did not name any terms to look for."
            : "Every term the advert uses is already in the CV."}
        </p>
      ) : (
        <ul className="tl-keywords">
          {shown.map((keyword) => (
            <li key={keyword.id} data-found={keyword.foundAs ? "true" : undefined}>
              <span
                className="tl-count"
                title={`The advert says it ${keyword.occurrences} ${keyword.occurrences === 1 ? "time" : "times"}`}
              >
                {keyword.occurrences}×
              </span>
              <span className="tl-keyword" data-weight={keyword.weight}>
                {keyword.text}
              </span>
              {keyword.foundAs ? (
                <span className="tl-ok">
                  <span aria-hidden="true">✓</span> In CV
                </span>
              ) : (
                <button
                  type="button"
                  className="tl-add"
                  disabled={busy}
                  title={`Adds “${keyword.text}” to your Skills. Only add what you can back up.`}
                  aria-label={`Add ${keyword.text} to your skills`}
                  onClick={() => addKeyword(keyword.text)}
                  suppressHydrationWarning
                >
                  + Add
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="tl-note">
        Add puts the term in your Skills. Showing it in a role, in a bullet, counts for more.
      </p>
    </section>
  );
}

function useKeywordActions() {
  const { state, addKeyword } = useTailoring();
  return { state, addKeyword, busy: state.busy || state.status === "analyzing" };
}

/* -------------------------------------------------------------------------- */

const IMPORTANCE_LABELS: Record<RequirementImportance, string> = {
  required: "Required",
  important: "Important",
  preferred: "Nice to have",
};

const MATCH_MARKS: Record<RequirementMatch, { mark: string; said: string }> = {
  strong: { mark: "●", said: "shown in the CV" },
  partial: { mark: "◐", said: "mentioned, not shown" },
  missing: { mark: "○", said: "not in the CV" },
};

/**
 * Responsibilities and qualifications, one line each, as the CV answers them.
 *
 * Keywords are the advert's vocabulary; these are what it actually asks for.
 * Each one says whether the document shows it, only names it, or never mentions
 * it — and a line that is shown somewhere opens that place in the document.
 */
export function RequirementPanel() {
  const { state, focusElement } = useTailoring();
  const analysis = state.analysis;

  const rows = useMemo(() => {
    if (!analysis) return [];
    const verdicts = new Map(
      analysis.coverage.requirements.map((verdict) => [verdict.requirementId, verdict]),
    );
    return analysis.jobAnalysis.requirements.map((requirement) => {
      const verdict = verdicts.get(requirement.id);
      return {
        requirement,
        match: verdict?.match ?? ("missing" as const),
        evidenceKey: verdict?.evidence.find((evidence) => evidence.key)?.key ?? null,
      };
    });
  }, [analysis]);

  if (!analysis || rows.length === 0) return null;

  const order: RequirementImportance[] = ["required", "important", "preferred"];
  const met = rows.filter((row) => row.match === "strong").length;

  return (
    <section className="tl-card" aria-labelledby="cv-requirements-heading">
      <header className="tl-card-head">
        <h2 id="cv-requirements-heading" className="tl-card-title">
          Requirements
        </h2>
        <span className="tl-tally">
          {met}/{rows.length}
        </span>
      </header>

      {order.map((importance) => {
        const group = rows.filter((row) => row.requirement.importance === importance);
        if (group.length === 0) return null;
        return (
          <div key={importance} className="tl-req-group">
            <h3 className="tl-group-title">{IMPORTANCE_LABELS[importance]}</h3>
            <ul className="tl-reqs">
              {group.map(({ requirement, match, evidenceKey }) => (
                <li key={requirement.id} data-match={match}>
                  <span className="tl-req-mark" aria-hidden="true">
                    {MATCH_MARKS[match].mark}
                  </span>
                  {evidenceKey ? (
                    <button
                      type="button"
                      className="tl-req-name"
                      title={requirement.sourceText || undefined}
                      onClick={() => focusElement(evidenceKey)}
                      suppressHydrationWarning
                    >
                      {requirement.name}
                    </button>
                  ) : (
                    <span className="tl-req-name" title={requirement.sourceText || undefined}>
                      {requirement.name}
                    </span>
                  )}
                  <span className="sr-only">, {MATCH_MARKS[match].said}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <p className="tl-note">● shown in a role · ◐ only named · ○ not in the CV</p>
    </section>
  );
}
