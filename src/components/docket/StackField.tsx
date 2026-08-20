"use client";

import { useMemo, useState } from "react";

import { FreeTextCaution } from "@/components/FreeTextCaution";
import { detectStack, resolveTags } from "@/lib/stack-detector";

/**
 * The job description and the tags it produces, as one control.
 *
 * Shared by the form that creates an entry and the one that corrects it. The
 * tag list is derived on every keystroke rather than stored in state, and the
 * two arrays beside it hold the edits *on top of* the detector's output — which
 * is what stops a re-paste from resurrecting a tag someone removed.
 */
/**
 * Reconstructs the two edit lists from a saved entry.
 *
 * The tag list is derived from the description on every keystroke, so an entry
 * being corrected has to arrive as the *difference* between what the detector
 * finds in its description and what was actually saved. A tag that was typed by
 * hand is not in the text and must be re-added as `manual`; a tag the text
 * produces but the saved list does not contain was removed on purpose and must
 * be re-added as `dismissed`. Without both, opening an entry to fix a typo
 * would silently rewrite its tags.
 *
 * Pure, so the reconstruction is testable without rendering anything.
 */
export function seedStack(initial: { description: string; tags: readonly string[] }): {
  manual: string[];
  dismissed: string[];
} {
  const found = detectStack(initial.description);
  const foundKeys = new Set(found.map((tag) => tag.toLowerCase()));
  const savedKeys = new Set(initial.tags.map((tag) => tag.toLowerCase()));

  return {
    manual: initial.tags.filter((tag) => !foundKeys.has(tag.toLowerCase())),
    dismissed: found.filter((tag) => !savedKeys.has(tag.toLowerCase())),
  };
}

export function useStack(initial: { description: string; tags: readonly string[] }) {
  const [description, setDescription] = useState(initial.description);
  const [seed] = useState(() => seedStack(initial));
  const [manual, setManual] = useState<string[]>(seed.manual);
  const [dismissed, setDismissed] = useState<string[]>(seed.dismissed);

  const detected = useMemo(() => detectStack(description), [description]);
  const tags = useMemo(
    () => resolveTags({ detected, dismissed, manual }),
    [detected, dismissed, manual],
  );

  return {
    description,
    setDescription,
    detected,
    dismissed,
    setDismissed,
    manual,
    setManual,
    tags,
  };
}

export type Stack = ReturnType<typeof useStack>;

export function StackField({
  stack,
  id = "jobDescription",
  label,
  marked = false,
  onDescriptionChange,
}: {
  stack: Stack;
  id?: string;
  label?: React.ReactNode;
  marked?: boolean;
  onDescriptionChange?: (value: string) => void;
}) {
  const { description, setDescription, detected, manual, setManual, setDismissed, tags } = stack;
  const [draft, setDraft] = useState("");

  function addTag(value: string) {
    const clean = value.trim();
    if (!clean) return;
    setDismissed((list) => list.filter((t) => t.toLowerCase() !== clean.toLowerCase()));
    if (!tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setManual((list) => [...list, clean]);
    }
    setDraft("");
  }

  function removeTag(value: string) {
    setManual((list) => list.filter((t) => t !== value));
    if (detected.includes(value)) {
      setDismissed((list) => (list.includes(value) ? list : [...list, value]));
    }
  }

  function clear() {
    setDescription("");
    onDescriptionChange?.("");
    setDismissed([]);
    setManual([]);
    setDraft("");
  }

  return (
    <div className="field col-span-full" suppressHydrationWarning>
      <label className="field-label" htmlFor={id}>
        Job description
        {label ?? (
          <span className="field-hint">
            Paste the ad here. Every technology in it becomes a tag on its own — add or remove any
            of them.
          </span>
        )}
      </label>
      <textarea
        id={id}
        data-form-type="other"
        suppressHydrationWarning
        rows={5}
        value={description}
        onChange={(event) => {
          setDescription(event.target.value);
          onDescriptionChange?.(event.target.value);
        }}
        placeholder="Paste the requirements here. e.g. You'll work with React, TypeScript and Next.js, with a Node.js/GraphQL backend deployed on AWS…"
        className={`field-textarea min-h-[108px]${marked ? " marked" : ""}`}
      />
      <FreeTextCaution />

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="eyebrow text-stamp">
          {tags.length === 0
            ? "No technology recognised"
            : `${tags.length} ${tags.length === 1 ? "technology" : "technologies"} on the tag`}
        </span>
        {(description || manual.length > 0) && (
          <button type="button" className="link-quiet" onClick={clear}>
            Clear
          </button>
        )}
      </div>

      <div className="flex min-h-10 flex-wrap items-center gap-2 border-b-[1.5px] border-rule px-0.5 pt-2 pb-2.5">
        {tags.length === 0 ? (
          <span className="text-sm text-faint">
            Paste the description above, or write the technology in the field below.
          </span>
        ) : (
          tags.map((tag) => (
            <span
              key={tag}
              className={`pill${manual.includes(tag) && !detected.includes(tag) ? " pill-manual" : ""}`}
            >
              {tag}
              <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                ✕
              </button>
            </span>
          ))
        )}
      </div>

      <div className="mt-3" suppressHydrationWarning>
        <input
          data-form-type="other"
          suppressHydrationWarning
          className="field-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag(draft);
            }
          }}
          aria-label="Add a technology by hand"
          placeholder="Missing one? Type it and press Enter"
        />
      </div>
    </div>
  );
}
