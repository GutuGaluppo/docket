import { describe, expect, it } from "vitest";

import { BENCHMARK_JOB } from "@/test/benchmark";
import { SAMPLE_JOB } from "@/test/resume";

import { hasJobContent, readJobDescription } from "./heuristics";

const analysis = readJobDescription(BENCHMARK_JOB);

const find = (name: string) =>
  analysis.requirements.find(
    (requirement) => requirement.name.toLowerCase() === name.toLowerCase(),
  );

describe("reading a job advert into requirements", () => {
  it("takes the title from the first line", () => {
    expect(analysis.roleTitle).toBe("Senior Frontend Engineer");
  });

  it("finds the technologies the advert names", () => {
    for (const name of ["React", "TypeScript", "Next.js", "GraphQL"]) {
      expect(find(name), `${name} was not read as a requirement`).toBeTruthy();
    }
  });

  it("finds the practices an advert names without naming a tool", () => {
    for (const name of ["Accessibility", "SSR", "Core Web Vitals", "Design System", "Testing"]) {
      expect(find(name), `${name} was not read as a requirement`).toBeTruthy();
    }
  });

  it("asks for each thing once, however many times the advert says it", () => {
    const names = analysis.requirements.map((requirement) => requirement.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);

    // "SSR / SSG" from the stack dictionary and "SSR" from the concept table
    // are one requirement, not two.
    const ssr = analysis.requirements.filter((requirement) =>
      requirement.name.toLowerCase().includes("ssr"),
    );
    expect(ssr).toHaveLength(1);
  });

  it("reads importance from the block the advert put it in", () => {
    expect(find("React")?.importance).toBe("required");
    // "Added bonus" is a real signal and a small one.
    expect(find("Observability")?.importance).toBe("preferred");
  });

  it("carries the other ways of saying each thing", () => {
    expect(find("SSR")?.aliases).toEqual(expect.arrayContaining(["server-side rendering"]));
    expect(find("Accessibility")?.aliases).toEqual(expect.arrayContaining(["screen reader"]));
  });

  it("keeps the sentence each requirement came from", () => {
    // Section 58: "why was React classified as required?" has an answer.
    expect(find("React")?.sourceText.length).toBeGreaterThan(0);
  });

  it("sorts each requirement into the dimension it belongs to", () => {
    expect(find("React")?.category).toBe("skill");
    expect(find("Git")?.category).toBe("tool");
    expect(find("Accessibility")?.category).toBe("practice");
    expect(find("Application performance")?.category).toBe("responsibility");
    expect(find("Fintech")?.category).toBe("domain");
    expect(find("Collaboration")?.category).toBe("soft_skill");
  });

  it("keeps generic hiring vocabulary out of the keywords", () => {
    const words = analysis.keywords.map((keyword) => keyword.text.toLowerCase());

    for (const generic of ["team", "work", "build", "ship", "customer", "people", "added"]) {
      expect(words, `"${generic}" is not job-specific terminology`).not.toContain(generic);
    }
  });

  it("keeps the terminology that makes this role this role", () => {
    const words = analysis.keywords.map((keyword) => keyword.text.toLowerCase());
    expect(words).toEqual(expect.arrayContaining(["react", "typescript", "graphql"]));
  });

  it("reads the level and the field it is written in", () => {
    expect(analysis.inferredSeniority).toBe("senior");
    expect(analysis.domain).toBe("fintech");
  });

  it("reads the same advert the same way twice", () => {
    expect(readJobDescription(BENCHMARK_JOB)).toEqual(analysis);
  });

  it("survives an advert that is one long line", () => {
    const flat = readJobDescription("We need someone who knows React and Postgres. ".repeat(4));
    expect(flat.requirements.length).toBeGreaterThan(0);
  });

  it("reads a shorter advert too", () => {
    const short = readJobDescription(SAMPLE_JOB);
    expect(short.requirements.map((requirement) => requirement.name)).toEqual(
      expect.arrayContaining(["React", "TypeScript", "GraphQL"]),
    );
    expect(
      short.requirements.find((requirement) => requirement.name === "Kubernetes")?.importance,
    ).toBe("preferred");
  });

  it("knows when there is not enough advert to read", () => {
    expect(hasJobContent("Frontend dev wanted")).toBe(false);
    expect(hasJobContent(BENCHMARK_JOB)).toBe(true);
  });
});
