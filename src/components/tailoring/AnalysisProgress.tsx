"use client";

import { useEffect, useRef } from "react";

import { matchLabel } from "@/lib/tailoring/score";

import { AnalysisStepList } from "./AnalysisStepList";
import { useTailoring } from "./TailoringProvider";

/**
 * What is happening while a reading runs, and what happened when it stops.
 *
 * Modal, because everything on the page behind it is about to be replaced: the
 * figure, the recommendations and the state of every card are all answers to
 * the question being asked, and editing the document mid-reading would produce
 * a result about a version that no longer exists.
 *
 * The checklist is fed by the stream — each line the server writes as it
 * reaches a stage — so it reports where the work is rather than how long it has
 * been going. It is deliberately five steps and not seven: keyword coverage,
 * role alignment and the weighted figure are one computation over one set of
 * data, and three ticks for one event would be an animation dressed as
 * telemetry.
 *
 * It stays open when the reading finishes. Closing the moment the answer lands
 * would mean the only signal that anything happened is a number quietly
 * changing behind a dialog that has already gone.
 */
export function AnalysisProgress({
  resumeTitle,
  jobLabel,
}: {
  resumeTitle: string;
  jobLabel: string;
}) {
  const { state, cancelAnalysis, runAnalysis } = useTailoring();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  const running = state.status === "analyzing";
  const failed = state.status === "error";
  // Finished, and this dialog is the thing that says so.
  const finished = state.steps.every((step) => step.status === "completed");
  const open = running || failed || (state.status === "ready" && finished);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (state.status === "ready" && finished) doneRef.current?.focus();
  }, [state.status, finished]);

  const close = () => dialogRef.current?.close();
  const score = state.jobMatch?.overallScore ?? null;
  const pending = state.suggestions.filter((suggestion) => suggestion.status === "pending").length;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cv-progress-heading"
      className="cv-dialog"
      onCancel={(event) => {
        // Escape during a reading means stop, not hide: a dialog that vanishes
        // while the work continues is the dishonest version of Cancel.
        if (running) {
          event.preventDefault();
          cancelAnalysis();
        }
      }}
      onClose={() => {
        if (running) cancelAnalysis();
      }}
    >
      <div className="cv-dialog-body">
        <h2 id="cv-progress-heading" className="text-lg font-bold tracking-[-0.02em]">
          {running && "Analyzing your CV"}
          {failed && "The analysis couldn't be completed"}
          {!running && !failed && "Analysis complete"}
        </h2>

        <p className="text-sm text-muted">
          Comparing <span className="cv-library-name">{resumeTitle}</span> with{" "}
          <span className="cv-library-name">{jobLabel}</span>.
        </p>

        <div aria-live="polite">
          <AnalysisStepList steps={state.steps} />
        </div>

        {failed && (
          <p className="cv-confirm">
            {state.error} Your CV and the job description are exactly as they were.
            {state.analysis && " The result you had before is still on screen."}
          </p>
        )}

        {!running && !failed && score !== null && (
          <p className="cv-progress-result">
            <b>{score}%</b> <span className="text-muted">{matchLabel(score)}</span>
            <span className="cv-progress-count">
              {pending === 1 ? "1 recommendation" : `${pending} recommendations`}
            </span>
          </p>
        )}

        <div className="cv-dialog-actions">
          {running && (
            <button
              type="button"
              className="link-quiet"
              onClick={cancelAnalysis}
              suppressHydrationWarning
            >
              Cancel analysis
            </button>
          )}

          {failed && (
            <>
              <button type="button" className="link-quiet" onClick={close} suppressHydrationWarning>
                Close
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => runAnalysis()}
                suppressHydrationWarning
              >
                Try again
              </button>
            </>
          )}

          {!running && !failed && (
            <button
              ref={doneRef}
              type="button"
              className="btn"
              onClick={close}
              suppressHydrationWarning
            >
              View results
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
