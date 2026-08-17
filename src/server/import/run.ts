import "server-only";

import { createEntries } from "@/server/db/queries/applications";
import type { Scope } from "@/server/db/queries/scope";
import { parseImport } from "@/lib/import/parse";

export type ImportResult =
  | { ok: true; imported: number; skipped: Array<{ line: number; reason: string }> }
  | { ok: false; error: string };

export const MAX_IMPORT_BYTES = 2_000_000;

/**
 * Shared by the import screen and POST /api/import so both behave identically.
 *
 * Deliberately NOT a server action: it takes a Scope, and a scope must always
 * be derived from the session on this side of the wire — never accepted as an
 * argument from a caller.
 */
export async function runImport(
  scope: Scope,
  text: string,
  filename: string,
): Promise<ImportResult> {
  if (text.length > MAX_IMPORT_BYTES) {
    return { ok: false, error: "File is larger than 2 MB. Split it and import in parts." };
  }

  const { rows, skipped } = parseImport(text, filename);
  if (rows.length === 0) {
    const reason = skipped[0]?.reason;
    return { ok: false, error: reason ? `Nothing to import: ${reason}.` : "Nothing to import." };
  }

  const { inserted } = await createEntries(
    scope,
    rows.map((row) => ({
      company: row.company,
      website: row.website || null,
      position: row.position,
      city: row.city || null,
      country: row.country || null,
      notes: row.notes || null,
      jobDescription: row.jobDescription || null,
      tags: row.tags,
      ...(row.createdAt ? { createdAt: row.createdAt } : {}),
    })),
  );

  return { ok: true, imported: inserted, skipped };
}
