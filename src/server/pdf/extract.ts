import "server-only";

import { extractLinks, extractText, extractTextItems, getDocumentProxy } from "unpdf";

import { pageReadingOrder, type PositionedText } from "@/lib/pdf/layout";
import { PDF_LIMITS } from "@/lib/pdf/limits";
import { countCharacters, judgeExtraction, needsLayoutPass } from "@/lib/pdf/quality";
import type {
  PdfExtractionErrorCode,
  PdfExtractionOutcome,
  PdfExtractionTimings,
  PdfPageContent,
} from "@/lib/pdf/types";

/**
 * The one place a PDF is read.
 *
 * `unpdf` answers "what is in this file"; everything downstream answers "what
 * does it mean". Keeping those apart is the point of this module: no component,
 * route, prompt or editor imports the library, and nothing outside this file
 * sees one of its types. Replacing it later is a rewrite of this file rather
 * than of the feature.
 *
 * The pipeline is ordered by cost, and each step is taken on evidence:
 *
 *     getDocumentProxy      once, and reused by every pass below
 *            ↓
 *     extractText           per page, so a scan among text pages is visible
 *            ↓
 *     judgeExtraction       several signals, not one length check
 *            ↓
 *     extractTextItems      only when the flat order looks wrong
 *            ↓
 *     extractLinks          only when the text mentions something linkable
 *
 * Nothing here logs, stores or returns anything about the person: the result
 * carries the document's text because the caller needs it, and the timings
 * carry counts and durations because an operator does.
 */

type UnpdfTextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
};

/** Names that usually appear as display text with the real address behind them. */
const LINKABLE = /\b(linkedin|github|gitlab|portfolio|website|behance|dribbble)\b|https?:\/\//i;

export type ExtractionOutcome = PdfExtractionOutcome & { timings?: PdfExtractionTimings };

/**
 * Reads a CV out of a PDF, or says exactly why it could not.
 *
 * Never throws: every failure mode a caller has to handle is a code, and the
 * library's own error text — which can contain fragments of the document — is
 * never propagated.
 */
export async function extractResumePdf(
  input: ArrayBuffer | Uint8Array,
): Promise<ExtractionOutcome> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const started = Date.now();
  // Read before anything else touches the array: opening the document takes
  // ownership of the buffer and leaves it detached, so its length is only
  // knowable now.
  const size = bytes.byteLength;

  if (size === 0) return { ok: false, code: "INVALID_PDF" };
  if (size > PDF_LIMITS.maxFileSize) return { ok: false, code: "FILE_TOO_LARGE" };

  try {
    return await withTimeout(read(bytes, size, started), PDF_LIMITS.extractionTimeoutMs);
  } catch (error) {
    return { ok: false, code: classify(error) };
  }
}

async function read(bytes: Uint8Array, size: number, started: number): Promise<ExtractionOutcome> {
  /**
   * One document, reused by every pass below: loading it again per operation
   * would parse the same file three times.
   *
   * It is handed a copy, because opening a document detaches the buffer it was
   * given. The caller still needs those bytes — a document with no text layer
   * is sent on to be looked at, and sending a detached array would send an
   * empty file.
   */
  const pdf = await getDocumentProxy(new Uint8Array(bytes));

  const totalPages = pdf.numPages;
  if (totalPages > PDF_LIMITS.maxPages) {
    return { ok: false, code: "TOO_MANY_PAGES", totalPages };
  }

  const textStarted = Date.now();
  // Page by page rather than merged: a document can be text for two pages and a
  // scan for the third, and a single string cannot say which.
  const extracted = await extractText(pdf, { mergePages: false });
  const rawPages: string[] = Array.isArray(extracted.text)
    ? extracted.text
    : [String(extracted.text ?? "")];
  const textMs = Date.now() - textStarted;

  let pages: PdfPageContent[] = rawPages.map((text, index) => ({
    number: index + 1,
    text: text.trim(),
    characters: countCharacters(text),
  }));

  let verdict = judgeExtraction(pages);
  let usedLayout = false;
  let layoutMs = 0;

  const flat = pages.map((page) => page.text).join("\n\n");

  if (needsLayoutPass(flat, verdict.quality)) {
    const layoutStarted = Date.now();
    const laidOut = await readWithLayout(pdf, pages);
    layoutMs = Date.now() - layoutStarted;

    if (laidOut) {
      pages = laidOut.pages;
      usedLayout = true;
      verdict = judgeExtraction(pages);
      if (laidOut.columns > 1) {
        verdict.warnings.push({
          code: "layout-reordered",
          message:
            "This CV is set in more than one column, so each was read through separately. Check that nothing ended up in the wrong section.",
        });
      }
    }
  }

  const text = pages
    .map((page) => page.text)
    .filter(Boolean)
    .join("\n\n");

  let links: string[] = [];
  let linksMs = 0;

  // Asked for only when the text suggests there is an address hiding behind a
  // word — "GitHub" with no URL beside it is the case this exists for.
  if (verdict.quality !== "poor" && LINKABLE.test(text)) {
    const linksStarted = Date.now();
    links = await readLinks(pdf);
    linksMs = Date.now() - linksStarted;
  }

  return {
    ok: true,
    result: {
      text,
      totalPages,
      pages,
      links,
      quality: verdict.quality,
      requiresFallback: verdict.requiresFallback,
      warnings: verdict.warnings,
      usedLayout,
    },
    timings: {
      bytes: size,
      totalPages,
      textMs,
      layoutMs,
      linksMs,
      totalMs: Date.now() - started,
      quality: verdict.quality,
    },
  };
}

