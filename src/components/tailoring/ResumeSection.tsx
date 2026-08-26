"use client";

import type { ReactNode } from "react";

/**
 * The shell a section of the CV is drawn in.
 *
 * Sections are the level a person edits at — they add a role, not a field — so
 * the add control belongs here rather than beside every entry. `count` is the
 * number of entries, printed because an empty section is a finding: a CV with
 * no summary and a CV with a bad summary need different advice.
 */
export function ResumeSection({
  id,
  title,
  hint,
  onAdd,
  addLabel,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  onAdd?: () => void;
  addLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="cv-section" aria-labelledby={`${id}-heading`}>
      <header className="cv-section-head">
        <h3 id={`${id}-heading`} className="eyebrow text-stamp">
          {title}
        </h3>
        {onAdd && (
          <button type="button" className="link-quiet" onClick={onAdd} suppressHydrationWarning>
            {addLabel ?? "Add"}
          </button>
        )}
      </header>
      {hint && <p className="field-hint">{hint}</p>}
      <div className="cv-section-body">{children}</div>
    </section>
  );
}

/** One row inside a section, with the control that removes it. */
export function ResumeEntry({
  title,
  onRemove,
  removeLabel,
  children,
}: {
  title: string;
  onRemove?: () => void;
  removeLabel: string;
  children: ReactNode;
}) {
  return (
    <article className="cv-entry">
      <header className="cv-entry-head">
        <h4 className="cv-entry-title">{title}</h4>
        {onRemove && (
          <button
            type="button"
            className="cv-remove"
            onClick={onRemove}
            aria-label={removeLabel}
            suppressHydrationWarning
          >
            ×
          </button>
        )}
      </header>
      {children}
    </article>
  );
}
