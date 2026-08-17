"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { cancelInterview } from "@/server/actions/interviews";

/** Two clicks, like removing an entry. Same rule, same four-second window. */
export function CancelInterviewButton({ id, label }: { id: string; label: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <button
      type="button"
      disabled={pending}
      suppressHydrationWarning
      aria-label={confirming ? `Confirm cancelling ${label}` : `Cancel ${label}`}
      onClick={() => {
        if (!confirming) {
          setConfirming(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setConfirming(false), 4000);
          return;
        }
        if (timer.current) clearTimeout(timer.current);
        setConfirming(false);
        startTransition(async () => {
          await cancelInterview({ id });
        });
      }}
      className={`cursor-pointer font-mono text-[10px] tracking-[0.06em] uppercase ${
        confirming ? "text-flag" : "text-muted hover:text-flag"
      }`}
    >
      {pending ? "…" : confirming ? "Sure?" : "Cancel"}
    </button>
  );
}
