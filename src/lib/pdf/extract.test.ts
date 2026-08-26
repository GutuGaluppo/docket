import { describe, expect, it } from "vitest";

import {
  compositeFontPdf,
  compositeFontWithoutMap,
  corruptPdf,
  encryptedPdf,
  imageOnlyPdf,
  onePageCv,
  twoColumnCv,
} from "@/test/pdf";

import { extractPdf } from "./extract";
import { PDF_LIMITS } from "./limits";

const read = (bytes: Uint8Array) => {
  const result = extractPdf(bytes);
  if (!result.ok) throw new Error(`expected a reading, got ${result.reason}`);
  return result.extraction;
};

describe("a CV exported as text", () => {
  const extraction = read(onePageCv());

  it("comes back as the lines it was written as", () => {
    expect(extraction.text).toContain("Ana Ribeiro");
    expect(extraction.text).toContain("ana@example.com | +49 30 1234567 | Berlin, Germany");
    expect(extraction.text).toContain("Loudly - Frontend Engineer");
    expect(extraction.text).toContain("- Built the subscription flow in React");
  });

  it("keeps the order it was written in", () => {
    const at = (value: string) => extraction.text.indexOf(value);
    expect(at("Ana Ribeiro")).toBeLessThan(at("Experience"));
    expect(at("Experience")).toBeLessThan(at("Skills"));
    expect(at("Loudly - Frontend Engineer")).toBeLessThan(at("2021 - present"));
  });

  it("keeps the blocks apart, which is what the CV parser reads", () => {
    // A heading and its section are one block; the gap before the next heading
    // is what separates them.
    expect(extraction.text).toMatch(/Experience\n/);
    expect(extraction.text.split("\n\n").length).toBeGreaterThan(3);
  });

  it("is one column, with a text layer", () => {
    expect(extraction.columns).toBe(1);
    expect(extraction.hasTextLayer).toBe(true);
    expect(extraction.pageCount).toBe(1);
    expect(extraction.characters).toBeGreaterThan(PDF_LIMITS.minCharacters);
  });
});

describe("a CV with a sidebar", () => {
  const extraction = read(twoColumnCv());

  it("is read as two columns", () => {
    expect(extraction.columns).toBe(2);
  });

  it("reads each column through before starting the next", () => {
    const at = (value: string) => extraction.text.indexOf(value);

    // The failure this exists to prevent: "Experience Skills Loudly React".
    expect(at("Maintained the checkout")).toBeLessThan(at("Skills"));
    expect(at("Skills")).toBeLessThan(at("Languages"));
    expect(extraction.text).not.toMatch(/Experience\s+Skills/);
  });

  it("never joins a line from one column to a line from the other", () => {
    for (const line of extraction.text.split("\n")) {
      expect(line.includes("Loudly") && line.includes("React") && line.includes("Skills")).toBe(
        false,
      );
    }
  });
});

describe("a CV set in an embedded subset font", () => {
  it("is read through the map the producer shipped", () => {
    // Written as glyph indices: without ToUnicode these bytes are meaningless.
    const extraction = read(compositeFontPdf("Ana Ribeiro"));
    expect(extraction.text.trim()).toBe("Ana Ribeiro");
  });

  it("decodes nothing rather than inventing letters when the map is missing", () => {
    const extraction = read(compositeFontWithoutMap());
    expect(extraction.text.trim()).toBe("");
    expect(extraction.hasTextLayer).toBe(false);
  });
});

describe("a document that cannot be read as text", () => {
  it("reports a scan as having no text layer, not as a failure", () => {
    const extraction = read(imageOnlyPdf());
    expect(extraction.hasTextLayer).toBe(false);
    expect(extraction.characters).toBeLessThan(PDF_LIMITS.minCharacters);
    expect(extraction.pageCount).toBe(1);
  });

  it("names a password as a password", () => {
    expect(extractPdf(encryptedPdf())).toEqual({ ok: false, reason: "encrypted" });
  });

  it("refuses something that is not a PDF at all", () => {
    const notPdf = new Uint8Array(Buffer.from("Dear hiring manager,\n".repeat(20), "utf8"));
    expect(extractPdf(notPdf)).toEqual({ ok: false, reason: "not-pdf" });
  });

  it("refuses an empty file", () => {
    expect(extractPdf(new Uint8Array())).toEqual({ ok: false, reason: "empty" });
  });

  it("refuses a file bigger than the limit without parsing it", () => {
    const huge = new Uint8Array(PDF_LIMITS.maxFileSize + 1);
    expect(extractPdf(huge)).toEqual({ ok: false, reason: "too-large" });
  });

  it("survives a damaged file instead of throwing", () => {
    const result = extractPdf(corruptPdf());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("corrupt");
  });

  it("refuses a document with more pages than a CV has", () => {
    const pages = Array.from({ length: PDF_LIMITS.maxPages + 1 }, () => "1 page");
    const many = manyPagePdf(pages);
    const result = extractPdf(many);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too-many-pages");
      expect(result.pageCount).toBe(PDF_LIMITS.maxPages + 1);
    }
  });
});

/** A document of `n` pages, each holding one line. */
function manyPagePdf(pages: readonly string[]): Uint8Array {
  const kids = pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  pages.forEach((line, index) => {
    const contentId = 5 + index * 2;
    objects.push(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    const body = `BT /F1 10 Tf 1 0 0 1 56 700 Tm (${line}) Tj ET`;
    objects.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
  });

  let file = "%PDF-1.5\n";
  objects.forEach((body, index) => {
    file += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n%%EOF\n`;

  return new Uint8Array(Buffer.from(file, "latin1"));
}
