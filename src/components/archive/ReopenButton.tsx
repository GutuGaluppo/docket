"use client";

import { useState, useTransition } from "react";

import { reopenEntry } from "@/server/actions/rejections";

/**
 * Takes an entry back out of the archive, in one click.
 *
 * Nothing here needs confirming. Filing was reversible by design, and a company
 * that comes back after a no — or a refusal filed on the wrong row — is common
 * enough that the way back should cost exactly one click.
 */
export function ReopenButton({ id, label }: { id: string; label: string }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        aria-label={`Reopen ${label}`}
        onClick={() => {
          setError("");
          startTransition(async () => {
            const result = await reopenEntry({ id });
            if (!result.ok) setError(result.error);
          });
        }}
        className="cursor-pointer border-0 bg-transparent py-1 font-mono text-[11px] tracking-[0.08em] text-muted uppercase hover:text-stamp disabled:opacity-50"
        suppressHydrationWarning
      >
        {pending ? "Reopening…" : "Reopen"}
      </button>
      {error && <span className="font-mono text-[11px] text-flag">{error}</span>}
    </span>
  );
}
