"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { fileAsRejected } from "@/server/actions/rejections";

/**
 * Files a refusal from the register.
 *
 * What they said is worth more than a single line can hold. A rejection note is
 * often the whole email — "we went with someone with more Kubernetes" — and it
 * is the one sentence that turns a rejection into something the analytics can
 * learn from, so it gets a dialog with a real text area rather than an input
 * squeezed between two table cells.
 *
 * It is still not a confirmation. Nothing is destroyed here and the archive
 * hands the entry straight back, so the dialog's job is to make the note easy
 * to write, not to ask whether the person meant it.
 */
export function RejectionButton({ id, label }: { id: string; label: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  // The row disappears from an "open" listing the moment this succeeds, which
  // unmounts the dialog mid-close in some browsers. Closing first keeps the
  // top layer tidy either way.
  useEffect(() => () => dialogRef.current?.close(), []);

  function open() {
    setReason("");
    setError("");
    dialogRef.current?.showModal();
  }

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await fileAsRejected({ id, reason });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      dialogRef.current?.close();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        data-tone="file"
        className="row-action"
        aria-haspopup="dialog"
        aria-label={`File ${label} as rejected`}
        suppressHydrationWarning
      >
        <FlagGlyph />
        Rejected
      </button>

      <dialog
        ref={dialogRef}
        className="modal"
        aria-labelledby={`reject-${id}-title`}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        <form
          suppressHydrationWarning
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="modal-head">
            <div className="min-w-0">
              <h2 id={`reject-${id}-title`} className="modal-title">
                File as rejected
              </h2>
              <p className="modal-sub">{label}</p>
            </div>
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={() => dialogRef.current?.close()}
              suppressHydrationWarning
            >
              ×
            </button>
          </div>

          <div className="modal-body">
            <label className="field-label" htmlFor={`reject-${id}-note`}>
              What they said
              <span className="field-hint">
                Optional, and kept verbatim. It is what the archive shows later, and the only place
                the reason for a refusal is ever recorded.
              </span>
            </label>
            <textarea
              id={`reject-${id}-note`}
              autoFocus
              rows={5}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={280}
              placeholder="e.g. They went with someone with more Kubernetes experience."
              className="field-textarea min-h-30"
              suppressHydrationWarning
            />
            <p className="text-right font-mono text-[11px] text-faint">{reason.length} / 280</p>
            <p className="text-xs leading-relaxed text-muted">
              The entry keeps its number and its history. It moves to the archive, and one click
              there reopens it if the answer changes.
            </p>
            {error && (
              <p role="alert" className="font-mono text-xs text-flag">
                {error}
              </p>
            )}
          </div>

          <div className="modal-foot">
            <button
              type="button"
              className="link-quiet"
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
              suppressHydrationWarning
            >
              Cancel
            </button>
            <button type="submit" className="btn" disabled={pending} suppressHydrationWarning>
              {pending ? "Filing…" : "File as rejected"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function FlagGlyph() {
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
      <path d="M3.5 14V2.5h9l-2 3 2 3h-9" />
    </svg>
  );
}
