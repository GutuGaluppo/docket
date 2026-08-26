"use client";

import { memo } from "react";

import { elementDomId } from "@/lib/resume/target";

/**
 * One editable piece of the CV, and the only place a highlight is drawn.
 *
 * Three states have to be told apart at a glance, and section 30 forbids doing
 * it with colour alone — colour is the part a reader with low vision or a
 * forced-colours theme does not get:
 *
 *   hover     a dotted rule and a faint wash. Temporary, follows the pointer.
 *   selected  a solid rule, a bar down the left edge and a stronger wash.
 *   editing   the browser's own focus ring, untouched.
 *
 * Memoised on its props, which is what keeps hovering a card in the panel from
 * re-rendering forty fields: the parent re-renders, every field whose
 * highlight did not change skips its own work, and only the two that did are
 * touched.
 */
export type ResumeFieldProps = {
  elementKey: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  hint?: string;
  highlighted?: boolean;
  selected?: boolean;
  /** An imported value the reading was not confident about. */
  flagged?: boolean;
};

function Field({
  elementKey,
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
  hint,
  highlighted = false,
  selected = false,
  flagged = false,
}: ResumeFieldProps) {
  const domId = elementDomId(elementKey);
  const state = selected ? "selected" : highlighted ? "hover" : undefined;

  return (
    <div
      className="cv-field"
      data-highlight={state}
      data-flagged={flagged ? "true" : undefined}
      data-cv-key={elementKey}
    >
      <label className="field-label" htmlFor={domId}>
        {label}
        {selected && <span className="sr-only">, the element this recommendation points at</span>}
      </label>

      {multiline ? (
        <textarea
          id={domId}
          className="field-textarea cv-input"
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={domId}
          className="field-input cv-input"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {flagged && (
        <p className="cv-review-note">
          Please review this field — the document was not clear about it.
        </p>
      )}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export const ResumeField = memo(Field);
