import { COLUMNS, type ExportEntry, exportFilename } from "../entries";
import { buildPdf, line, text, type PdfPage } from "./writer";
import { fit, measure, wrap, type Face } from "./text";

/**
 * The register, printed.
 *
 * This is the export that is read rather than processed: attached to a message,
 * filed with an application for benefits, or put in front of somebody who asked
 * what the last three months looked like. That is a different job from CSV and
 * from the workbook, and it is why this one is laid out instead of serialised —
 * it fixes a page size, keeps the header on every page, and numbers the pages,
 * because those are the things a printed table is judged on.
 *
 * A4 landscape, because the register is wider than it is tall.
 */

const PAGE = { width: 842, height: 595, margin: 40 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;

const TITLE_BLOCK = 74;
const HEAD_HEIGHT = 18;
const ROW_HEIGHT = 19;
/** What a second and further line inside a cell costs the row. */
const CELL_LINE = 10;
const NOTE_LINE = 9.5;
const FOOTER_ZONE = 34;

const BODY_SIZE = 8.5;
const NOTE_SIZE = 7.2;
const LABEL_SIZE = 7;
const CELL_PADDING = 5;

/** Notes never take more of the page than the rows they belong to. */
const MAX_NOTE_LINES = 2;

const shared = (key: string) => {
  const column = COLUMNS.find((candidate) => candidate.key === key);
  if (!column) throw new Error(`Unknown export column: ${key}`);
  return column;
};

/**
 * The printed grid, which is the shared column list minus what paper cannot use.
 *
 * The website is dropped because a URL is not clickable on paper and costs more
 * width than any other column; the notes are dropped out of the grid and printed
 * under their own row, the way the docket itself shows them. City and country
 * share one column here for the same reason they share one on screen.
 *
 * `lines` is how many lines a cell may wrap onto before it is cut. A stack is a
 * list, and a list held to one line has to be given the width of the longest
 * one in the register — width taken from every other column on every other row.
 * Wrapping spends a little height instead, which the page has more of. The
 * company and the position wrap for the same reason, one line less, because a
 * truncated company name is a worse thing to hand somebody than a tall row.
 *
 * The widths add up to the content width exactly — the assertion in the tests
 * is what keeps that true when a column is added.
 */
export const GRID: ReadonlyArray<{
  label: string;
  width: number;
  face: Face;
  lines: number;
  value: (entry: ExportEntry) => string;
}> = [
  { ...shared("protocol"), label: "Nº", width: 34, face: "mono", lines: 1 },
  { ...shared("company"), width: 150, face: "bold", lines: 2 },
  { ...shared("position"), width: 176, face: "regular", lines: 2 },
  {
    label: "Stack",
    width: 110,
    face: "regular",
    lines: 3,
    /**
     * A comma here, where every other export uses a middle dot.
     *
     * The dot is separated by a space on both sides, so a wrap can put it at
     * the start of a line — a row reading "· Kubernetes · Docker" under the one
     * above it. A comma binds to the word before it, which is the whole reason
     * lists have been wrapped on commas since long before any of this.
     */
    value: (entry) => entry.tags.join(", "),
  },
  {
    label: "City / country",
    width: 116,
    face: "regular",
    lines: 2,
    value: (entry) => [entry.city, entry.country].filter(Boolean).join(", "),
  },
  { ...shared("stage"), width: 80, face: "regular", lines: 1 },
  { ...shared("stampedAt"), label: "Stamped", width: 96, face: "mono", lines: 1 },
];

const COLUMN_X = GRID.reduce<number[]>((positions, column, index) => {
  positions.push(index === 0 ? PAGE.margin : positions[index - 1]! + GRID[index - 1]!.width);
  return positions;
}, []);

export type PdfOptions = {
  /** The search the register was filtered by, if it was. */
  search?: string;
  exportedAt?: Date;
  /** The edition of the app that printed it, shown in the footer. */
  edition?: string;
};

/** Each cell is a list of lines, because most of them can be more than one. */
type Row = { cells: string[][]; notes: string[]; height: number };

function toRow(entry: ExportEntry): Row {
  const cells = GRID.map((column) => {
    const inner = column.width - CELL_PADDING * 2;
    const value = column.value(entry);
    return column.lines > 1
      ? wrap(value, column.face, BODY_SIZE, inner, column.lines)
      : [fit(value, column.face, BODY_SIZE, inner)];
  });

  const notes = entry.notes
    ? wrap(entry.notes, "regular", NOTE_SIZE, CONTENT_WIDTH - 48, MAX_NOTE_LINES)
    : [];

  // The row is as tall as the cell that needed the most lines.
  const tallest = Math.max(1, ...cells.map((lines) => lines.length));

  return {
    cells,
    notes,
    height:
      ROW_HEIGHT + (tallest - 1) * CELL_LINE + (notes.length ? notes.length * NOTE_LINE + 4 : 0),
  };
}

const capacity = (first: boolean) =>
  PAGE.height - PAGE.margin * 2 - FOOTER_ZONE - HEAD_HEIGHT - (first ? TITLE_BLOCK : 0);

function paginate(rows: readonly Row[]): Row[][] {
  const pages: Row[][] = [];
  let current: Row[] = [];
  let left = capacity(true);

  for (const row of rows) {
    // A row never straddles a page: the note under an entry belongs with it.
    if (row.height > left && current.length > 0) {
      pages.push(current);
      current = [];
      left = capacity(false);
    }
    current.push(row);
    left -= row.height;
  }

  pages.push(current);
  return pages;
}

const right = (value: string, face: Face, size: number, edge: number) =>
  edge - measure(value, face, size);

function titleBlock(top: number, count: number, options: Required<PdfOptions>): string[] {
  const exported = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(options.exportedAt);

  const parts = [
    `${count} ${count === 1 ? "entry" : "entries"}`,
    `exported ${exported}`,
    ...(options.search ? [`matching "${options.search}"`] : []),
  ];

  return [
    text(PAGE.margin, top - 10, fit("PERSONAL REGISTER · KEPT BY YOU", "bold", LABEL_SIZE, 300), {
      face: "bold",
      size: LABEL_SIZE,
      gray: 0.35,
      spacing: 1.4,
    }),
    text(PAGE.margin, top - 36, fit("Your docket", "bold", 22, CONTENT_WIDTH), {
      face: "bold",
      size: 22,
    }),
    text(PAGE.margin, top - 54, fit(parts.join(" · "), "regular", 8.5, CONTENT_WIDTH), {
      size: 8.5,
      gray: 0.35,
    }),
    line(PAGE.margin, top - TITLE_BLOCK + 8, PAGE.width - PAGE.margin, top - TITLE_BLOCK + 8, {
      width: 1.2,
    }),
  ];
}

function head(top: number): string[] {
  const labels = GRID.map((column, index) =>
    text(
      COLUMN_X[index]! + CELL_PADDING,
      top - 12,
      fit(column.label.toUpperCase(), "bold", LABEL_SIZE, column.width - CELL_PADDING),
      { face: "bold", size: LABEL_SIZE, spacing: 0.8 },
    ),
  );

  return [
    ...labels,
    line(PAGE.margin, top - HEAD_HEIGHT, PAGE.width - PAGE.margin, top - HEAD_HEIGHT, {
      width: 1,
    }),
  ];
}

function footer(page: number, total: number, edition: string): string[] {
  const y = PAGE.margin + 10;
  const mark = fit(edition ? `Docket · edition ${edition}` : "Docket", "regular", 7.5, 300);
  const count = fit(`Page ${page} of ${total}`, "mono", 7.5, 120);

  return [
    line(PAGE.margin, PAGE.margin + 22, PAGE.width - PAGE.margin, PAGE.margin + 22, {
      width: 0.5,
      gray: 0.72,
    }),
    text(PAGE.margin, y, mark, { size: 7.5, gray: 0.45 }),
    text(right(count, "mono", 7.5, PAGE.width - PAGE.margin), y, count, {
      face: "mono",
      size: 7.5,
      gray: 0.45,
    }),
  ];
}

function renderPage(
  rows: readonly Row[],
  index: number,
  total: number,
  count: number,
  options: Required<PdfOptions>,
): PdfPage {
  const top = PAGE.height - PAGE.margin;
  const first = index === 0;
  const tableTop = first ? top - TITLE_BLOCK : top;

  const operators: string[] = [
    ...(first ? titleBlock(top, count, options) : []),
    ...head(tableTop),
  ];

  let y = tableTop - HEAD_HEIGHT;

  for (const row of rows) {
    row.cells.forEach((lines, column) => {
      lines.forEach((cellLine, index) => {
        if (!cellLine) return;
        operators.push(
          text(COLUMN_X[column]! + CELL_PADDING, y - 13 - index * CELL_LINE, cellLine, {
            face: GRID[column]!.face,
            size: BODY_SIZE,
            gray: column === 0 ? 0.35 : 0,
          }),
        );
      });
    });

    const notesTop = y - (row.height - (row.notes.length ? row.notes.length * NOTE_LINE + 4 : 0));
    row.notes.forEach((noteLine, noteIndex) => {
      operators.push(
        text(PAGE.margin + 40, notesTop - 4 - noteIndex * NOTE_LINE, noteLine, {
          size: NOTE_SIZE,
          gray: 0.45,
        }),
      );
    });

    y -= row.height;
    operators.push(line(PAGE.margin, y, PAGE.width - PAGE.margin, y, { width: 0.4, gray: 0.78 }));
  }

  if (rows.length === 0) {
    operators.push(
      text(PAGE.margin, y - 20, fit("This register is empty.", "regular", 9, CONTENT_WIDTH), {
        size: 9,
        gray: 0.45,
      }),
    );
  }

  operators.push(...footer(index + 1, total, options.edition));

  return { width: PAGE.width, height: PAGE.height, operators };
}

export function toPdf(
  entries: readonly ExportEntry[],
  options: PdfOptions = {},
): Uint8Array<ArrayBuffer> {
  const settings: Required<PdfOptions> = {
    search: options.search ?? "",
    exportedAt: options.exportedAt ?? new Date(),
    edition: options.edition ?? "",
  };

  const pages = paginate(entries.map(toRow));

  return buildPdf(
    pages.map((rows, index) => renderPage(rows, index, pages.length, entries.length, settings)),
    { title: `Docket — ${entries.length} applications` },
  );
}

export const pdfFilename = (today = new Date()) => exportFilename("pdf", today);
