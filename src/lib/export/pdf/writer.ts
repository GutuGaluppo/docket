import { encodeWinAnsi, type Face } from "./text";

/**
 * A PDF document, written by hand.
 *
 * What is produced here is deliberately the smallest thing that is still a
 * conforming PDF: a catalogue, a page tree, three of the fourteen fonts every
 * reader already has, and one uncompressed content stream per page. There is no
 * layout engine, because the thing being printed is a table whose geometry this
 * project already decides in points.
 *
 * The one part that has to be exactly right is the cross-reference table: it
 * indexes every object by its byte offset, and a reader that finds the wrong
 * byte there rejects the whole file. That is why the document is assembled as
 * Latin-1 text, where one character is one byte and an offset is a string
 * length — and why every string reaching this module is WinAnsi encoded first.
 */

const FONT_KEYS: Record<Face, string> = { regular: "F1", bold: "F2", mono: "F3" };

export type TextOptions = {
  face?: Face;
  size?: number;
  /** 0 is black, 1 is white. */
  gray?: number;
  /** Extra space between characters, for the small caps-style labels. */
  spacing?: number;
};

const round = (value: number) => Math.round(value * 100) / 100;

/** Parentheses and backslashes end a string literal early unless escaped. */
const escapeString = (value: string) => value.replace(/([\\()])/g, "\\$1");

/**
 * Every string reaching `text` has been WinAnsi encoded already, because the
 * layout had to encode it to measure it. The document title is the exception —
 * nothing measures it — so it is encoded here instead.
 */

export function text(x: number, y: number, value: string, options: TextOptions = {}): string {
  const { face = "regular", size = 9, gray = 0, spacing = 0 } = options;
  return [
    "BT",
    `/${FONT_KEYS[face]} ${size} Tf`,
    `${gray} g`,
    `${spacing} Tc`,
    `1 0 0 1 ${round(x)} ${round(y)} Tm`,
    `(${escapeString(value)}) Tj`,
    "ET",
  ].join("\n");
}

export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: { width?: number; gray?: number } = {},
): string {
  const { width = 0.5, gray = 0 } = options;
  return `${gray} G\n${width} w\n${round(x1)} ${round(y1)} m ${round(x2)} ${round(y2)} l S`;
}

export function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  gray: number = 0,
): string {
  return `${gray} g\n${round(x)} ${round(y)} ${round(width)} ${round(height)} re f`;
}

export type PdfPage = {
  width: number;
  height: number;
  /** Content stream operators, in drawing order. */
  operators: readonly string[];
};

/**
 * Object numbers are fixed rather than allocated: the catalogue, the page tree,
 * the three fonts and the metadata always occupy 1 to 6, and each page takes
 * the next two. Knowing the numbering in advance is what lets the page tree be
 * written before the pages it points at.
 */
const FIRST_PAGE_OBJECT = 7;

export function buildPdf(
  pages: readonly PdfPage[],
  meta: { title: string },
): Uint8Array<ArrayBuffer> {
  const objects: string[] = [];
  const pageIds = pages.map((_, index) => FIRST_PAGE_OBJECT + index * 2);

  objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  objects.push(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
  objects.push(
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`,
  );
  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>`);
  objects.push(`<< /Title (${escapeString(encodeWinAnsi(meta.title))}) /Producer (Docket) >>`);

  pages.forEach((page, index) => {
    const contentId = pageIds[index]! + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`,
    );

    const stream = page.operators.join("\n");
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  let file = "%PDF-1.7\n";
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets.push(file.length);
    file += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const startxref = file.length;
  // Every entry is exactly twenty bytes wide; a reader seeks into this table by
  // multiplying, so the padding is structural rather than cosmetic.
  const entries = offsets
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");

  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries}`;
  file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\n`;
  file += `startxref\n${startxref}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(file, "latin1"));
}
