import "server-only";

import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * A scope is the only legitimate way to reach user data. Query functions take
 * one as their first argument and must build every WHERE clause through
 * `scope.owned()`, which pins the row to the owner. Nothing below
 * `src/server/db` is importable from components (enforced by ESLint), so a
 * missing userId filter cannot slip in from the UI layer.
 */
export type Scope = {
  readonly userId: string;
  /** `owned(table.userId, ...rest)` — the tenant predicate, plus any extras. */
  owned(ownerColumn: PgColumn, ...extra: Array<SQL | undefined>): SQL;
};

export function createScope(userId: string): Scope {
  if (!userId) throw new Error("createScope called without a userId");
  return {
    userId,
    owned(ownerColumn, ...extra) {
      const clause = and(eq(ownerColumn, userId), ...extra);
      // `and` only returns undefined when given no arguments, which cannot
      // happen here — the owner predicate is always present.
      return clause as SQL;
    },
  };
}
