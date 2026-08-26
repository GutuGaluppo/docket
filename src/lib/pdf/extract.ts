import { readContent } from "./content";
import { PDF_LIMITS } from "./limits";
import { layoutPage, pageText, type PageLine } from "./layout";
import {
  entry,
  field,
  isRef,
  nameOf,
  readPdf,
  resolve,
  streamData,
  type PdfFile,
  type PdfValue,
} from "./objects";

/**
 * A PDF in, the text of a CV out.
 *
 * The three steps below are separate because they fail differently. Reading the
 * file can fail on a password or on damage, and neither is the same answer as
 * "we read it and there was nothing there". Reading the content streams can
 * yield nothing at all, which is what a scan looks like — a real document, with
 * real pages, holding no characters. Only the last step, laying the runs out,
 * is a judgement, and it is the one that decides whether a CV has one column or
 * two.
 *
 * The limits live in `./limits` so the browser can share them without pulling
 * `node:zlib` into a page bundle.
 */

export { PDF_LIMITS };

export type PdfPageText = {
  number: number;
  text: string;
  lines: PageLine[];
  columns: number;
};

export type PdfExtraction = {
  pages: PdfPageText[];
  /** Every page, in order, separated by a blank line. */
  text: string;
  characters: number;
  pageCount: number;
  /** False when the file is a picture of a CV rather than a CV. */
  hasTextLayer: boolean;
  /** The widest layout found on any page: 1, or 2 for a sidebar CV. */
  columns: number;
};

export type PdfFailureReason =
  "not-pdf" | "too-large" | "encrypted" | "corrupt" | "empty" | "too-many-pages";

export type PdfReadResult =
  | { ok: true; extraction: PdfExtraction }
  | { ok: false; reason: PdfFailureReason; pageCount?: number };

/** The header, which may sit behind a few bytes of junk in a repaired file. */
function looksLikePdf(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  return head.includes("%PDF-");
}

export function extractPdf(bytes: Uint8Array): PdfReadResult {
  if (bytes.byteLength === 0) return { ok: false, reason: "empty" };
  if (bytes.byteLength > PDF_LIMITS.maxFileSize) return { ok: false, reason: "too-large" };
  if (!looksLikePdf(bytes)) return { ok: false, reason: "not-pdf" };

  let file: PdfFile;
  try {
    file = readPdf(bytes);
  } catch {
    return { ok: false, reason: "corrupt" };
  }

  // A password on a PDF encrypts its streams, so there is nothing to read and
  // nothing to guess. It is a different answer from "we could not read this".
  if (file.encrypted) return { ok: false, reason: "encrypted" };

  const pages = findPages(file);
  if (pages.length === 0) return { ok: false, reason: "corrupt" };
  if (pages.length > PDF_LIMITS.maxPages) {
    return { ok: false, reason: "too-many-pages", pageCount: pages.length };
  }

  const read: PdfPageText[] = pages.map((page, index) => {
    const source = contentOf(file, page.value);
    const runs = source ? readContent(file, source, entry(file, page.value, "Resources")) : [];
    const { lines, columns } = layoutPage(runs);

    return { number: index + 1, text: pageText(lines), lines, columns };
  });

  const text = read
    .map((page) => page.text.trim())
    .filter(Boolean)
    .join("\n\n");

  const characters = text.replace(/\s/g, "").length;

  return {
    ok: true,
    extraction: {
      pages: read,
      text,
      characters,
      pageCount: read.length,
      hasTextLayer: characters >= PDF_LIMITS.minCharacters,
      columns: Math.max(1, ...read.map((page) => page.columns)),
    },
  };
}

type PageObject = { value: PdfValue };

/**
 * The pages, in the order the document says they are in.
 *
 * The page tree is walked rather than the objects being sorted by number,
 * because object numbers say nothing about order — a document edited twice can
 * have its last page as object 4. `/Resources` is inherited down the tree, so
 * it is pushed into each page that did not state its own.
 */
function findPages(file: PdfFile): PageObject[] {
  const root = file.trailers.map((trailer) => resolve(file, field(trailer, "Root"))).find(Boolean);
  const pagesRoot = root ? entry(file, root, "Pages") : null;

  const out: PageObject[] = [];
  const seen = new Set<number>();

  const walk = (node: PdfValue, inherited: PdfValue, depth: number): void => {
    if (depth > 32) return;

    const resources = field(node, "Resources") ?? inherited;
    const type = nameOf(entry(file, node, "Type"));

    if (type === "Page") {
      out.push({ value: withResources(node, resources) });
      return;
    }

    const kids = resolve(file, field(node, "Kids"));
    if (!Array.isArray(kids)) return;

    for (const kid of kids) {
      if (isRef(kid)) {
        if (seen.has(kid.num)) continue;
        seen.add(kid.num);
      }
      walk(resolve(file, kid), resources, depth + 1);
    }
  };

  if (pagesRoot) walk(pagesRoot, null, 0);
  if (out.length > 0) return out;

  // No usable tree: fall back to every page object there is, by number, which
  // is the order a producer almost always writes them in anyway.
  return [...file.objects.values()]
    .filter((object) => nameOf(entry(file, object.value, "Type")) === "Page")
    .sort((a, b) => a.num - b.num)
    .map((object) => ({ value: object.value }));
}

function withResources(page: PdfValue, resources: PdfValue): PdfValue {
  if (page === null || typeof page !== "object" || Array.isArray(page)) return page;
  if (field(page, "Resources") !== undefined) return page;
  return { ...(page as Record<string, PdfValue>), Resources: resources };
}

/** `/Contents` is one stream, or several that are read as if concatenated. */
function contentOf(file: PdfFile, page: PdfValue): string | null {
  const contents = field(page, "Contents");
  const references = Array.isArray(resolve(file, contents))
    ? (resolve(file, contents) as PdfValue[])
    : [contents];

  const parts: string[] = [];
  for (const reference of references) {
    if (reference === undefined || reference === null || !isRef(reference)) continue;
    const data = streamData(file, file.objects.get(reference.num));
    if (data) parts.push(data.toString("latin1"));
  }

  return parts.length > 0 ? parts.join("\n") : null;
}
