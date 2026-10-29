"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { elementDomId, resolveTarget, toTarget } from "@/lib/resume/target";
import type { AdvertSource } from "@/server/db/queries/applications";
import type { LibraryEntry } from "@/server/db/queries/resumes";

import { AnalysisProgress } from "./AnalysisProgress";
import { JobMatchPanel } from "./JobMatchPanel";
import { JobSourcePanel } from "./JobSourcePanel";
import { KeywordPanel, RequirementPanel, useKeywords } from "./KeywordPanel";
import { ResumeEditor } from "./ResumeEditor";
import { ResumeLibrary } from "./ResumeLibrary";
import { ResumePreview, type PreviewDiff } from "./ResumePreview";
import { ResumeStart } from "./ResumeStart";
import { SuggestionPanel } from "./SuggestionPanel";
import { TailoringProvider, useTailoring, type TailoringInitialData } from "./TailoringProvider";
import type { ImportPayload } from "./ResumePdfUpload";

/**
 * The screen, and the three things it can be showing.
 *
 * An account with no CV sees the ways of adding one. An account adding another
 * sees the same screen with a way back. Everything else is the tailoring
 * workspace: the recommendations on the left, the document in the middle, and
 * on the right what the advert asks for and how much of it the document
 * answers. Working a CV against an advert is a loop between those three — read
 * what is missing, see where it would go, accept or write it — and each step of
 * the loop is on screen at once rather than behind a tab.
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

const SAVE_LABELS = {
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved changes",
  failed: "Not saved — retrying on the next edit",
} as const;

function Workspace({
  library,
  sources,
  onAdd,
}: {
  library: readonly LibraryEntry[];
  sources: AdvertSource[];
  onAdd: () => void;
}) {
  const { state, saveState, runAnalysis } = useTailoring();
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

  const hasAdvert =
    Boolean(state.applicationId) || state.jobDescription.trim().length >= 120;
  const analyzing = state.status === "analyzing";

  // The advert dialog hands over to the progress dialog rather than sitting
  // under it: once a reading starts, the form has done its job.
  useEffect(() => {
    if (analyzing) advertRef.current?.close();
  }, [analyzing]);

  const tailor = () => {
    if (!hasAdvert) advertRef.current?.showModal();
    else runAnalysis();
  };

  return (
    <>
      <div className="tl-bar">
        <div className="tl-bar-name">
          <span className="tl-bar-title">{title}</span>
          <span className="tl-bar-save" data-state={saveState} aria-live="polite">
            {SAVE_LABELS[saveState]}
          </span>
        </div>

        <button
          type="button"
          className="tl-advert"
          aria-haspopup="dialog"
          onClick={() => advertRef.current?.showModal()}
          suppressHydrationWarning
        >
          <span className="tl-advert-label">Tailoring for</span>
          <span className="tl-advert-job">{hasAdvert ? jobLabel : "Choose an advert…"}</span>
        </button>

        <div className="tl-bar-actions">
          <button
            type="button"
            className="btn btn-quiet"
            aria-haspopup="dialog"
            onClick={() => setLibraryOpen(true)}
            suppressHydrationWarning
          >
            Your CVs ({library.length})
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => window.print()}
            suppressHydrationWarning
          >
            Download PDF
          </button>
          <button
            type="button"
            className="btn"
            disabled={analyzing}
            onClick={tailor}
            suppressHydrationWarning
          >
            <span aria-hidden="true">✦</span>{" "}
            {analyzing ? "Tailoring…" : state.analysis ? "Tailor again" : "Tailor to this job"}
          </button>
        </div>
      </div>

      {/*
        A CV that has answered other adverts is a CV other applications are
        relying on, and applying a recommendation here changes it for all of
        them. Said at the moment it becomes true, rather than after somebody has
        tailored a document they meant to keep general.
      */}
      {active && active.comparisons > 1 && (
        <p className="tl-warning">
          This CV has been read against {active.comparisons} adverts. Changes you accept here change
          it for all of them — duplicate it first from <b>Your CVs</b> to keep this one as it is.
        </p>
      )}

      <div className="tl-layout">
        <aside className="tl-rail tl-rail-left" aria-label="Suggestions">
          <SuggestionPanel />
        </aside>

        <DocumentPane />

        <aside className="tl-rail tl-rail-right" aria-label="How the CV matches the advert">
          <JobMatchPanel jobLabel={hasAdvert ? jobLabel : undefined} />
          <KeywordPanel />
          <RequirementPanel />
        </aside>
      </div>

      <PrintCopy />

      <dialog
        ref={advertRef}
        className="modal"
        aria-label="The advert to tailor this CV to"
        onClick={(event) => {
          if (event.target === event.currentTarget) advertRef.current?.close();
        }}
      >
        <div className="modal-head">
          <div className="min-w-0">
            <h2 className="modal-title">The advert</h2>
            <p className="modal-sub">One CV, tailored to one job description.</p>
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

