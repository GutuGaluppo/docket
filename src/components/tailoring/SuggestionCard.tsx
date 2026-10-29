"use client";

import { useEffect, useMemo, useState } from "react";

import { SECTION_LABELS } from "@/lib/resume/schema";
import { resolveTarget, toTarget } from "@/lib/resume/target";
import { DIMENSION_LABELS } from "@/lib/tailoring/score";
import type { ResumeChange, ResumeSuggestion, SuggestionType } from "@/lib/tailoring/types";

import { useTailoring } from "./TailoringProvider";

/**
 * One recommendation, and the three things a person can do with it.
 *
 * Accept writes the text as it stands. Edit opens it so they can write their
 * own version first — which is the same act, recorded as theirs. Ignore
 * changes nothing at all, and deliberately does not move the figure: declining
 * advice is not evidence of a worse CV.
 *
 * A card with no suggested text is not a broken card. It is the honest shape of
 * a gap — the advert asks for GraphQL, the CV has never mentioned it, and there
 * is no sentence that can be written from what the document says. Those cards
 * offer Edit and Ignore, never Accept, because Accept would have to invent
 * something — and for the same reason they cannot be picked for a bulk Accept.
 */

const TYPE_LABELS: Record<SuggestionType, string> = {
  missing_keyword: "Keyword",
  skill_alignment: "Skill",
  experience_relevance: "Relevance",
  weak_wording: "Wording",
  missing_evidence: "Evidence",
  summary_alignment: "Summary",
  ats_readability: "Readability",
  irrelevant_content: "Relevance",
  missing_requirement: "Gap",
};

export function SuggestionCard({
  suggestion,
  change,
  picked = false,
  onPick,
}: {
  suggestion: ResumeSuggestion;
  /** The applied change this card produced, when it produced one. */
  change?: ResumeChange;
  /** Whether it is part of the selection a bulk Accept would apply. */
  picked?: boolean;
  /** Present only when the card can be accepted as written. */
  onPick?: () => void;
}) {
  const { state, hover, activate, startEditing, apply, dismiss, restore, undo } = useTailoring();

  const active = state.activeSuggestionId === suggestion.id;
  const editing = state.editingSuggestionId === suggestion.id;
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (editing) setDraft(suggestion.suggestedText ?? suggestion.currentText ?? "");
  }, [editing, suggestion.suggestedText, suggestion.currentText]);

  // Where it points, in the document's own words rather than its ids.
  const path = useMemo(() => {
    const target = toTarget(suggestion);
    const element = target ? resolveTarget(state.resume, target) : null;
    return element ? element.path.join(" → ") : SECTION_LABELS[suggestion.targetSectionId];
  }, [suggestion, state.resume]);

  const settled = suggestion.status !== "pending";

  return (
    <li
      className="cv-card"
      data-state={active ? "active" : undefined}
      data-status={suggestion.status}
      data-priority={suggestion.priority}
      onMouseEnter={() => hover(suggestion.id)}
      onMouseLeave={() => hover(null)}
      // Focus is the keyboard's hover. Without this the highlight would be a
      // pointer-only feature, which section 31 does not allow.
      onFocus={() => hover(suggestion.id)}
      onBlur={() => hover(null)}
    >
      {onPick && (
        <input
          type="checkbox"
          className="tl-card-pick"
          checked={picked}
          onChange={onPick}
          aria-label={`Select “${suggestion.title}” to accept with the others`}
        />
      )}
      <button
        type="button"
        className="cv-card-open"
        aria-expanded={active}
        onClick={() => activate(active ? null : suggestion.id)}
        suppressHydrationWarning
      >
        <span className="cv-card-meta">
          <span className="cv-chip" data-priority={suggestion.priority}>
            {suggestion.priority}
          </span>
          <span className="cv-chip">{TYPE_LABELS[suggestion.type]}</span>
          {suggestion.status === "applied" && (
            <span className="cv-chip" data-done="true">
              applied
            </span>
          )}
          {suggestion.status === "edited" && (
            <span className="cv-chip" data-done="true">
              edited
            </span>
          )}
          {suggestion.status === "dismissed" && <span className="cv-chip">dismissed</span>}
        </span>
        <span className="cv-card-title">{suggestion.title}</span>
        {!active && suggestion.suggestedText && !settled && (
          <span className="tl-card-preview">{suggestion.suggestedText}</span>
        )}
        <span className="cv-card-path">{path}</span>
      </button>

      {active && (
        <div className="cv-card-body">
          {suggestion.currentText && (
            <div className="cv-diff">
              <span className="eyebrow text-faint">Current</span>
              <p className="cv-diff-text">{suggestion.currentText}</p>
            </div>
          )}

          {suggestion.suggestedText && !editing && (
            <div className="cv-diff" data-kind="suggested">
              <span className="eyebrow text-stamp">Suggested</span>
              <p className="cv-diff-text">{suggestion.suggestedText}</p>
            </div>
          )}

          {editing && (
            <div className="cv-diff" data-kind="suggested">
              <label className="eyebrow text-stamp" htmlFor={`edit-${suggestion.id}`}>
                Your version
              </label>
              <textarea
                id={`edit-${suggestion.id}`}
                className="field-textarea"
                rows={4}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </div>
          )}

          <div className="cv-why">
            <span className="eyebrow text-faint">Why</span>
            <p>{suggestion.reason}</p>
          </div>

          {suggestion.affects.length > 0 && (
            <p className="cv-affects">
              <span className="eyebrow text-faint">Affects</span>{" "}
              {suggestion.affects.map((dimension) => DIMENSION_LABELS[dimension]).join(" · ")}
            </p>
          )}

          {suggestion.requiresConfirmation && !suggestion.suggestedText && (
            <p className="cv-confirm">
              Nothing in the CV supports writing this for you. If it is true of you, write it in
              your own words; if it is not, this is a gap worth knowing about.
            </p>
          )}

          <div className="cv-actions">
            {suggestion.suggestedText && !editing && (
              <button
                type="button"
                className="btn"
                disabled={state.busy || settled}
                onClick={() => apply(suggestion, suggestion.suggestedText!, false)}
                suppressHydrationWarning
              >
                <span aria-hidden="true">✓</span> Accept
              </button>
            )}

            {editing ? (
              <>
                <button
                  type="button"
                  className="btn"
                  disabled={state.busy || draft.trim().length === 0}
                  onClick={() => apply(suggestion, draft, true)}
                  suppressHydrationWarning
                >
                  Accept my version
                </button>
                <button
                  type="button"
                  className="link-quiet"
                  onClick={() => startEditing(null)}
                  suppressHydrationWarning
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-quiet"
                disabled={state.busy}
                onClick={() => startEditing(suggestion.id)}
                suppressHydrationWarning
              >
                {suggestion.suggestedText ? "Edit" : "Write it myself"}
              </button>
            )}

            {suggestion.status === "dismissed" ? (
              <button
                type="button"
                className="link-quiet"
                onClick={() => restore(suggestion.id)}
                suppressHydrationWarning
              >
                Put back
              </button>
            ) : (
              !editing && (
                <button
                  type="button"
                  className="link-quiet"
                  onClick={() => dismiss(suggestion.id)}
                  suppressHydrationWarning
                >
                  Ignore
                </button>
              )
            )}

            {change && (
              <button
                type="button"
                className="link-quiet"
                disabled={state.busy}
                onClick={() => undo(change)}
                suppressHydrationWarning
              >
                Undo
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
