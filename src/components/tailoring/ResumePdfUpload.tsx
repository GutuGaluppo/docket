"use client";

import { useRef, useState } from "react";

import { PDF_LIMITS } from "@/lib/pdf/limits";
import type { ResumeImportResult } from "@/lib/resume/import";

/**
 * Choosing a PDF, and watching it be read.
 *
 * The states are the real ones. Upload progress is reported because the browser
 * actually knows it — `XMLHttpRequest` reports bytes sent, which `fetch` does
 * not — and everything after the last byte is a single "reading" state with no
 * bar, because the server does not report progress and a bar that fills on a
 * timer is a lie about how long this takes.
 *
 * The file never touches the page's own state beyond its name and size: it is
 * handed to the request and forgotten.
 */

export type ImportPayload = {
  importId: string;
  fileName: string;
  pageCount: number;
  result: ResumeImportResult;
};

type Status = "idle" | "uploading" | "reading" | "error";

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function ResumePdfUpload({ onImported }: { onImported: (payload: ImportPayload) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const busy = status === "uploading" || status === "reading";

  const choose = (chosen: File | null | undefined) => {
    if (!chosen) return;
    setError("");

    // The browser's type is a guess and the extension is a claim; the file's
    // own header is checked on the server. This is only the quick refusal.
    const looksRight =
      chosen.type === "application/pdf" || chosen.name.toLowerCase().endsWith(".pdf");
    if (!looksRight) {
      setFile(null);
      setStatus("error");
      setError("That is not a PDF. Choose the PDF of your CV.");
      return;
    }

    if (chosen.size > PDF_LIMITS.maxFileSize) {
      setFile(null);
      setStatus("error");
      setError(
        `That file is ${megabytes(chosen.size)}, over the ${megabytes(PDF_LIMITS.maxFileSize)} limit. A text CV is usually well under one.`,
      );
      return;
    }

    setFile(chosen);
    setStatus("idle");
  };

  const remove = () => {
    setFile(null);
    setError("");
    setStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
  };

  const send = () => {
    if (!file) return;

    setStatus("uploading");
    setProgress(0);
    setError("");

    const body = new FormData();
    body.append("file", file);

    const request = new XMLHttpRequest();
    request.open("POST", "/cv/import");

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const sent = Math.round((event.loaded / event.total) * 100);
      setProgress(sent);
      // The last byte is sent long before the answer comes back. From here the
      // server is reading, and there is no progress to report about that.
      if (sent >= 100) setStatus("reading");
    });

    request.addEventListener("load", () => {
      let payload: { ok?: boolean; error?: string } & Partial<ImportPayload> = {};
      try {
        payload = JSON.parse(request.responseText) as typeof payload;
      } catch {
        payload = {};
      }

      if (request.status >= 200 && request.status < 300 && payload.ok && payload.result) {
        onImported({
          importId: payload.importId!,
          fileName: payload.fileName ?? file.name,
          pageCount: payload.pageCount ?? 0,
          result: payload.result,
        });
        return;
      }

      setStatus("error");
      setError(payload.error ?? "We couldn't read that PDF. Please try another version of it.");
    });

    request.addEventListener("error", () => {
      setStatus("error");
      setError("The upload did not go through. Check your connection and try again.");
    });

    request.send(body);
  };

  return (
    <div className="cv-upload">
      <div
        className="cv-dropzone"
        data-dragging={dragging ? "true" : undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          choose(event.dataTransfer.files?.[0]);
        }}
      >
        <label className="field-label" htmlFor="cv-pdf">
          Your CV as a PDF
        </label>
        <input
          ref={inputRef}
          id="cv-pdf"
          type="file"
          accept="application/pdf,.pdf"
          className="cv-file"
          disabled={busy}
          onChange={(event) => choose(event.target.files?.[0])}
        />
        <p className="field-hint">
          Drop it here or choose a file. PDF only, up to {megabytes(PDF_LIMITS.maxFileSize)} and{" "}
          {PDF_LIMITS.maxPages} pages. Nothing is read until you press the button.
        </p>
      </div>

      {file && (
        <p className="cv-file-chosen">
          <span className="cv-file-name">{file.name}</span>
          <span className="text-muted">{megabytes(file.size)}</span>
          {!busy && (
            <button type="button" className="link-quiet" onClick={remove} suppressHydrationWarning>
              Remove
            </button>
          )}
        </p>
      )}

      {error && <p className="font-mono text-xs text-flag">{error}</p>}

      <div className="cv-upload-actions" aria-live="polite">
        <button
          type="button"
          className="btn"
          disabled={!file || busy}
          onClick={send}
          suppressHydrationWarning
        >
          {status === "uploading"
            ? `Uploading… ${progress}%`
            : status === "reading"
              ? "Reading your CV…"
              : "Import this CV"}
        </button>

        {status === "reading" && (
          <span className="cv-upload-note">
            Finding the sections, the roles and the dates. This takes a few seconds.
          </span>
        )}
      </div>
    </div>
  );
}