/**
 * What Download PDF prints: the document alone, typeset, with no marks.
 *
 * Mounted straight under `<body>` so the print stylesheet can hide every other
 * child of the body outright. Hiding the app shell around a nested copy would
 * leave its height behind, and the browser would print it as blank pages.
 */
function PrintCopy() {
  const { state } = useTailoring();
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => setHost(document.body), []);
  if (!host) return null;

  return createPortal(
    <div className="tl-print" aria-hidden="true">
      <ResumePreview resume={state.resume} plain />
    </div>,
    host,
  );
}

/* -------------------------------------------------------------------------- */

type View = "edit" | "preview";

/**
 * The document, in the two forms it is worked in.
 *
 * Edit is the fields. Preview is the page as a reader will see it, with the
 * advert's terms marked and the recommendation under the pointer drawn into
 * the sentence it would change. A click on any line of the preview opens that
 * line in the editor, so the two are one document seen twice rather than two
 * places to keep in step.
 */
function DocumentPane() {
  const { state, focusElement } = useTailoring();
  const { terms } = useKeywords();
  const [view, setView] = useState<View>("edit");

  /**
   * One scroll per request. The nonce is what tells a new request from the one
   * already served when the view changes and the effect runs again.
   */
  const served = useRef(0);

  useEffect(() => {
    const request = state.scrollRequest;
    if (!request || request.nonce === served.current) return;

    const id =
      view === "preview" ? `preview-${elementDomId(request.key)}` : elementDomId(request.key);
    const node = document.getElementById(id);
    if (!node) return;
    served.current = request.nonce;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      node.focus({ preventScroll: true });
    }
  }, [state.scrollRequest, view]);

  // The recommendation being looked at, drawn in place on the preview.
  const diff = useMemo<PreviewDiff | null>(() => {
    const id = state.hoveredSuggestionId ?? state.activeSuggestionId;
    const suggestion = state.suggestions.find((candidate) => candidate.id === id);
    if (!suggestion?.suggestedText || suggestion.status !== "pending") return null;

    const target = toTarget(suggestion);
    const element = target ? resolveTarget(state.resume, target) : null;
    if (!element) return null;
    return { key: element.key, current: element.text, suggested: suggestion.suggestedText };
  }, [state.hoveredSuggestionId, state.activeSuggestionId, state.suggestions, state.resume]);

  return (
    <main className="tl-doc" aria-label="Your CV">
      <div className="tl-doc-tabs" role="tablist" aria-label="How to show the CV">
        {(["edit", "preview"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={view === option}
            onClick={() => setView(option)}
            suppressHydrationWarning
          >
            {option === "edit" ? "Edit" : "Preview"}
          </button>
        ))}
        {view === "preview" && terms.length > 0 && (
          <span className="tl-doc-legend">
            <mark className="cvp-kw">term</mark> in the advert
          </span>
        )}
      </div>

      <div className="cv-sheet-wrap">
        <div className="cv-sheet" data-view={view}>
          {view === "edit" ? (
            <ResumeEditor />
          ) : (
            <ResumePreview
              resume={state.resume}
              terms={terms}
              highlightedKey={state.highlightedElementKey}
              selectedKey={state.selectedElementKey}
              diff={diff}
              onEdit={(key) => {
                setView("edit");
                focusElement(key);
              }}
            />
          )}
        </div>
      </div>
    </main>
  );
}