/**
 * The positional pass: every item with its coordinates, put back into the order
 * a person reads it in.
 *
 * The library's item shape is mapped into this project's own before anything
 * looks at it, so the column logic in `lib/pdf/layout` stays independent of
 * where the positions came from.
 */
async function readWithLayout(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  fallback: readonly PdfPageContent[],
): Promise<{ pages: PdfPageContent[]; columns: number } | null> {
  try {
    const extracted = (await extractTextItems(pdf)) as unknown as {
      items?: UnpdfTextItem[][];
    };
    const perPage = extracted.items;
    if (!Array.isArray(perPage) || perPage.length === 0) return null;

    let widest = 1;

    const pages = perPage.map((items, index): PdfPageContent => {
      const positioned: PositionedText[] = (items ?? [])
        .filter((item) => typeof item?.str === "string" && item.str.trim().length > 0)
        .map((item) => ({
          text: item.str,
          x: item.x,
          y: item.y,
          width: item.width,
          size: item.fontSize || 10,
        }));

      if (positioned.length === 0) {
        return fallback[index] ?? { number: index + 1, text: "", characters: 0 };
      }

      const { text, columns } = pageReadingOrder(positioned);
      widest = Math.max(widest, columns);

      return { number: index + 1, text, characters: countCharacters(text), columns };
    });

    return { pages, columns: widest };
  } catch {
    // The flat reading is already in hand; a failed second pass costs nothing.
    return null;
  }
}

/** Real link targets. Never a URL guessed from the words around it. */
async function readLinks(pdf: Awaited<ReturnType<typeof getDocumentProxy>>): Promise<string[]> {
  try {
    const extracted = (await extractLinks(pdf)) as unknown as { links?: unknown };
    const found = Array.isArray(extracted.links) ? extracted.links : [];

    return [
      ...new Set(
        found
          .filter((link): link is string => typeof link === "string")
          .map((link) => link.trim())
          .filter((link) => /^https?:\/\//i.test(link))
          .slice(0, 20),
      ),
    ];
  } catch {
    return [];
  }
}

/**
 * A budget, enforced.
 *
 * A PDF is untrusted input and parsing one is not linear in its size: a
 * document built to be expensive would otherwise spend the whole request
 * budget, and a serverless function that runs out of time reports nothing
 * useful to anyone.
 */
async function withTimeout(
  work: Promise<ExtractionOutcome>,
  ms: number,
): Promise<ExtractionOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const expiry = new Promise<ExtractionOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, code: "EXTRACTION_TIMEOUT" }), ms);
  });

  try {
    return await Promise.race([work, expiry]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The library's exceptions, turned into this application's vocabulary.
 *
 * The message is deliberately dropped: it can quote the file, and a file is
 * somebody's CV.
 */
function classify(error: unknown): PdfExtractionErrorCode {
  const name = (error as { name?: string } | null)?.name ?? "";

  if (name === "PasswordException") return "PASSWORD_PROTECTED";
  if (name === "InvalidPDFException") return "INVALID_PDF";
  if (name === "MissingPDFException" || name === "UnexpectedResponseException") {
    return "CORRUPTED_PDF";
  }

  return "EXTRACTION_FAILED";
}
