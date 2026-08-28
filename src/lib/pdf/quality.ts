import { PDF_QUALITY } from "./limits";
import type { ExtractionQuality, PdfExtractionWarning, PdfPageContent } from "./types";

/**
 * Whether extracted text is worth interpreting.
 *
 * `text.length > 0` is the wrong question, in both directions. A scan of a CV
 * yields a handful of characters from stray metadata and would pass it; a
 * sparse one-page CV yields eight hundred and would fail any threshold set high
 * enough to catch the scan. So several signals are read together, each of which
 * means something on its own:
 *
 *   - **Total text.** Below a few hundred characters there is no CV here,
 *     whatever the page count says.
 *   - **Text per page.** Four pages holding what one page should is a document
 *     whose content is mostly pictures.
 *   - **Empty pages.** One empty page among four is a cover sheet; three among
 *     four is a scan with a text cover.
 *   - **Unreadable glyphs.** Replacement characters and control codes are what
 *     a subset font with no `ToUnicode` map produces. It looks like text, it
 *     has a length, and it says nothing.
 *
 * Deterministic and pure, so the thresholds can be argued with in a test rather
 * than in production.
 */

/** What arrives when a glyph could not be mapped back to a letter. */
const UNREADABLE = /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

export function countCharacters(text: string): number {
  return text.replace(/\s/g, "").length;
}

export function unreadableShare(text: string): number {
  const total = countCharacters(text);
  if (total === 0) return 0;
  return (text.match(UNREADABLE)?.length ?? 0) / total;
}

export type QualityVerdict = {
  quality: ExtractionQuality;
  requiresFallback: boolean;
  warnings: PdfExtractionWarning[];
};

export function judgeExtraction(pages: readonly PdfPageContent[]): QualityVerdict {
  const warnings: PdfExtractionWarning[] = [];

  const characters = pages.reduce((total, page) => total + page.characters, 0);
  const perPage = pages.length > 0 ? characters / pages.length : 0;

  const empty = pages.filter((page) => page.characters < PDF_QUALITY.emptyPageCharacters);
  const emptyShare = pages.length > 0 ? empty.length / pages.length : 1;

  const unreadable = unreadableShare(pages.map((page) => page.text).join(""));

  if (unreadable > PDF_QUALITY.maxUnreadableShare) {
    warnings.push({
      code: "unreadable-glyphs",
      message:
        "Much of this PDF is set in a font that does not say what its letters are, so parts of it could not be read.",
    });
  }

  if (empty.length > 0 && empty.length < pages.length) {
    warnings.push({
      code: "empty-pages",
      message:
        empty.length === 1
          ? `Page ${empty[0]!.number} has no text in it — anything on it was drawn as an image.`
          : `${empty.length} pages have no text in them — anything on them was drawn as images.`,
    });
  }

  // Nothing worth interpreting: a picture of a CV, or a font nothing can read.
  const poor =
    characters < PDF_QUALITY.minCharacters ||
    perPage < PDF_QUALITY.minCharactersPerPage ||
    emptyShare > PDF_QUALITY.maxEmptyPageShare ||
    unreadable > PDF_QUALITY.maxUnreadableShare;

  if (poor) return { quality: "poor", requiresFallback: true, warnings };

  const thin = perPage < PDF_QUALITY.thinCharactersPerPage || empty.length > 0;

  if (thin) {
    warnings.push({
      code: "thin-text",
      message:
        "Only a little text came out of this PDF. If parts of your CV are missing, they were probably drawn as images.",
    });
    return { quality: "partial", requiresFallback: false, warnings };
  }

  return { quality: "good", requiresFallback: false, warnings };
}

/**
 * Whether the flat text is worth a second, positional pass.
 *
 * `extractText` walks the content in the order the producer wrote it, which is
 * reading order for most documents and is not for a CV with a sidebar. The
 * positional pass costs another walk of every page, so it is asked for on
 * evidence rather than always: a document that looks like it might be in
 * columns, or one whose text came out thin enough that its order is suspect.
 */
export function needsLayoutPass(text: string, quality: ExtractionQuality): boolean {
  if (quality === "poor") return false;
  if (quality === "partial") return true;

  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 8) return false;

  // Two runs of text separated by a wide gap on one line is what a sidebar
  // looks like once the positions have been thrown away.
  const wideGaps = lines.filter((line) => /\S {3,}\S/.test(line)).length;
  if (wideGaps / lines.length > 0.15) return true;

  // A sidebar of one-word lines - "React", "TypeScript" - reads as a document
  // whose lines are suspiciously short on average.
  const shortLines = lines.filter((line) => line.trim().length <= 18).length;
  return shortLines / lines.length > 0.55;
}
