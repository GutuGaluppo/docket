"use client";

import { useState } from "react";

import { hasResumeContent } from "@/lib/resume/text";

import { ResumeDocument } from "./ResumeDocument";
import { ResumeStart } from "./ResumeStart";
import { useTailoring } from "./TailoringProvider";

/**
 * The document as fields, connected to everything else on the screen.
 *
 * The fields themselves live in `ResumeDocument`, which knows nothing about
 * recommendations; what is added here is which element a card is pointing at.
 * Scrolling to it is the document pane's job, because the same request has to
 * land on the preview when that is the view on screen.
 */
export function ResumeEditor() {
  const { state, editResume, resumeId } = useTailoring();
  const { resume } = state;

  /**
   * The way back out of an empty document.
   *
   * "Start an empty one instead" is a decision made before seeing what it leads
   * to, and the opening screen never comes back on its own once a document
   * exists. So while there is still nothing in the document, the import screen
   * stays one click away — and it disappears the moment the document holds
   * something, because by then it would be an offer to overwrite somebody's
   * writing.
   */
  const [pasting, setPasting] = useState(false);
  const empty = !hasResumeContent(resume);

  if (pasting && empty) {
    return <ResumeStart mode="replace" resumeId={resumeId} onCancel={() => setPasting(false)} />;
  }

  return (
    <>
      {empty && (
        <p className="cv-restart">
          This document is empty. Fill it in below, or{" "}
          <button
            type="button"
            className="link-quiet"
            onClick={() => setPasting(true)}
            suppressHydrationWarning
          >
            bring in the CV you already have
          </button>{" "}
          — nothing here would be lost.
        </p>
      )}

      <ResumeDocument
        resume={resume}
        onChange={editResume}
        highlightedKey={state.highlightedElementKey}
        selectedKey={state.selectedElementKey}
      />
    </>
  );
}
