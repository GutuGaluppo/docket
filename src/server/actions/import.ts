"use server";

import { revalidatePath } from "next/cache";

import { requireScope, UnauthenticatedError } from "@/server/auth/session";
import type { Scope } from "@/server/db/queries/scope";
import { MAX_IMPORT_BYTES, runImport, type ImportResult } from "@/server/import/run";

export async function importEntries(formData: FormData): Promise<ImportResult> {
  let scope: Scope;
  try {
    scope = await requireScope();
  } catch (error) {
    if (error instanceof UnauthenticatedError) return { ok: false, error: "Sign in first." };
    throw error;
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a .csv or .json file." };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, error: "File is larger than 2 MB. Split it and import in parts." };
  }

  const result = await runImport(scope, await file.text(), file.name);
  if (result.ok) revalidatePath("/docket");
  return result;
}
