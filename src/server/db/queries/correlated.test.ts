import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { count, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { applications, interviews } from "@/server/db/schema";
import { createScope } from "./scope";

const dialect = new PgDialect();
const rendered = (query: { getSQL: () => ReturnType<typeof sql> }) =>
  dialect.sqlToQuery(query.getSQL()).sql;

/**
 * Architecture rule 2: a correlated subquery names its outer column with the
 * table.
 *
 * Drizzle renders the same fragment two ways. Nested inside another `sql`
 * template, `${applications.id}` comes out as `"applications"."id"`. Used
 * directly as a select field, it comes out as a bare `"id"` — and inside a
 * subquery over a table that has an `id` of its own, that bare name binds to
 * the inner table instead. Nothing errors: the condition simply never matches,
 * and the field is silently null or zero for every row, everywhere, forever.
 *
 * `${applications}."id"` renders the same in both positions, so it is the form
 * this folder uses. The first test demonstrates the failure the rule prevents;
 * the second is the one that fails when someone writes the fragile form again.
 */
describe("correlated subqueries", () => {
  it("renders a bare column reference when the fragment is a select field", () => {
    const fragile = db
      .select({
        next: sql<Date | null>`(
          select min(i.starts_at) from ${interviews} i
           where i.application_id = ${applications.id}
        )`,
      })
      .from(applications)
      .where(createScope("u1").owned(applications.userId));

    // The correlation is lost: inside the subquery, "id" is `interviews.id`.
    expect(rendered(fragile)).toContain('i.application_id = "id"');
    expect(rendered(fragile)).not.toContain('"applications"."id"');
  });

  it("keeps the table on the outer column when written the long way", () => {
    const safe = db
      .select({
        next: sql<Date | null>`(
          select min(i.starts_at) from ${interviews} i
           where i.application_id = ${applications}."id"
        )`,
        total: count(),
      })
      .from(applications)
      .where(createScope("u1").owned(applications.userId));

    expect(rendered(safe)).toContain('i.application_id = "applications"."id"');
  });

  it("is how every query module writes it", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(here).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

    for (const file of files) {
      const source = readFileSync(join(here, file), "utf8");
      // The comment in rejections.ts quotes both forms to explain the rule, so
      // only lines that are actually SQL are checked.
      const offenders = source
        .split("\n")
        .filter((line) => line.includes("${applications.id}") && !line.trimStart().startsWith("*"));

      expect(offenders, `${file} correlates on an unqualified column`).toEqual([]);
    }
  });
});
