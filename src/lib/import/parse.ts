import { detectStack } from "@/lib/stack-detector";
import { normalizeDomain } from "@/lib/company/domain";
import { resolveCity } from "@/lib/cities";

export type ImportRow = {
  company: string;
  website: string;
  position: string;
  city: string;
  country: string;
  notes: string;
  jobDescription: string;
  tags: string[];
  createdAt: Date | null;
};

export type ParseResult = {
  rows: ImportRow[];
  /** Rows we could not use, with the reason. Import never fails silently. */
  skipped: Array<{ line: number; reason: string }>;
};

/* -------------------------------------------------------------------------
   CSV — RFC 4180 enough for what spreadsheets and the prototype produce.
------------------------------------------------------------------------- */

export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\ufeff/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char ?? "";
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/* -------------------------------------------------------------------------
   Field mapping. The prototype exported Portuguese keys and headers; Docket's
   own export uses English ones. Both are accepted, so a user can round-trip.
------------------------------------------------------------------------- */

const ALIASES: Record<keyof Omit<ImportRow, "tags" | "createdAt">, string[]> = {
  company: ["company", "empresa"],
  website: ["website", "site", "url"],
  position: ["position", "posicao", "posição", "cargo", "role"],
  city: ["city", "cidade"],
  country: ["country", "pais", "país"],
  notes: ["notes", "observacoes", "observações", "obs"],
  jobDescription: ["jobdescription", "descricaovaga", "descrição da vaga", "descricao da vaga"],
};

const TAG_KEYS = ["tags", "stacks", "stack", "tecnologias"];
const DATE_KEYS = ["createdat", "criadoem", "data da aplicacao", "data da aplicação", "date"];
const LOCATION_KEYS = ["local", "pais/cidade", "país/cidade", "location"];

const key = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^n[º°]?$/, "protocol")
    .trim();

function pick(record: Record<string, unknown>, names: string[]): string {
  for (const name of names) {
    const found = record[key(name)];
    if (typeof found === "string" && found.trim()) return found.trim();
    if (typeof found === "number") return String(found);
  }
  return "";
}

/** Accepts ISO, "dd/mm/yyyy" and "dd/mm/yyyy HH:MM" — the prototype's CSV format. */
export function parseDate(value: string): Date | null {
  const raw = value.trim();
  if (!raw) return null;

  const slashed = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,]+(\d{2}):(\d{2}))?$/);
  if (slashed) {
    const [, d, m, y, h = "12", min = "00"] = slashed;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function splitTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((t): t is string => typeof t === "string" && t.trim() !== "")
      .map((t) => t.trim());
  }
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(/[·;|]|,\s/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function toRow(record: Record<string, unknown>): ImportRow | { error: string } {
  const company = pick(record, ALIASES.company);
  const position = pick(record, ALIASES.position);
  if (!company) return { error: "no company" };
  if (!position) return { error: "no position" };

  let city = pick(record, ALIASES.city);
  let country = pick(record, ALIASES.country);

  // The prototype's CSV merged both into one "City, Country" column.
  if (!city && !country) {
    const location = pick(record, LOCATION_KEYS);
    if (location && location !== "—") {
      const [first = "", second = ""] = location.split(",").map((p) => p.trim());
      city = first;
      country = second;
    }
  }
  if (city && !country) country = resolveCity(city)?.country ?? "";
  const canonical = city ? resolveCity(city) : null;
  if (canonical) {
    city = canonical.city;
    country = canonical.country;
  }

  const jobDescription = pick(record, ALIASES.jobDescription);
  let tags: string[] = [];
  for (const name of TAG_KEYS) {
    const value = record[key(name)];
    if (value !== undefined) {
      tags = splitTags(value);
      if (tags.length > 0) break;
    }
  }
  // Nothing tagged but the ad survived? Re-run the detector over it.
  if (tags.length === 0 && jobDescription) tags = detectStack(jobDescription);

  return {
    company,
    website: normalizeDomain(pick(record, ALIASES.website)),
    position,
    city,
    country,
    notes: pick(record, ALIASES.notes),
    jobDescription,
    tags,
    createdAt: parseDate(pick(record, DATE_KEYS)),
  };
}

function normalizeKeys(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) out[key(k)] = v;
  return out;
}

export function parseJsonImport(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { rows: [], skipped: [{ line: 0, reason: "not valid JSON" }] };
  }

  // Accept both a bare array and Docket's own export envelope.
  const list = Array.isArray(data)
    ? data
    : typeof data === "object" &&
        data !== null &&
        Array.isArray((data as { entries?: unknown }).entries)
      ? ((data as { entries: unknown[] }).entries as unknown[])
      : null;

  if (!list) return { rows: [], skipped: [{ line: 0, reason: "expected an array of entries" }] };

  const rows: ImportRow[] = [];
  const skipped: ParseResult["skipped"] = [];

  list.forEach((item, index) => {
    if (typeof item !== "object" || item === null) {
      skipped.push({ line: index + 1, reason: "not an object" });
      return;
    }
    const result = toRow(normalizeKeys(item as Record<string, unknown>));
    if ("error" in result) skipped.push({ line: index + 1, reason: result.error });
    else rows.push(result);
  });

  return { rows, skipped };
}

export function parseCsvImport(text: string): ParseResult {
  const table = parseCsv(text);
  const [header, ...body] = table;
  if (!header) return { rows: [], skipped: [{ line: 0, reason: "empty file" }] };

  const headers = header.map((h) => key(h));
  const rows: ImportRow[] = [];
  const skipped: ParseResult["skipped"] = [];

  body.forEach((cells, index) => {
    const record: Record<string, unknown> = {};
    headers.forEach((name, i) => {
      record[name] = cells[i] ?? "";
    });
    const result = toRow(record);
    if ("error" in result) skipped.push({ line: index + 2, reason: result.error });
    else rows.push(result);
  });

  return { rows, skipped };
}

/** Picks the parser from the file name or the content itself. */
export function parseImport(text: string, filename = ""): ParseResult {
  const looksJson =
    filename.endsWith(".json") || text.trim().startsWith("[") || text.trim().startsWith("{");
  return looksJson ? parseJsonImport(text) : parseCsvImport(text);
}
