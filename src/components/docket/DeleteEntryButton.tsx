"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { removeEntry } from "@/server/actions/entries";

/**
 * Two clicks, four seconds apart at most. No dialog: a modal for deleting one
 * row is heavier than the mistake it prevents, and the second click is close
 * enough to the first that nobody has to go looking for it.
 *
 * What changed is only how loud it is. It used to be the faintest grey in the
 * palette next to two other faint greys, which made the three things a person
 * most often wants to do the three hardest things to find.
 */
export function DeleteEntryButton({ id, label }: { id: string; label: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function onClick() {
    if (!confirming) {
      setConfirming(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setConfirming(false), 4000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setConfirming(false);
    startTransition(async () => {
      await removeEntry({ id });
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      data-tone="danger"
      data-armed={confirming ? "true" : undefined}
      aria-label={confirming ? `Confirm removal of ${label}` : `Remove ${label}`}
      className="row-action"
      suppressHydrationWarning
    >
      <BinGlyph />
      {pending ? "Removing…" : confirming ? "Confirm" : "Remove"}
    </button>
  );
}

function BinGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M2.75 4.25h10.5M6.5 4.25V2.75h3v1.5M4.25 4.25l.6 8.5h6.3l.6-8.5" />
    </svg>
  );
}
