"use client";

import { useState, useTransition } from "react";

import { fileAsRejected } from "@/server/actions/rejections";

/**
 * Files a refusal from the register.
 *
 * One click opens a single line asking what they said, and that line is
 * optional — the point is that filing a rejection takes as little as possible,
 * because the moment it is done is not a moment anyone wants to spend on a
 * form. What it is not is a two-click confirmation like removal: nothing is
 * destroyed here, and the archive hands the entry straight back.
 */
export function RejectionButton({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await fileAsRejected({ id, reason });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setReason("");
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`File ${label} as rejected`}
        className="cursor-pointer border-0 bg-transparent py-1 font-mono text-[11px] tracking-[0.08em] text-muted uppercase hover:text-stamp"
        suppressHydrationWarning
      >
        Rejected
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-1.5"
      suppressHydrationWarning
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <input
        autoFocus
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={280}
        placeholder="What they said (optional)"
        aria-label={`Why ${label} was rejected`}
        className="min-w-[190px] rounded-[2px] border border-rule bg-sheet px-2 py-1 font-mono text-[11px] focus:border-stamp focus:outline-none"
        suppressHydrationWarning
      />
      <span className="flex items-center gap-3 font-mono text-[11px] tracking-[0.08em] uppercase">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer border-0 bg-transparent text-stamp disabled:opacity-50"
          suppressHydrationWarning
        >
          {pending ? "Filing…" : "File"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setError("");
          }}
          className="cursor-pointer border-0 bg-transparent text-muted hover:text-ink"
          suppressHydrationWarning
        >
          Cancel
        </button>
      </span>
      {error && <span className="font-mono text-[11px] text-flag">{error}</span>}
    </form>
  );
}
