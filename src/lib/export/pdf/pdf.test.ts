import { describe, expect, it } from "vitest";

import type { ExportEntry } from "../entries";
import { SAMPLE_ENTRIES } from "@/test/entries";
import { GRID, pdfFilename, toPdf } from "./index";
import { encodeWinAnsi } from "./text";

const exportedAt = new Date("2026-08-19T10:00:00.000Z");
const render = (entries: readonly ExportEntry[] = SAMPLE_ENTRIES, options = {}) =>
  Buffer.from(toPdf(entries, { exportedAt, ...options })).toString("latin1");

/** Enough entries to spill onto a third page. */
const many = (count: number): ExportEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    ...SAMPLE_ENTRIES[2]!,
    protocolNumber: index + 1,
    company: `Company ${index + 1}`,
  }));

describe("the printed grid", () => {
  it("fills the page width exactly", () => {
    // A4 landscape is 842pt wide, with a 40pt margin on each side.
    expect(GRID.reduce((total, column) => total + column.width, 0)).toBe(842 - 80);
  });
});

describe("toPdf", () => {
  it("is a PDF, from its first bytes to its last", () => {
    const file = render();
    expect(file.startsWith("%PDF-1.7")).toBe(true);
    expect(file.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("indexes every object at the byte it actually starts on", () => {
    const file = render();
    const startxref = Number(file.match(/startxref\n(\d+)/)?.[1]);
    expect(startxref).toBeGreaterThan(0);
    expect(file.slice(startxref, startxref + 4)).toBe("xref");

    const offsets = [...file.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((match) =>
      Number(match[1]),
    );
    expect(offsets.length).toBeGreaterThan(6);

    offsets.forEach((offset, index) => {
      expect(file.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`);
    });
  });

  it("declares each content stream at the length it wrote", () => {
    const file = render();
    const streams = [...file.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)];
    expect(streams.length).toBeGreaterThan(0);
    for (const [, declared, body] of streams) {
      expect(body?.length).toBe(Number(declared));
    }
  });

  it("counts its pages in the page tree", () => {
    const file = render();
    const declared = Number(file.match(/\/Type \/Pages .*?\/Count (\d+)/)?.[1]);
    expect(file.match(/\/Type \/Page\b/g)).toHaveLength(declared);
  });

  it("grows a page at a time as the register grows", () => {
    const pages = (count: number) =>
      Number(render(many(count)).match(/\/Type \/Pages .*?\/Count (\d+)/)?.[1]);

    expect(pages(5)).toBe(1);
    expect(pages(120)).toBeGreaterThan(pages(60));
    expect(pages(60)).toBeGreaterThan(1);
  });

  it("prints the header, the count and the page numbers", () => {
    const file = render();
    expect(file).toContain("(Your docket) Tj");
    expect(file).toContain(`(${encodeWinAnsi("3 entries · exported 19/08/2026")}) Tj`);
    expect(file).toContain("(Page 1 of 1) Tj");
  });

  it("says what the register was filtered by, when it was", () => {
    expect(render(SAMPLE_ENTRIES, { search: "react" })).toContain('matching "react"');
  });

  it("stamps the edition it was printed by", () => {
    expect(render(SAMPLE_ENTRIES, { edition: "0.2.0" })).toContain("edition 0.2.0");
  });

  it("writes text in the encoding it declared for the fonts", () => {
    const file = render();
    expect(file).toContain("/Encoding /WinAnsiEncoding");
    expect(file).toContain(`(${encodeWinAnsi("São Paulo, Brazil")}) Tj`);
  });

  it("escapes the parentheses that would otherwise end a string early", () => {
    const tricky: ExportEntry = { ...SAMPLE_ENTRIES[2]!, company: "Acme (EU) \\ Ltd" };
    expect(render([tricky])).toContain("(Acme \\(EU\\) \\\\ Ltd) Tj");
  });

  it("wraps a stack inside its column instead of widening it", () => {
    const stacked: ExportEntry = {
      ...SAMPLE_ENTRIES[2]!,
      tags: ["React", "TypeScript", "Next.js", "PostgreSQL", "Terraform"],
    };
    const file = render([stacked]);
    const stackColumn = GRID.findIndex((column) => column.label === "Stack");
    const x = 40 + GRID.slice(0, stackColumn).reduce((total, c) => total + c.width, 0) + 5;

    // Every line of the cell starts at the same x, one below the other.
    const drawn = [...file.matchAll(new RegExp(`1 0 0 1 ${x} (\\d+(?:\\.\\d+)?) Tm`, "g"))];
    expect(drawn.length).toBeGreaterThan(1);
    expect(file).toContain("React");
    expect(file).toContain("Terraform");
    // Bound to the word before it, so no line can begin with a separator.
    expect(file).toContain("React,");
  });

  it("gives a wrapped row the height its tallest cell needs", () => {
    const one: ExportEntry = { ...SAMPLE_ENTRIES[2]!, tags: ["Go"] };
    const several: ExportEntry = {
      ...SAMPLE_ENTRIES[2]!,
      tags: ["React", "TypeScript", "Next.js", "PostgreSQL", "Terraform"],
    };
    const pages = (entries: ExportEntry[]) =>
      Number(
        render(Array.from({ length: 40 }, () => entries[0]!)).match(
          /\/Type \/Pages .*?\/Count (\d+)/,
        )?.[1],
      );

    // Taller rows mean fewer of them fit, which is the whole trade being made.
    expect(pages([several])).toBeGreaterThan(pages([one]));
  });

  it("prints a note under the entry it belongs to", () => {
    expect(render()).toContain("(Referred by a former colleague.");
  });

  it("says so plainly when there is nothing to print", () => {
    const file = render([]);
    expect(file).toContain("(This register is empty.) Tj");
    expect(file).toContain(`(${encodeWinAnsi("0 entries · exported 19/08/2026")}) Tj`);
  });

  it("holds no byte the file cannot carry", () => {
    // The document is written as Latin-1: a stray character above 0xff would be
    // silently truncated to its low byte, which is how an ellipsis once became
    // an ampersand on every truncated cell. One unbroken word is the case that
    // still has to be cut, now that a cell wraps rather than truncating.
    const wide: ExportEntry = { ...SAMPLE_ENTRIES[0]!, company: "W".repeat(120) };
    const file = render([wide]);
    expect(file).toContain(String.fromCharCode(0x85));
    expect(file).not.toContain("&");
  });

  it("names the file by the day it was taken", () => {
    expect(pdfFilename(exportedAt)).toBe("docket-2026-08-19.pdf");
  });
});
