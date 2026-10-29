"use client";

import { useMemo, useState } from "react";

import { SECTION_LABELS } from "@/lib/resume/schema";
import { resumeElements } from "@/lib/resume/target";
import {
  groupSuggestions,
  isAcceptable,
  sortSuggestions,
  type SuggestionGrouping,
} from "@/lib/tailoring/queue";

import { SuggestionCard } from "./SuggestionCard";
import { useTailoring } from "./TailoringProvider";

/**
 * The recommendations, as a queue to work through.
 *
 * Ordering is not the order the recommendations were produced in — it is
 * priority, then how much of the figure a change could move, then the order the
 * CV reads in — and the queue can be cut by the section it touches or by how
 * much it matters, whichever way somebody prefers to work.
 *
 * Cards that can be accepted as written can also be accepted together. Only
 * those: a card with no suggested text is a gap only the person can fill, and a
 * batch that skipped over it silently would read as if it had been dealt with.
 * Everything settled leaves the queue for a folded list at the bottom, with its
 * Undo still where it was.
 */
export function SuggestionPanel() {
  const { state, applyMany } = useTailoring();
  const [grouping, setGrouping] = useState<SuggestionGrouping>("section");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  const order = useMemo(
    () => resumeElements(state.resume).map((element) => element.key),
    [state.resume],
  );

  const sorted = useMemo(
    () => sortSuggestions(state.suggestions, order),
    [state.suggestions, order],
  );

  const { groups, settled } = useMemo(
    () =>
      groupSuggestions(sorted, grouping, (suggestion) => SECTION_LABELS[suggestion.targetSectionId]),
    [sorted, grouping],
  );

  const acceptable = useMemo(() => sorted.filter(isAcceptable), [sorted]);
  // A selection only ever holds cards that can still be accepted.
  const selected = acceptable.filter((suggestion) => picked.has(suggestion.id));
  const allPicked = acceptable.length > 0 && selected.length === acceptable.length;
  const pending = sorted.length - settled.length;

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const changeFor = (suggestionId: string) =>
    state.history.find((change) => change.suggestionId === suggestionId);

  const working = state.busy || state.status === "analyzing";

  return (
    <section className="tl-card tl-queue" aria-labelledby="cv-aside-heading">
      <header className="tl-card-head">
        <h2 id="cv-aside-heading" className="tl-card-title">
          Suggestions
        </h2>
        {state.suggestions.length > 0 && <span className="tl-tally">{pending} to review</span>}
      </header>

      {state.status === "idle" && (
        <p className="cv-empty">
          Choose an advert and press <b>Tailor</b>. Every change is proposed here with the reason
          for it, and nothing is written into the CV until you accept it.
        </p>
      )}

      {state.status === "analyzing" && state.suggestions.length === 0 && (
        <p className="cv-empty">Reading the CV against the advert…</p>
      )}

      {state.status !== "idle" &&
        state.status !== "analyzing" &&
        state.suggestions.length === 0 && (
          <p className="cv-empty">
            Your CV already aligns strongly with this advert. No major changes recommended.
          </p>
        )}

      {pending > 0 && (
        <>
          <div className="tl-toolbar">
            <div className="tl-seg" role="group" aria-label="Group suggestions by">
              <button
                type="button"
                aria-pressed={grouping === "section"}
                onClick={() => setGrouping("section")}
                suppressHydrationWarning
              >
                Section
              </button>
              <button
                type="button"
                aria-pressed={grouping === "priority"}
                onClick={() => setGrouping("priority")}
                suppressHydrationWarning
              >
                Priority
              </button>
            </div>

            {acceptable.length > 0 && (
              <label className="tl-check">
                <input
                  type="checkbox"
                  checked={allPicked}
                  ref={(node) => {
                    if (node) node.indeterminate = selected.length > 0 && !allPicked;
                  }}
                  onChange={() =>
                    setPicked(allPicked ? new Set() : new Set(acceptable.map((item) => item.id)))
                  }
                />
                Select all
              </label>
            )}
          </div>

          {selected.length > 0 && (
            <div className="tl-bulk" role="region" aria-label="Selected suggestions">
              <span>
                {selected.length} selected
              </span>
              <button
                type="button"
                className="link-quiet"
                onClick={() => setPicked(new Set())}
                suppressHydrationWarning
              >
                Clear
              </button>
              <button
                type="button"
                className="btn"
                disabled={working}
                onClick={() => {
                  applyMany(selected);
                  setPicked(new Set());
                }}
                suppressHydrationWarning
              >
                {working ? "Applying…" : `Accept ${selected.length}`}
              </button>
            </div>
          )}

          {groups.map((group) => (
            <div key={group.id} className="tl-group">
              <h3 className="tl-group-title">
                {group.label} <span className="text-faint">({group.items.length})</span>
              </h3>
              <ul className="cv-cards">
                {group.items.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    change={changeFor(suggestion.id)}
                    picked={picked.has(suggestion.id)}
                    onPick={isAcceptable(suggestion) ? () => toggle(suggestion.id) : undefined}
                  />
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      {settled.length > 0 && (
        <details className="tl-done">
          <summary>Done ({settled.length})</summary>
          <ul className="cv-cards">
            {settled.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                change={changeFor(suggestion.id)}
              />
            ))}
          </ul>
        </details>
      )}

      {state.history.length > 0 && <ChangeHistory />}
    </section>
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

  const paths = useMemo(
    () =>
      new Map(
        resumeElements(state.resume).map((element) => [element.key, element.path.join(" → ")]),
      ),
    [state.resume],
  );

  return (
    <details className="tl-done cv-history">
      <summary>Applied in this document ({state.history.length})</summary>
      <ul>
        {state.history.map((change) => (
          <li key={change.id}>
            <span className="cv-history-target">{paths.get(change.targetId) ?? change.targetId}</span>
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
    </details>
  );
}
