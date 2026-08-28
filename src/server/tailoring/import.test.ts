import { beforeAll, describe, expect, it } from "vitest";

import { resumeElements } from "@/lib/resume/target";
import { normalize } from "@/lib/tailoring/match";
import {
  compositeFontPdf,
  corruptPdf,
  encryptedPdf,
  hybridCv,
  imageOnlyPdf,
  onePageCv,
  twoColumnCv,
} from "@/test/pdf";

import { importFromPdf } from "./import";

/**
 * The import, run the way most deployments will run it: with no model
 * configured, so the classification is the structural one. That path has to
 * produce a whole document — and, more importantly, it has to fail in the right
 * words when the file cannot be read at all.
 */
beforeAll(() => {
  delete process.env.AI_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

const imported = async (bytes: Uint8Array, name = "cv.pdf") => {
  const outcome = await importFromPdf(bytes, name);
  if (!outcome.ok) throw new Error(`expected an import, got ${outcome.reason}`);
  return outcome;
};

describe("a CV with a text layer", () => {
  it("becomes a document with the person and their work in it", async () => {
    const outcome = await imported(onePageCv());
    const { resume } = outcome.result;

    expect(resume.personal.fullName).toBe("Ana Ribeiro");
    expect(resume.personal.email).toBe("ana@example.com");
    expect(resume.experience[0]!.company).toBe("Loudly");
    expect(resume.experience[0]!.bullets.some((bullet) => bullet.text.includes("React"))).toBe(
      true,
    );
    expect(resume.skills[0]!.skills).toContain("TypeScript");
  });

  it("says that the sections were identified structurally", async () => {
    const outcome = await imported(onePageCv());
    expect(outcome.result.source).toBe("heuristic");
    expect(outcome.result.warnings.map((warning) => warning.code)).toContain("no-model");
    expect(outcome.result.requiresReview).toBe(true);
  });

  it("keeps every value traceable to the document it came from", async () => {
    const outcome = await imported(onePageCv());
    const source = normalize(outcome.extractedText);

    for (const element of resumeElements(outcome.result.resume)) {
      if (!element.text.trim()) continue;
      for (const word of normalize(element.text)
        .split(" ")
        .filter((part) => part.length > 3)) {
        expect(source, `"${word}" is not in the document`).toContain(word);
      }
    }
  });

  it("is read through the producer's map when the CV uses an embedded font", async () => {
    // The shape a word processor exports: glyph indices plus a ToUnicode map.
    const outcome = await imported(
      compositeFontPdf(
        "Ana Ribeiro Frontend Engineer ana@example.com Berlin Germany Experience Loudly " +
          "Frontend Engineer 2021 present Built the subscription flow in React and worked on " +
          "frontend performance across the playback surface Marketplace GmbH Junior Developer " +
          "2019 2021 Maintained the checkout and reduced failed payments Education Universidade " +
          "de Lisboa BSc Computer Science Skills React TypeScript CSS Docker Git",
      ),
      "subset.pdf",
    );

    const flowing = outcome.extractedText.replace(/\s+/g, " ");
    expect(flowing).toContain("Ana Ribeiro");
    expect(flowing).toContain("subscription flow in React");
  });
});

describe("a document that is partly a scan", () => {
  it("imports the pages that had text and says which did not", async () => {
    const outcome = await imported(hybridCv(), "hybrid.pdf");

    expect(outcome.result.resume.experience[0]!.company).toContain("Loudly");
    expect(outcome.result.warnings.map((warning) => warning.code)).toContain("scanned");
    expect(outcome.pageCount).toBe(2);
  });
});

describe("what is measured about an import", () => {
  it("records counts and durations, and nothing from the document", async () => {
    const outcome = await imported(onePageCv());

    expect(outcome.timings?.totalPages).toBe(1);
    expect(outcome.timings?.quality).toBeTruthy();
    expect(JSON.stringify(outcome.timings ?? {})).not.toContain("Ana");
  });
});

describe("a CV with a sidebar", () => {
  it("says so, and does not interleave the columns", async () => {
    const outcome = await imported(twoColumnCv());

    expect(outcome.result.warnings.map((warning) => warning.code)).toContain("two-columns");
    expect(outcome.extractedText.indexOf("Maintained the checkout")).toBeLessThan(
      outcome.extractedText.indexOf("Skills"),
    );
  });
});

describe("a file that cannot be turned into a CV", () => {
  it("tells someone their scan needs a model, rather than importing nothing", async () => {
    const outcome = await importFromPdf(imageOnlyPdf(), "scan.pdf");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("NO_TEXT_CONTENT");
  });

  it("names a password as a password", async () => {
    const outcome = await importFromPdf(encryptedPdf(), "locked.pdf");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("PASSWORD_PROTECTED");
  });

  it("refuses a damaged file", async () => {
    const outcome = await importFromPdf(corruptPdf(), "broken.pdf");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("INVALID_PDF");
  });

  it("refuses an empty file", async () => {
    const outcome = await importFromPdf(new Uint8Array(), "nothing.pdf");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("INVALID_PDF");
  });

  it("refuses something that is not a PDF", async () => {
    const outcome = await importFromPdf(
      new Uint8Array(Buffer.from("Dear hiring manager".repeat(30), "utf8")),
      "letter.txt",
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("INVALID_PDF");
  });

  it("treats a page with a line on it as having no text layer, not as a CV", async () => {
    // Two words is not a document. Without a model there is nothing to look at
    // it with, so this is the same answer a scan gets.
    const outcome = await importFromPdf(compositeFontPdf("Hi there"), "note.pdf");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("NO_TEXT_CONTENT");
  });
});
