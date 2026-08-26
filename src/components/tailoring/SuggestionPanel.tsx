"use client";

import { useMemo, useState } from "react";

import { resumeElements } from "@/lib/resume/target";
import {
  filterCounts,
  matchesFilter,
  sortSuggestions,
  SUGGESTION_FILTERS,
} from "@/lib/tailoring/queue";

import { SuggestionCard } from "./SuggestionCard";
import { useTailoring } from "./TailoringProvider";

/**
 * The panel beside the document.
 *
 * Ordering is not the order the recommendations were produced in — it is
 * priority, then how much of the figure a change could move, then the order the
 * CV reads in, so working down this list is also working down the page.
 * Anything already applied or dismissed sinks to the bottom rather than
 * disappearing: a person who applied something wants to see that they did, and
 * wants Undo where they left it.
 *
 * While a reading is in flight the panel names the four things being done. They
 * are real stages, printed as a list rather than as a progress bar, because
 * there is no progress to report and a bar that fills on a timer is a lie about
 * how long this takes.
 */
export function SuggestionPanel() {
  const { state, setFilter } = useTailoring();
  const [collapsed, setCollapsed] = useState(false);

  const order = useMemo(
    () => resumeElements(state.resume).map((element) => element.key),
    [state.resume],
  );

  const sorted = useMemo(
    () => sortSuggestions(state.suggestions, order),
    [state.suggestions, order],
  );

  const counts = useMemo(() => filterCounts(state.suggestions), [state.suggestions]);
  const shown = sorted.filter((suggestion) => matchesFilter(suggestion, state.filter));

  const changeFor = (suggestionId: string) =>
    state.history.find((change) => change.suggestionId === suggestionId);

  return (
    <aside
      className="cv-aside"
      data-collapsed={collapsed ? "true" : undefined}
      aria-labelledby="cv-aside-heading"
    >
      <header className="cv-aside-head">
        <h2 id="cv-aside-heading" className="eyebrow text-stamp">
          AI recommendations
        </h2>
        <button
          type="button"
          className="link-quiet drawer-only"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
          suppressHydrationWarning
        >
          {collapsed ? `Show (${counts.all})` : "Hide"}
        </button>
      </header>

      <div className="cv-aside-body">
        {state.status === "analyzing" && (
          <ol className="cv-steps" aria-live="polite">
            <li>Identifying the requirements</li>
            <li>Comparing them against your experience</li>
            <li>Checking keyword coverage</li>
            <li>Preparing recommendations</li>
          </ol>
        )}

        {state.suggestions.length > 0 && (
          <nav className="cv-filters" aria-label="Filter recommendations">
            {SUGGESTION_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className="cv-filter"
                data-current={state.filter === filter.id ? "true" : undefined}
                aria-pressed={state.filter === filter.id}
                onClick={() => setFilter(filter.id)}
                suppressHydrationWarning
              >
                {filter.label} ({counts[filter.id]})
              </button>
            ))}
          </nav>
        )}

        {state.status === "idle" && (
          <p className="cv-empty">
            Add a job description to see how well your CV matches this role. Nothing is read, and
            nothing is sent anywhere, until you ask for it.
          </p>
        )}

        {state.status !== "idle" &&
          state.status !== "analyzing" &&
          state.suggestions.length === 0 && (
            <p className="cv-empty">
              Your CV already aligns strongly with this advert. No major changes recommended.
            </p>
          )}

        {state.suggestions.length > 0 && shown.length === 0 && (
          <p className="cv-empty">Nothing under this filter.</p>
        )}

        <ul className="cv-cards">
          {shown.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              change={changeFor(suggestion.id)}
            />
          ))}
        </ul>

        {state.history.length > 0 && <ChangeHistory />}
      </div>
    </aside>
  );
}

/**
 * What has been applied, newest first, each with the way back.
 *
 * Kept in the panel rather than in a dialog because it is the record of what
 * this session did to the document: a person who applied six changes and lost
 * their nerve about the third needs to find it without remembering which card
 * it came from.
 */
function ChangeHistory() {
  const { state, undo } = useTailoring();

  return (
    <section className="cv-history" aria-labelledby="cv-history-heading">
      <h3 id="cv-history-heading" className="eyebrow text-faint">
        Applied in this document
      </h3>
      <ul>
        {state.history.map((change) => (
          <li key={change.id}>
            <span className="cv-history-target">{change.targetId}</span>
            <span className="cv-history-text">{change.nextValue}</span>
            <button
              type="button"
              className="link-quiet"
              disabled={state.busy}
              onClick={() => undo(change)}
              suppressHydrationWarning
            >
              Undo
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
