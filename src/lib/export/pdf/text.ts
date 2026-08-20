/**
 * Text metrics for the standard fourteen.
 *
 * The printed docket uses Helvetica, Helvetica-Bold and Courier, which every
 * PDF reader is required to have. Nothing is embedded, so the file stays small
 * and no font licence travels with it — but a reader that supplies the face
 * also supplies its metrics, which means this module has to know them in
 * advance to decide where a column ends and where a line breaks.
 *
 * The widths below are the published ones, in thousandths of an em.
 */

export type Face = "regular" | "bold" | "mono";

/**
 * Codes 32 to 126, in order, sixteen to a line.
 *
 * Laid out so a number can be counted to rather than trusted: a single value
 * missing here shifts every glyph after it, and nothing about the output would
 * look wrong — the columns would just quietly stop lining up. Prettier is told
 * to leave the shape alone for that reason.
 */
// prettier-ignore
export const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

// prettier-ignore
export const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Courier is monospaced, so one number covers every glyph. */
const COURIER_WIDTH = 600;

/**
 * The characters WinAnsi puts where Latin-1 keeps control codes.
 *
 * A register holds text people pasted out of job ads, and job ads are full of
 * curly quotes and em dashes. Without this map each one would print as a
 * question mark.
 */
const WIN_ANSI_HIGH: Record<string, number> = {
  "€": 0x80, // euro
  "‚": 0x82,
  ƒ: 0x83,
  "„": 0x84,
  "…": 0x85, // ellipsis
  "†": 0x86,
  "‡": 0x87,
  ˆ: 0x88,
  "‰": 0x89,
  Š: 0x8a,
  "‹": 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  "‘": 0x91, // curly quotes, in both directions
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95, // bullet
  "–": 0x96, // en dash
  "—": 0x97, // em dash
  "˜": 0x98,
  "™": 0x99,
  š: 0x9a,
  "›": 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
};

/** Widths for the bytes above 0x7f that are not simply an accented letter. */
const HIGH_WIDTHS: Record<number, number> = {
  0x85: 1000, // ellipsis
  0x91: 222,
  0x92: 222,
  0x93: 333,
  0x94: 333,
  0x95: 350, // bullet
  0x96: 556, // en dash
  0x97: 1000, // em dash
  0x99: 1000, // trade mark
  0xa0: 278, // no-break space
  0xb0: 400, // degree
  0xb7: 278, // the separator the stack column is joined with
  0xba: 365, // the ordinal in the number column
};

const DIACRITICS = /[\u0300-\u036f]/g;
/**
 * The ellipsis as WinAnsi holds it, which is byte 0x85 rather than U+2026.
 *
 * Everything past `encodeWinAnsi` is a byte string, not text: the document is
 * written out as Latin-1, so a character above 0xff would be truncated to its
 * low byte on the way to the file — U+2026 would arrive as an ampersand. The
 * ellipsis is appended after encoding, so it has to already be encoded.
 */
export const ELLIPSIS = "\u0085";

/**
 * Letters that carry a stroke rather than an accent.
 *
 * Stripping combining marks handles most of Latin Extended-A, but a stroke is
 * part of the letter and does not decompose — so a Polish company name would
 * lose its first character to a question mark without this.
 */
const STROKED: Record<string, string> = {
  "\u0141": "L",
  "\u0142": "l",
  "\u0110": "D",
  "\u0111": "d",
  "\u0126": "H",
  "\u0127": "h",
  "\u0166": "T",
  "\u0167": "t",
  "\u0131": "i",
};

/**
 * Text as the PDF will store it: one byte per character, WinAnsi encoded.
 *
 * Anything the encoding cannot hold is folded to its unaccented base before it
 * is given up on, so a name written in an alphabet Helvetica does not cover
 * degrades to something readable rather than to a row of question marks.
 */
export function encodeWinAnsi(value: string): string {
  let out = "";

  for (const character of value) {
    const mapped = WIN_ANSI_HIGH[character];
    if (mapped !== undefined) {
      out += String.fromCharCode(mapped);
      continue;
    }

    const code = character.codePointAt(0) ?? 0;
    if (code === 0x09) {
      out += " ";
      continue;
    }
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) continue;
    if (code <= 0xff) {
      out += character;
      continue;
    }

    const folded = (STROKED[character] ?? character).normalize("NFD").replace(DIACRITICS, "");
    for (const part of folded) {
      const partCode = part.codePointAt(0) ?? 0;
      out += partCode >= 0x20 && partCode <= 0xff ? part : "?";
    }
  }

  return out;
}

function glyphWidth(code: number, face: Face): number {
  if (face === "mono") return COURIER_WIDTH;

  const table = face === "bold" ? HELVETICA_BOLD : HELVETICA;
  if (code >= 32 && code <= 126) return table[code - 32] ?? 500;

  const known = HIGH_WIDTHS[code];
  if (known !== undefined) return known;

  // An accented letter is exactly as wide as the letter under it.
  const base = String.fromCharCode(code).normalize("NFD").replace(DIACRITICS, "").charCodeAt(0);
  if (base >= 32 && base <= 126) return table[base - 32] ?? 500;
  return 556;
}

/** Width of already-encoded text, in points. */
export function measure(encoded: string, face: Face, size: number): number {
  let total = 0;
  for (let i = 0; i < encoded.length; i += 1) {
    total += glyphWidth(encoded.charCodeAt(i), face);
  }
  return (total * size) / 1000;
}

/** Cuts encoded text down to the width and marks the cut. Always ends in an ellipsis. */
function truncate(encoded: string, face: Face, size: number, maxWidth: number): string {
  const room = maxWidth - measure(ELLIPSIS, face, size);
  let end = encoded.length;
  while (end > 0 && measure(encoded.slice(0, end), face, size) > room) end -= 1;
  return encoded.slice(0, end).trimEnd() + ELLIPSIS;
}

const clip = (encoded: string, face: Face, size: number, maxWidth: number) =>
  measure(encoded, face, size) <= maxWidth ? encoded : truncate(encoded, face, size, maxWidth);

/**
 * Encodes and, if it will not fit, cuts to an ellipsis.
 *
 * A cell that overflows in a spreadsheet is merely hidden; a cell that
 * overflows on paper is printed on top of the next column. The ellipsis is the
 * reader's signal that the register holds more than the page shows.
 */
export const fit = (value: string, face: Face, size: number, maxWidth: number) =>
  clip(encodeWinAnsi(value), face, size, maxWidth);

/** The last line of a clipped block ends in an ellipsis, so the cut is visible. */
function capped(lines: readonly string[], face: Face, size: number, maxWidth: number): string[] {
  const last = lines[lines.length - 1];
  if (last === undefined) return [...lines];
  return [...lines.slice(0, -1), truncate(last, face, size, maxWidth)];
}

/** Greedy word wrap. A word wider than the line is cut rather than left to run off it. */
export function wrap(
  value: string,
  face: Face,
  size: number,
  maxWidth: number,
  maxLines = Infinity,
): string[] {
  const words = encodeWinAnsi(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate, face, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    if (lines.length >= maxLines) return capped(lines.slice(0, maxLines), face, size, maxWidth);
    current = measure(word, face, size) <= maxWidth ? word : fit(word, face, size, maxWidth);
  }

  if (current) lines.push(current);
  return lines.length > maxLines ? capped(lines.slice(0, maxLines), face, size, maxWidth) : lines;
}
