import { describe, expect, it } from "vitest";

import { COLUMNS } from "./entries";
import { SAMPLE_ENTRIES } from "@/test/entries";
import { readArchive } from "@/test/zip";
import {
  columnLetter,
  escapeXml,
  toSerialDate,
  toXlsx,
  wrappedLineCount,
  xlsxFilename,
} from "./xlsx";

const workbook = (entries = SAMPLE_ENTRIES) => readArchive(toXlsx(entries));
const sheet = (entries = SAMPLE_ENTRIES) => workbook(entries).get("xl/worksheets/sheet1.xml") ?? "";

describe("columnLetter", () => {
  it("counts the way a spreadsheet does", () => {
    expect([0, 25, 26, 27, 51, 52].map(columnLetter)).toEqual(["A", "Z", "AA", "AB", "AZ", "BA"]);
  });
});

describe("escapeXml", () => {
  it("escapes what XML reserves", () => {
    expect(escapeXml("R&D <team>")).toBe("R&amp;D &lt;team&gt;");
  });

  it("keeps the whitespace a note is written with", () => {
    expect(escapeXml("first line\nsecond line")).toBe("first line\nsecond line");
  });

  it("drops control characters, which XML has no escape for", () => {
    expect(escapeXml(`a${String.fromCharCode(7)}b`)).toBe("ab");
  });
});

describe("wrappedLineCount", () => {
  it("keeps a short value on one line", () => {
    expect(wrappedLineCount("Go", 24)).toBe(1);
    expect(wrappedLineCount("", 24)).toBe(1);
  });

  it("counts the lines a stack needs in the column it is given", () => {
    expect(wrappedLineCount("React · TypeScript · Next.js", 24)).toBe(2);
    expect(wrappedLineCount("React · TypeScript · Next.js", 60)).toBe(1);
  });

  it("counts a line break the writer put there", () => {
    expect(wrappedLineCount("first\nsecond\nthird", 60)).toBe(3);
  });

  it("wraps a word wider than the column inside itself", () => {
    expect(wrappedLineCount("W".repeat(50), 10)).toBeGreaterThan(4);
  });
});

describe("toSerialDate", () => {
  it("puts the epoch where Excel puts it", () => {
    expect(toSerialDate("01/01/1970 00:00")).toBe(25_569);
  });

  it("carries the clock as a fraction of the day", () => {
    expect(toSerialDate("01/01/1970 12:00")).toBe(25_569.5);
  });

  it("refuses anything that is not a stamp", () => {
    expect(toSerialDate("whenever")).toBe(null);
  });
});

describe("toXlsx", () => {
  it("writes the parts Excel opens a workbook by", () => {
    expect([...workbook().keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "docProps/core.xml",
      "docProps/app.xml",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]);
  });

  it("heads the sheet with the shared column list", () => {
    const header = sheet().match(/<row r="1"[^>]*>(.*?)<\/row>/)?.[1] ?? "";
    for (const column of COLUMNS) expect(header).toContain(`<t>${column.label}</t>`);
  });

  it("writes the protocol number as a number, so it sorts as one", () => {
    expect(sheet()).toContain(`<c r="A2"><v>1</v></c>`);
    expect(sheet()).toContain(`<c r="A4"><v>12</v></c>`);
  });

  it("writes the stamp as a date, in the zone it was made in", () => {
    // 21:41 UTC is 23:41 in Berlin, which is what the docket shows.
    expect(sheet()).toContain(`<c r="I2" s="2"><v>${toSerialDate("17/08/2026 23:41")}</v></c>`);
  });

  it("keeps every other column as text, spelling included", () => {
    expect(sheet()).toContain("São Paulo");
    // A quote needs no escape inside a text node, and gets none.
    expect(sheet()).toContain('Loudly "GmbH"');
  });

  it("freezes the header and offers it as a filter", () => {
    const rows = SAMPLE_ENTRIES.length + 1;
    expect(sheet()).toContain(`<pane ySplit="1" topLeftCell="A2"`);
    expect(sheet()).toContain(`<autoFilter ref="A1:J${rows}"/>`);
    expect(sheet()).toContain(`<dimension ref="A1:J${rows}"/>`);
  });

  it("leaves an empty field out rather than writing an empty cell", () => {
    // Row 4 is the entry with no website, no stack, no location and no stage.
    const row = sheet().match(/<row r="4">(.*?)<\/row>/)?.[1] ?? "";
    expect(row).toContain(`<c r="A4">`);
    expect(row).not.toContain(`<c r="C4"`);
    expect(row).not.toContain(`<c r="H4"`);
  });

  it("wraps the stack inside its cell rather than widening the column", () => {
    // Style 3 is the wrapped one; the stack is column E.
    expect(sheet()).toContain(`<c r="E2" s="3" t="inlineStr">`);
    expect(sheet()).toContain(`<c r="J2" s="3" t="inlineStr">`);
  });

  it("states the height a wrapped row needs, because Excel will not work it out", () => {
    // Row 2 wraps: its notes are long. Row 4 has neither notes nor a stack.
    expect(sheet()).toMatch(/<row r="2" ht="\d+" customHeight="1">/);
    expect(sheet()).toContain(`<row r="4">`);
  });

  it("still writes a workbook for an empty register", () => {
    const empty = sheet([]);
    expect(empty).toContain(`<dimension ref="A1:J1"/>`);
    expect(empty).toContain("<t>Company</t>");
  });

  it("declares as many styles as it defines", () => {
    const styles = workbook().get("xl/styles.xml") ?? "";
    const declared = Number(styles.match(/<cellXfs count="(\d+)">/)?.[1]);
    expect(styles.match(/<xf [^>]*xfId="0"/g)?.length).toBe(declared);
  });

  it("names the file by the day it was taken", () => {
    expect(xlsxFilename(new Date("2026-08-19T10:00:00.000Z"))).toBe("docket-2026-08-19.xlsx");
  });
});
