import { formatStamp, protocolNumber } from "@/lib/format";

export type CsvEntry = {
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

const HEADER = [
  "No",
  "Company",
  "Website",
  "Position",
  "Stack",
  "City",
  "Country",
  "Stage",
  "Stamped at",
  "Notes",
] as const;

const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

/** BOM included: spreadsheets still guess the encoding wrong without it. */
export function toCsv(entries: readonly CsvEntry[]): string {
  const lines = entries.map((entry) => {
    const stamp = formatStamp(entry.createdAt, entry.timezone);
    return [
      protocolNumber(entry.protocolNumber),
      entry.company,
      entry.website ?? "",
      entry.position,
      entry.tags.join(" · "),
      entry.city ?? "",
      entry.country ?? "",
      entry.stage ?? "",
      `${stamp.date} ${stamp.time}`,
      entry.notes ?? "",
    ].map(cell);
  });

  return `\ufeff${[HEADER.map(cell), ...lines].map((line) => line.join(",")).join("\n")}`;
}

export const csvFilename = (today = new Date()) => `docket-${today.toISOString().slice(0, 10)}.csv`;
