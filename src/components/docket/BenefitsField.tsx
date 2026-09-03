"use client";

import { useMemo, useState } from "react";

import { detectBenefits, resolveBenefits } from "@/lib/benefit-detector";
import { seedEdits } from "@/lib/alias-scan";

/**
 * What the advert offers, read off the same description the stack is read off.
 *
 * The list is derived from the description on every keystroke rather than
 * stored, and the two arrays beside it hold the edits *on top of* the
 * detector's output — which is what stops a re-paste from resurrecting a
 * benefit someone removed, or dropping one they added by hand.
 *
 * Deliberately its own hook rather than a second return value from `useStack`.
 * The two lists answer different questions about the same text — what the job
 * needs against what it gives — and keeping them apart is what lets the form
 * show them as two fields without either one having to know about the other.
 */
export function useBenefits(initial: { description: string; benefits: readonly string[] }) {
  const [seed] = useState(() => seedEdits(detectBenefits(initial.description), initial.benefits));
  const [manual, setManual] = useState<string[]>(seed.manual);
  const [dismissed, setDismissed] = useState<string[]>(seed.dismissed);

  const detected = useMemo(() => detectBenefits(initial.description), [initial.description]);
  const benefits = useMemo(
    () => resolveBenefits({ detected, dismissed, manual }),
    [detected, dismissed, manual],
  );

  return { detected, dismissed, setDismissed, manual, setManual, benefits };
}

export type Benefits = ReturnType<typeof useBenefits>;

/**
 * Reads the description but never writes it: the textarea belongs to the stack
 * field, and two controls owning one value is how they drift apart. This one
 * takes the text as a prop and shows what it found in it.
 */
export function BenefitsField({
  benefits: state,
  hasDescription,
}: {
  benefits: Benefits;
  hasDescription: boolean;
}) {
  const { detected, manual, setManual, setDismissed, benefits } = state;
  const [draft, setDraft] = useState("");

  function addBenefit(value: string) {
    const clean = value.trim();
    if (!clean) return;
    setDismissed((list) => list.filter((b) => b.toLowerCase() !== clean.toLowerCase()));
    if (!benefits.some((b) => b.toLowerCase() === clean.toLowerCase())) {
      setManual((list) => [...list, clean]);
    }
    setDraft("");
  }

  function removeBenefit(value: string) {
    setManual((list) => list.filter((b) => b !== value));
    if (detected.includes(value)) {
      setDismissed((list) => (list.includes(value) ? list : [...list, value]));
    }
  }

  return (
    <div className="field col-span-full" suppressHydrationWarning>
      <span className="field-label">
        Benefits
        <span className="field-hint">
          Read from the description above — what the job offers, as opposed to what it asks for. Add
          or remove any of them.
        </span>
      </span>

      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="eyebrow text-stamp">
          {benefits.length === 0
            ? "No benefit recognised"
            : `${benefits.length} ${benefits.length === 1 ? "benefit" : "benefits"} on the record`}
        </span>
        {(detected.length > 0 || manual.length > 0) && (
          <button
            type="button"
            className="link-quiet"
            onClick={() => {
              setDismissed([...detected]);
              setManual([]);
              setDraft("");
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex min-h-10 flex-wrap items-center gap-2 border-b-[1.5px] border-rule px-0.5 pt-2 pb-2.5">
        {benefits.length === 0 ? (
          <span className="text-sm text-faint">
            {hasDescription
              ? "Nothing in the description named a benefit. Write one in the field below."
              : "Paste the description above, or write a benefit in the field below."}
          </span>
        ) : (
          benefits.map((benefit) => (
            <span
              key={benefit}
              className={`pill${manual.includes(benefit) && !detected.includes(benefit) ? " pill-manual" : ""}`}
            >
              {benefit}
              <button
                type="button"
                onClick={() => removeBenefit(benefit)}
                aria-label={`Remove ${benefit}`}
              >
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
              addBenefit(draft);
            }
          }}
          aria-label="Add a benefit by hand"
          placeholder="Missing one? Type it and press Enter"
        />
      </div>
    </div>
  );
}
