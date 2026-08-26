import { buildPdf, text, type PdfPage } from "@/lib/export/pdf/writer";

/**
 * The documents the PDF reader is tested against.
 *
 * Two kinds are built here. The first uses this project's own writer, which
 * produces the simple-font, uncompressed shape that a CV exported from a plain
 * tool has — and gives the reader a round trip to be judged by. The second is
 * written out by hand, because the interesting failures cannot be produced by a
 * writer that works: a composite font whose codes only its `ToUnicode` map
 * explains, a page that is one big image, a file with a password on it, and a
 * file that is damaged.
 */

export type Line = { x: number; y: number; text: string; size?: number };

/** A page of positioned lines, written with the standard fonts. */
export function textPdf(lines: readonly Line[], height = 842): Uint8Array {
  const page: PdfPage = {
    width: 595,
    height,
    operators: lines.map((line) => text(line.x, line.y, line.text, { size: line.size ?? 10 })),
  };
  return buildPdf([page], { title: "CV" });
}

/** A one-column CV, the shape most exports have. */
export function onePageCv(): Uint8Array {
  return textPdf([
    { x: 56, y: 780, text: "Ana Ribeiro", size: 16 },
    { x: 56, y: 758, text: "Frontend Engineer", size: 11 },
    { x: 56, y: 742, text: "ana@example.com | +49 30 1234567 | Berlin, Germany" },
    { x: 56, y: 700, text: "Summary", size: 12 },
    { x: 56, y: 684, text: "Frontend engineer building product interfaces in React." },
    { x: 56, y: 640, text: "Experience", size: 12 },
    { x: 56, y: 624, text: "Loudly - Frontend Engineer" },
    { x: 56, y: 610, text: "2021 - present" },
    { x: 56, y: 594, text: "- Built the subscription flow in React" },
    { x: 56, y: 580, text: "- Worked on frontend performance" },
    { x: 56, y: 536, text: "Skills", size: 12 },
    { x: 56, y: 520, text: "Frontend: React, TypeScript, CSS" },
  ]);
}

/**
 * A sidebar CV: skills down the right-hand side, the work history on the left,
 * and a gutter between them that no line crosses.
 */
export function twoColumnCv(): Uint8Array {
  const left: Line[] = [
    { x: 50, y: 780, text: "Ana Ribeiro", size: 14 },
    { x: 50, y: 750, text: "Experience", size: 12 },
    { x: 50, y: 730, text: "Loudly - Frontend Engineer" },
    { x: 50, y: 716, text: "2021 - present" },
    { x: 50, y: 700, text: "Built the subscription flow in React" },
    { x: 50, y: 686, text: "Worked on frontend performance" },
    { x: 50, y: 650, text: "Marketplace - Junior Developer" },
    { x: 50, y: 636, text: "2019 - 2021" },
    { x: 50, y: 620, text: "Maintained the checkout" },
  ];

  const right: Line[] = [
    { x: 400, y: 780, text: "Skills", size: 12 },
    { x: 400, y: 762, text: "React" },
    { x: 400, y: 748, text: "TypeScript" },
    { x: 400, y: 734, text: "CSS" },
    { x: 400, y: 700, text: "Languages", size: 12 },
    { x: 400, y: 682, text: "Portuguese" },
    { x: 400, y: 668, text: "English" },
  ];

  return textPdf([...left, ...right]);
}

/* -------------------------------------------------------------------------- */

function assemble(objects: readonly string[], trailerExtra = ""): Uint8Array {
  let file = "%PDF-1.5\n";
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets.push(file.length);
    file += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const startxref = file.length;
  const entries = offsets
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");

  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries}`;
  file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${trailerExtra}>>\n`;
  file += `startxref\n${startxref}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(file, "latin1"));
}

const stream = (dict: string, body: string) =>
  `<< ${dict} /Length ${body.length} >>\nstream\n${body}\nendstream`;

/**
 * A page set in an embedded subset font.
 *
 * Its codes are glyph indices — 0x0001 is whatever the first glyph of the
 * subset happens to be — so the text is recoverable only through the
 * `ToUnicode` map written beside it. Every modern word processor produces
 * documents of this shape.
 */
export function compositeFontPdf(value: string): Uint8Array {
  const codes = [...value].map((_, index) => index + 1);
  const hex = codes.map((code) => code.toString(16).padStart(4, "0")).join("");

  const pairs = [...value]
    .map(
      (character, index) =>
        `<${codes[index]!.toString(16).padStart(4, "0")}> <${character
          .charCodeAt(0)
          .toString(16)
          .padStart(4, "0")}>`,
    )
    .join("\n");

  const cmap = [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin begincmap",
    "1 begincodespacerange <0000> <FFFF> endcodespacerange",
    `${value.length} beginbfchar`,
    pairs,
    "endbfchar",
    "endcmap end end",
  ].join("\n");

  const content = `BT /F1 12 Tf 1 0 0 1 60 700 Tm <${hex}> Tj ET`;

  return assemble([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type0 /BaseFont /AAAAAA+Subset /Encoding /Identity-H " +
      "/DescendantFonts [7 0 R] /ToUnicode 5 0 R >>",
    stream("", cmap),
    stream("", content),
    "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /AAAAAA+Subset >>",
  ]);
}

/** The same, with the map left out: codes nothing can turn back into letters. */
export function compositeFontWithoutMap(): Uint8Array {
  return assemble([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type0 /BaseFont /AAAAAA+Subset /Encoding /Identity-H >>",
    stream("", "BT /F1 12 Tf 1 0 0 1 60 700 Tm <0001000200030004> Tj ET"),
  ]);
}

/** A scan: one page, one image, no text anywhere in the file. */
export function imageOnlyPdf(): Uint8Array {
  return assemble([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /XObject << /I0 5 0 R >> >> /Contents 4 0 R >>",
    stream("", "q 595 0 0 842 0 0 cm /I0 Do Q"),
    stream(
      "/Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceGray " +
        "/BitsPerComponent 8 /Filter /DCTDecode",
      "\xff\xd8\xff\xe0 not really a jpeg",
    ),
  ]);
}

/** A file with a password on it: the streams are ciphertext. */
export function encryptedPdf(): Uint8Array {
  return assemble(
    [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>",
      stream("", "BT ET"),
      "<< /Filter /Standard /V 2 /R 3 /Length 128 /P -1 /O (xxxxxxxx) /U (yyyyyyyy) >>",
    ],
    "/Encrypt 5 0 R ",
  );
}

/** A PDF header on top of something that is not a PDF. */
export function corruptPdf(): Uint8Array {
  return new Uint8Array(Buffer.from("%PDF-1.7\n" + "  broken ".repeat(40), "latin1"));
}
