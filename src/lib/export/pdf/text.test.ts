import { describe, expect, it } from "vitest";

import { ELLIPSIS, HELVETICA, HELVETICA_BOLD, encodeWinAnsi, fit, measure, wrap } from "./text";

const codes = (value: string) => [...value].map((character) => character.charCodeAt(0));

describe("the width tables", () => {
  it("cover every printable ASCII character, and no more", () => {
    // 32 to 126 inclusive. A table one short would misplace every glyph past
    // the gap without ever looking broken.
    expect(HELVETICA).toHaveLength(95);
    expect(HELVETICA_BOLD).toHaveLength(95);
  });
});

describe("encodeWinAnsi", () => {
  it("leaves ASCII alone", () => {
    expect(encodeWinAnsi("Senior Frontend Developer")).toBe("Senior Frontend Developer");
  });

  it("keeps the accented letters the encoding already has", () => {
    expect(codes(encodeWinAnsi("São Paulo"))).toEqual(codes("São Paulo"));
  });

  it("maps the typographic characters job ads are full of", () => {
    expect(codes(encodeWinAnsi("“quoted” — and…"))).toEqual([
      0x93, 113, 117, 111, 116, 101, 100, 0x94, 32, 0x97, 32, 97, 110, 100, 0x85,
    ]);
  });

  it("keeps the separator the stack column is joined with", () => {
    expect(codes(encodeWinAnsi("React · Go"))).toEqual([
      82, 101, 97, 99, 116, 32, 0xb7, 32, 71, 111,
    ]);
  });

  it("folds a letter the encoding does not have to the one under it", () => {
    // Latin Extended-A: not in WinAnsi, but "Lodz" is better than "L?dz".
    expect(encodeWinAnsi("Łódź")).toBe("Lódz");
  });

  it("never emits a byte a PDF string cannot hold", () => {
    const encoded = encodeWinAnsi("東京 · Tokyo");
    expect(Math.max(...codes(encoded))).toBeLessThanOrEqual(0xff);
  });

  it("drops control characters rather than printing them", () => {
    expect(encodeWinAnsi(`a${String.fromCharCode(7)}b`)).toBe("ab");
  });
});

describe("measure", () => {
  it("scales with the point size", () => {
    expect(measure("Docket", "regular", 20)).toBeCloseTo(measure("Docket", "regular", 10) * 2, 6);
  });

  it("knows bold is wider than regular", () => {
    expect(measure("Company", "bold", 9)).toBeGreaterThan(measure("Company", "regular", 9));
  });

  it("treats the mono face as monospaced", () => {
    expect(measure("001", "mono", 10)).toBeCloseTo(measure("WWW", "mono", 10), 6);
  });
});

describe("fit", () => {
  it("returns text that already fits, untouched", () => {
    expect(fit("Berlin", "regular", 9, 200)).toBe("Berlin");
  });

  it("cuts to an ellipsis and stays inside the column", () => {
    const cut = fit("Senior Frontend Developer, Platform Team", "regular", 9, 60);
    expect(cut.endsWith(ELLIPSIS)).toBe(true);
    expect(measure(cut, "regular", 9)).toBeLessThanOrEqual(60);
  });

  it("marks the cut with a byte the file can actually hold", () => {
    // U+2026 would be truncated to an ampersand when the document is written
    // out as Latin-1. WinAnsi keeps its ellipsis at 0x85.
    expect(ELLIPSIS.charCodeAt(0)).toBe(0x85);
    const cut = fit("Senior Frontend Developer, Platform Team", "regular", 9, 60);
    expect(Math.max(...codes(cut))).toBeLessThanOrEqual(0xff);
  });

  it("survives a column too narrow for anything at all", () => {
    expect(measure(fit("Berlin", "regular", 9, 1), "regular", 9)).toBeLessThanOrEqual(9);
  });
});

describe("wrap", () => {
  it("breaks on spaces and keeps every line inside the width", () => {
    const lines = wrap("Referred by a former colleague who left last spring", "regular", 8, 90);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(measure(line, "regular", 8)).toBeLessThanOrEqual(90);
    expect(lines.join(" ")).toBe("Referred by a former colleague who left last spring");
  });

  it("cuts a word that is wider than the line rather than letting it run off", () => {
    const [line] = wrap("Kraftfahrzeughaftpflichtversicherung", "regular", 8, 40);
    expect(measure(line ?? "", "regular", 8)).toBeLessThanOrEqual(40);
  });

  it("marks the cut when a note is longer than the lines it is given", () => {
    const lines = wrap("one two three four five six seven eight nine", "regular", 8, 40, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith(ELLIPSIS)).toBe(true);
  });

  it("returns nothing for nothing", () => {
    expect(wrap("   ", "regular", 8, 100)).toEqual([]);
  });
});
