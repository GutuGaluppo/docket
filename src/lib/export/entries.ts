import { formatStamp, protocolNumber } from "@/lib/format";

/**
 * The row every export reads.
 *
 * Deliberately the listing shape rather than the database row: an export is a
 * copy of the register as it is shown, so a field nobody can see on the docket
 * is not one a file gets to carry out of it. The job description is the case
 * that matters — it is held per entry, it is often the whole ad, and it belongs
 * to the account's own JSON export, not to a table someone mails to a recruiter.
 */
export type ExportEntry = {
  protocolNumber: number;
  company: string;
  website: string | null;
  position: string;
  tags: string[];
  city: string | null;
  country: string | null;
  stage: string | null;
  createdAt: Date;
  timezone: string | null;
  notes: string | null;
};

/**
 * One column list, three formats.
 *
 * CSV, the workbook and the printed table are three renderings of the same
 * register, and the fastest way to make them disagree is to keep three header
 * arrays in three files. Adding a column here adds it everywhere; a format that
 * cannot carry one — the PDF drops notes out of the grid and prints them under
 * the row — says so in its own layout rather than by keeping a private copy.
 */
export type ExportColumn = {
  key: string;
  label: string;
  value: (entry: ExportEntry) => string;
};

/** The stamp as one string, in the zone the entry was made in. */
export function stampedAt(entry: ExportEntry): string {
  const stamp = formatStamp(entry.createdAt, entry.timezone);
  return `${stamp.date} ${stamp.time}`;
}

/** How a stack reads in a single cell. The import parser splits on this. */
export const joinTags = (tags: readonly string[]) => tags.join(" · ");

export const COLUMNS: readonly ExportColumn[] = [
  { key: "protocol", label: "No", value: (e) => protocolNumber(e.protocolNumber) },
  { key: "company", label: "Company", value: (e) => e.company },
  { key: "website", label: "Website", value: (e) => e.website ?? "" },
  { key: "position", label: "Position", value: (e) => e.position },
  { key: "stack", label: "Stack", value: (e) => joinTags(e.tags) },
  { key: "city", label: "City", value: (e) => e.city ?? "" },
  { key: "country", label: "Country", value: (e) => e.country ?? "" },
  { key: "stage", label: "Stage", value: (e) => e.stage ?? "" },
  { key: "stampedAt", label: "Stamped at", value: stampedAt },
  { key: "notes", label: "Notes", value: (e) => e.notes ?? "" },
];

export const EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const exportFilename = (format: ExportFormat, today = new Date()) =>
  `docket-${today.toISOString().slice(0, 10)}.${format}`;
