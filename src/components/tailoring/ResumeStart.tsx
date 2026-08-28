"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { FreeTextCaution } from "@/components/FreeTextCaution";
import { createResumeDocument, replaceResumeWithText } from "@/server/actions/resume";

import { ResumeImportReview } from "./ResumeImportReview";
import { ResumePdfUpload, type ImportPayload } from "./ResumePdfUpload";

/**
 * Where a CV comes into the product.
 *
 * Three doors, in the order most people will want them: the PDF they already
 * have, the text of it pasted, and an empty document to fill in. Nobody should
 * have to retype a CV to try this — that is where the tab gets closed — and the
 * first two doors both end in the same structured document, addressable and
 * editable, with the parser's mistakes visible and fixable.
 *
 * It renders in two situations, which is why it takes a mode. `create` is the
 * opening screen of an account with no CV. `replace` is the way back for
 * someone who took the empty door and then thought better of it — the document
 * exists by then, so what arrives is read over it. That is only offered while
 * the document is still empty, and the actions refuse it otherwise.
 */
export function ResumeStart({
  mode = "create",
  resumeId,
  pending,
  onCancel,
}: {
  mode?: "create" | "replace";
  resumeId?: string;
  /** A reading somebody left mid-review, reopened where they left it. */
  pending?: ImportPayload | null;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [imported, setImported] = useState<ImportPayload | null>(pending ?? null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  const replacing = mode === "replace";

  if (imported) {
    return (
      <ResumeImportReview
        importId={imported.importId}
        fileName={imported.fileName}
        pageCount={imported.pageCount}
        result={imported.result}
        onDiscarded={() => setImported(null)}
      />
    );
  }

  const submit = (content: string) => {
    setError("");
    startTransition(async () => {
      const result =
        replacing && resumeId
          ? await replaceResumeWithText({ id: resumeId, text: content })
          : await createResumeDocument({ text: content, title: "My CV" });

      if (result.ok) router.refresh();
      else setError(result.error);
    });
  };

  return (
    <section className="cv-start">
      <div className="cv-start-head">
        <h2 className="text-xl font-bold tracking-[-0.02em]">
          {replacing ? "Bring in the CV you already have" : "Add your CV"}
        </h2>
        {!replacing && onCancel && (
          <button type="button" className="link-quiet" onClick={onCancel} suppressHydrationWarning>
            Back to the editor
          </button>
        )}
      </div>
      <p className="mt-2 max-w-[62ch] text-sm text-muted">
        Start from the document you already have. It is read into sections, roles and bullets you
        can correct, and you see what was read before anything is saved.{" "}
        {replacing
          ? "It replaces the empty document you are looking at; there is nothing in it to lose."
          : "Nothing is analysed against a job until you ask for it."}
      </p>

      <ResumePdfUpload onImported={setImported} />

      <div className="cv-or">
        <span>or paste it as text</span>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="cv-paste">
          Your CV
        </label>
        <textarea
          id="cv-paste"
          className="field-textarea"
          rows={10}
          value={text}
          placeholder={
            "Ana Ribeiro\nFrontend Engineer\nana@example.com | Berlin\n\nExperience\nLoudly — Frontend Engineer\n2021 – present\n• Built the subscription flow in React"
          }
          onChange={(event) => setText(event.target.value)}
        />
        <FreeTextCaution />
      </div>

      {error && <p className="font-mono text-xs text-flag">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="btn btn-quiet"
          disabled={busy || text.trim().length < 40}
          onClick={() => submit(text)}
          suppressHydrationWarning
        >
          {busy ? "Reading it…" : "Read this text in"}
        </button>

        {replacing ? (
          <button
            type="button"
            className="link-quiet"
            disabled={busy}
            onClick={onCancel}
            suppressHydrationWarning
          >
            Back to the empty document
          </button>
        ) : (
          <button
            type="button"
            className="link-quiet"
            disabled={busy}
            onClick={() => submit("")}
            suppressHydrationWarning
          >
            Create one manually instead
          </button>
        )}
      </div>
    </section>
  );
}
