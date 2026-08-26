"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { Resume } from "@/lib/resume/schema";
import type { ResumeImportResult } from "@/lib/resume/import";
import { confirmResumeImport, discardResumeImport } from "@/server/actions/resume";

import { ResumeDocument } from "./ResumeDocument";

/**
 * What was read, before it becomes the CV.
 *
 * The review exists because importing is a reading, and a reading can be wrong
 * in ways only the person who wrote the document can see: a date that belonged
 * to the role above it, a sidebar heading that became a job title. Catching
 * that here costs one screen; catching it after the Job Match has been computed
 * costs the person's confidence in the whole feature.
 *
 * It is editable with the same components the editor uses, so a correction made
 * here is made with the same control, and it is the corrected document that is
 * confirmed — not the one the reading produced.
 */
export function ResumeImportReview({
  importId,
  fileName,
  pageCount,
  result,
  onDiscarded,
}: {
  importId: string;
  fileName: string;
  pageCount: number;
  result: ResumeImportResult;
  onDiscarded: () => void;
}) {
  const router = useRouter();
  const [resume, setResume] = useState<Resume>(result.resume);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const counts: Array<{ label: string; total: number }> = [
    { label: "Personal information", total: resume.personal.fullName ? 1 : 0 },
    { label: "Summary", total: resume.summary.text.trim() ? 1 : 0 },
    { label: "Experience", total: resume.experience.length },
    { label: "Education", total: resume.education.length },
    { label: "Skills", total: resume.skills.reduce((sum, group) => sum + group.skills.length, 0) },
    { label: "Languages", total: resume.languages.length },
    { label: "Certifications", total: resume.certifications.length },
    { label: "Projects", total: resume.projects.length },
  ];

  const confirm = () => {
    setError("");
    startTransition(async () => {
      const answer = await confirmResumeImport({ importId, resume });
      if (answer.ok) router.refresh();
      else setError(answer.error);
    });
  };

  const discard = () => {
    setError("");
    startTransition(async () => {
      await discardResumeImport({ importId });
      onDiscarded();
      router.refresh();
    });
  };

  return (
    <section className="cv-review" aria-labelledby="cv-review-heading">
      <header className="cv-review-head">
        <h2 id="cv-review-heading" className="text-xl font-bold tracking-[-0.02em]">
          We imported your CV
        </h2>
        <p className="mt-2 max-w-[62ch] text-sm text-muted">
          Read from <span className="cv-file-name">{fileName}</span>
          {pageCount > 0 && `, ${pageCount} ${pageCount === 1 ? "page" : "pages"}`}. Nothing was
          rewritten or improved — this is what the document says. Check it over, correct anything
          that landed wrong, and confirm.
        </p>
      </header>

      <ul className="cv-review-counts">
        {counts.map((section) => (
          <li key={section.label} data-empty={section.total === 0 ? "true" : undefined}>
            <span>{section.label}</span>
            <span className="cv-review-count">{section.total === 0 ? "—" : section.total}</span>
          </li>
        ))}
      </ul>

      {result.warnings.length > 0 && (
        <ul className="cv-review-warnings">
          {result.warnings.map((warning, index) => (
            <li key={`${warning.code}-${index}`}>{warning.message}</li>
          ))}
        </ul>
      )}

      {result.unclassifiedContent.length > 0 && (
        <section className="cv-unclassified" aria-labelledby="cv-unclassified-heading">
          <h3 id="cv-unclassified-heading" className="eyebrow text-stamp">
            Content we could not place
          </h3>
          <p className="field-hint">
            Kept rather than dropped. Copy anything here into the section it belongs to, or leave it
            out — it is not part of the CV until you put it somewhere.
          </p>
          <ul>
            {result.unclassifiedContent.map((item) => (
              <li key={item.id}>
                {item.sourcePage && <span className="cv-page-mark">p. {item.sourcePage}</span>}
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ResumeDocument resume={resume} onChange={setResume} uncertain={result.uncertain} />

      {error && <p className="font-mono text-xs text-flag">{error}</p>}

      <div className="cv-review-actions">
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={confirm}
          suppressHydrationWarning
        >
          {pending ? "Saving…" : "Confirm and continue"}
        </button>
        <button
          type="button"
          className="link-quiet"
          disabled={pending}
          onClick={discard}
          suppressHydrationWarning
        >
          Discard this import
        </button>
      </div>
    </section>
  );
}
