"use client";

import { useState, useTransition } from "react";

import { draftFromLink } from "@/server/actions/posting";
import type { PostingDraft } from "@/lib/posting/types";

/**
 * Paste a link, get a draft.
 *
 * The control deliberately stops one step short of the register: it fills the
 * form and says so, and the entry is still created by the person pressing
 * Stamp. Nothing here writes anything.
 */
export function PostingImport({
  onDraft,
  disabled,
}: {
  onDraft: (draft: PostingDraft) => void;
  disabled?: boolean;
}) {
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function read() {
    if (!link.trim() || pending) return;
    setError("");
    startTransition(async () => {
      const result = await draftFromLink(link);
      if (result.ok) {
        onDraft(result.draft);
        setLink("");
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="field col-span-full" suppressHydrationWarning>
      <label className="field-label" htmlFor="posting-link">
        Link to the advert
        <span className="field-hint">optional — fills the fields below for you to check</span>
      </label>

      <div className="flex flex-wrap items-end gap-2.5">
        <input
          id="posting-link"
          type="url"
          inputMode="url"
          data-form-type="other"
          suppressHydrationWarning
          className="field-input min-w-[220px] flex-1"
          autoComplete="off"
          value={link}
          disabled={disabled || pending}
          onChange={(event) => {
            setLink(event.target.value);
            if (error) setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              read();
            }
          }}
          placeholder="e.g. https://job-boards.greenhouse.io/loudly/jobs/4820193"
        />
        <button
          type="button"
          className="btn btn-mark shrink-0"
          onClick={read}
          disabled={disabled || pending || !link.trim()}
          suppressHydrationWarning
        >
          {pending ? "Reading…" : "Read link"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-1.5 font-mono text-[11px] leading-relaxed text-flag">
          {error}
        </p>
      ) : (
        <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-faint">
          Nothing is saved from the link. It only fills the form.
        </p>
      )}
    </div>
  );
}
