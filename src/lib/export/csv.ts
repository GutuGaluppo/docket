import { COLUMNS, type ExportEntry, exportFilename } from "./entries";

/** Kept as the name the rest of the app already imports. */
export type CsvEntry = ExportEntry;

const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

/**
 * The portable format: every column quoted, every value a string.
 *
 * This is the one that has to survive being opened by something nobody here
 * chose — a text editor, another tracker's importer, a script. It carries no
 * types and no formatting on purpose. When the destination is known to be
 * Excel, `toXlsx` is the better answer; this one stays boring.
 *
 * BOM included: spreadsheets still guess the encoding wrong without it.
 */
export function toCsv(entries: readonly ExportEntry[]): string {
  const lines = entries.map((entry) => COLUMNS.map((column) => cell(column.value(entry))));
  const header = COLUMNS.map((column) => cell(column.label));

  return `\ufeff${[header, ...lines].map((line) => line.join(",")).join("\n")}`;
}

export const csvFilename = (today = new Date()) => exportFilename("csv", today);
