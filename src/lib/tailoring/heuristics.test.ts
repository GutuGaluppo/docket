import { describe, expect, it } from "vitest";

import { SAMPLE_JOB } from "@/test/resume";

import { hasJobContent, readJobDescription } from "./heuristics";

const analysis = readJobDescription(SAMPLE_JOB);

const names = (requirements: { text: string }[]) => requirements.map((entry) => entry.text);

describe("reading a job advert", () => {
  it("takes the title from the first line", () => {
    expect(analysis.roleTitle).toBe("Senior Frontend Engineer");
  });

  it("finds the technologies the advert names", () => {
    expect(names(analysis.requiredSkills)).toEqual(
      expect.arrayContaining(["React", "TypeScript", "GraphQL"]),
    );
  });

  it("keeps a nice-to-have out of the required list", () => {
    // Section 5: an optional skill must not be scored as a failed requirement.
    expect(names(analysis.preferredSkills)).toContain("Kubernetes");
    expect(names(analysis.requiredSkills)).not.toContain("Kubernetes");
  });

  it("collects the work the role is responsible for", () => {
    expect(analysis.responsibilities.length).toBeGreaterThanOrEqual(3);
    expect(names(analysis.responsibilities)).toContain(
      "Own frontend performance across the streaming player",
    );
  });

  it("does not count a length of experience twice", () => {
    expect(names(analysis.experienceRequirements)).toEqual([
      "5+ years of experience building web products",
    ]);
    expect(names(analysis.responsibilities)).not.toContain(
      "5+ years of experience building web products",
    );
  });

  it("ranks the words the advert repeats above the ones it says once", () => {
    const frontend = analysis.keywords.find((keyword) => keyword.text === "frontend");
    expect(frontend?.weight).toBe("primary");
    expect(frontend?.occurrences).toBeGreaterThanOrEqual(3);
    expect(analysis.keywords.every((keyword) => keyword.text.length >= 4)).toBe(true);
  });

  it("reads the level and the field it is written in", () => {
    expect(analysis.inferredSeniority).toBe("senior");
    expect(analysis.domain).toBe("music");
  });

  it("reads the same advert the same way twice", () => {
    expect(readJobDescription(SAMPLE_JOB)).toEqual(analysis);
  });

  it("survives an advert that is one long line", () => {
    const flat = readJobDescription("We need someone who knows React and Postgres. ".repeat(4));
    expect(flat.requiredSkills.length).toBeGreaterThan(0);
  });

  it("knows when there is not enough advert to read", () => {
    expect(hasJobContent("Frontend dev wanted")).toBe(false);
    expect(hasJobContent(SAMPLE_JOB)).toBe(true);
  });
});
