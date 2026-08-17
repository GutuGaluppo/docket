import { describe, expect, it } from "vitest";

import { parseCsv, parseCsvImport, parseDate, parseImport, parseJsonImport } from "./parse";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes and embedded newlines", () => {
    const csv = 'a,b\n"one","two, still two"\n"say ""hi""","line\nbreak"';
    expect(parseCsv(csv)).toEqual([
      ["a", "b"],
      ["one", "two, still two"],
      ['say "hi"', "line\nbreak"],
    ]);
  });

  it("strips the BOM that Excel insists on", () => {
    expect(parseCsv("﻿a,b\n1,2")[0]).toEqual(["a", "b"]);
  });
});

describe("parseDate", () => {
  it("reads the prototype's dd/mm/yyyy HH:MM", () => {
    const date = parseDate("17/08/2026 13:45");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(7);
    expect(date?.getDate()).toBe(17);
    expect(date?.getHours()).toBe(13);
  });

  it("reads ISO", () => {
    expect(parseDate("2026-08-17T10:00:00.000Z")?.toISOString()).toBe("2026-08-17T10:00:00.000Z");
  });

  it("returns null instead of an Invalid Date", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("someday")).toBeNull();
  });
});

describe("parseJsonImport", () => {
  const artifactExport = JSON.stringify([
    {
      id: "1",
      numero: 1,
      empresa: "Loudly",
      site: "https://www.loudly.com/careers",
      posicao: "Senior Frontend Developer",
      stacks: ["React", "TypeScript"],
      observacoes: "indicação do Pedro",
      cidade: "Berlim",
      pais: "Alemanha",
      criadoEm: "2026-08-01T09:30:00.000Z",
    },
  ]);

  it("reads the prototype's export and canonicalises it", () => {
    const { rows, skipped } = parseJsonImport(artifactExport);
    expect(skipped).toEqual([]);
    expect(rows[0]).toMatchObject({
      company: "Loudly",
      website: "loudly.com",
      position: "Senior Frontend Developer",
      city: "Berlin",
      country: "Germany",
      notes: "indicação do Pedro",
      tags: ["React", "TypeScript"],
    });
    expect(rows[0]?.createdAt?.toISOString()).toBe("2026-08-01T09:30:00.000Z");
  });

  it("reads Docket's own export envelope", () => {
    const own = JSON.stringify({
      exportedAt: "2026-08-17T00:00:00.000Z",
      entries: [{ company: "Neon", position: "DevRel", tags: ["PostgreSQL"] }],
    });
    expect(parseJsonImport(own).rows[0]).toMatchObject({ company: "Neon", position: "DevRel" });
  });

  it("skips rows without a company or a position, and says which", () => {
    const { rows, skipped } = parseJsonImport(
      JSON.stringify([{ empresa: "A" }, { posicao: "B" }, "nope"]),
    );
    expect(rows).toEqual([]);
    expect(skipped).toEqual([
      { line: 1, reason: "no position" },
      { line: 2, reason: "no company" },
      { line: 3, reason: "not an object" },
    ]);
  });

  it("reports malformed JSON instead of throwing", () => {
    expect(parseJsonImport("{oops").skipped[0]?.reason).toBe("not valid JSON");
  });

  it("re-runs the detector when the ad survived but the tags did not", () => {
    const { rows } = parseJsonImport(
      JSON.stringify([
        { empresa: "A", posicao: "B", descricaoVaga: "We use Rust and Kubernetes." },
      ]),
    );
    expect(rows[0]?.tags).toEqual(["Rust", "Kubernetes"]);
  });
});

describe("parseCsvImport", () => {
  const prototypeCsv = [
    '"Nº","Empresa","Site","Posição","Stack","País/Cidade","Data da aplicação","Observações"',
    '"1","Loudly","loudly.com","Frontend Dev","React · TypeScript","Berlim, Alemanha","01/08/2026 09:30","70–80k"',
  ].join("\n");

  it("reads the prototype's CSV, including the merged location column", () => {
    const { rows, skipped } = parseCsvImport(prototypeCsv);
    expect(skipped).toEqual([]);
    expect(rows[0]).toMatchObject({
      company: "Loudly",
      position: "Frontend Dev",
      tags: ["React", "TypeScript"],
      city: "Berlin",
      country: "Germany",
      notes: "70–80k",
    });
  });

  it("points at the file line when a row is unusable", () => {
    const csv = "Empresa,Posição\n,Frontend\nLoudly,";
    const { rows, skipped } = parseCsvImport(csv);
    expect(rows).toEqual([]);
    expect(skipped).toEqual([
      { line: 2, reason: "no company" },
      { line: 3, reason: "no position" },
    ]);
  });
});

describe("parseImport", () => {
  it("picks the parser from the content when the name is missing", () => {
    expect(parseImport('[{"empresa":"A","posicao":"B"}]').rows).toHaveLength(1);
    expect(parseImport("Empresa,Posição\nA,B").rows).toHaveLength(1);
  });
});
