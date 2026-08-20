import { COLUMNS, type ExportEntry, exportFilename } from "./entries";
import { zipArchive, type ZipFile } from "./zip";

/**
 * A real workbook, for the register that is going to be read in Excel.
 *
 * CSV already leaves the building, and for a spreadsheet it leaves badly: every
 * value arrives as text, so the numbers do not sort as numbers, the stamps do
 * not sort as dates, and on a machine whose regional settings disagree with ours
 * the separator itself is wrong. None of that is fixable inside CSV — the format
 * has no types to fix it with.
 *
 * So this writes the format Excel actually speaks. The protocol number arrives
 * as a number, the stamp as a date, the text as text, with the header frozen and
 * filterable. Opening it is a double click; there is no import wizard and no
 * separator to choose.
 */

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

/** Style indexes into `cellXfs` below. Order matters; Excel reads them by position. */
const STYLE = { body: 0, header: 1, stamp: 2, wrapped: 3 } as const;

/** How wide each column opens, in Excel's character units. */
const WIDTHS: Record<string, number> = {
  protocol: 6,
  company: 26,
  website: 24,
  position: 32,
  stack: 24,
  city: 18,
  country: 16,
  stage: 18,
  stampedAt: 18,
  notes: 48,
};

/**
 * The columns that wrap inside the cell rather than widening it.
 *
 * A stack is a list, and a list written on one line makes its column as wide as
 * the longest register in the file — which pushes the stamp off the screen for
 * every other row. Wrapping trades a column nobody can fit for a row that is
 * two lines tall.
 */
const WRAPPED = new Set(["stack", "notes"]);

const ROW_LINE_HEIGHT = 15;

/**
 * A row is only as tall as its tallest wrapped cell, and Excel is told how tall.
 *
 * Excel does not re-measure a wrapped cell when it opens a file; it uses the
 * height the file states, and only recalculates once the cell is edited. A
 * workbook that leaves the height out therefore shows wrapped text clipped to
 * one line until somebody double-clicks the row border, which is exactly the
 * problem wrapping was meant to solve.
 */
const MAX_ROW_LINES = 8;

/**
 * Excel measures column width in characters, so counting them is the same unit
 * the width is written in. It is an estimate — the default font is not
 * monospaced — and it only ever decides a row height, where being a line out is
 * a little whitespace rather than a wrong number.
 */
export function wrappedLineCount(value: string, width: number): number {
  if (!value) return 1;
  const budget = Math.max(1, Math.floor(width) - 1);
  let lines = 0;

  for (const paragraph of value.split(/\r?\n/)) {
    lines += 1;
    let used = 0;

    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const needed = word.length + (used > 0 ? 1 : 0);
      if (used > 0 && used + needed > budget) {
        lines += 1;
        used = word.length;
      } else {
        used += needed;
      }
      // A single word wider than the column wraps inside itself.
      while (used > budget) {
        lines += 1;
        used -= budget;
      }
    }
  }

  return Math.max(1, lines);
}

/**
 * XML rejects most control characters outright, and a register holds free text
 * that a person pasted out of a job ad. Tab, newline and carriage return survive;
 * everything else below 0x20 is dropped rather than escaped, because there is no
 * escape that makes them legal.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 0 -> A, 25 -> Z, 26 -> AA. Enough for far more columns than we have. */
