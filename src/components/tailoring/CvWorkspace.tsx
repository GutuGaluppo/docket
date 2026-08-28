"use client";

import { useState } from "react";

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
 * sees the same screen with a way back. Everything else is the workspace: the
 * document, the advert, the figure and the panel, with the library one button
 * away and the progress dialog over the top while a reading runs.
 *
 * It is a client component because the choice between those three is a choice
 * somebody makes with a button. Everything inside it that can stay on the
 * server does — the page fetches, this arranges.
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

  const active = library.find((entry) => entry.active) ?? library[0];
  const title = active?.title ?? "Your CV";

  const entry = sources.find((source) => source.id === state.applicationId);
  const jobLabel = entry
    ? `${entry.position} at ${entry.company}`
    : state.jobDescription.trim()
      ? "the advert you pasted"
      : "a job description";

  return (
    <>
      <div className="cv-layout">
        <div className="cv-head">
          <JobMatchPanel />
          <JobSourcePanel sources={sources} />
        </div>

        <div className="cv-bar">
          <p className="cv-bar-name">
            <span className="eyebrow text-faint">In the editor</span>
            <span className="cv-library-name">{title}</span>
            {unsaved && <span className="cv-bar-unsaved">Unsaved changes</span>}
          </p>

          <div className="cv-bar-actions">
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
            changes it for all of them. Said at the moment it becomes true,
            rather than after somebody has tailored a document they meant to
            keep general.
          */}
          {active && active.comparisons > 1 && (
            <p className="cv-bar-note">
              This CV has been read against {active.comparisons} adverts. Changes you apply here
              change it for all of them — duplicate it first to keep this one as it is.
            </p>
          )}
        </div>

        <main className="cv-main" aria-label="Your CV">
          <ResumeEditor />
        </main>

        <SuggestionPanel />
      </div>

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
