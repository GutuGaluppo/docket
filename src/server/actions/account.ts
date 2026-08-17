"use server";

import { redirect } from "next/navigation";

import { signOut } from "@/auth";
import { deleteAccount } from "@/server/db/queries/account";
import { requireScope, UnauthenticatedError } from "@/server/auth/session";

/**
 * One click, no cooling-off period, no "are you sure" chain beyond the typed
 * confirmation on the page. GDPR art. 17 / LGPD art. 18 — and the promise the
 * landing page makes.
 */
export async function deleteMyAccount(formData: FormData): Promise<{ error: string } | never> {
  let scope;
  try {
    scope = await requireScope();
  } catch (error) {
    if (error instanceof UnauthenticatedError) return { error: "Sign in first." };
    throw error;
  }

  if (formData.get("confirm") !== "DELETE") {
    return { error: "Type DELETE to confirm." };
  }

  await deleteAccount(scope);
  await signOut({ redirect: false });
  redirect("/");
}