export function columnLetter(index: number): string {
  let out = "";
  let n = index;
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

/**
 * Excel counts days from 1899-12-30, with the clock as a fraction of a day.
 *
 * The parts come from the formatted stamp rather than from the Date, so the
 * serial says what the docket says: an entry stamped at 23:41 in Berlin reads
 * 23:41 in the workbook too, wherever it is opened. A serial carries no
 * timezone, so converting from the instant instead would silently shift half
 * the register by a few hours.
 *
 * Dates before March 1900 come out one day ahead of what Excel would say, because
 * Excel keeps a 29th of February that year that never happened. Nothing is done
 * about it: a job application cannot be stamped in 1900, and correcting for the
 * bug would put every real date one day wrong.
 */
export function toSerialDate(stamp: string): number | null {
  const match = stamp.match(/^(\d{2})\/(\d{2})\/(\d{4})[ ,]+(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, day, month, year, hour, minute] = match;
  const days = Date.UTC(Number(year), Number(month) - 1, Number(day)) / 86_400_000 + 25_569;
  return days + (Number(hour) * 60 + Number(minute)) / 1_440;
}

function cell(reference: string, value: string, key: string): string {
  if (value === "") return "";

  if (key === "protocol") {
    return `<c r="${reference}"><v>${Number(value)}</v></c>`;
  }
  if (key === "stampedAt") {
    const serial = toSerialDate(value);
    // An unparseable stamp still belongs in the file: it goes in as the text it
    // is, rather than being dropped for failing to be a date.
    if (serial !== null) {
      return `<c r="${reference}" s="${STYLE.stamp}"><v>${serial}</v></c>`;
    }
  }

  const style = WRAPPED.has(key) ? ` s="${STYLE.wrapped}"` : "";
  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function sheet(entries: readonly ExportEntry[]): string {
  const lastColumn = columnLetter(COLUMNS.length - 1);
  const lastRow = entries.length + 1;

  const cols = COLUMNS.map(
    (column, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="${WIDTHS[column.key] ?? 18}" customWidth="1"/>`,
  ).join("");

  const header = COLUMNS.map(
    (column, index) =>
      `<c r="${columnLetter(index)}1" s="${STYLE.header}" t="inlineStr"><is><t>${escapeXml(column.label)}</t></is></c>`,
  ).join("");

  const rows = entries.map((entry, row) => {
    const values = COLUMNS.map((column) => column.value(entry));
    const cells = COLUMNS.map((column, index) =>
      cell(`${columnLetter(index)}${row + 2}`, values[index] ?? "", column.key),
    ).join("");

    const lines = Math.min(
      MAX_ROW_LINES,
      Math.max(
        1,
        ...COLUMNS.map((column, index) =>
          WRAPPED.has(column.key)
            ? wrappedLineCount(values[index] ?? "", WIDTHS[column.key] ?? 18)
            : 1,
        ),
      ),
    );
    const height = lines > 1 ? ` ht="${lines * ROW_LINE_HEIGHT}" customHeight="1"` : "";

    return `<row r="${row + 2}"${height}>${cells}</row>`;
  });

  return [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<worksheet xmlns="${NS}">`,
    `<dimension ref="A1:${lastColumn}${lastRow}"/>`,
    // The header stays put while the register scrolls, which is most of why
    // anyone opens a long list in a spreadsheet at all.
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>`,
    `<sheetFormatPr defaultRowHeight="15"/>`,
    `<cols>${cols}</cols>`,
    `<sheetData><row r="1" ht="22" customHeight="1">${header}</row>${rows.join("")}</sheetData>`,
    `<autoFilter ref="A1:${lastColumn}${lastRow}"/>`,
    `</worksheet>`,
  ].join("");
}

/**
 * The first two fills are not decoration: Excel reserves index 0 for "none" and
 * index 1 for "gray125", and misreads every later index if they are missing.
 */
const STYLES = [
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
  `<styleSheet xmlns="${NS}">`,
  `<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy\\ hh:mm"/></numFmts>`,
  `<fonts count="2">`,
  `<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>`,
  `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>`,
  `</fonts>`,
  `<fills count="3">`,
  `<fill><patternFill patternType="none"/></fill>`,
  `<fill><patternFill patternType="gray125"/></fill>`,
  `<fill><patternFill patternType="solid"><fgColor rgb="FF1A1A1A"/><bgColor indexed="64"/></patternFill></fill>`,
  `</fills>`,
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>`,
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`,
  `<cellXfs count="4">`,
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`,
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>`,
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`,
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`,
  `</cellXfs>`,
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>`,
  `</styleSheet>`,
].join("");

export function toXlsx(
  entries: readonly ExportEntry[],
  exportedAt = new Date(),
): Uint8Array<ArrayBuffer> {
  const stamped = exportedAt.toISOString().replace(/\.\d+Z$/, "Z");

  const parts: ZipFile[] = [
    {
      path: "[Content_Types].xml",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
        `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
        `</Types>`,
    },
    {
      path: "_rels/.rels",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="${PKG_NS}">` +
        `<Relationship Id="rId1" Type="${R_NS}/officeDocument" Target="xl/workbook.xml"/>` +
        `<Relationship Id="rId2" Type="${PKG_NS}/metadata/core-properties" Target="docProps/core.xml"/>` +
        `<Relationship Id="rId3" Type="${R_NS}/extended-properties" Target="docProps/app.xml"/>` +
        `</Relationships>`,
    },
    {
      path: "docProps/core.xml",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
        `<dc:title>Docket</dc:title>` +
        `<dcterms:created xsi:type="dcterms:W3CDTF">${stamped}</dcterms:created>` +
        `</cp:coreProperties>`,
    },
    {
      path: "docProps/app.xml",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">` +
        `<Application>Docket</Application>` +
        `</Properties>`,
    },
    {
      path: "xl/workbook.xml",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="${NS}" xmlns:r="${R_NS}">` +
        `<sheets><sheet name="Docket" sheetId="1" r:id="rId1"/></sheets>` +
        `</workbook>`,
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="${PKG_NS}">` +
        `<Relationship Id="rId1" Type="${R_NS}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${R_NS}/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    },
    { path: "xl/styles.xml", data: STYLES },
    { path: "xl/worksheets/sheet1.xml", data: sheet(entries) },
  ];

  return zipArchive(parts);
}

export const xlsxFilename = (today = new Date()) => exportFilename("xlsx", today);
