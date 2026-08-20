import type { NextRequest } from "next/server";

import { EXPORT_FORMATS, type ExportFormat, exportFilename } from "@/lib/export/entries";
import { APP_VERSION } from "@/lib/version";
import { listEntries } from "@/server/db/queries/applications";
import { getScope } from "@/server/auth/session";
import { toCsv } from "@/lib/export/csv";
import { toPdf } from "@/lib/export/pdf";
import { toXlsx } from "@/lib/export/xlsx";

const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

const isFormat = (value: string): value is ExportFormat =>
  (EXPORT_FORMATS as readonly string[]).includes(value);

/**
 * One route, three renderings of the same query.
 *
 * The register is always read the same way — filtered by the search that was on
 * screen, ordered by protocol number ascending — and only the writing differs.
 * Ordering is the route's decision rather than the caller's on purpose: a
 * register is read in the order it was written, and an export that came out in
 * whatever order the table happened to be sorted in would be a different
 * document every time it was taken.
 *
 * A request with no format is a CSV, which is what this route meant before it
 * had any. A request with a format it does not know is a mistake worth saying
 * out loud rather than quietly answering with the wrong file.
 */
export async function GET(request: NextRequest) {
  const scope = await getScope();
  if (!scope) return new Response("Sign in first.", { status: 401 });

  const requested = request.nextUrl.searchParams.get("format");
  if (requested !== null && !isFormat(requested)) {
    return new Response(`Unknown export format. Choose one of: ${EXPORT_FORMATS.join(", ")}.`, {
      status: 400,
    });
  }
  const format: ExportFormat = requested ?? "csv";

  const search = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 120);
  const entries = await listEntries(scope, { search, sort: "protocolNumber", direction: "asc" });

  const body =
    format === "pdf"
      ? toPdf(entries, { search, edition: APP_VERSION })
      : format === "xlsx"
        ? toXlsx(entries)
        : toCsv(entries);

  return new Response(body, {
    headers: {
      "content-type": CONTENT_TYPES[format],
      "content-disposition": `attachment; filename="${exportFilename(format)}"`,
      "cache-control": "no-store",
    },
  });
}
