import { describe, expect, it } from "vitest";

import { judgeExtraction, needsLayoutPass, unreadableShare } from "./quality";
import type { PdfPageContent } from "./types";

/**
 * The judgement that decides whether a model is asked to read the file itself.
 *
 * It is worth testing on made-up numbers rather than on documents: what is
 * being checked is the rule, and the rule has to be arguable in one place
 * rather than discovered from a PDF that happens to sit either side of it.
 */
const page = (number: number, text: string): PdfPageContent => ({
  number,
  text,
  characters: text.replace(/\s/g, "").length,
});

const paragraph = (times: number) =>
  "Frontend engineer building product interfaces in React. ".repeat(times);

describe("judging what came out of a PDF", () => {
  it("calls a full page of a CV good", () => {
    const verdict = judgeExtraction([page(1, paragraph(20))]);

    expect(verdict.quality).toBe("good");
    expect(verdict.requiresFallback).toBe(false);
    expect(verdict.warnings).toEqual([]);
  });

  it("calls a scan poor rather than empty", () => {
    // What a picture of a CV yields: a few characters of stray metadata.
    const verdict = judgeExtraction([page(1, "Scanned by CamScanner")]);

    expect(verdict.quality).toBe("poor");
    expect(verdict.requiresFallback).toBe(true);
  });

  it("does not call a sparse but real CV a scan", () => {
    const verdict = judgeExtraction([page(1, paragraph(6))]);

    expect(verdict.quality).toBe("partial");
    expect(verdict.requiresFallback).toBe(false);
    expect(verdict.warnings.map((warning) => warning.code)).toContain("thin-text");
  });

  it("keeps the text pages of a document that is partly a scan", () => {
    const verdict = judgeExtraction([page(1, paragraph(20)), page(2, "")]);

    expect(verdict.requiresFallback).toBe(false);
    expect(verdict.warnings.map((warning) => warning.code)).toContain("empty-pages");
  });

  it("gives up when most of the pages are pictures", () => {
    const verdict = judgeExtraction([page(1, paragraph(20)), page(2, ""), page(3, "")]);

    expect(verdict.quality).toBe("poor");
    expect(verdict.requiresFallback).toBe(true);
  });

  it("is not fooled by length alone when the glyphs say nothing", () => {
    // A subset font with no map: it has a length, and it is not text.
    const nonsense = "�".repeat(400);
    const verdict = judgeExtraction([page(1, nonsense)]);

    expect(unreadableShare(nonsense)).toBeGreaterThan(0.9);
    expect(verdict.quality).toBe("poor");
    expect(verdict.warnings.map((warning) => warning.code)).toContain("unreadable-glyphs");
  });

  it("treats a document with no pages as nothing to read", () => {
    expect(judgeExtraction([]).requiresFallback).toBe(true);
  });
});

describe("deciding whether to look at the positions", () => {
  it("does not bother for a document that came out in order", () => {
    const flowing = Array.from({ length: 20 }, () => "Built the subscription flow in React").join(
      "\n",
    );

    expect(needsLayoutPass(flowing, "good")).toBe(false);
  });

  it("asks for it when lines hold two runs with a gap between them", () => {
    const sidebar = Array.from({ length: 12 }, () => "Loudly - Frontend Engineer      React").join(
      "\n",
    );

    expect(needsLayoutPass(sidebar, "good")).toBe(true);
  });

  it("asks for it when almost every line is one short word", () => {
    const stacked = [
      "React",
      "TypeScript",
      "CSS",
      "Docker",
      "Git",
      "Vite",
      "Node",
      "Jest",
      "SQL",
    ].join("\n");

    expect(needsLayoutPass(stacked, "good")).toBe(true);
  });

  it("always asks when the text came out thin", () => {
    expect(needsLayoutPass("short", "partial")).toBe(true);
  });

  it("never asks when there is nothing to reorder", () => {
    expect(needsLayoutPass("", "poor")).toBe(false);
  });
});
