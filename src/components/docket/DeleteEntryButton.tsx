"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { removeEntry } from "@/server/actions/entries";

/**
 * Two clicks, four seconds apart at most. No modal: a dialog for deleting one
 * row is heavier than the mistake it prevents.
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
      aria-label={confirming ? `Confirm removal of ${label}` : `Remove ${label}`}
      className={`cursor-pointer border-0 bg-transparent py-1 font-mono text-[11px] tracking-[0.08em] uppercase ${
        confirming ? "text-flag" : "text-muted hover:text-flag"
      }`}
    >
      {pending ? "Removing…" : confirming ? "Confirm" : "Remove"}
    </button>
  );
}
