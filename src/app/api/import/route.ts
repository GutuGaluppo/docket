import type { NextRequest } from "next/server";

import { getScope } from "@/server/auth/session";
import { MAX_IMPORT_BYTES, runImport } from "@/server/import/run";

/**
 * The programmatic twin of /docket/import. Accepts either a multipart upload
 * (field `file`) or a raw body of JSON/CSV, and shares the same parser, so the
 * two paths cannot drift apart.
 */
export async function POST(request: NextRequest) {
  const scope = await getScope();
  if (!scope) return Response.json({ error: "Sign in first." }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";
  let text: string;
  let filename = "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "Attach a .csv or .json file as `file`." }, { status: 400 });
    }
    if (file.size > MAX_IMPORT_BYTES) {
      return Response.json({ error: "File is larger than 2 MB." }, { status: 413 });
    }
    text = await file.text();
    filename = file.name;
  } else {
    text = await request.text();
    filename = contentType.includes("json") ? "upload.json" : "upload.csv";
  }

  const result = await runImport(scope, text, filename);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
