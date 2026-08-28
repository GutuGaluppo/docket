/**
 * What the PDF pipeline will accept and how hard it will work, in one place.
 *
 * Shared by the browser and the server: the file picker refuses an oversized
 * file before a byte is uploaded, and the extraction service refuses the same
 * file again on arrival. Neither of them holds a number of its own.
 *
 * The values are sized for what this actually receives. A CV is one to three
 * pages and well under a megabyte; a twenty-megabyte file is a portfolio, a
 * scan at 600dpi, or a mistake.
 */
export const PDF_LIMITS = {
  /** Bytes. Comfortably above a text CV, comfortably below a scanned book. */
  maxFileSize: 4 * 1024 * 1024,
  maxPages: 12,
  /**
   * A serverless function has a wall-clock budget and a PDF is untrusted input:
   * a document crafted to be expensive to parse must meet a limit rather than
   * the platform's.
   */
  extractionTimeoutMs: 20_000,
} as const;

/**
 * The signals that decide whether extracted text is worth interpreting.
 *
 * Not one threshold on one number. A single length check calls a one-page CV
 * with a sparse layout unreadable and calls three pages of page furniture
 * readable, so the judgement is made from several signals together — see
 * `quality.ts`, where they are combined and where every one of them is
 * explained.
 */
export const PDF_QUALITY = {
  /** Non-whitespace characters below which a document is not a CV at all. */
  minCharacters: 220,
  /** Per page, below which that page contributed nothing worth having. */
  minCharactersPerPage: 80,
  /** A page under this is counted as empty when judging the whole document. */
  emptyPageCharacters: 20,
  /** Above this share of empty pages, the document is a scan with a cover page. */
  maxEmptyPageShare: 0.5,
  /**
   * Extraction that produces mostly unmappable glyphs looks like text and is
   * not: a subset font with no `ToUnicode` map yields replacement characters
   * rather than letters.
   */
  maxUnreadableShare: 0.15,
  /** Below this, the text is usable but thin enough to be worth saying so. */
  thinCharactersPerPage: 400,
} as const;
