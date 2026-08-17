"use client";

import { useState, useTransition } from "react";

import { FOLLOW_UP_CHOICES, followUpLabel } from "@/lib/validation/settings";
import { updateFollowUps } from "@/server/actions/settings";

export function FollowUpSettings({ current }: { current: number | null }) {
  const [days, setDays] = useState(current ?? 0);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="mt-4 flex flex-wrap items-end gap-3" suppressHydrationWarning>
      <div className="field" suppressHydrationWarning>
        <label className="field-label" htmlFor="followUpDays">
          Nudge me
        </label>
        <select
          id="followUpDays"
          value={days}
          disabled={pending}
          suppressHydrationWarning
          onChange={(event) => {
            const next = Number(event.target.value);
            setDays(next);
            setError("");
            setNotice("");
            startTransition(async () => {
              const result = await updateFollowUps({ days: next });
              if (result.ok) setNotice(result.message);
              else setError(result.error);
            });
          }}
          className="field-input cursor-pointer"
        >
          {FOLLOW_UP_CHOICES.map((choice) => (
            <option key={choice} value={choice}>
              {followUpLabel(choice)}
            </option>
          ))}
        </select>
      </div>
      <span className="pb-2 font-mono text-xs" aria-live="polite">
        {error ? (
          <span className="text-flag">{error}</span>
        ) : (
          <span className="text-muted">{notice || "Saved as you change it."}</span>
        )}
      </span>
    </div>
  );
}
