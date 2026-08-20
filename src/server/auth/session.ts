import "server-only";

import { cache } from "react";

import { auth } from "@/auth";
import { createScope, type Scope } from "@/server/db/queries/scope";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthenticatedError";
  }
}

/**
 * One session read per request, and the only one anything should call.
 *
 * Sessions are stored, not signed — `session: { strategy: "database" }` — so
 * every `auth()` is a round trip to Postgres. A layout and the page inside it
 * render concurrently, so a single navigation was asking the database who this
 * is two and sometimes three times: once for the shell, once for the scope,
 * once more for whatever the page wanted from the session object.
 *
 * React's `cache` memoises per request, not across them: two callers in one
 * render share an answer, and the next request — or a server action that runs
 * a second later — still reads the session fresh. Nothing about revocation
 * changes.
 */
export const getSession = cache(async () => auth());

/** Reads the session and fails closed. Every server action starts here. */
export async function requireScope(): Promise<Scope> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) throw new UnauthenticatedError();
  return createScope(userId);
}

/** Same, but for render paths that want to show a signed-out state instead. */
export async function getScope(): Promise<Scope | null> {
  const session = await getSession();
  const userId = session?.user?.id;
  return userId ? createScope(userId) : null;
}
