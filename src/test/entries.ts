import type { ExportEntry } from "@/lib/export/entries";

/**
 * The register the export tests are written against.
 *
 * Deliberately awkward: an accented city, a quote inside a company name, an
 * entry with no location and no stage, and notes long enough to wrap. Every
 * format has to survive the same three rows, which is what stops one of them
 * from being tested on easier data than the others.
 */
export const SAMPLE_ENTRIES: ExportEntry[] = [
  {
    protocolNumber: 1,
    company: 'Loudly "GmbH"',
    website: "loudly.com",
    position: "Senior Frontend Developer",
    tags: ["React", "TypeScript", "Next.js"],
    city: "Berlin",
    country: "Germany",
    stage: "Interviewing",
    createdAt: new Date("2026-08-17T21:41:00.000Z"),
    timezone: "Europe/Berlin",
    notes: "Referred by a former colleague. They asked for a take-home, one week to return it.",
  },
  {
    protocolNumber: 2,
    company: "Café & Co",
    website: null,
    position: "Engenheiro de Software",
    tags: ["Go", "PostgreSQL"],
    city: "São Paulo",
    country: "Brazil",
    stage: "Application sent",
    createdAt: new Date("2026-08-18T13:05:00.000Z"),
    timezone: "America/Sao_Paulo",
    notes: null,
  },
  {
    protocolNumber: 12,
    company: "Remote Labs",
    website: null,
    position: "Platform Engineer",
    tags: [],
    city: null,
    country: null,
    stage: null,
    createdAt: new Date("2026-08-19T09:00:00.000Z"),
    timezone: null,
    notes: null,
  },
];
