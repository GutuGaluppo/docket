import { describe, expect, it } from "vitest";

import { COLUMNS } from "./entries";
import { SAMPLE_ENTRIES } from "@/test/entries";
import { csvFilename, toCsv } from "./csv";

const rows = (csv: string) => csv.replace(/^\ufeff/, "").split("\n");

describe("toCsv", () => {
  it("starts with a BOM, so a spreadsheet reads it as UTF-8", () => {
    expect(toCsv(SAMPLE_ENTRIES).startsWith("\ufeff")).toBe(true);
  });

  it("writes the shared column list as its header, in order", () => {
    expect(rows(toCsv(SAMPLE_ENTRIES))[0]).toBe(
      COLUMNS.map((column) => `"${column.label}"`).join(","),
    );
  });

  it("doubles a quote that appears inside a value", () => {
    expect(rows(toCsv(SAMPLE_ENTRIES))[1]).toContain('"Loudly ""GmbH"""');
  });

  it("stamps in the zone the entry was made in", () => {
    // 21:41 UTC is 23:41 in Berlin, which is what the docket shows.
    expect(rows(toCsv(SAMPLE_ENTRIES))[1]).toContain('"17/08/2026 23:41"');
  });

  it("keeps empty fields as empty cells rather than dropping them", () => {
    const line = rows(toCsv(SAMPLE_ENTRIES))[3];
    expect(line?.split(",").length).toBe(COLUMNS.length);
    expect(line).toContain('"Remote Labs"');
  });

  it("names the file by the day it was taken", () => {
    expect(csvFilename(new Date("2026-08-19T10:00:00.000Z"))).toBe("docket-2026-08-19.csv");
  });
});
