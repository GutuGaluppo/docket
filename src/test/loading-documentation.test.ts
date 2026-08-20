import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Architecture rule 3, kept true by reading both sides.
 *
 * `docs/loading.md` says which region of which section waits on the database.
 * That claim goes stale in exactly two ways — a page moves, or a section starts
 * or stops waiting — and both are cheap to catch: the table names a file, and
 * the file either has a `<Suspense>` boundary or it does not.
 *
 * What is deliberately not checked is whether a boundary is drawn around the
 * right region. A skeleton over a heading passes this test and fails review,
 * which is the correct division of labour: a test can hold a fact, not a
 * judgement.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const doc = readFileSync(join(root, "docs", "loading.md"), "utf8");

type Row = { section: string; page: string; waits: string };

/** The rows of the "What waits, section by section" table. */
function rows(): Row[] {
  return doc
    .split("\n")
    .filter((line) => line.startsWith("| ") && line.includes("`src/app/"))
    .map((line) => {
      const cells = line.split("|").map((cell) => cell.trim());
      return {
        section: cells[1] ?? "",
        page: (cells[2] ?? "").replaceAll("`", ""),
        waits: cells[3] ?? "",
      };
    });
}

describe("docs/loading.md", () => {
  const table = rows();

  it("documents every section", () => {
    // Seven sections wait on something; import waits on nothing.
    expect(table.length).toBeGreaterThanOrEqual(8);
  });

  for (const row of table) {
    it(`${row.section}: the page it names exists`, () => {
      expect(existsSync(join(root, row.page)), `${row.page} is gone`).toBe(true);
    });

    it(`${row.section}: ${row.waits === "—" ? "has no loader" : "has a boundary"}`, () => {
      const source = readFileSync(join(root, row.page), "utf8");
      const hasBoundary = source.includes("<Suspense");

      if (row.waits === "—") {
        expect(
          hasBoundary,
          `${row.page} now waits on something — say what, in docs/loading.md`,
        ).toBe(false);
        return;
      }

      expect(
        hasBoundary,
        `${row.page} is documented as waiting on ${row.waits}, but has no <Suspense> boundary`,
      ).toBe(true);
    });
  }

  /**
   * The page component's own body, from `export default` to the first line that
   * is a bare closing brace. Cutting there keeps the check off the async
   * children below it, which are supposed to await — that is what they are for.
   */
  function pageBody(source: string): string {
    const start = source.indexOf("export default");
    const rest = source.slice(start);
    const end = rest.indexOf("\n}\n");
    return end === -1 ? rest : rest.slice(0, end);
  }

  it("keeps the shell out of the boundaries", () => {
    // The rule the whole document exists for: a page's own path must not touch
    // the database, or every boundary under it is decoration.
    for (const row of table) {
      const body = pageBody(readFileSync(join(root, row.page), "utf8"));
      expect(
        body.includes("await requireScope()"),
        `${row.page} awaits the session in the page itself, so nothing can paint before it`,
      ).toBe(false);
    }
  });
});
