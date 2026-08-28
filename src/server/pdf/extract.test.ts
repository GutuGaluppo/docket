import { describe, expect, it } from "vitest";

import { PDF_LIMITS } from "@/lib/pdf/limits";
import {
  compositeFontPdf,
  compositeFontWithoutMap,
  corruptPdf,
  encryptedPdf,
  hybridCv,
  imageOnlyPdf,
  linkedCv,
  manyPageCv,
  onePageCv,
  twoColumnCv,
  twoPageCv,
} from "@/test/pdf";

import { extractResumePdf } from "./extract";

/**
 * The extraction service, against real documents.
 *
 * Every fixture here is a PDF this project produced or assembled by hand, so
 * the tests exercise the same path a person's CV takes: bytes in, normalized
 * result out, and never an exception.
 */
const read = async (bytes: Uint8Array) => {
  const outcome = await extractResumePdf(bytes);
  if (!outcome.ok) throw new Error(`expected an extraction, got ${outcome.code}`);
  return outcome;
};

describe("a CV with a text layer", () => {
  it("comes back as the lines it was written as", async () => {
    const { result } = await read(onePageCv());

    expect(result.text).toContain("Ana Ribeiro");
    expect(result.text).toContain("ana@example.com | +49 30 1234567 | Berlin, Germany");
    expect(result.text).toContain("Built the subscription flow in React");
    expect(result.totalPages).toBe(1);
    expect(result.requiresFallback).toBe(false);
  });

  it("keeps the order it was written in", async () => {
    const { result } = await read(onePageCv());
    const at = (value: string) => result.text.indexOf(value);

    expect(at("Ana Ribeiro")).toBeLessThan(at("Experience"));
    expect(at("Experience")).toBeLessThan(at("Skills"));
  });

  it("reports timings without reporting any of the document", async () => {
    const outcome = await read(onePageCv());

    expect(outcome.timings?.totalPages).toBe(1);
    expect(outcome.timings?.bytes).toBeGreaterThan(0);
    expect(outcome.timings?.totalMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(outcome.timings)).not.toContain("Ana");
  });

  it("reads every page of a CV that runs over two", async () => {
    const { result } = await read(twoPageCv());

    expect(result.totalPages).toBe(2);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]!.text).toContain("Loudly");
    expect(result.pages[1]!.text).toContain("Universidade de Lisboa");
    expect(result.text).toContain("Docker, Git, Vite");
  });

  it("is read through the producer's map when the CV uses an embedded font", async () => {
    const { result } = await read(
      compositeFontPdf(
        "Ana Ribeiro Frontend Engineer ana@example.com Berlin Germany Experience Loudly " +
          "Frontend Engineer 2021 present Built the subscription flow in React and worked on " +
          "frontend performance across the playback surface Marketplace GmbH Junior Developer " +
          "2019 2021 Maintained the checkout and reduced failed payments Education Universidade " +
          "de Lisboa BSc Computer Science Skills React TypeScript CSS Docker Git",
      ),
    );

    // Wrapped across lines the way a page sets it, so the check is on the words.
    const flowing = result.text.replace(/\s+/g, " ");
    expect(flowing).toContain("Ana Ribeiro");
    expect(flowing).toContain("subscription flow in React");
    expect(flowing).toContain("Universidade de Lisboa");
  });
});

describe("a CV with a sidebar", () => {
  it("reads each column through before starting the next", async () => {
    const { result } = await read(twoColumnCv());
    const at = (value: string) => result.text.indexOf(value);

    // The failure this exists to prevent: "Experience Skills Loudly React".
    expect(at("Maintained the checkout")).toBeLessThan(at("Skills"));
    expect(at("Skills")).toBeLessThan(at("Languages"));
    expect(result.text).not.toMatch(/Experience\s+Skills/);
  });

  it("keeps a sidebar skill out of the sentence beside it", async () => {
    const { result } = await read(twoColumnCv());

    for (const line of result.text.split("\n")) {
      expect(line.includes("Loudly") && line.includes("React") && line.includes("Skills")).toBe(
        false,
      );
    }
  });
});

describe("a document that is partly a scan", () => {
  it("keeps the page that had text and says which one did not", async () => {
    const { result } = await read(hybridCv());

    expect(result.totalPages).toBe(2);
    expect(result.pages[0]!.characters).toBeGreaterThan(100);
    expect(result.pages[1]!.characters).toBe(0);
    expect(result.text).toContain("subscription flow in React");
    expect(result.warnings.map((warning) => warning.code)).toContain("empty-pages");
  });
});

describe("links", () => {
  it("reads the real addresses out of the file", async () => {
    const { result } = await read(linkedCv());

    // The document says "GitHub"; the address is in the annotation behind it.
    expect(result.links).toContain("https://github.com/anaribeiro");
    expect(result.links).toContain("https://linkedin.com/in/anaribeiro");
  });

  it("does not go looking when nothing in the text could be a link", async () => {
    const { result } = await read(onePageCv());
    expect(result.links).toEqual([]);
  });
});

describe("a document that cannot be read as text", () => {
  it("reports a scan as needing something else, not as a failure", async () => {
    const { result } = await read(imageOnlyPdf());

    expect(result.quality).toBe("poor");
    expect(result.requiresFallback).toBe(true);
    expect(result.totalPages).toBe(1);
  });

  it("treats a font nothing can map the same way", async () => {
    const { result } = await read(compositeFontWithoutMap());

    expect(result.requiresFallback).toBe(true);
    expect(result.text.trim()).toBe("");
  });

  it("names a password as a password", async () => {
    expect(await extractResumePdf(encryptedPdf())).toMatchObject({
      ok: false,
      code: "PASSWORD_PROTECTED",
    });
  });

  it("refuses something that is not a PDF", async () => {
    const notPdf = new Uint8Array(Buffer.from("Dear hiring manager,\n".repeat(20), "utf8"));
    expect(await extractResumePdf(notPdf)).toMatchObject({ ok: false, code: "INVALID_PDF" });
  });

  it("refuses a damaged file rather than throwing", async () => {
    const outcome = await extractResumePdf(corruptPdf());
    expect(outcome.ok).toBe(false);
  });

  it("refuses an empty file", async () => {
    expect(await extractResumePdf(new Uint8Array())).toMatchObject({
      ok: false,
      code: "INVALID_PDF",
    });
  });

  it("refuses a file over the size limit before opening it", async () => {
    const huge = new Uint8Array(PDF_LIMITS.maxFileSize + 1);
    expect(await extractResumePdf(huge)).toMatchObject({ ok: false, code: "FILE_TOO_LARGE" });
  });

  it("refuses a document with more pages than a CV has, before reading them", async () => {
    const outcome = await extractResumePdf(manyPageCv(PDF_LIMITS.maxPages + 1));

    expect(outcome).toMatchObject({
      ok: false,
      code: "TOO_MANY_PAGES",
      totalPages: PDF_LIMITS.maxPages + 1,
    });
  });
});
