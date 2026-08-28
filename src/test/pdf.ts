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

/** A CV that runs over two pages, the second continuing the first. */
export function twoPageCv(): Uint8Array {
  const page = (lines: readonly Line[]): PdfPage => ({
    width: 595,
    height: 842,
    operators: lines.map((line) => text(line.x, line.y, line.text, { size: line.size ?? 10 })),
  });

  return buildPdf(
    [
      page([
        { x: 56, y: 780, text: "Ana Ribeiro", size: 16 },
        { x: 56, y: 758, text: "Frontend Engineer" },
        { x: 56, y: 720, text: "Experience", size: 12 },
        { x: 56, y: 700, text: "Loudly - Frontend Engineer" },
        { x: 56, y: 686, text: "- Built the subscription flow in React" },
        { x: 56, y: 672, text: "- Worked on frontend performance across the player" },
        { x: 56, y: 658, text: "- Shipped the accessibility review process" },
      ]),
      page([
        { x: 56, y: 780, text: "Education", size: 12 },
        { x: 56, y: 760, text: "Universidade de Lisboa - BSc Computer Science" },
        { x: 56, y: 740, text: "Skills", size: 12 },
        { x: 56, y: 720, text: "Frontend: React, TypeScript, CSS" },
        { x: 56, y: 700, text: "Tooling: Docker, Git, Vite" },
      ]),
    ],
    { title: "CV" },
  );
}

/**
 * Text on the first page, nothing on the second.
 *
 * The hybrid case: a document is not all one thing, and a scan bound after a
 * text page must not cost the text page.
 */
export function hybridCv(): Uint8Array {
  return buildPdf(
    [
      {
        width: 595,
        height: 842,
        operators: [
          text(56, 780, "Ana Ribeiro", { size: 16 }),
          text(56, 758, "Frontend Engineer"),
          text(56, 720, "Experience", { size: 12 }),
          text(56, 700, "Loudly - Frontend Engineer, 2021 - present"),
          text(56, 686, "- Built the subscription flow in React and TypeScript"),
          text(56, 672, "- Worked on frontend performance across the playback surface"),
          text(56, 658, "- Ran the accessibility review that shipped with every release"),
          text(56, 620, "Skills", { size: 12 }),
          text(56, 600, "Frontend: React, TypeScript, CSS, Testing Library"),
        ],
      },
      // A page that was scanned in: drawn, with nothing to extract.
      { width: 595, height: 842, operators: [] },
    ],
    { title: "CV" },
  );
}

/** As many pages as asked for, for the page-limit refusal. */
export function manyPageCv(count: number): Uint8Array {
  const pages: PdfPage[] = Array.from({ length: count }, (_, index) => ({
    width: 595,
    height: 842,
    operators: [text(56, 700, `Page ${index + 1} of a very long document`)],
  }));

  return buildPdf(pages, { title: "Long" });
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
  // One code per distinct character, which is what a subset font actually is:
  // the glyphs the document uses, numbered, with a map back to what they mean.
  const alphabet = [...new Set([...value])];
  const codeOf = new Map(alphabet.map((character, index) => [character, index + 1]));

  const pairs = alphabet.map(
    (character, index) =>
      `<${(index + 1).toString(16).padStart(4, "0")}> <${character
        .charCodeAt(0)
        .toString(16)
        .padStart(4, "0")}>`,
  );

  // A bfchar block holds at most a hundred entries. Producers chunk them and
  // readers stop at the limit, so a fixture that ignores it is a document no
  // reader would accept.
  const blocks: string[] = [];
  for (let at = 0; at < pairs.length; at += 100) {
    const chunk = pairs.slice(at, at + 100);
    blocks.push(`${chunk.length} beginbfchar`, chunk.join("\n"), "endbfchar");
  }

  const cmap = [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin begincmap",
    "1 begincodespacerange <0000> <FFFF> endcodespacerange",
    ...blocks,
    "endcmap end end",
  ].join("\n");

  const hex = (line: string) =>
    [...line]
      .map((character) => (codeOf.get(character) ?? 1).toString(16).padStart(4, "0"))
      .join("");

  // Wrapped into lines, the way a page of a CV is set.
  const lines = value.match(/.{1,72}(\s|$)/g) ?? [value];
  const content = lines
    .map(
      (line, index) => `BT /F1 11 Tf 1 0 0 1 56 ${760 - index * 18} Tm <${hex(line.trim())}> Tj ET`,
    )
    .join("\n");

  return assemble([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type0 /BaseFont /AAAAAA+Subset /Encoding /Identity-H " +
      "/DescendantFonts [7 0 R] /ToUnicode 5 0 R >>",
    stream("", cmap),
    stream("", content),
    "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /AAAAAA+Subset " +
      `/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> ` +
      `/DW 600 /W [1 ${alphabet.length} 600] >>`,
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

/**
 * A CV whose contact line says "GitHub" and "LinkedIn" as words, with the real
 * addresses behind link annotations — which is how every CV exported from a
 * word processor carries them, and why they have to be read from the file
 * rather than guessed from the text.
 */
export function linkedCv(): Uint8Array {
  const lines = [
    "BT /F1 16 Tf 1 0 0 1 56 780 Tm (Ana Ribeiro) Tj ET",
    "BT /F1 10 Tf 1 0 0 1 56 758 Tm (Frontend Engineer) Tj ET",
    "BT /F1 10 Tf 1 0 0 1 56 742 Tm (GitHub | LinkedIn | ana@example.com) Tj ET",
    "BT /F1 12 Tf 1 0 0 1 56 700 Tm (Experience) Tj ET",
    "BT /F1 10 Tf 1 0 0 1 56 680 Tm (Loudly - Frontend Engineer, 2021 - present) Tj ET",
    "BT /F1 10 Tf 1 0 0 1 56 664 Tm (- Built the subscription flow in React and TypeScript) Tj ET",
    "BT /F1 10 Tf 1 0 0 1 56 648 Tm (- Worked on frontend performance across the player) Tj ET",
    "BT /F1 10 Tf 1 0 0 1 56 632 Tm (- Ran the accessibility review before every release) Tj ET",
    "BT /F1 12 Tf 1 0 0 1 56 600 Tm (Skills) Tj ET",
    "BT /F1 10 Tf 1 0 0 1 56 580 Tm (Frontend: React, TypeScript, CSS, Testing Library) Tj ET",
  ].join("\n");

  return assemble([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /Annots [6 0 R 7 0 R] >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    stream("", lines),
    "<< /Type /Annot /Subtype /Link /Rect [56 736 100 752] /Border [0 0 0] " +
      "/A << /Type /Action /S /URI /URI (https://github.com/anaribeiro) >> >>",
    "<< /Type /Annot /Subtype /Link /Rect [110 736 170 752] /Border [0 0 0] " +
      "/A << /Type /Action /S /URI /URI (https://linkedin.com/in/anaribeiro) >> >>",
  ]);
}
