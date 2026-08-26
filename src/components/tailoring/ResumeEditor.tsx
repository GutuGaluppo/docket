"use client";

import { useEffect, useState } from "react";

import { hasResumeContent } from "@/lib/resume/text";
import { elementDomId } from "@/lib/resume/target";

import { ResumeDocument } from "./ResumeDocument";
import { ResumeStart } from "./ResumeStart";
import { useTailoring } from "./TailoringProvider";

/**
 * The document, connected to everything else on the screen.
 *
 * The fields themselves live in `ResumeDocument`, which knows nothing about
 * recommendations; what is added here is the part that only makes sense next to
 * the panel: which element a card is pointing at, and the one piece of
 * imperative behaviour in the feature — a click on a recommendation scrolls its
 * field into view and focuses it. Hovering deliberately does neither, because a
 * page that moves under the pointer cannot be read down.
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

  useEffect(() => {
    const request = state.scrollRequest;
    if (!request) return;

    const node = document.getElementById(elementDomId(request.key));
    if (!node) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      node.focus({ preventScroll: true });
    }
  }, [state.scrollRequest]);

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
