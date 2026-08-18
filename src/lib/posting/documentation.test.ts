import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BOARD_ADAPTERS } from "./adapters";
import { POSTING_FIELDS } from "./types";
import { BLOCKED_HOSTS } from "./url";

/**
 * Architecture rule 2: docs/entry-form.md describes the entry form and the
 * link pipeline, and it has to stay true. Enforced the same way rule 1 is
 * enforced in src/server/db/queries/scope.test.ts — by reading the source
 * rather than by trusting review.
 *
 * The checks below are chosen for a specific reason. A staleness rule that
 * fires on every cosmetic edit gets satisfied mechanically — someone appends a
 * word until it passes — and then it protects nothing. So this asserts only on
 * facts that are machine-knowable and that genuinely drift: the set of modules,
 * the paths named, the boards, the fields, the refused hosts, and the phases.
 * Prose is deliberately out of scope; it is also the part most worth keeping
 * right, which is why the document says so in its own words.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const DOC = "docs/entry-form.md";

const doc = readFileSync(join(root, DOC), "utf8");

/** Modules that make up the pipeline, plus the components that present it. */
function documentedSurface(): string[] {
  const modules = (folder: string) =>
    readdirSync(join(root, folder))
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) => `${folder}/${file}`);

  return [
    ...modules("src/lib/posting"),
    ...modules("src/server/posting"),
    "src/server/actions/posting.ts",
    "src/components/docket/StampForm.tsx",
    "src/components/docket/PostingImport.tsx",
    "src/components/docket/DraftReview.tsx",
  ];
}

describe(`${DOC} describes the code as it is`, () => {
  it("names every module of the entry form and the link pipeline", () => {
    const surface = documentedSurface();
    // A guard on the guard: if the folders ever move, the loop below would pass
    // by iterating nothing.
    expect(surface.length).toBeGreaterThan(10);

    for (const path of surface) {
      expect(
        doc.includes(path),
        `${path} exists but ${DOC} never mentions it — add it, or say why it is not part of the surface.`,
      ).toBe(true);
    }
  });

  it("names no file that has since been renamed or deleted", () => {
    // Paths as written in prose, tables and mermaid labels.
    const mentioned = new Set(
      [...doc.matchAll(/\bsrc\/[\w./-]+\.(?:ts|tsx|css)\b/g)].map((match) => match[0]),
    );
    expect(mentioned.size).toBeGreaterThan(10);

    for (const path of mentioned) {
      expect(
        existsSync(join(root, path)),
        `${DOC} points at ${path}, which no longer exists.`,
      ).toBe(true);
    }
  });

  it("points at figures that exist", () => {
    // Images are relative to the document, not to the repository root.
    const figures = [...doc.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1] ?? "");
    expect(figures.length).toBeGreaterThan(0);

    for (const figure of figures) {
      expect(
        existsSync(join(root, "docs", figure)),
        `${DOC} shows a figure that is not in the repository: ${figure}`,
      ).toBe(true);
    }
  });

  it("lists every board adapter", () => {
    for (const adapter of BOARD_ADAPTERS) {
      expect(
        doc.includes(adapter.source),
        `Board adapter "${adapter.source}" is not in ${DOC} — phase C changed and the document did not.`,
      ).toBe(true);
    }
  });

  it("lists every field the pipeline can fill", () => {
    // The anatomy table writes each field as `code`, which is what is asserted:
    // a bare word could match incidental prose.
    for (const field of POSTING_FIELDS) {
      expect(
        doc.includes(`\`${field}\``),
        `Field "${field}" is not in the field table in ${DOC}.`,
      ).toBe(true);
    }
  });

  it("lists every host that is refused up front", () => {
    for (const host of BLOCKED_HOSTS) {
      expect(doc.includes(host), `${host} is refused in code but not listed in ${DOC}.`).toBe(true);
    }
  });

  it("keeps a section for each implemented phase", () => {
    for (const phase of ["Phase A", "Phase B", "Phase C", "Phase D"]) {
      expect(doc.includes(phase), `${DOC} lost its ${phase} section.`).toBe(true);
    }
  });

  it("keeps the maintenance rule visible in the document itself", () => {
    // The rule only works if whoever opens the file is told about it before
    // they start editing.
    expect(doc).toMatch(/Maintenance rule/);
    expect(doc).toContain(relative(root, join(here, "documentation.test.ts")).replace(/\\/g, "/"));
  });
});
