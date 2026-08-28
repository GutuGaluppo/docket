"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { elapsed } from "@/lib/format";
import type { LibraryEntry } from "@/server/db/queries/resumes";
import { selectResume } from "@/server/actions/resume";

import { DeleteResumeDialog, ResumeNameDialog, UnsavedSwitchDialog } from "./ResumeDialogs";
import { useTailoring } from "./TailoringProvider";

/**
 * Every CV this account holds, and the four things that can be done with one.
 *
 * A dialog rather than a column beside the editor, for the reason the dossier
 * is one: the library is consulted, not worked in. Somebody opens it to answer
 * "which CV am I sending to this job", chooses, and is back where they were.
 *
 * Two rules the interface keeps and the copy states. Switching documents is
 * never silent — unsaved edits are named before they can be lost, and nothing
 * chooses a document on somebody's behalf. And deleting is permanent, said in
 * those words, with what goes with it spelled out before the button that does
 * it.
 */

const SOURCE_LABELS: Record<LibraryEntry["source"], string> = {
  pdf: "Imported from a PDF",
  manual: "Written here",
  duplicate: "Copied from another CV",
};

type Pending =
  | { kind: "rename"; entry: LibraryEntry }
  | { kind: "duplicate"; entry: LibraryEntry }
  | { kind: "delete"; entry: LibraryEntry }
  | { kind: "switch"; entry: LibraryEntry }
  | null;

export function ResumeLibrary({
  library,
  open,
  onClose,
  onAdd,
}: {
  library: readonly LibraryEntry[];
  open: boolean;
  onClose: () => void;
  onAdd: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<Pending>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // `showModal` brings the focus trap and the Escape key with it, which is
    // most of what an accessible dialog needs and all of it done by the browser.
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cv-library-heading"
      onClose={() => {
        setPending(null);
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      className="cv-dialog"
    >
      <div className="cv-dialog-body">
        <header className="cv-dialog-head">
          <h2 id="cv-library-heading" className="text-xl font-bold tracking-[-0.02em]">
            Your CVs
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="cv-dialog-close"
            suppressHydrationWarning
          >
            ×
          </button>
        </header>

        {library.length === 0 ? (
          <p className="cv-empty">
            You don&rsquo;t have any saved CVs yet. Add one to start comparing it with jobs.
          </p>
        ) : (
          <ul className="cv-library">
            {library.map((entry) => (
              <ResumeLibraryItem key={entry.id} entry={entry} onAct={setPending} />
            ))}
          </ul>
        )}

        <footer className="cv-dialog-foot">
          <button
            type="button"
            className="btn"
            onClick={() => {
              dialogRef.current?.close();
              onAdd();
            }}
            suppressHydrationWarning
          >
            Add a CV
          </button>
        </footer>
      </div>

      {pending?.kind === "delete" && (
        <DeleteResumeDialog entry={pending.entry} onDone={() => setPending(null)} />
      )}
      {pending?.kind === "rename" && (
        <ResumeNameDialog mode="rename" entry={pending.entry} onDone={() => setPending(null)} />
      )}
      {pending?.kind === "duplicate" && (
        <ResumeNameDialog mode="duplicate" entry={pending.entry} onDone={() => setPending(null)} />
      )}
      {pending?.kind === "switch" && (
        <UnsavedSwitchDialog entry={pending.entry} onDone={() => setPending(null)} />
      )}
    </dialog>
  );
}

/* -------------------------------------------------------------------------- */

function ResumeLibraryItem({
  entry,
  onAct,
}: {
  entry: LibraryEntry;
  onAct: (pending: Pending) => void;
}) {
  const router = useRouter();
  const { unsaved } = useTailoring();
  const [busy, startTransition] = useTransition();

  const use = () => {
    if (entry.active) return;
    // Section 43: edits that have not reached the server yet are named before
    // anything can happen to them.
    if (unsaved) {
      onAct({ kind: "switch", entry });
      return;
    }
    startTransition(async () => {
      const result = await selectResume({ id: entry.id });
      if (result.ok) router.refresh();
    });
  };

  return (
    <li className="cv-library-item" data-active={entry.active ? "true" : undefined}>
      <div className="cv-library-main">
        <h3 className="cv-library-name">
          {entry.title}
          {entry.active && (
            <span className="cv-library-active">
              <span aria-hidden="true">✓</span> In the editor
            </span>
          )}
        </h3>

        <p className="cv-library-meta">
          {SOURCE_LABELS[entry.source]}
          {entry.originalFileName && entry.source === "pdf" && (
            <>
              {" · "}
              <span className="cv-file-name">{entry.originalFileName}</span>
            </>
          )}
        </p>

        <p className="cv-library-meta">
          Edited {elapsed(entry.updatedAt)}
          {entry.latest && (
            <>
              {" · Last read against "}
              {entry.latest.company
                ? `${entry.latest.position ?? "a role"} at ${entry.latest.company}`
                : "a pasted advert"}
              {entry.latest.score !== null && ` · ${entry.latest.score}%`}
            </>
          )}
        </p>

        {entry.comparisons > 0 && (
          <p className="cv-library-meta">
            {entry.comparisons === 1 ? "1 comparison" : `${entry.comparisons} comparisons`} saved
          </p>
        )}
      </div>

      <div className="cv-library-actions">
        <button
          type="button"
          className="btn btn-quiet"
          disabled={busy || entry.active}
          onClick={use}
          suppressHydrationWarning
        >
          {entry.active ? "In use" : busy ? "Opening…" : "Use CV"}
        </button>
        <ResumeActionsMenu entry={entry} onAct={onAct} />
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */

function ResumeActionsMenu({
  entry,
  onAct,
}: {
  entry: LibraryEntry;
  onAct: (pending: Pending) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div className="cv-menu" ref={wrapper}>
      <button
        type="button"
        className="cv-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`More actions for ${entry.title}`}
        onClick={() => setOpen((value) => !value)}
        suppressHydrationWarning
      >
        •••
      </button>

      {open && (
        <div className="cv-menu-list" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onAct({ kind: "rename", entry });
            }}
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onAct({ kind: "duplicate", entry });
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            className="cv-menu-danger"
            onClick={() => {
              setOpen(false);
              onAct({ kind: "delete", entry });
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
