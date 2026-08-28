/**
 * What the rest of the application knows about a PDF.
 *
 * Nothing from the extraction library appears in these types, and that is the
 * point of them: `unpdf` is infrastructure, and a product that spreads a
 * dependency's shapes through its feature code has to be rewritten when the
 * dependency is. Everything past the extraction service works with what is
 * below.
 */

export type ExtractionQuality =
  /** Enough text, well distributed, to interpret as a CV. */
  | "good"
  /** Readable, but thin or uneven — worth interpreting, worth a warning. */
  | "partial"
  /** Not a text document: a scan, or a font nothing can map back to letters. */
  | "poor";

export type PdfWarningCode =
  "empty-pages" | "thin-text" | "unreadable-glyphs" | "layout-reordered" | "single-column-assumed";

export type PdfExtractionWarning = { code: PdfWarningCode; message: string };

export type PdfPageContent = {
  /** 1-based, as a reader counts them. */
  number: number;
  text: string;
  /** Non-whitespace characters on the page. */
  characters: number;
  /** How many columns the layout pass found, when it ran. */
  columns?: number;
};

export type PdfExtractionResult = {
  /** Every page, in reading order, separated by a blank line. */
  text: string;
  totalPages: number;
  pages: PdfPageContent[];
  /** Real link targets found in the file. Never inferred from display text. */
  links: string[];
  quality: ExtractionQuality;
  /** True when the text is not worth interpreting and something else must read the file. */
  requiresFallback: boolean;
  warnings: PdfExtractionWarning[];
  /** Whether the positional pass ran. Reported for the timings, not for the reader. */
  usedLayout: boolean;
};

/**
 * Every way this can fail, named.
 *
 * A code rather than a message, because the caller decides what to say: the
 * upload route turns these into sentences for the person, and nothing from the
 * library's own error text is ever shown to them.
 */
export type PdfExtractionErrorCode =
  | "INVALID_PDF"
  | "CORRUPTED_PDF"
  | "PASSWORD_PROTECTED"
  | "TOO_MANY_PAGES"
  | "FILE_TOO_LARGE"
  | "EXTRACTION_TIMEOUT"
  | "NO_TEXT_CONTENT"
  | "EXTRACTION_FAILED";

export type PdfExtractionOutcome =
  | { ok: true; result: PdfExtractionResult }
  | { ok: false; code: PdfExtractionErrorCode; totalPages?: number };

/**
 * What the import is allowed to record about a file.
 *
 * Counts and durations, never content: a CV is personal data, and the fact that
 * it took nine hundred milliseconds to read four pages is not.
 */
export type PdfExtractionTimings = {
  bytes: number;
  totalPages: number;
  textMs: number;
  layoutMs: number;
  linksMs: number;
  totalMs: number;
  quality: ExtractionQuality;
};
