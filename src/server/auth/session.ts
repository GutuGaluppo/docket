import "server-only";

import { auth } from "@/auth";
import { createScope, type Scope } from "@/server/db/queries/scope";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthenticatedError";
  }
}

/** Reads the session and fails closed. Every server action starts here. */
export async function requireScope(): Promise<Scope> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new UnauthenticatedError();
  return createScope(userId);
}

/** Same, but for render paths that want to show a signed-out state instead. */
export async function getScope(): Promise<Scope | null> {
  const session = await auth();
  const userId = session?.user?.id;
  return userId ? createScope(userId) : null;
}
