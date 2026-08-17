import type { NextRequest } from "next/server";

import { csvFilename, toCsv } from "@/lib/export/csv";
import { listEntries } from "@/server/db/queries/applications";
import { getScope } from "@/server/auth/session";

export async function GET(request: NextRequest) {
  const scope = await getScope();
  if (!scope) return new Response("Sign in first.", { status: 401 });

  const search = request.nextUrl.searchParams.get("q") ?? "";
  const entries = await listEntries(scope, { search, sort: "protocolNumber", direction: "asc" });

  return new Response(toCsv(entries), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${csvFilename()}"`,
      "cache-control": "no-store",
    },
  });
}
