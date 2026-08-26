import { createHash } from "node:crypto";

import type { NextRequest } from "next/server";

import { PDF_LIMITS } from "@/lib/pdf/limits";
import { getScope } from "@/server/auth/session";
import { createImport } from "@/server/db/queries/resumes";
import { createLimiter } from "@/server/rate-limit";
import { importFromPdf, type ImportFailureReason } from "@/server/tailoring/import";

/**
 * The one endpoint a CV file is sent to.
 *
 * A route rather than a server action, for the reason `/api/import` is one: an
 * action's request body is capped well below the size of a document, and a file
 * upload that fails at a megabyte is a feature that works for some CVs. The
 * session is checked here exactly as it is in an action — this is a public
 * endpoint whoever posts to it.
 *
 * Nothing about the file reaches a log. The failure reasons below are
 * deliberately about the document, never about its contents.
 */

const uploads = createLimiter({
  // Reading a PDF costs a model request; a loop that retries on failure should
  // meet a wall rather than a bill.
  minGapMs: 2_000,
  windowMs: 60 * 60 * 1_000,
  perKey: 12,
  perInstance: 200,
});

const MESSAGES: Record<ImportFailureReason, string> = {
  "not-pdf": "That file is not a PDF. Upload the PDF of your CV, or paste it as text instead.",
  "too-large": `That file is larger than ${Math.round(PDF_LIMITS.maxFileSize / (1024 * 1024))} MB. A text CV is usually well under one.`,
  encrypted:
    "We can't read this PDF because it's password protected. Please upload an unlocked version of your CV.",
  corrupt: "We couldn't read this PDF. Please check the file, or try exporting your CV again.",
  empty: "That file is empty.",
  "too-many-pages": `That document has more pages than a CV usually does — the limit is ${PDF_LIMITS.maxPages}.`,
  "no-text":
    "This PDF has no text in it — it looks like a scan. Reading a scanned CV needs a language model, and none is configured here. Paste your CV as text instead.",
  unreadable:
    "We read the file, but couldn't reliably identify the sections of a CV in it. Your file is safe, and nothing was changed.",
};

export async function POST(request: NextRequest) {
  const scope = await getScope();
  if (!scope) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });

  if (uploads.exceeded(scope.userId)) {
    return Response.json(
      { ok: false, error: "That is a lot of uploads in one hour. Try again shortly." },
      { status: 429 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ ok: false, error: "Choose a PDF to upload." }, { status: 400 });
  }

  // The extension and the browser's guess are both attacker-controlled, so
  // neither decides anything: the header inside the file is checked in
  // `extractPdf`, and this is only the cheap first refusal.
  const looksRight =
    file.type === "application/pdf" || file.type === "" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksRight) {
    return Response.json({ ok: false, error: MESSAGES["not-pdf"] }, { status: 400 });
  }

  if (file.size > PDF_LIMITS.maxFileSize) {
    return Response.json({ ok: false, error: MESSAGES["too-large"] }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const outcome = await importFromPdf(bytes, file.name);

  if (!outcome.ok) {
    return Response.json({ ok: false, error: MESSAGES[outcome.reason] }, { status: 422 });
  }

  const record = await createImport(scope, {
    fileName: file.name.slice(0, 200),
    byteSize: bytes.byteLength,
    pageCount: outcome.pageCount,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    fileData: Buffer.from(bytes).toString("base64"),
    extractedText: outcome.extractedText.slice(0, 200_000),
    result: outcome.result,
  });

  return Response.json({
    ok: true,
    importId: record.id,
    fileName: record.fileName,
    pageCount: record.pageCount,
    result: record.result,
  });
}
