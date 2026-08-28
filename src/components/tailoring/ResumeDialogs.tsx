"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { LibraryEntry } from "@/server/db/queries/resumes";
import {
  deleteResumeDocument,
  duplicateResumeDocument,
  renameResumeDocument,
  selectResume,
} from "@/server/actions/resume";

import { useTailoring } from "./TailoringProvider";

/**
 * The three questions the library has to ask before it does something.
 *
 * All of them are modal on purpose. Renaming, copying and deleting are
 * decisions with consequences that outlive the click, and a control that acts
 * on the first press is the wrong shape for any of them — section 13 is
 * explicit that nothing is deleted on one click.
 */

function useDialog(onDone: () => void) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return { ref, close: () => ref.current?.close(), onClose: onDone };
}

/* -------------------------------------------------------------------------- */

/**
 * Deleting, with what goes with it named first.
 *
 * The count of saved comparisons is on screen because it is the part somebody
 * is most likely not to have thought about: the readings belong to this
 * document and go when it goes. What is shared with the rest of the product —
 * the entries in the register those readings pointed at — stays, and the
 * sentence says so rather than leaving it to be discovered.
 */
export function DeleteResumeDialog({ entry, onDone }: { entry: LibraryEntry; onDone: () => void }) {
  const router = useRouter();
  const { ref, close, onClose } = useDialog(onDone);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  const remove = () => {
    setError("");
    startTransition(async () => {
      const result = await deleteResumeDocument({ id: entry.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
      router.refresh();
    });
  };

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="cv-delete-heading" className="cv-dialog">
      <div className="cv-dialog-body">
        <h2 id="cv-delete-heading" className="text-lg font-bold tracking-[-0.02em]">
          Delete this CV?
        </h2>

        <p className="text-sm text-muted">
          <span className="cv-library-name">{entry.title}</span> will be permanently deleted, along
          with the file it was imported from
          {entry.comparisons > 0 && (
            <>
              {" and its "}
              {entry.comparisons === 1
                ? "one saved comparison"
                : `${entry.comparisons} saved comparisons`}
            </>
          )}
          . The entries in your docket are not affected. This cannot be undone.
        </p>

        {entry.active && (
          <p className="cv-confirm">
            This is the CV currently in the editor. Deleting it leaves the editor empty rather than
            opening a different one.
          </p>
        )}

        {error && <p className="font-mono text-xs text-flag">{error}</p>}

        <div className="cv-dialog-actions">
          <button type="button" className="link-quiet" onClick={close} suppressHydrationWarning>
            Cancel
          </button>
          <button
            type="button"
            className="btn cv-danger"
            disabled={busy}
            onClick={remove}
            suppressHydrationWarning
          >
            {busy ? "Deleting…" : "Delete CV"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/* -------------------------------------------------------------------------- */

/** Naming one, whether it already exists or is about to. */
export function ResumeNameDialog({
  mode,
  entry,
  onDone,
}: {
  mode: "rename" | "duplicate";
  entry: LibraryEntry;
  onDone: () => void;
}) {
  const router = useRouter();
  const { ref, close, onClose } = useDialog(onDone);
  const [title, setTitle] = useState(mode === "rename" ? entry.title : `${entry.title} copy`);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  const submit = () => {
    setError("");
    startTransition(async () => {
      const result =
        mode === "rename"
          ? await renameResumeDocument({ id: entry.id, title })
          : await duplicateResumeDocument({ id: entry.id, title, activate: true });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
      router.refresh();
    });
  };

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="cv-name-heading" className="cv-dialog">
      <div className="cv-dialog-body">
        <h2 id="cv-name-heading" className="text-lg font-bold tracking-[-0.02em]">
          {mode === "rename" ? "Rename this CV" : "Duplicate this CV"}
        </h2>

        <p className="text-sm text-muted">
          {mode === "rename"
            ? "The name is for you — it is never sent anywhere."
            : "A copy that shares nothing with the original: editing one leaves the other exactly as it is."}
        </p>

        <div className="field">
          <label className="field-label" htmlFor="cv-name">
            Name
          </label>
          <input
            id="cv-name"
            className="field-input"
            value={title}
            autoFocus
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && title.trim()) submit();
            }}
          />
        </div>

        {error && <p className="font-mono text-xs text-flag">{error}</p>}

        <div className="cv-dialog-actions">
          <button type="button" className="link-quiet" onClick={close} suppressHydrationWarning>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy || !title.trim()}
            onClick={submit}
            suppressHydrationWarning
          >
            {mode === "rename" ? "Save the name" : "Create the copy"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Switching away from a document with edits that have not reached the server.
 *
 * The editor saves on a debounce, so there is a second or two in which what is
 * on screen is not what is stored. Leaving in that second is a legitimate thing
 * to want to do and a terrible thing to do silently, so all three answers are
 * offered and none of them is chosen by default.
 */
export function UnsavedSwitchDialog({
  entry,
  onDone,
}: {
  entry: LibraryEntry;
  onDone: () => void;
}) {
  const router = useRouter();
  const { ref, close, onClose } = useDialog(onDone);
  const { saveNow, discardUnsaved } = useTailoring();
  const [busy, startTransition] = useTransition();

  const switchTo = (save: boolean) => {
    startTransition(async () => {
      if (save) await saveNow();
      else discardUnsaved();

      const result = await selectResume({ id: entry.id });
      close();
      if (result.ok) router.refresh();
    });
  };

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="cv-unsaved-heading" className="cv-dialog">
      <div className="cv-dialog-body">
        <h2 id="cv-unsaved-heading" className="text-lg font-bold tracking-[-0.02em]">
          You have unsaved changes
        </h2>

        <p className="text-sm text-muted">
          The CV in the editor has edits that have not been saved yet. Opening{" "}
          <span className="cv-library-name">{entry.title}</span> now would leave them behind.
        </p>

        <div className="cv-dialog-actions">
          <button type="button" className="link-quiet" onClick={close} suppressHydrationWarning>
            Stay here
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            disabled={busy}
            onClick={() => switchTo(false)}
            suppressHydrationWarning
          >
            Switch without saving
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => switchTo(true)}
            suppressHydrationWarning
          >
            Save and switch
          </button>
        </div>
      </div>
    </dialog>
  );
}
