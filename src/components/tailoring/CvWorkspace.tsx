"use client";

import { useRef, useState } from "react";

import type { AdvertSource } from "@/server/db/queries/applications";
import type { LibraryEntry } from "@/server/db/queries/resumes";

import { AnalysisProgress } from "./AnalysisProgress";
import { JobMatchPanel } from "./JobMatchPanel";
import { JobSourcePanel } from "./JobSourcePanel";
import { ResumeEditor } from "./ResumeEditor";
import { ResumeLibrary } from "./ResumeLibrary";
import { ResumeStart } from "./ResumeStart";
import { SuggestionPanel } from "./SuggestionPanel";
import { TailoringProvider, useTailoring, type TailoringInitialData } from "./TailoringProvider";
import type { ImportPayload } from "./ResumePdfUpload";

/**
 * The screen, and the three things it can be showing.
 *
 * An account with no CV sees the ways of adding one. An account adding another
 * sees the same screen with a way back. Everything else is the workspace.
 *
 * The workspace used to be four panels of equal weight — a figure, an advert
 * form, the document and the recommendations — and the document, which is the
 * only thing being made here, was one quarter of the screen. It is now the
 * screen: an A4 sheet in the middle, the recommendations beside it, and
 * everything that is *about* the document rather than *in* it moved into a strip
 * above it or behind a button.
 */
export function CvWorkspace({
  data,
  library,
  sources,
  pendingImport,
}: {
  data: TailoringInitialData | null;
  library: readonly LibraryEntry[];
  sources: AdvertSource[];
  pendingImport: ImportPayload | null;
}) {
  const [adding, setAdding] = useState(false);

  if (!data) return <ResumeStart pending={pendingImport} />;
  if (adding) return <ResumeStart pending={pendingImport} onCancel={() => setAdding(false)} />;

  return (
    <TailoringProvider data={data}>
      <Workspace library={library} sources={sources} onAdd={() => setAdding(true)} />
    </TailoringProvider>
  );
}

function Workspace({
  library,
  sources,
  onAdd,
}: {
  library: readonly LibraryEntry[];
  sources: AdvertSource[];
  onAdd: () => void;
}) {
  const { state, unsaved } = useTailoring();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const advertRef = useRef<HTMLDialogElement>(null);

  const active = library.find((entry) => entry.active) ?? library[0];
  const title = active?.title ?? "Your CV";

  const entry = sources.find((source) => source.id === state.applicationId);
  const jobLabel = entry
    ? `${entry.position} at ${entry.company}`
    : state.jobDescription.trim()
      ? "the advert you pasted"
      : "a job description";

  const hasAdvert = Boolean(state.applicationId) || state.jobDescription.trim().length > 0;

  return (
    <>
      <div className="mt-6 flex flex-col gap-5">
        <div className="cv-strip">
          <div className="cv-strip-name">
            <span className="cv-strip-note">In the editor</span>
            <span className="cv-strip-title">{title}</span>
          </div>

          {unsaved && <span className="cv-strip-note cv-strip-unsaved">Unsaved changes</span>}

          <button
            type="button"
            className="btn btn-quiet"
            aria-haspopup="dialog"
            onClick={() => advertRef.current?.showModal()}
            suppressHydrationWarning
          >
            {hasAdvert ? `Advert · ${jobLabel}` : "Choose an advert"}
          </button>

          <button
            type="button"
            className="btn btn-quiet"
            aria-haspopup="dialog"
            onClick={() => setLibraryOpen(true)}
            suppressHydrationWarning
          >
            Your CVs ({library.length})
          </button>
        </div>

        {/*
          Section 10: a CV that has answered other adverts is a CV other
          applications are relying on, and applying a recommendation here
          changes it for all of them. Said at the moment it becomes true, rather
          than after somebody has tailored a document they meant to keep general.
        */}
        {active && active.comparisons > 1 && (
          <p className="rounded-lg border border-mark-edge bg-mark-wash px-4 py-2.5 text-xs leading-relaxed text-ink">
            This CV has been read against {active.comparisons} adverts. Changes you apply here
            change it for all of them — duplicate it first to keep this one as it is.
          </p>
        )}

        <div className="cv-page">
          <div className="cv-sheet-wrap">
            <main className="cv-sheet" aria-label="Your CV">
              <ResumeEditor />
            </main>
          </div>

          <aside className="cv-panel">
            <JobMatchPanel />
            <SuggestionPanel />
          </aside>
        </div>
      </div>

      {/*
        The advert, behind a button rather than beside the document.

        It is a form somebody fills in once per role and then never looks at
        again, and it was taking a quarter of the screen from the thing they are
        actually editing. Nothing about it changed except where it lives.
      */}
      <dialog
        ref={advertRef}
        className="modal"
        aria-label="The advert to read this CV against"
        onClick={(event) => {
          if (event.target === event.currentTarget) advertRef.current?.close();
        }}
      >
        <div className="modal-head">
          <div className="min-w-0">
            <h2 className="modal-title">The advert</h2>
            <p className="modal-sub">One CV, read against one job description.</p>
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label="Close"
            onClick={() => advertRef.current?.close()}
            suppressHydrationWarning
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          <JobSourcePanel sources={sources} />
        </div>
      </dialog>

      <ResumeLibrary
        library={library}
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onAdd={onAdd}
      />

      <AnalysisProgress resumeTitle={title} jobLabel={jobLabel} />
    </>
  );
}
