"use client";

import { useState } from "react";

/**
 * The stack an advert asked for, readable without leaving the listing.
 *
 * Which technologies a role wanted is the single most common reason to open an
 * entry, and opening an entry to read four words is a poor trade — so the cell
 * expands where it stands. Three are shown, the rest are one click away, and
 * the click is on a control that says how many are hiding rather than on a
 * silent "+4" that could be anything.
 *
 * The chips fade in on a stagger so a row that grows from three to eleven reads
 * as an unfolding rather than as a jump in the table's height.
 */
const VISIBLE = 3;

export function StackCell({ tags, label }: { tags: readonly string[]; label: string }) {
  const [expanded, setExpanded] = useState(false);

  if (tags.length === 0) return <span className="text-faint">—</span>;

  const shown = expanded ? tags : tags.slice(0, VISIBLE);
  const hidden = tags.length - shown.length;

  return (
    <div className="stack-cell">
      {shown.map((tag, index) => (
        <span
          key={tag}
          className="stack-chip"
          style={
            // Only the newly revealed chips are staggered; the first three were
            // already on screen and re-animating them would look like a flicker.
            index >= VISIBLE
              ? ({ "--rise-delay": `${(index - VISIBLE) * 30}ms` } as React.CSSProperties)
              : undefined
          }
        >
          {tag}
        </span>
      ))}

      {(hidden > 0 || expanded) && (
        <button
          type="button"
          className="stack-more"
          aria-expanded={expanded}
          aria-label={
            expanded
              ? `Show fewer technologies for ${label}`
              : `Show all ${tags.length} technologies for ${label}`
          }
          onClick={() => setExpanded((value) => !value)}
          suppressHydrationWarning
        >
          {expanded ? "less" : `+${hidden} more`}
        </button>
      )}
    </div>
  );
}
