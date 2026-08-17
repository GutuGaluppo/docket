import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { applications } from "@/server/db/schema";
import { createScope } from "./scope";

const dialect = new PgDialect();
const render = (clause: ReturnType<ReturnType<typeof createScope>["owned"]>) =>
  dialect.sqlToQuery(clause);

describe("createScope", () => {
  it("refuses to exist without a user", () => {
    expect(() => createScope("")).toThrow();
  });

  it("pins the owner even when no other filter is given", () => {
    const { sql, params } = render(createScope("user-a").owned(applications.userId));
    expect(sql).toContain('"user_id"');
    expect(params).toEqual(["user-a"]);
  });

  it("keeps the owner predicate when other filters are added", () => {
    const { sql, params } = render(
      createScope("user-a").owned(applications.userId, eq(applications.id, "entry-1")),
    );
    expect(sql).toContain('"user_id"');
    expect(sql).toContain('"id"');
    expect(sql.toLowerCase()).toContain(" and ");
    expect(params).toEqual(["user-a", "entry-1"]);
  });

  it("cannot be tricked into dropping the owner by passing undefined filters", () => {
    const { params } = render(createScope("user-a").owned(applications.userId, undefined));
    expect(params).toEqual(["user-a"]);
  });
});

/**
 * Architecture rule 1, enforced by reading the source rather than trusting
 * review: no read, update or delete in this folder may reach a user-owned
 * table without `scope.owned`, and no insert into `applications` may omit the
 * owner. A hand-written `.where(eq(applications.id, id))` fails here.
 *
 * Inserts into `application_tags` and `status_events` are reached through an
 * application id that a scoped insert has just returned, and cascade-delete
 * with their parent row.
 */
function enclosingFunction(source: string, index: number): string {
  const start = source.lastIndexOf("\nexport ", index);
  const end = source.indexOf("\nexport ", index);
  return source.slice(start === -1 ? 0 : start, end === -1 ? source.length : end);
}

describe("every statement is scoped", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const files = readdirSync(here).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("finds the query modules", () => {
    expect(files.length).toBeGreaterThan(1);
  });

  for (const file of files) {
    if (file === "scope.ts") continue;

    it(`${file}: reads, updates and deletes are owner-filtered`, () => {
      const source = readFileSync(join(here, file), "utf8");
      const statements = [...source.matchAll(/await db\s*\.\s*(select|update|delete)\b/g)].map(
        (match) => ({
          index: match.index,
          // Up to the next blank line, not the next ";": a select object can
          // contain semicolons inside inline TypeScript generics.
          text: source.slice(match.index, source.indexOf("\n\n", match.index)),
        }),
      );

      expect(statements.length).toBeGreaterThan(0);
      for (const statement of statements) {
        // `users` is keyed by the user id, so filtering on it is the same
        // guarantee written directly.
        const pins = (code: string) =>
          code.includes("scope.owned(") || /eq\(users\.id, scope\.userId\)/.test(code);

        let scoped = pins(statement.text);
        if (!scoped) {
          // `.where(where)` — follow the local variable back to its assignment
          // inside the same function before calling this a leak.
          const alias = statement.text.match(/\.where\((\w+)\)/)?.[1];
          const fn = enclosingFunction(source, statement.index);
          const assignment = alias
            ? new RegExp(`const\\s+${alias}\\s*=([\\s\\S]*?);`).exec(fn)?.[1]
            : undefined;
          scoped = Boolean(assignment && pins(assignment));
        }

        expect(scoped, `unscoped statement in ${file}:\n${statement.text.slice(0, 240)}`).toBe(
          true,
        );
      }
    });

    it(`${file}: inserts into applications carry the owner`, () => {
      const source = readFileSync(join(here, file), "utf8");
      const inserts = [...source.matchAll(/db\s*\.\s*insert\(applications\)/g)].map((match) =>
        source.slice(match.index, source.indexOf(".returning", match.index)),
      );

      for (const insert of inserts) {
        expect(insert).toContain("userId: scope.userId");
      }
    });
  }
});
