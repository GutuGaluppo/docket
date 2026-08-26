/**
 * What the upload will accept, in one place.
 *
 * Kept apart from the reader itself because the browser needs these numbers
 * too — the file picker refuses an oversized file before a byte is uploaded —
 * and the reader imports `node:zlib`, which has no business in a page bundle.
 *
 * They are sized for what this actually receives: a CV is one to three pages
 * and well under a megabyte, and a twenty-megabyte file is a portfolio, a scan
 * at 600dpi, or a mistake.
 */
export const PDF_LIMITS = {
  /** Bytes. Comfortably above a text CV, comfortably below a scanned book. */
  maxFileSize: 4 * 1024 * 1024,
  maxPages: 12,
  /**
   * Below this many characters a document is treated as having no text layer.
   * A scanned CV yields a handful of characters from stray metadata; a real
   * one-page CV yields two thousand or more.
   */
  minCharacters: 220,
} as const;
